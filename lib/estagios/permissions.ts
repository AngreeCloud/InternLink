/**
 * Permissões para o módulo de Gestão de Estágios.
 *
 * O "Diretor de Curso" é derivado — não é uma role do sistema. Um professor é
 * considerado Diretor de Curso de um determinado estágio se o curso do aluno
 * (identificado em `estagio.alunoCourseId` ou `estagio.courseId`) tiver
 * `courseDirectorId == user.uid`. Isto é calculado por estágio, não globalmente.
 */

export type EstagioRole = "diretor" | "professor" | "tutor" | "aluno";

export type CourseDoc = {
  id: string;
  schoolId?: string;
  courseDirectorId?: string;
  teacherIds?: string[];
  supportingTeacherIds?: string[];
};

export type EstagioDoc = {
  id: string;
  schoolId?: string;
  alunoId?: string;
  alunoCourseId?: string;
  courseId?: string;
  professorId?: string;
  tutorId?: string;
};

export function getEstagioCourseId(estagio: EstagioDoc): string | undefined {
  return estagio.alunoCourseId || estagio.courseId;
}

/**
 * Determina a role que um utilizador tem num estágio concreto.
 * Devolve `null` se o utilizador não pertencer ao estágio.
 */
export function getUserRoleInEstagio(
  uid: string,
  estagio: EstagioDoc,
  course?: CourseDoc | null
): EstagioRole | null {
  if (!uid || !estagio) return null;

  // Diretor tem prioridade sobre professor se for ambos.
  if (course && course.courseDirectorId && course.courseDirectorId === uid) {
    const courseId = getEstagioCourseId(estagio);
    if (course.id === courseId) {
      return "diretor";
    }
  }

  if (estagio.professorId === uid) return "professor";
  if (estagio.tutorId === uid) return "tutor";
  if (estagio.alunoId === uid) return "aluno";
  return null;
}

export function isDirector(
  uid: string,
  estagio: EstagioDoc,
  course?: CourseDoc | null
): boolean {
  return getUserRoleInEstagio(uid, estagio, course) === "diretor";
}

export type DocumentoEstagio = {
  accessRoles?: EstagioRole[];
  accessUserIds?: string[];
  signatureRoles?: EstagioRole[];
  signatureUserIds?: string[];
};

export function canReadDoc(
  uid: string,
  role: EstagioRole | null,
  doc: DocumentoEstagio
): boolean {
  if (!role) return false;
  if (role === "diretor") return true; // Diretor vê tudo.
  const rolesOk = Array.isArray(doc.accessRoles) && doc.accessRoles.includes(role);
  const uidOk = Array.isArray(doc.accessUserIds) && doc.accessUserIds.includes(uid);
  return Boolean(rolesOk || uidOk);
}

export function canSignDoc(
  uid: string,
  role: EstagioRole | null,
  doc: DocumentoEstagio
): boolean {
  if (!role) return false;
  const rolesOk = Array.isArray(doc.signatureRoles) && doc.signatureRoles.includes(role);
  const uidOk = Array.isArray(doc.signatureUserIds) && doc.signatureUserIds.includes(uid);
  return Boolean(rolesOk || uidOk);
}

export function isDirectorRole(role: EstagioRole | null): boolean {
  return role === "diretor";
}
