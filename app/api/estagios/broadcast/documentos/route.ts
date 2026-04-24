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
  courseId: string;
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

    if (!body.courseId || typeof body.courseId !== "string") {
      throw new EstagioAccessError(400, "missing_course_id", "Indique o curso de destino.");
    }
    const nome = (body.nome ?? "").trim();
    if (!nome) {
      throw new EstagioAccessError(400, "missing_name", "Nome do documento é obrigatório.");
    }
    if (!body.currentFileUrl || !body.currentFilePath) {
      throw new EstagioAccessError(
        400,
        "missing_file",
        "PDF em falta (currentFileUrl/currentFilePath)."
      );
    }

    const db = getFirebaseAdminDb();

    // Confirma que o utilizador é professor e está associado ao curso.
    const [userSnap, courseSnap] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("courses").doc(body.courseId).get(),
    ]);
    if (!userSnap.exists) {
      throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
    }
    if (!courseSnap.exists) {
      throw new EstagioAccessError(404, "course_not_found", "Curso não encontrado.");
    }
    const userData = userSnap.data() as { role?: string; schoolId?: string };
    if (userData.role !== "professor") {
      throw new EstagioAccessError(403, "not_professor", "Apenas professores podem difundir.");
    }
    const courseData = courseSnap.data() as {
      schoolId?: string;
      courseDirectorId?: string;
      teacherIds?: string[];
      supportingTeacherIds?: string[];
    };
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
        "Não está associado a este curso."
      );
    }

    // Carrega todos os estágios desta turma onde o utilizador é o professor
    // orientador, diretor do curso ou admin escolar.
    const estagiosSnap = await db
      .collection("estagios")
      .where("alunoCourseId", "==", body.courseId)
      .get();

    const now = FieldValue.serverTimestamp();
    const createdIds: Array<{ estagioId: string; docId: string }> = [];
    const skipped: Array<{ estagioId: string; reason: string }> = [];

    for (const estagioSnap of estagiosSnap.docs) {
      const estagioData = estagioSnap.data() as {
        professorId?: string;
        schoolId?: string;
      };
      const canWrite =
        estagioData.professorId === uid || isDirector /* director manages all in course */;
      if (!canWrite) {
        skipped.push({ estagioId: estagioSnap.id, reason: "not_manager" });
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
        estado: "aguarda_assinatura",
        prazoAssinatura:
          body.prazoAssinatura === null
            ? null
            : typeof body.prazoAssinatura === "string"
              ? body.prazoAssinatura
              : null,
        accessRoles: sanitizeRoles(body.accessRoles),
        accessUserIds: [],
        signatureRoles: sanitizeRoles(body.signatureRoles),
        signatureUserIds: [],
        signatureBoxes: sanitizeBoxes(body.signatureBoxes),
        currentVersion: 1,
        currentFileUrl: body.currentFileUrl,
        currentFilePath: body.currentFilePath,
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
        broadcastCourseId: body.courseId,
      });

      await docRef.collection("versoes").doc("v1").set({
        version: 1,
        fileUrl: body.currentFileUrl,
        filePath: body.currentFilePath,
        uploadedAt: now,
        uploadedBy: uid,
        notes: `Difundido pelo curso ${body.courseId}.`,
      });

      createdIds.push({ estagioId: estagioSnap.id, docId: docRef.id });
    }

    return NextResponse.json({
      ok: true,
      total: estagiosSnap.size,
      created: createdIds.length,
      skipped: skipped.length,
      details: { createdIds, skipped },
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
