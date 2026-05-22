import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse } from "@/lib/estagios/estagio-access";
import type { TerminoAntecipado } from "@/lib/estagios/termino-antecipado";

export const runtime = "nodejs";

/**
 * GET /estagios/:id/termino-antecipado/ativo
 * Returns the active (pendente or aprovado) terminoAntecipado for this estagio,
 * or the most recent one if none active.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await assertEstagioAccess(id, "member");

    const db = getFirebaseAdminDb();
    const col = db.collection("estagios").doc(id).collection("termino_antecipado");

    // Try to find active (pendente or aprovado) first
    const activeSnap = await col
      .where("estado", "in", ["pendente", "aprovado"])
      .limit(1)
      .get();

    if (!activeSnap.empty) {
      const doc = activeSnap.docs[0];
      const raw = doc.data() as Omit<TerminoAntecipado, "id">;
      return NextResponse.json({ ok: true, pedido: { id: doc.id, ...raw } });
    }

    // Fallback: get the most recent one
    const recentSnap = await col
      .orderBy("submittedAt", "desc")
      .limit(1)
      .get();

    if (recentSnap.empty) {
      return NextResponse.json({ ok: true, pedido: null });
    }

    const doc = recentSnap.docs[0];
    const raw = doc.data() as Omit<TerminoAntecipado, "id">;
    return NextResponse.json({ ok: true, pedido: { id: doc.id, ...raw } });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
