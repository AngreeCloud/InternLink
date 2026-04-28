import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  EstagioAccessError,
  requireSessionUid,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import type { EstagioRole } from "@/lib/estagios/permissions";

export const runtime = "nodejs";

type SignatureBox = {
  id: string;
  role?: EstagioRole;
  userId?: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  label?: string;
};

type BroadcastBody = {
  courseId?: string;
  courseIds?: string[];
  nome: string;
  descricao?: string;
  categoria?: string;
  templateCode?: string;
  pinned?: boolean;
  prazoAssinatura?: string | null;
  accessRoles?: EstagioRole[];
  signatureRoles?: EstagioRole[];
  signatureBoxes?: SignatureBox[];
  currentFileUrl: string;
  currentFilePath: string;
  fileMimeType?: string;
  fileExtension?: string;
};

const ALLOWED_ROLES: EstagioRole[] = ["diretor", "professor", "tutor", "aluno"];

function sanitizeRoles(roles?: EstagioRole[]): EstagioRole[] {
  if (!Array.isArray(roles)) return [];
  return roles.filter((r) => ALLOWED_ROLES.includes(r));
}

function sanitizeBoxes(boxes?: SignatureBox[]): SignatureBox[] {
  if (!Array.isArray(boxes)) return [];
  return boxes
    .filter((box) => {
      if (!box || typeof box !== "object") return false;
      if (!Number.isFinite(box.page) || box.page < 1) return false;
      if (!Number.isFinite(box.x) || !Number.isFinite(box.y)) return false;
      if (!Number.isFinite(box.width) || !Number.isFinite(box.height)) return false;
      return true;
    })
    .map((box) => ({
      id: String(box.id ?? ""),
      role: box.role && ALLOWED_ROLES.includes(box.role) ? box.role : undefined,
      userId: typeof box.userId === "string" ? box.userId : undefined,
      page: Math.floor(box.page),
      x: Math.max(0, Math.min(1, box.x)),
      y: Math.max(0, Math.min(1, box.y)),
      width: Math.max(0, Math.min(1, box.width)),
      height: Math.max(0, Math.min(1, box.height)),
      color: typeof box.color === "string" ? box.color : undefined,
      label: typeof box.label === "string" ? box.label : undefined,
    }));
}

/**
 * POST /api/estagios/broadcast/documentos
 *
 * Difunde um documento para TODOS os estágios de um curso (turma) em que o
 * professor autenticado seja orientador ou Diretor de Curso. Útil para
 * carregar o mesmo modelo (ex.: Regulamento Interno) em massa, mantendo as
 * mesmas caixas de assinatura e permissões.
 *
 * Retorna o número de estágios processados e a lista de IDs criados.
 */
