import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  EstagioAccessError,
  requireSessionUid,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

type CourseData = {
  schoolId?: string;
  courseDirectorId?: string;
  teacherIds?: string[];
  supportingTeacherIds?: string[];
  nome?: string;
  name?: string;
};

/**
 * GET /api/professor/broadcast-courses
 *
 * Lista as turmas (cursos) onde o professor tem associação (diretor, professor
 * ou professor de apoio), incluindo contagem de estágios por turma.
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

    const courseSnaps = await db
      .collection("courses")
      .where("schoolId", "==", userData.schoolId)
      .get();

    const relevant = courseSnaps.docs.filter((c) => {
      const data = c.data() as CourseData;
      return (
        data.courseDirectorId === uid ||
        (Array.isArray(data.teacherIds) && data.teacherIds.includes(uid)) ||
        (Array.isArray(data.supportingTeacherIds) &&
          data.supportingTeacherIds.includes(uid))
      );
    });

    const counts = await Promise.all(
      relevant.map(async (c) => {
        const [alunoSnap, courseSnap] = await Promise.all([
          db.collection("estagios").where("alunoCourseId", "==", c.id).get(),
          db.collection("estagios").where("courseId", "==", c.id).get(),
        ]);
        const unique = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
        for (const doc of alunoSnap.docs) unique.set(doc.id, doc);
        for (const doc of courseSnap.docs) unique.set(doc.id, doc);
        return unique.size;
      })
    );

    const courses = relevant.map((c, idx) => {
      const data = c.data() as CourseData;
      return {
        id: c.id,
        nome: data.nome ?? data.name ?? c.id,
        estagiosCount: counts[idx] ?? 0,
      };
    });

    return NextResponse.json({ ok: true, courses });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
