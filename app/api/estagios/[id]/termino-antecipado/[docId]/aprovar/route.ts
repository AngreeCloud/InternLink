import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse, EstagioAccessError } from "@/lib/estagios/estagio-access";
import { validateApproval, type TerminoAntecipado } from "@/lib/estagios/termino-antecipado";
import { toIsoDate } from "@/lib/estagios/workdays";
import {
  buildTerminoAntecipadoNotification,
} from "@/lib/notifications/termino-antecipado-notifications";

export const runtime = "nodejs";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await context.params;
    const session = await assertEstagioAccess(id, "member");

    if (session.role !== "tutor") {
      throw new EstagioAccessError(403, "not_tutor", "Apenas o tutor pode aprovar o pedido.");
    }

    const db = getFirebaseAdminDb();
    const ref = db.collection("estagios").doc(id).collection("termino_antecipado").doc(docId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new EstagioAccessError(404, "not_found", "Pedido não encontrado.");
    }

    const pedido = { id: snap.id, ...snap.data() } as TerminoAntecipado;
    const currentIso = toIsoDate(new Date());

    const val = validateApproval(pedido, currentIso);
    if (!val.ok) {
      throw new EstagioAccessError(409, "invalid_state", val.reason ?? "Estado inválido.");
    }

    // Update the document
    await ref.update({
      estado: "aprovado",
      respondidoAt: FieldValue.serverTimestamp(),
    });

    // Create notifications
    const notifsCol = db.collection("estagios").doc(id).collection("notifications");
    const batch = db.batch();
    const tutorNome = session.displayName || "O tutor";

    // Notify aluno
    const an = buildTerminoAntecipadoNotification(pedido.alunoId, docId, id, {
      kind: "tutor_approved",
      tutorNome,
      diaDeDispensa: pedido.diaDeDispensa,
      diasParaCumprir: pedido.diasParaCumprir,
    });
    batch.set(notifsCol.doc(), { ...an, createdAt: FieldValue.serverTimestamp() });

    // Notify professor
    if (pedido.professorOrientadorId) {
      const pn = buildTerminoAntecipadoNotification(pedido.professorOrientadorId, docId, id, {
        kind: "tutor_approved",
        tutorNome,
        diaDeDispensa: pedido.diaDeDispensa,
        diasParaCumprir: [],
      });
      batch.set(notifsCol.doc(), { ...pn, createdAt: FieldValue.serverTimestamp() });
    }

    // Notify EE
    if (pedido.encarregadoEducacaoId) {
      const een = buildTerminoAntecipadoNotification(pedido.encarregadoEducacaoId, docId, id, {
        kind: "tutor_approved",
        tutorNome,
        diaDeDispensa: pedido.diaDeDispensa,
        diasParaCumprir: [],
      });
      batch.set(notifsCol.doc(), { ...een, createdAt: FieldValue.serverTimestamp() });
    }

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