export async function POST(request: Request) {
  try {
    const { uid } = await requireSessionUid();
    const body = (await request.json()) as BroadcastBody;

    const courseIds = Array.from(
      new Set(
        [
          ...(Array.isArray(body.courseIds) ? body.courseIds : []),
          ...(typeof body.courseId === "string" ? [body.courseId] : []),
        ]
          .map((id) => (typeof id === "string" ? id.trim() : ""))
          .filter((id) => id.length > 0)
      )
    );

    if (courseIds.length === 0) {
      throw new EstagioAccessError(
        400,
        "missing_course_id",
        "Indique pelo menos um curso de destino."
      );
    }

    const nome = (body.nome ?? "").trim();
    if (!nome) {
      throw new EstagioAccessError(400, "missing_name", "Nome do documento é obrigatório.");
    }
    if (!body.currentFileUrl || !body.currentFilePath) {
      throw new EstagioAccessError(
        400,
        "missing_file",
        "Ficheiro em falta (currentFileUrl/currentFilePath)."
      );
    }

    const db = getFirebaseAdminDb();

    // Confirma que o utilizador é professor.
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
    }

    const userData = userSnap.data() as { role?: string; schoolId?: string };
    if (userData.role !== "professor") {
      throw new EstagioAccessError(403, "not_professor", "Apenas professores podem difundir.");
    }

    const accessRoles = sanitizeRoles(body.accessRoles);
    const signatureRoles = sanitizeRoles(body.signatureRoles);
    const signatureBoxes = sanitizeBoxes(body.signatureBoxes);
    const hasSignatureFlow = signatureRoles.length > 0 && signatureBoxes.length > 0;
    const fileMimeType = typeof body.fileMimeType === "string" ? body.fileMimeType : "";
    const fileExtension =
      typeof body.fileExtension === "string" ? body.fileExtension.toLowerCase() : "";

    const now = FieldValue.serverTimestamp();
    const createdIds: Array<{ estagioId: string; docId: string }> = [];
    const skipped: Array<{ estagioId: string; reason: string }> = [];

    const perCourse: Array<{ courseId: string; total: number; created: number; skipped: number }> = [];

    for (const courseId of courseIds) {
      const courseSnap = await db.collection("courses").doc(courseId).get();
      if (!courseSnap.exists) {
        throw new EstagioAccessError(
          404,
          "course_not_found",
          `Curso não encontrado: ${courseId}`
        );
      }

      const courseData = courseSnap.data() as {
        schoolId?: string;
        courseDirectorId?: string;
        teacherIds?: string[];
        supportingTeacherIds?: string[];
      };

      if (courseData.schoolId && userData.schoolId && courseData.schoolId !== userData.schoolId) {
        throw new EstagioAccessError(
          403,
          "cross_school_course",
          `O curso ${courseId} pertence a outra escola.`
        );
      }

      const isDirector = courseData.courseDirectorId === uid;
      const isTeacher =
        Array.isArray(courseData.teacherIds) && courseData.teacherIds.includes(uid);
      const isSupporting =
        Array.isArray(courseData.supportingTeacherIds) &&
        courseData.supportingTeacherIds.includes(uid);
      if (!isDirector && !isTeacher && !isSupporting) {
        throw new EstagioAccessError(
          403,
          "not_associated",
          `Não está associado ao curso ${courseId}.`
        );
      }

      const [alunoSnap, estagioCourseSnap] = await Promise.all([
        db.collection("estagios").where("alunoCourseId", "==", courseId).get(),
        db.collection("estagios").where("courseId", "==", courseId).get(),
      ]);

      const estagiosMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      for (const doc of alunoSnap.docs) estagiosMap.set(doc.id, doc);
      for (const doc of estagioCourseSnap.docs) estagiosMap.set(doc.id, doc);
      const estagiosList = Array.from(estagiosMap.values());

      let createdInCourse = 0;
      let skippedInCourse = 0;

      for (const estagioSnap of estagiosList) {
        const estagioData = estagioSnap.data() as {
          professorId?: string;
          schoolId?: string;
        };
        const canWrite =
          estagioData.professorId === uid || isDirector /* director manages all in course */;
        if (!canWrite) {
          skipped.push({ estagioId: estagioSnap.id, reason: "not_manager" });
          skippedInCourse += 1;
          continue;
        }

        const docsCol = estagioSnap.ref.collection("documentos");
        const existing = await docsCol.get();
        let maxOrdem = 0;
        existing.forEach((d) => {
          const ordem = Number((d.data() as { ordem?: number })?.ordem ?? 0);
          if (ordem > maxOrdem) maxOrdem = ordem;
        });

        const docRef = docsCol.doc();
        await docRef.set({
          nome,
          descricao: typeof body.descricao === "string" ? body.descricao : "",
          categoria: typeof body.categoria === "string" ? body.categoria : "outros",
          templateCode: typeof body.templateCode === "string" ? body.templateCode : null,
          ordem: maxOrdem + 1,
          pinned: Boolean(body.pinned),
          pinnedAt: body.pinned ? now : null,
          estado: hasSignatureFlow ? "aguarda_assinatura" : "pendente",
          prazoAssinatura:
            body.prazoAssinatura === null
              ? null
              : typeof body.prazoAssinatura === "string"
                ? body.prazoAssinatura
                : null,
          accessRoles,
          accessUserIds: [],
          signatureRoles: hasSignatureFlow ? signatureRoles : [],
          signatureUserIds: [],
          signatureBoxes: hasSignatureFlow ? signatureBoxes : [],
          currentVersion: 1,
          currentFileUrl: body.currentFileUrl,
          currentFilePath: body.currentFilePath,
          fileMimeType,
          fileExtension,
          createdAt: now,
          updatedAt: now,
          createdBy: uid,
          broadcastCourseId: courseId,
        });

        await docRef.collection("versoes").doc("v1").set({
          version: 1,
          fileUrl: body.currentFileUrl,
          filePath: body.currentFilePath,
          uploadedAt: now,
          uploadedBy: uid,
          notes: `Difundido pelo curso ${courseId}.`,
        });

        createdIds.push({ estagioId: estagioSnap.id, docId: docRef.id });
        createdInCourse += 1;
      }

      perCourse.push({
        courseId,
        total: estagiosMap.size,
        created: createdInCourse,
        skipped: skippedInCourse,
      });
    }

    const total = perCourse.reduce((sum, item) => sum + item.total, 0);

    return NextResponse.json({
      ok: true,
      courseIds,
      total,
      created: createdIds.length,
      skipped: skipped.length,
      perCourse,
      details: { createdIds, skipped },
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
