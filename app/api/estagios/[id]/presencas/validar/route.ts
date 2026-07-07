import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import { checkPresencasCanValidate } from "@/lib/estagios/presencas";
import { checkShouldTransitionToConcluido } from "@/lib/estagios/estagio-status";
import { writeAuditLog } from "@/lib/audit/write";
import { buildSummary } from "@/lib/audit/summaries";

export const runtime = "nodejs";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await assertEstagioAccess(id, "member");
    const db = getFirebaseAdminDb();

    const role = session.role;
    if (role !== "tutor") {
      return NextResponse.json(
        { error: "Apenas o tutor pode validar presenças.", code: "not_tutor" },
        { status: 403 }
      );
    }

    const estagioRef = db.collection("estagios").doc(id);
    const estagioSnap = await estagioRef.get();
    if (!estagioSnap.exists) {
      return NextResponse.json(
        { error: "Estágio não encontrado.", code: "not_found" },
        { status: 404 }
      );
    }

    const estagio = estagioSnap.data() as Record<string, unknown>;

    if (estagio.presencasValidatedByTutor === true) {
      return NextResponse.json(
        { error: "Presenças já validadas.", code: "already_validated" },
        { status: 422 }
      );
    }

    const totalHoras = Number(estagio.totalHoras ?? 0) || 0;
    const horasDiarias = Number(estagio.horasDiarias ?? estagio.horasPorDia ?? 0) || 0;

    // Sum presencas
    const presencasSnap = await estagioRef.collection("presencas").get();
    let totalRealizado = 0;
    presencasSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      totalRealizado += Number(data.hoursWorked ?? 0) || 0;
    });

    const check = checkPresencasCanValidate(totalRealizado, totalHoras, horasDiarias);
    if (!check.podeValidar) {
      return NextResponse.json(
        { error: check.motivo || "Condições de validação não satisfeitas.", code: "cannot_validate" },
        { status: 422 }
      );
    }

    // Check if termino antecipado is approved
    const taSnap = await estagioRef
      .collection("termino_antecipado")
      .where("estado", "==", "aprovado")
      .limit(1)
      .get();
    const hasTerminoAprovado = !taSnap.empty;

    const shouldConcluir = checkShouldTransitionToConcluido({
      totalHoras,
      totalRealizado,
      hasTerminoAprovado,
    });

    const tutorNome =
      (estagio.tutorNome as string) || session.displayName || "Tutor";

    const updates: Record<string, unknown> = {
      presencasValidatedByTutor: true,
      presencasValidatedAt: FieldValue.serverTimestamp(),
      presencasValidatedBy: session.uid,
      presencasValidatedByName: tutorNome,
      updatedAt: FieldValue.serverTimestamp(),
    };

    let estadoTransicionado = false;
    if (shouldConcluir) {
      updates.estadoEstagio = "concluido";
      updates.estado = "concluido";
      estadoTransicionado = true;
    }

    await estagioRef.update(updates);

    const schoolId = session.estagio.schoolId as string;
    const estTitulo = (estagio.titulo as string) || id;
    writeAuditLog({
      schoolId,
      entityType: "estagio",
      entityId: id,
      entityLabel: estTitulo,
      action: "update",
      changedBy: session.uid,
      summary: `Presenças validadas pelo tutor (${totalRealizado}h/${totalHoras}h)`,
      metadata: { totalRealizado, totalHoras, estadoTransicionado },
    });

    return NextResponse.json({
      ok: true,
      estadoTransicionado,
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
