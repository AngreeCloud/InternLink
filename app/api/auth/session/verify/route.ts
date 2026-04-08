import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const db = getFirebaseAdminDb();

    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const userData = userSnap.exists
      ? (userSnap.data() as { role?: string; estado?: string })
      : {};

    return NextResponse.json({
      valid: true,
      exp: decoded.exp,
      uid: decoded.uid,
      role: userData.role,
      estado: userData.estado,
    });
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}
