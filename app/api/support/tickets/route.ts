import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { ensureUserClaims } from "@/lib/auth/custom-claims";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

async function requireSupportOrSuperAdmin(): Promise<{ uid: string; role: string }> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) throw new Error("Unauthorized");
  const auth = getFirebaseAdminAuth();
  const decoded = await auth.verifySessionCookie(sessionCookie, true);
  if (!decoded.uid) throw new Error("Unauthorized");
  const db = getFirebaseAdminDb();
  const claims = await ensureUserClaims(auth, db, decoded.uid);
  if (claims.role !== "support" && claims.role !== "super_admin") throw new Error("Forbidden");
  return { uid: decoded.uid, role: claims.role };
}

export async function GET() {
  try {
    const { uid, role } = await requireSupportOrSuperAdmin();
    const db = getFirebaseAdminDb();

    let query = db.collection("supportTickets").orderBy("createdAt", "desc");
    if (role === "support") query = query.where("assignedTo", "==", uid);

    const snap = await query.get();
    const tickets = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ tickets });
  } catch (error) {
    const m = error instanceof Error ? error.message : String(error);
    if (m === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (m === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { uid } = await requireSupportOrSuperAdmin();
    const body = (await request.json()) as { ticketId: string; status?: string; assignedTo?: string };
    if (!body.ticketId) return NextResponse.json({ error: "ticketId obrigatório." }, { status: 400 });

    const db = getFirebaseAdminDb();
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status) update.status = body.status;
    if (body.assignedTo !== undefined) update.assignedTo = body.assignedTo;

    await db.collection("supportTickets").doc(body.ticketId).update(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const m = error instanceof Error ? error.message : String(error);
    if (m === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (m === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
