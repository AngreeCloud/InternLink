import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const role = typeof decoded.role === "string" ? decoded.role : undefined;
    const estado = typeof decoded.estado === "string" ? decoded.estado : undefined;

    if (!role || !estado) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      exp: decoded.exp,
      uid: decoded.uid,
      role,
      estado,
    });
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}
