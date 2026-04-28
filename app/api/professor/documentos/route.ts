import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  EstagioAccessError,
  requireSessionUid,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import {
  getEstagioCourseId,
  getUserRoleInEstagio,
  type CourseDoc,
  type EstagioDoc,
  type EstagioRole,
} from "@/lib/estagios/permissions";

export const runtime = "nodejs";

type CourseData = {
  schoolId?: string;
  courseDirectorId?: string;
  teacherIds?: string[];
  supportingTeacherIds?: string[];
  nome?: string;
  name?: string;
};

type EstagioData = {
  titulo?: string;
  title?: string;
  alunoNome?: string;
  empresa?: string;
  entidadeAcolhimento?: string;
  courseNome?: string;
  professorId?: string;
  tutorId?: string;
  alunoId?: string;
  alunoCourseId?: string;
  courseId?: string;
  schoolId?: string;
};

type DocumentoData = {
  nome?: string;
  descricao?: string;
  categoria?: string;
  estado?: string;
  currentVersion?: number;
  currentFileUrl?: string;
  currentFilePath?: string;
  broadcastCourseId?: string;
  fileMimeType?: string;
  fileExtension?: string;
  accessRoles?: EstagioRole[];
  signatureRoles?: EstagioRole[];
  signatureBoxes?: unknown[];
  createdAt?: { toMillis?: () => number };
  updatedAt?: { toMillis?: () => number };
};

type AccessibleEstagio = {
  id: string;
  titulo: string;
  alunoNome: string;
  empresa: string;
  courseNome: string;
  role: EstagioRole;
};

function timestampToMillis(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const timestamp = value as { toMillis?: () => number; _seconds?: number; seconds?: number };
  if (typeof timestamp.toMillis === "function") {
    return timestamp.toMillis();
  }
  if (typeof timestamp._seconds === "number") {
    return timestamp._seconds * 1000;
  }
  if (typeof timestamp.seconds === "number") {
    return timestamp.seconds * 1000;
  }
  return null;
}

function inferExtension(path: string, mimeType: string): string {
  const match = path.match(/\.([a-z0-9]{2,8})(?:\?|$)/i);
  if (match?.[1]) return match[1].toLowerCase();

  const normalizedMime = mimeType.toLowerCase();
  if (normalizedMime === "application/pdf") return "pdf";
  if (normalizedMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "docx";
  }
  if (normalizedMime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return "xlsx";
  }
  return "";
}

/**
 * GET /api/professor/documentos
 *
 * Lista os documentos de estágios a que o professor tem acesso (como professor
 * orientador ou diretor de curso), já enriquecidos com metadados do estágio.
 */
