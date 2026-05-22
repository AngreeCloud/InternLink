import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse, EstagioAccessError } from "@/lib/estagios/estagio-access";
import type { TerminoAntecipado } from "@/lib/estagios/termino-antecipado";
import {
  buildTerminoAntecipadoNotification,
} from "@/lib/notifications/termino-antecipado-notifications";

export const runtime = "nodejs";

type Body = {
  motivoRecusa: string;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await context.params;
    const session = await assertEstagioAccess(id, "member");

    if (session.role !== "tutor") {
      throw new EstagioAccessError(403, "not_tutor", "Apenas o tutor pode recusar o pedido.");
    }

    const body = (await request.json()) as Body;

    if (!body.motivoRecusa || typeof body.motivoRecusa !== "string" || body.motivoRecusa.trim().length === 0) {
      throw new EstagioAccessError(400, "missing_motivo", "O motivo da recusa é obrigatório.");
    }

    const db = getFirebaseAdminDb();
    const ref = db.collection("estagios").doc(id).collection("termino_antecipado").doc(docId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new EstagioAccessError(404, "not_found", "Pedido não encontrado.");
    }

    const pedido = { id: snap.id, ...snap.data() } as TerminoAntecipado;

    if (pedido.estado !== "pendente") {
      throw new EstagioAccessError(409, "invalid_state", `O pedido não está pendente (estado atual: ${pedido.estado}).`);
    }

    const motivo = body.motivoRecusa.trim();

    // Update the document
    await ref.update({
      estado: "recusado",
      motivoRecusa: motivo,
      respondidoAt: FieldValue.serverTimestamp(),
    });

    // Create notifications
    const notifsCol = db.collection("estagios").doc(id).collection("notifications");
    const batch = db.batch();
    const tutorNome = session.displayName || "O tutor";

    // Notify aluno
    const an = buildTerminoAntecipadoNotification(pedido.alunoId, docId, id, {
      kind: "tutor_rejected",
      tutorNome,
      motivo,
    });
    batch.set(notifsCol.doc(), { ...an, createdAt: FieldValue.serverTimestamp() });

    // Notify professor
    if (pedido.professorOrientadorId) {
      const pn = buildTerminoAntecipadoNotification(pedido.professorOrientadorId, docId, id, {
        kind: "tutor_rejected",
        tutorNome,
        motivo,
      });
      batch.set(notifsCol.doc(), { ...pn, createdAt: FieldValue.serverTimestamp() });
    }

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
