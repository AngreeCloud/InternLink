import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
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
    nome?: string;
  };

  if (userData.role !== "admin_escolar" && userData.role !== "professor") {
    return { error: "Sem permissão para gerir empresas", status: 403 } as const;
  }
  if (!userData.schoolId) {
    return { error: "Utilizador sem escola associada", status: 403 } as const;
  }

  return { uid, schoolId: userData.schoolId, nome: userData.nome, role: userData.role, db } as const;
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
    const empresaData = empresaSnap.data();
    if (empresaData?.schoolId !== schoolId) {
      return NextResponse.json({ error: "Empresa não pertence a esta escola" }, { status: 403 });
    }

    const tutorIds = (empresaData?.tutorIds as string[]) ?? [];

    if (tutorIds.length === 0) {
      return NextResponse.json({ tutores: [] });
    }

    const tutorDocs = await Promise.all(
      tutorIds.map(async (tutorId) => {
        const docSnap = await db
          .collection("schools")
          .doc(schoolId)
          .collection("tutors")
          .doc(tutorId)
          .get();
        if (!docSnap.exists) return null;
        return { id: tutorId, ...docSnap.data() };
      })
    );

    const tutores = tutorDocs.filter(Boolean);

    return NextResponse.json({ tutores });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { uid, schoolId, db } = auth;
    const { id } = await params;

    const empresaSnap = await db.collection("empresas").doc(id).get();
    if (!empresaSnap.exists) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }
    const empresaData = empresaSnap.data();
    if (empresaData?.schoolId !== schoolId) {
      return NextResponse.json({ error: "Empresa não pertence a esta escola" }, { status: 403 });
    }

    const body = (await request.json()) as { tutorId?: string };
    const tutorId = (body.tutorId ?? "").trim();
    if (!tutorId) {
      return NextResponse.json({ error: "ID do tutor é obrigatório" }, { status: 400 });
    }

    const tutorSnap = await db
      .collection("schools")
      .doc(schoolId)
      .collection("tutors")
      .doc(tutorId)
      .get();

    if (!tutorSnap.exists) {
      return NextResponse.json({ error: "Tutor não encontrado nesta escola" }, { status: 404 });
    }

    const currentIds = (empresaData?.tutorIds as string[]) ?? [];

    if (currentIds.includes(tutorId)) {
      return NextResponse.json({ error: "Tutor já associado a esta empresa" }, { status: 409 });
    }

    await db.collection("empresas").doc(id).update({
      tutorIds: FieldValue.arrayUnion(tutorId),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    });

    const tutorData = tutorSnap.data();

    return NextResponse.json({
      ok: true,
      tutor: { id: tutorId, ...tutorData },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
