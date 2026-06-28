import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { ensureUserClaims } from "@/lib/auth/custom-claims";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

async function requireSuperAdmin(): Promise<string> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }

  const auth = getFirebaseAdminAuth();
  const decoded = await auth.verifySessionCookie(sessionCookie, true);
  if (!decoded.uid) {
    throw new Error("Unauthorized");
  }

  const db = getFirebaseAdminDb();
  const claims = await ensureUserClaims(auth, db, decoded.uid);
  if (claims.role !== "super_admin") {
    throw new Error("Forbidden");
  }

  return decoded.uid;
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const db = getFirebaseAdminDb();

    const [usersSnap, schoolsSnap, leadsSnap, supportQuery] = await Promise.all([
      db.collection("users").count().get(),
      db.collection("schools").count().get(),
      db.collection("schoolLeads").count().get(),
      db.collection("users").where("role", "==", "support").count().get(),
    ]);

    return NextResponse.json({
      totalUsers: usersSnap.data().count,
      totalSchools: schoolsSnap.data().count,
      totalLeads: leadsSnap.data().count,
      totalSupportAccounts: supportQuery.data().count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[api/super-admin/stats]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
