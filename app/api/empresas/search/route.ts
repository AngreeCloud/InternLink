import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

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
        { error: "Sem permissão para pesquisar empresas" },
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
      return NextResponse.json({ empresas: [] });
    }

    const snap = await db
      .collection("empresas")
      .where("schoolId", "==", userData.schoolId)
      .where("ativa", "==", true)
      .orderBy("nomeNormalizado", "asc")
      .get();

    const results = snap.docs
      .filter((doc) => {
        const d = doc.data();
        const nomeNorm = (d.nomeNormalizado as string) ?? "";
        const localidade = ((d.localidade as string) ?? "").toLowerCase();
        const nif = ((d.nif as string) ?? "");
        return (
          nomeNorm.includes(q) ||
          localidade.includes(q) ||
          nif.includes(q)
        );
      })
      .slice(0, 8)
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          nome: d.nome as string,
          morada: d.morada as string | undefined,
          codigoPostal: d.codigoPostal as string | undefined,
          localidade: d.localidade as string | undefined,
          nif: d.nif as string | undefined,
          setor: d.setor as string | undefined,
        };
      });

    return NextResponse.json({ empresas: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
