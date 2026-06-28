import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { ensureUserClaims } from "@/lib/auth/custom-claims";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

async function requireSuperAdmin(): Promise<string> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
  const auth = getFirebaseAdminAuth();
  const decoded = await auth.verifySessionCookie(sessionCookie, true);
  if (!decoded.uid) throw new Error("Unauthorized");
  const db = getFirebaseAdminDb();
  const claims = await ensureUserClaims(auth, db, decoded.uid);
  if (claims.role !== "super_admin") throw new Error("Forbidden");
  return decoded.uid;
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const db = getFirebaseAdminDb();
    const snap = await db.collection("landingContent").get();
    const content: Record<string, unknown> = {};
    snap.docs.forEach((doc) => {
      content[doc.id] = doc.data();
    });
    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const body = (await request.json()) as { sectionId: string; data: Record<string, unknown> };
    if (!body.sectionId) {
      return NextResponse.json({ error: "sectionId obrigatório." }, { status: 400 });
    }

    const db = getFirebaseAdminDb();
    await db.collection("landingContent").doc(body.sectionId).set({
      ...body.data,
      updatedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
