import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { requireSessionUid, EstagioAccessError, toApiErrorResponse } from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();

    const callerSnap = await db.collection("users").doc(uid).get();
    if (!callerSnap.exists) {
      throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
    }
    const callerData = callerSnap.data() as { role?: string; schoolId?: string };
    if (!callerData.schoolId) {
      throw new EstagioAccessError(403, "no_school", "Sem escola associada.");
    }

    const schoolId = callerData.schoolId;
    const search = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

    const snap = await db
      .collection("users")
      .where("schoolId", "==", schoolId)
      .where("role", "==", "encarregado")
      .where("estado", "==", "ativo")
      .get();

    let results = snap.docs.map((doc) => {
      const data = doc.data() as {
        nome?: string;
        email?: string;
        educandoIds?: string[];
      };
      return {
        uid: doc.id,
        nome: data.nome || "—",
        email: data.email || "—",
        educandosCount: Array.isArray(data.educandoIds) ? data.educandoIds.length : 0,
      };
    });

    if (search) {
      results = results.filter(
        (ee) =>
          ee.nome.toLowerCase().includes(search) ||
          ee.email.toLowerCase().includes(search)
      );
    }

    results.sort((a, b) => a.nome.localeCompare(b.nome, "pt-PT"));
    results = results.slice(0, 50);

    return NextResponse.json({ ok: true, ees: results });
  } catch (error) {
    console.error("[api/encarregado/search]", error);
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
