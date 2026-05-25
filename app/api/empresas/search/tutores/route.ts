import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { hasEmpresaAccess } from "@/lib/empresas/empresa-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
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
    const userData = userSnap.data() as {
      role?: string;
      schoolId?: string;
    };

    if (userData.role !== "admin_escolar" && userData.role !== "professor") {
      return NextResponse.json(
        { error: "Sem permissão para pesquisar" },
        { status: 403 }
      );
    }
    if (!userData.schoolId) {
      return NextResponse.json(
        { error: "Utilizador sem escola associada" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();

    if (!q) {
      return NextResponse.json({ tutores: [] });
    }

    const snap = await db
      .collection("schools")
      .doc(userData.schoolId)
      .collection("tutors")
      .get();

    const results = snap.docs
      .filter((doc) => {
        const d = doc.data();
        const nome = ((d.nome as string) ?? "").toLowerCase();
        const email = ((d.email as string) ?? "").toLowerCase();
        return nome.includes(q) || email.includes(q);
      })
      .slice(0, 10)
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          nome: (d.nome as string) ?? undefined,
          email: (d.email as string) ?? undefined,
          telefone: (d.telefone as string) ?? undefined,
        };
      });

    return NextResponse.json({ tutores: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
