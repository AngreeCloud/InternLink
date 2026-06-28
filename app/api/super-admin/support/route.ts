import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
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

function generateSecurePassword(length = 16): string {
  const bytes = crypto.randomBytes(length);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i]! % chars.length]!;
  }
  return password;
}

type CreateSupportBody = {
  email: string;
  name: string;
};

export async function GET() {
  try {
    await requireSuperAdmin();
    const db = getFirebaseAdminDb();

    const snap = await db.collection("users").where("role", "==", "support").get();
    const accounts = snap.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ accounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[api/super-admin/support]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const body = (await request.json()) as CreateSupportBody;

    if (!body.email || !body.name) {
      return NextResponse.json({ error: "Email e nome obrigatórios." }, { status: 400 });
    }

    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminDb();
    const password = generateSecurePassword();
    let uid: string;

    try {
      const existingUser = await auth.getUserByEmail(body.email);
      uid = existingUser.uid;
      await auth.updateUser(uid, { password });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "auth/user-not-found") {
        const user = await auth.createUser({
          email: body.email,
          displayName: body.name,
          password,
          emailVerified: true,
        });
        uid = user.uid;
      } else {
        throw err;
      }
    }

    await auth.setCustomUserClaims(uid, { role: "support", estado: "ativo" });

    await db.collection("users").doc(uid).set({
      role: "support",
      nome: body.name,
      email: body.email,
      estado: "ativo",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true, uid, email: body.email, password });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[api/super-admin/support]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
