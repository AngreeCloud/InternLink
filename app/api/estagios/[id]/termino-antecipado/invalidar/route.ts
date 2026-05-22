import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse, EstagioAccessError } from "@/lib/estagios/estagio-access";
import { checkInvalidation, type TerminoAntecipado } from "@/lib/estagios/termino-antecipado";
import {
  buildTerminoAntecipadoNotification,
} from "@/lib/notifications/termino-antecipado-notifications";

export const runtime = "nodejs";

type Body = {
  dataPresenca: string;
  horasTrabalhadas: number;
  horasPrevistasNoDia: number;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await assertEstagioAccess(id, "member");

    const body = (await request.json()) as Body;

    if (!body.dataPresenca || typeof body.dataPresenca !== "string") {
      throw new EstagioAccessError(400, "missing_date", "Falta a data da presença.");
    }

    const db = getFirebaseAdminDb();
    const col = db.collection("estagios").doc(id).collection("termino_antecipado");

    const activeSnap = await col
      .where("estado", "==", "aprovado")
      .limit(1)
      .get();

    if (activeSnap.empty) {
      return NextResponse.json({ ok: true, invalidated: false });
    }

    const doc = activeSnap.docs[0];
    const pedido = { id: doc.id, ...doc.data() } as TerminoAntecipado;

    const horasTrabalhadas = Number.isFinite(body.horasTrabalhadas) ? body.horasTrabalhadas : 0;
    const horasPrevistas = Number.isFinite(body.horasPrevistasNoDia) ? body.horasPrevistasNoDia : 0;

    const result = checkInvalidation(pedido, body.dataPresenca, horasTrabalhadas, horasPrevistas);

    if (!result.invalidar) {
      return NextResponse.json({ ok: true, invalidated: false });
    }

    await doc.ref.update({
      estado: "invalidado_por_incumprimento",
      diaDeIncumprimento: body.dataPresenca,
    });

    const notifsCol = db.collection("estagios").doc(id).collection("notifications");
    const batch = db.batch();

    const an = buildTerminoAntecipadoNotification(pedido.alunoId, doc.id, id, {
      kind: "invalidated",
      diaIncumprimento: body.dataPresenca,
    });
    batch.set(notifsCol.doc(), { ...an, createdAt: FieldValue.serverTimestamp() });

    if (pedido.tutorId) {
      const tn = buildTerminoAntecipadoNotification(pedido.tutorId, doc.id, id, {
        kind: "invalidated",
        diaIncumprimento: body.dataPresenca,
      });
      batch.set(notifsCol.doc(), { ...tn, createdAt: FieldValue.serverTimestamp() });
    }

    if (pedido.professorOrientadorId) {
      const pn = buildTerminoAntecipadoNotification(pedido.professorOrientadorId, doc.id, id, {
        kind: "invalidated",
        diaIncumprimento: body.dataPresenca,
      });
      batch.set(notifsCol.doc(), { ...pn, createdAt: FieldValue.serverTimestamp() });
    }

    if (pedido.encarregadoEducacaoId) {
      const een = buildTerminoAntecipadoNotification(pedido.encarregadoEducacaoId, doc.id, id, {
        kind: "invalidated",
        diaIncumprimento: body.dataPresenca,
      });
      batch.set(notifsCol.doc(), { ...een, createdAt: FieldValue.serverTimestamp() });
    }

    await batch.commit();

    return NextResponse.json({ ok: true, invalidated: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
