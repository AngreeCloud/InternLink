import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  requireSessionUid,
  EstagioAccessError,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import { writeAuditLog } from "@/lib/audit/write";
import type { CursoDatasAvaliacao, DatasAvaliacao } from "@/lib/avaliacao/types";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await context.params;
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();

    // Check user is course director or school admin
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
    }
    const userData = userSnap.data() as { role?: string; schoolId?: string };

    const courseSnap = await db.collection("courses").doc(courseId).get();
    if (!courseSnap.exists) {
      throw new EstagioAccessError(404, "course_not_found", "Curso não encontrado.");
    }
    const courseData = courseSnap.data() as Record<string, unknown>;

    const isDirector = courseData.courseDirectorId === uid;
    const isSchoolAdmin =
      userData.role === "admin_escolar" &&
      userData.schoolId === courseData.schoolId;

    if (!isDirector && !isSchoolAdmin) {
      throw new EstagioAccessError(
        403,
        "not_director",
        "Apenas o diretor de curso ou administrador escolar pode configurar as datas de avaliação."
      );
    }

    const body = (await request.json()) as {
      disponibilidadePreenchimento?: string;
      publicacaoNotaFinal?: string;
      autoArquivarNaPublicacao?: boolean;
      overridesPorEstagio?: Record<string, { disponibilidadePreenchimento: string }>;
    };

    const schoolId = courseData.schoolId as string;
    const datasRef = db
      .collection("courses")
      .doc(courseId)
      .collection("settings")
      .doc("avaliacaoDatas");

    const existingSnap = await datasRef.get();
    const existing = existingSnap.exists
      ? (existingSnap.data() as CursoDatasAvaliacao)
      : null;

    const updates: Partial<CursoDatasAvaliacao> = {
      cursoId: courseId,
      schoolId,
      datas: {
        disponibilidadePreenchimento:
          body.disponibilidadePreenchimento ??
          existing?.datas?.disponibilidadePreenchimento ??
          "",
        publicacaoNotaFinal:
          body.publicacaoNotaFinal ??
          existing?.datas?.publicacaoNotaFinal ??
          "",
      },
    };

    if (body.autoArquivarNaPublicacao !== undefined) {
      updates.autoArquivarNaPublicacao = body.autoArquivarNaPublicacao;
    }

    if (body.overridesPorEstagio !== undefined) {
      updates.overridesPorEstagio = body.overridesPorEstagio;
    }

    await datasRef.set({ ...existing, ...updates, updatedAt: FieldValue.serverTimestamp() });

    writeAuditLog({
      schoolId,
      entityType: "course",
      entityId: courseId,
      entityLabel: (courseData.name as string) || courseId,
      action: "update_settings",
      changedBy: uid,
      summary: `Datas de avaliação do curso atualizadas.`,
      metadata: {
        disponibilidadePreenchimento: updates.datas?.disponibilidadePreenchimento,
        publicacaoNotaFinal: updates.datas?.publicacaoNotaFinal,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
