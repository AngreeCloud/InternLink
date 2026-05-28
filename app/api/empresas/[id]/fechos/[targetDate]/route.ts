import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

async function requireAuth() {
  const jar = await cookies();
  const sessionCookie = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;
  const auth = getFirebaseAdminAuth();
  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    return decoded;
  } catch {
    return null;
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; targetDate: string }> }
) {
  try {
    const decoded = await requireAuth();
    if (!decoded) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const sessionUid = decoded.uid;

    const { id: empresaId, targetDate } = await context.params;

    if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    }

    const db = getFirebaseAdminDb();

    // Validate tutor is in company and is the creator
    const empresaSnap = await db.collection("empresas").doc(empresaId).get();
    if (!empresaSnap.exists) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
    const empresa = empresaSnap.data() as { tutorIds?: string[] };
    if (!empresa.tutorIds?.includes(sessionUid)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const fechoRef = db.collection("empresas").doc(empresaId).collection("fechos").doc(targetDate);
    const fechoSnap = await fechoRef.get();

    if (!fechoSnap.exists) {
      return NextResponse.json({ error: "Comunicado não encontrado para esta data." }, { status: 404 });
    }

    // Find all associated schedule_change_requests across all estagios of this company
    const estagiosSnap = await db.collection("estagios").where("empresaId", "==", empresaId).get();

    const batch = db.batch();

    // Cancel auto-generated requests for this targetDate
    await Promise.all(
      estagiosSnap.docs.map(async (estagioDoc) => {
        const reqsSnap = await estagioDoc.ref
          .collection("schedule_change_requests")
          .where("targetDate", "==", targetDate)
          .where("status", "==", "approved")
          .get();

        reqsSnap.docs.forEach(reqDoc => {
          batch.update(reqDoc.ref, {
            status: "cancelled",
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
      })
    );

    // Delete the fecho document
    batch.delete(fechoRef);
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE fecho error", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
