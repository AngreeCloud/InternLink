import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  EstagioAccessError,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import { writeAuditLog } from "@/lib/audit/write";
import type { NotasTutor } from "@/lib/avaliacao/types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: estagioId } = await context.params;
    const session = await assertEstagioAccess(estagioId, "member");

    if (session.role !== "professor" && session.role !== "diretor") {
      throw new EstagioAccessError(
        403,
        "not_professor",
        "Apenas o professor orientador ou diretor de curso pode repor a avaliação."
      );
    }

    const db = getFirebaseAdminDb();

    // Get current tutor doc for reset count
    const tutorRef = db
      .collection("estagios")
      .doc(estagioId)
      .collection("avaliacao")
      .doc("tutor");
    const tutorSnap = await tutorRef.get();
    if (!tutorSnap.exists) {
      throw new EstagioAccessError(
        400,
        "no_avaliacao",
        "A avaliação do tutor não existe para ser reposta."
      );
    }

    const tutorData = tutorSnap.data() as NotasTutor;
    const currentResetCount = tutorData.resetCount ?? 0;

    // Reset tutor evaluation: clear scores and signatures, keep reset count
    await tutorRef.set({
      parametros: {},
      estado: "pendente" as const,
      resetCount: currentResetCount + 1,
      assinaturaTutor: null,
      assinaturaProfessor: null,
      assinadoEm: null,
    });

    // Delete professor final grade if exists
    const professorRef = db
      .collection("estagios")
      .doc(estagioId)
      .collection("avaliacao")
      .doc("professor");
    const professorSnap = await professorRef.get();
    if (professorSnap.exists) {
      await professorRef.delete();
    }

    // Audit log
    const estagioLabel =
      (session.estagio.titulo as string) ||
      (session.estagio.id as string) ||
      estagioId;
    writeAuditLog({
      schoolId: session.estagio.schoolId ?? "",
      entityType: "avaliacao",
      entityId: estagioId,
      entityLabel: estagioLabel,
      action: "reset_avaliacao",
      changedBy: session.uid,
      summary: `Avaliação do tutor reposta (reset #${currentResetCount + 1}) por ${session.displayName || session.uid}: ${estagioLabel}`,
      metadata: { resetCount: currentResetCount + 1 },
    });

    return NextResponse.json({ ok: true, resetCount: currentResetCount + 1 });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
