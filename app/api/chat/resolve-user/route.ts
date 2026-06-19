import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const sessionCookie = jar.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Sessão inexistente" }, { status: 401 });
    }

    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const db = getFirebaseAdminDb();

    const { email } = (await request.json()) as { email?: string };
    if (!email || typeof email !== "string") {
      return NextResponse.json({ user: null });
    }

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return NextResponse.json({ user: null });
    }

    const snap = await db
      .collection("users")
      .where("email", "==", normalized)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ user: null });
    }

    const docSnap = snap.docs[0];
    const data = docSnap.data() as {
      nome?: string;
      email?: string;
      photoURL?: string;
      role?: string;
      estado?: string;
      schoolId?: string;
      escolaId?: string;
    };

    if ((data.estado || "").toLowerCase() === "removido") {
      return NextResponse.json({ user: null });
    }

    const chatRole =
      data.role === "professor"
        ? "teacher"
        : data.role === "tutor"
          ? "tutor"
          : data.role === "admin_escolar"
            ? "admin"
            : "student";

    return NextResponse.json({
      user: {
        uid: docSnap.id,
        name: data.nome || "Utilizador",
        email: data.email || normalized,
        photoURL: data.photoURL || "",
        role: chatRole,
        orgId: data.schoolId || data.escolaId || null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
