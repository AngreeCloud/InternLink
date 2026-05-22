import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  EstagioAccessError,
  requireSessionUid,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { uid } = await requireSessionUid();
    const role = request.nextUrl.searchParams.get("role") || "tutor";
    const db = getFirebaseAdminDb();

    const filterField = role === "tutor" ? "tutorId" : "professorOrientadorId";

    const estagiosSnap = await db
      .collection("estagios")
      .where(filterField, "==", uid)
      .get();

    const estagioIds = estagiosSnap.docs.map((d) => d.id);
    if (estagioIds.length === 0) {
      return NextResponse.json({ ok: true, pedidos: [] });
    }

    const results = await Promise.all(
      estagioIds.map(async (estagioId) => {
        const snap = await db
          .collection("estagios")
          .doc(estagioId)
          .collection("termino_antecipado")
          .get();
        return snap.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            estagioId,
            ...data,
          };
        });
      })
    );

    const pedidos = results.flat();

    return NextResponse.json({ ok: true, pedidos });
  } catch (error) {
    console.error("[api/termino-antecipado]", error);
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
