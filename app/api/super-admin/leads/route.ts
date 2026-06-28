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

    // Buscar leads da nova coleção schoolLeads (formulário de enliste 2 passos)
    const leadsSnap = await db.collection("schoolLeads").orderBy("createdAt", "desc").get();
    const leads = leadsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Também buscar schoolRequests (formulário antigo de solicitar-acesso)
    const requestsSnap = await db.collection("schoolRequests").orderBy("createdAt", "desc").get();
    const requests = requestsSnap.docs.map((doc) => ({
      id: doc.id,
      source: "solicitar-acesso",
      ...doc.data(),
    }));

    return NextResponse.json({ leads, requests });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[api/super-admin/leads]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
