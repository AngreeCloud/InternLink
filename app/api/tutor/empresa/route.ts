import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const jar = await cookies();
    const sessionCookie = jar.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;

    const db = getFirebaseAdminDb();
    const snap = await db
      .collection("empresas")
      .where("tutorIds", "array-contains", uid)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ ok: true, empresaId: null });
    }

    const doc = snap.docs[0];
    return NextResponse.json({ ok: true, empresaId: doc.id, empresaNome: doc.data().nome });
  } catch (error) {
    console.error("[api/tutor/empresa]", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
