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

function generateSchoolId(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

type CreateSchoolBody = {
  name: string;
  shortName: string;
  address?: string;
  contact?: string;
  educationLevel?: string;
  emailDomain?: string;
  adminEmail: string;
  adminName: string;
};

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const body = (await request.json()) as CreateSchoolBody;

    if (!body.name || !body.shortName || !body.adminEmail || !body.adminName) {
      return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
    }

    const db = getFirebaseAdminDb();
    const auth = getFirebaseAdminAuth();
    const schoolId = generateSchoolId(body.name);

    // Check if school already exists
    const existingSchool = await db.collection("schools").doc(schoolId).get();
    if (existingSchool.exists) {
      return NextResponse.json({ error: "Já existe uma escola com este ID." }, { status: 409 });
    }

    // Create school document
    await db.collection("schools").doc(schoolId).set({
      name: body.name,
      shortName: body.shortName,
      address: body.address || "",
      contact: body.contact || "",
      educationLevel: body.educationLevel || "Secundária/Profissional",
      emailDomain: body.emailDomain || "",
      requireInstitutionalEmail: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create school-admin Firebase Auth account
    const adminPassword = generateSecurePassword();
    let adminUid: string;

    try {
      const existingUser = await auth.getUserByEmail(body.adminEmail);
      adminUid = existingUser.uid;
      // Update password if user already exists
      await auth.updateUser(adminUid, { password: adminPassword });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "auth/user-not-found") {
        const user = await auth.createUser({
          email: body.adminEmail,
          displayName: body.adminName,
          password: adminPassword,
          emailVerified: true,
        });
        adminUid = user.uid;
      } else {
        throw err;
      }
    }

    // Set custom claims
    await auth.setCustomUserClaims(adminUid, {
      role: "admin_escolar",
      estado: "ativo",
    });

    // Create Firestore user document
    await db.collection("users").doc(adminUid).set({
      role: "admin_escolar",
      nome: body.adminName,
      email: body.adminEmail,
      schoolId,
      estado: "ativo",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      schoolId,
      adminEmail: body.adminEmail,
      adminPassword,
      adminUid,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[api/super-admin/schools]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
