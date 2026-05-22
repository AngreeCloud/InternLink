import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

async function requireAuth() {
  const jar = await cookies();
  const sessionCookie = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return { error: "Sessão inexistente", status: 401 } as const;
  }

  const auth = getFirebaseAdminAuth();
  const decoded = await auth.verifySessionCookie(sessionCookie, true);
  const uid = decoded.uid;
  const db = getFirebaseAdminDb();

  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    return { error: "Utilizador não encontrado", status: 403 } as const;
  }
  const userData = userSnap.data() as {
    role?: string;
    schoolId?: string;
  };

  if (userData.role !== "admin_escolar" && userData.role !== "professor") {
    return { error: "Sem permissão", status: 403 } as const;
  }
  if (!userData.schoolId) {
    return { error: "Utilizador sem escola associada", status: 403 } as const;
  }

  return { uid, schoolId: userData.schoolId, db } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { schoolId, db } = auth;
    const { id } = await params;

    const empresaSnap = await db.collection("empresas").doc(id).get();
    if (!empresaSnap.exists) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }
    if (empresaSnap.data()?.schoolId !== schoolId) {
      return NextResponse.json({ error: "Empresa não pertence a esta escola" }, { status: 403 });
    }

    const snap = await db
      .collection("estagios")
      .where("empresaId", "==", id)
      .where("schoolId", "==", schoolId)
      .orderBy("createdAt", "desc")
      .get();

    const estagios = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        titulo: d.titulo as string,
        alunoNome: d.alunoNome as string,
        professorNome: d.professorNome as string,
        tutorNome: d.tutorNome as string,
        estadoEstagio: d.estadoEstagio as string,
        dataInicio: d.dataInicio as string | undefined,
        dataFimEstimada: d.dataFimEstimada as string | undefined,
        totalHoras: d.totalHoras as number | undefined,
        horasRealizadas: d.horasRealizadas as number | undefined,
        courseNome: d.courseNome as string | undefined,
        createdAt: (d.createdAt as { toMillis?: () => number })?.toMillis?.() ?? null,
      };
    });

    return NextResponse.json({ estagios });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
