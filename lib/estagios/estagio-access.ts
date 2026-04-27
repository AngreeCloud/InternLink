import "server-only";

import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  getEstagioCourseId,
  getUserRoleInEstagio,
  type CourseDoc,
  type EstagioDoc,
  type EstagioRole,
} from "@/lib/estagios/permissions";

export type EstagioAccessSession = {
  uid: string;
  email: string | null;
  displayName: string | null;
  userDoc: Record<string, unknown>;
  estagio: EstagioDoc & Record<string, unknown>;
  course: (CourseDoc & Record<string, unknown>) | null;
  role: EstagioRole;
};

export type EstagioAccessRequirement = "director" | "member" | "signer";

export class EstagioAccessError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function requireSessionUid(): Promise<{ uid: string; email: string | null }> {
  const jar = await cookies();
  const sessionCookie = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    throw new EstagioAccessError(401, "no_session", "Sessão inexistente.");
  }
  try {
    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    return { uid: decoded.uid, email: (decoded.email as string | undefined) ?? null };
  } catch {
    throw new EstagioAccessError(401, "invalid_session", "Sessão inválida ou expirada.");
  }
}

/**
 * Valida a sessão + assert que o utilizador tem acesso ao estágio.
 * Devolve o perfil derivado (role efetiva no estágio, dados do estágio e do curso).
 */
export async function assertEstagioAccess(
  estagioId: string,
  requirement: EstagioAccessRequirement = "member"
): Promise<EstagioAccessSession> {
  if (!estagioId || typeof estagioId !== "string") {
    throw new EstagioAccessError(400, "missing_estagio_id", "Falta o identificador do estágio.");
  }

  const { uid, email } = await requireSessionUid();
  const db = getFirebaseAdminDb();

  const [userSnap, estagioSnap] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("estagios").doc(estagioId).get(),
  ]);

  if (!userSnap.exists) {
    throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
  }

  if (!estagioSnap.exists) {
    throw new EstagioAccessError(404, "estagio_not_found", "Estágio não encontrado.");
  }

  const userDoc = userSnap.data() as Record<string, unknown>;
  const estagioData = estagioSnap.data() as Record<string, unknown>;
  const estagio: EstagioDoc & Record<string, unknown> = {
    id: estagioId,
    ...(estagioData as Record<string, unknown>),
    schoolId: estagioData.schoolId as string | undefined,
    alunoId: estagioData.alunoId as string | undefined,
    alunoCourseId: estagioData.alunoCourseId as string | undefined,
    courseId: estagioData.courseId as string | undefined,
    professorId: estagioData.professorId as string | undefined,
    tutorId: estagioData.tutorId as string | undefined,
  };

  const courseId = getEstagioCourseId(estagio);
  let course: (CourseDoc & Record<string, unknown>) | null = null;
  if (courseId) {
    const courseSnap = await db.collection("courses").doc(courseId).get();
    if (courseSnap.exists) {
      const raw = courseSnap.data() as Record<string, unknown>;
      course = {
        id: courseId,
        ...raw,
        schoolId: raw.schoolId as string | undefined,
        courseDirectorId: raw.courseDirectorId as string | undefined,
        teacherIds: raw.teacherIds as string[] | undefined,
        supportingTeacherIds: raw.supportingTeacherIds as string[] | undefined,
      };
    }
  }

  const role = getUserRoleInEstagio(uid, estagio, course);

  if (!role) {
    // Permitir admin escolar da mesma escola como "diretor" (política do produto).
    const userRole = userDoc.role;
    const userSchoolId = userDoc.schoolId;
    if (
      userRole === "admin_escolar" &&
      estagio.schoolId &&
      userSchoolId === estagio.schoolId
    ) {
      const displayName =
        (userDoc.nome as string | undefined) || (userDoc.displayName as string | undefined) || null;
      return {
        uid,
        email,
        displayName,
        userDoc,
        estagio,
        course,
        role: "diretor",
      };
    }

    throw new EstagioAccessError(403, "not_member", "Sem acesso a este estágio.");
  }

  if (requirement === "director" && role !== "diretor") {
    throw new EstagioAccessError(403, "not_director", "Apenas o Diretor de Curso pode executar esta ação.");
  }

  const displayName =
    (userDoc.nome as string | undefined) || (userDoc.displayName as string | undefined) || null;

  return {
    uid,
    email,
    displayName,
    userDoc,
    estagio,
    course,
    role,
  };
}

export function toApiErrorResponse(error: unknown): { body: { error: string; code: string }; status: number } {
  if (error instanceof EstagioAccessError) {
    return {
      body: { error: error.message, code: error.code },
      status: error.status,
    };
  }
  const message = error instanceof Error ? error.message : "Erro interno.";
  return { body: { error: message, code: "internal_error" }, status: 500 };
}
