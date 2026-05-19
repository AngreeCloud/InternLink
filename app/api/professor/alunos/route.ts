import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { resolveStudentCourseId, resolveStudentCourseName } from "@/lib/course-enrollment";
import {
  EstagioAccessError,
  requireSessionUid,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

type CourseData = {
  nome?: string;
  name?: string;
  schoolId?: string;
  courseDirectorId?: string;
  teacherIds?: string[];
  supportingTeacherIds?: string[];
};

type StudentData = {
  nome?: string;
  email?: string;
  courseId?: string;
  curso?: string;
  localidade?: string;
  telefone?: string;
  dataNascimento?: string;
  createdAt?: { toDate?: () => Date };
  encarregadoId?: string | null;
};

type StudentStatus = "Estágio ativo" | "Estágio concluído" | "Sem estágio associado";

const ACTIVE_INTERNSHIP_STATES = new Set([
  "ativo",
  "em_curso",
  "em curso",
  "iniciado",
  "aberto",
]);

const COMPLETED_INTERNSHIP_STATES = new Set([
  "concluido",
  "concluído",
  "finalizado",
  "terminado",
  "encerrado",
]);

function normalizeState(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

export async function GET() {
  try {
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
    }

    const userData = userSnap.data() as { role?: string; schoolId?: string; nome?: string };
    if (userData.role !== "professor") {
      throw new EstagioAccessError(403, "not_professor", "Apenas professores podem aceder.");
    }
    if (!userData.schoolId) {
      throw new EstagioAccessError(403, "no_school", "Professor sem escola associada.");
    }

    const [coursesSnap, studentsSnap, estagiosSnap, schoolSnap] = await Promise.all([
      db.collection("courses").where("schoolId", "==", userData.schoolId).get(),
      db
        .collection("users")
        .where("schoolId", "==", userData.schoolId)
        .where("role", "==", "aluno")
        .where("estado", "==", "ativo")
        .get(),
      db.collection("estagios").where("schoolId", "==", userData.schoolId).get(),
      db.collection("schools").doc(userData.schoolId).get(),
    ]);

    const relevantCourses = coursesSnap.docs.filter((courseSnap) => {
      const data = courseSnap.data() as CourseData;
      return (
        data.courseDirectorId === uid ||
        (Array.isArray(data.teacherIds) && data.teacherIds.includes(uid)) ||
        (Array.isArray(data.supportingTeacherIds) && data.supportingTeacherIds.includes(uid))
      );
    });

    const courseRefs = relevantCourses.map((courseSnap) => {
      const data = courseSnap.data() as CourseData;
      return {
        id: courseSnap.id,
        name: data.nome || data.name || courseSnap.id,
      };
    });

    const allowedCourseIds = new Set(courseRefs.map((course) => course.id));

    const statusByStudentId = new Map<string, StudentStatus>();
    for (const estagioSnap of estagiosSnap.docs) {
      const data = estagioSnap.data() as { alunoId?: string; estado?: string; estadoEstagio?: string };
      const studentId = (data.alunoId || "").trim();
      if (!studentId) continue;

      const state = normalizeState(data.estadoEstagio || data.estado);
      if (ACTIVE_INTERNSHIP_STATES.has(state)) {
        statusByStudentId.set(studentId, "Estágio ativo");
        continue;
      }

      if (COMPLETED_INTERNSHIP_STATES.has(state) && statusByStudentId.get(studentId) !== "Estágio ativo") {
        statusByStudentId.set(studentId, "Estágio concluído");
      }
    }

    const studentsTemp = studentsSnap.docs
      .map((studentSnap) => {
        const data = studentSnap.data() as StudentData;
        const resolvedCourseId = resolveStudentCourseId(
          {
            courseId: data.courseId || null,
            curso: data.curso || null,
          },
          courseRefs,
        );
        if (!resolvedCourseId || !allowedCourseIds.has(resolvedCourseId)) {
          return null;
        }
        const resolvedCourseName = resolveStudentCourseName(
          resolvedCourseId,
          courseRefs,
          data.curso || "",
        );

        return {
          id: studentSnap.id,
          nome: data.nome || "—",
          email: data.email || "—",
          courseId: resolvedCourseId || data.courseId || "",
          curso: resolvedCourseName,
          localidade: data.localidade || "—",
          telefone: data.telefone || "—",
          dataNascimento: data.dataNascimento || "—",
          createdAt:
            data.createdAt?.toDate?.()?.toLocaleDateString("pt-PT") ||
            "—",
          encarregadoId: data.encarregadoId || null,
          internshipStatus: statusByStudentId.get(studentSnap.id) || "Sem estágio associado",
        };
      })
      .filter((student): student is NonNullable<typeof student> => Boolean(student))
      .sort((left, right) => left.nome.localeCompare(right.nome, "pt-PT"));

    // Fetch EE names
    const eeIds = Array.from(new Set(studentsTemp.map(s => s.encarregadoId).filter(Boolean) as string[]));
    const eeNames = new Map<string, string>();
    
    // Process in chunks of 30 due to Firestore "in" filter limits
    for (let i = 0; i < eeIds.length; i += 30) {
      const chunk = eeIds.slice(i, i + 30);
      const eesSnap = await db.collection("users").where("__name__", "in", chunk).get();
      for (const eeDoc of eesSnap.docs) {
        eeNames.set(eeDoc.id, (eeDoc.data() as { nome?: string }).nome || "—");
      }
    }

    const students = studentsTemp.map(s => ({
      ...s,
      encarregadoNome: s.encarregadoId ? eeNames.get(s.encarregadoId) || "—" : null
    }));

    const courses = courseRefs.sort((left, right) => left.name.localeCompare(right.name, "pt-PT"));

    return NextResponse.json({
      ok: true,
      uid,
      schoolId: userData.schoolId,
      schoolName: schoolSnap.exists ? ((schoolSnap.data() as { name?: string; shortName?: string }).name || (schoolSnap.data() as { shortName?: string }).shortName || "") : "",
      courses,
      students,
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