export async function GET() {
  try {
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
    }

    const userData = userSnap.data() as { role?: string; schoolId?: string };
    if (userData.role !== "professor") {
      throw new EstagioAccessError(403, "not_professor", "Apenas professores podem aceder.");
    }
    if (!userData.schoolId) {
      throw new EstagioAccessError(403, "no_school", "Professor sem escola associada.");
    }

    const [coursesSnap, estagiosSnap] = await Promise.all([
      db.collection("courses").where("schoolId", "==", userData.schoolId).get(),
      db.collection("estagios").where("schoolId", "==", userData.schoolId).get(),
    ]);

    const courseMap = new Map<string, CourseDoc>();
    for (const course of coursesSnap.docs) {
      const data = course.data() as CourseData;
      courseMap.set(course.id, {
        id: course.id,
        schoolId: data.schoolId,
        courseDirectorId: data.courseDirectorId,
        teacherIds: Array.isArray(data.teacherIds) ? data.teacherIds : [],
        supportingTeacherIds: Array.isArray(data.supportingTeacherIds)
          ? data.supportingTeacherIds
          : [],
      });
    }

    const accessible: Array<{ snap: FirebaseFirestore.QueryDocumentSnapshot; estagio: AccessibleEstagio }> = [];

    for (const estagioSnap of estagiosSnap.docs) {
      const raw = estagioSnap.data() as EstagioData;
      const estagioDoc: EstagioDoc = {
        id: estagioSnap.id,
        schoolId: raw.schoolId,
        alunoId: raw.alunoId,
        alunoCourseId: raw.alunoCourseId,
        courseId: raw.courseId,
        professorId: raw.professorId,
        tutorId: raw.tutorId,
      };
      const courseId = getEstagioCourseId(estagioDoc);
      const course = courseId ? courseMap.get(courseId) ?? null : null;
      const role = getUserRoleInEstagio(uid, estagioDoc, course);
      if (!role) continue;

      accessible.push({
        snap: estagioSnap,
        estagio: {
          id: estagioSnap.id,
          titulo: (raw.titulo as string | undefined) ?? (raw.title as string | undefined) ?? "—",
          alunoNome: (raw.alunoNome as string | undefined) ?? "—",
          empresa:
            (raw.entidadeAcolhimento as string | undefined) ??
            (raw.empresa as string | undefined) ??
            "—",
          courseNome: (raw.courseNome as string | undefined) ?? "—",
          role,
        },
      });
    }

    const docsByEstagio = await Promise.all(
      accessible.map(async ({ snap, estagio }) => {
        const docsSnap = await snap.ref.collection("documentos").get();
        const rows = docsSnap.docs
          .map((docSnap) => {
            const data = docSnap.data() as DocumentoData;
            const currentFileUrl = typeof data.currentFileUrl === "string" ? data.currentFileUrl : "";
            if (!currentFileUrl) return null;

            const currentFilePath =
              typeof data.currentFilePath === "string" ? data.currentFilePath : "";
            const fileMimeType =
              typeof data.fileMimeType === "string" ? data.fileMimeType : "";
            const fileExtension =
              typeof data.fileExtension === "string"
                ? data.fileExtension.toLowerCase()
                : inferExtension(currentFilePath || currentFileUrl, fileMimeType);

            return {
              id: docSnap.id,
              estagioId: estagio.id,
              estagioTitulo: estagio.titulo,
              alunoNome: estagio.alunoNome,
              empresa: estagio.empresa,
              courseNome: estagio.courseNome,
              role: estagio.role,
              nome: typeof data.nome === "string" ? data.nome : "Documento sem título",
              descricao: typeof data.descricao === "string" ? data.descricao : "",
              categoria: typeof data.categoria === "string" ? data.categoria : "outros",
              estado: typeof data.estado === "string" ? data.estado : "pendente",
              currentVersion:
                typeof data.currentVersion === "number" ? data.currentVersion : 0,
              currentFileUrl,
              currentFilePath,
              fileMimeType,
              fileExtension,
              broadcastCourseId:
                typeof data.broadcastCourseId === "string" ? data.broadcastCourseId : "",
              accessRoles: Array.isArray(data.accessRoles) ? data.accessRoles : [],
              signatureRoles: Array.isArray(data.signatureRoles) ? data.signatureRoles : [],
              signatureBoxes: Array.isArray(data.signatureBoxes) ? data.signatureBoxes : [],
              createdAt: timestampToMillis(data.createdAt),
              updatedAt: timestampToMillis(data.updatedAt),
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        return rows;
      })
    );

    const items = docsByEstagio
      .flat()
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

    const estagios = accessible
      .map(({ estagio }) => estagio)
      .filter((e) => e.role === "diretor" || e.role === "professor")
      .sort((a, b) => {
        const aluno = a.alunoNome.localeCompare(b.alunoNome, "pt-PT");
        if (aluno !== 0) return aluno;
        return a.titulo.localeCompare(b.titulo, "pt-PT");
      });

    return NextResponse.json({
      ok: true,
      uid,
      schoolId: userData.schoolId,
      items,
      estagios,
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
