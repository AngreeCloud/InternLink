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
      return NextResponse.json({ error: "Sessão inexistente" }, { status: 401 });
    }

    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;
    const db = getFirebaseAdminDb();

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 403 });
    }
    const userData = userSnap.data() as { role?: string; schoolId?: string };

    if (userData.role !== "admin_escolar") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    if (!userData.schoolId) {
      return NextResponse.json({ error: "Utilizador sem escola associada" }, { status: 403 });
    }

    const profSnap = await db
      .collection("users")
      .where("schoolId", "==", userData.schoolId)
      .where("role", "==", "professor")
      .where("estado", "==", "ativo")
      .get();

    const professors = profSnap.docs.map((doc) => {
      const d = doc.data() as { nome?: string; email?: string };
      return {
        uid: doc.id,
        nome: d.nome || "Sem nome",
        email: d.email || "",
      };
    });

    professors.sort((a, b) => a.nome.localeCompare(b.nome, "pt-PT"));

    return NextResponse.json({ professors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
