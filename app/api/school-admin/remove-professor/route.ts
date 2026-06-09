import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/write";
import { buildSummary } from "@/lib/audit/summaries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const sessionCookie = jar.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sessão inexistente" }, { status: 401 });
    }

    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;
    const db = getFirebaseAdminDb();

    const adminSnap = await db.collection("users").doc(uid).get();
    if (!adminSnap.exists) {
      return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 403 });
    }

    const adminData = adminSnap.data() as {
      role?: string;
      schoolId?: string;
      nome?: string;
    };

    if (adminData.role !== "admin_escolar") {
      return NextResponse.json({ error: "Apenas o administrador escolar pode remover professores" }, { status: 403 });
    }
    if (!adminData.schoolId) {
      return NextResponse.json({ error: "Utilizador sem escola associada" }, { status: 403 });
    }

    const schoolId = adminData.schoolId;
    const { professorId } = (await request.json()) as { professorId: string };

    if (!professorId) {
      return NextResponse.json({ error: "professorId é obrigatório" }, { status: 400 });
    }

    // Verificar que o professor pertence a esta escola
    const professorSnap = await db.collection("users").doc(professorId).get();
    if (!professorSnap.exists) {
      return NextResponse.json({ error: "Professor não encontrado" }, { status: 404 });
    }

    const professorData = professorSnap.data() as {
      nome?: string;
      schoolId?: string;
    };
    if (professorData.schoolId !== schoolId) {
      return NextResponse.json({ error: "Professor não pertence a esta escola" }, { status: 403 });
    }

    const professorNome = professorData.nome || professorId;

    // Remover de todos os cursos da escola
    const coursesSnap = await db
      .collection("courses")
      .where("schoolId", "==", schoolId)
      .where("teacherIds", "array-contains", professorId)
      .get();

    for (const courseDoc of coursesSnap.docs) {
      const courseData = courseDoc.data() as {
        name?: string;
        courseDirectorId?: string;
        supportingTeacherIds?: string[];
        teacherIds?: string[];
      };
      const courseNome = courseData.name || courseDoc.id;

      const updatedTeacherIds = (courseData.teacherIds || []).filter((id) => id !== professorId);
      const updatedSupportingIds = (courseData.supportingTeacherIds || []).filter((id) => id !== professorId);
      const updatedDirectorId =
        courseData.courseDirectorId === professorId ? null : courseData.courseDirectorId;

      await db.collection("courses").doc(courseDoc.id).update({
        teacherIds: updatedTeacherIds,
        courseDirectorId: updatedDirectorId,
        supportingTeacherIds: updatedSupportingIds,
        updatedAt: FieldValue.serverTimestamp(),
      });

      writeAuditLog({
        schoolId,
        entityType: "course",
        entityId: courseDoc.id,
        entityLabel: courseNome,
        action: "disassociate",
        changedBy: uid,
        summary: buildSummary("course", "disassociate", courseNome),
        metadata: { removedProfessorId: professorId, removedProfessorName: professorNome },
      });
    }

    // Marcar utilizador como removido
    await db.collection("users").doc(professorId).update({
      estado: "removido",
      schoolId: null,
      courseId: null,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: uid,
    });

    writeAuditLog({
      schoolId,
      entityType: "user",
      entityId: professorId,
      entityLabel: professorNome,
      action: "update",
      changedBy: uid,
      summary: buildSummary("user", "update", professorNome),
      metadata: { field: "estado", from: "ativo", to: "removido" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
