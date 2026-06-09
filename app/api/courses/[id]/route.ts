import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/write";
import { buildSummary } from "@/lib/audit/summaries";

export const runtime = "nodejs";

type CourseUpdateBody = {
  teacherIds?: string[];
  courseDirectorId?: string | null;
  supportingTeacherIds?: string[];
};

async function requireAuth() {
  const jar = await cookies();
  const sessionCookie = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return { error: "Sessão inexistente", status: 401 } as const;
  }

  const auth = getFirebaseAdminAuth();
  const decoded = await auth.verifySessionCookie(sessionCookie, true);
  const uid = decoded.uid;
  const db = getFirebaseAdminDb();

  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    return { error: "Utilizador não encontrado", status: 403 } as const;
  }
  const userData = userSnap.data() as {
    role?: string;
    schoolId?: string;
    nome?: string;
  };

  if (userData.role !== "admin_escolar") {
    return { error: "Apenas o administrador escolar pode gerir cursos", status: 403 } as const;
  }
  if (!userData.schoolId) {
    return { error: "Utilizador sem escola associada", status: 403 } as const;
  }

  return { uid, schoolId: userData.schoolId, nome: userData.nome, db } as const;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { uid, schoolId, db } = auth;
    const { id } = await params;

    const courseSnap = await db.collection("courses").doc(id).get();
    if (!courseSnap.exists) {
      return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });
    }

    const currentData = courseSnap.data() as Record<string, unknown>;
    if (currentData?.schoolId !== schoolId) {
      return NextResponse.json({ error: "Curso não pertence a esta escola" }, { status: 403 });
    }

    const body = (await request.json()) as CourseUpdateBody;
    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.teacherIds !== undefined) {
      updates.teacherIds = body.teacherIds;
    }
    if (body.courseDirectorId !== undefined) {
      updates.courseDirectorId = body.courseDirectorId;
    }
    if (body.supportingTeacherIds !== undefined) {
      updates.supportingTeacherIds = body.supportingTeacherIds;
    }

    await db.collection("courses").doc(id).update(updates);

    const courseNome = (currentData?.name as string) || id;

    const directorChanged =
      body.courseDirectorId !== undefined &&
      body.courseDirectorId !== (currentData?.courseDirectorId as string | undefined);
    const supportingChanged =
      body.supportingTeacherIds !== undefined &&
      JSON.stringify(body.supportingTeacherIds) !== JSON.stringify(currentData?.supportingTeacherIds);
    const teacherIdsChanged =
      body.teacherIds !== undefined &&
      JSON.stringify(body.teacherIds) !== JSON.stringify(currentData?.teacherIds);

    if (directorChanged) {
      writeAuditLog({ schoolId, entityType: "course", entityId: id, entityLabel: courseNome, action: "permission_change", changedBy: uid, summary: buildSummary("course", "permission_change", courseNome), metadata: { field: "courseDirectorId", from: currentData?.courseDirectorId as string | null | undefined, to: body.courseDirectorId } });
    } else {
      const action =
        teacherIdsChanged && (currentData?.teacherIds as string[] | undefined)?.length !== undefined && (body.teacherIds?.length ?? 0) < (currentData?.teacherIds as string[])!.length
          ? "disassociate"
          : teacherIdsChanged && (body.teacherIds?.length ?? 0) > (currentData?.teacherIds as string[] | undefined)?.length!
          ? "associate"
          : "update";
      writeAuditLog({ schoolId, entityType: "course", entityId: id, entityLabel: courseNome, action, changedBy: uid, summary: buildSummary("course", action, courseNome) });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
