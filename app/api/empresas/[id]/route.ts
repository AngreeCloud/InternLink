import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { buildEmpresaSnapshot } from "@/lib/types/empresa";

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

    const docSnap = await db.collection("empresas").doc(id).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }

    const data = docSnap.data();
    if (data?.schoolId !== schoolId) {
      return NextResponse.json({ error: "Empresa não pertence a esta escola" }, { status: 403 });
    }

    return NextResponse.json({ empresa: { id: docSnap.id, ...data } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { uid, schoolId, role, db } = auth;
    const { id } = await params;

    const docSnap = await db.collection("empresas").doc(id).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }

    const currentData = docSnap.data();
    if (currentData?.schoolId !== schoolId) {
      return NextResponse.json({ error: "Empresa não pertence a esta escola" }, { status: 403 });
    }

    if (role !== "admin_escolar") {
      const schoolSnap = await db.collection("schools").doc(schoolId).get();
      const schoolData = schoolSnap.data();
      const access = schoolData?.empresasPageAccess as
        | { professores?: string; courseDirectors?: string }
        | undefined;

      const profAccess = access?.professores ?? "none";
      if (profAccess !== "write") {
        return NextResponse.json(
          { error: "Professores não têm permissão de edição de empresas" },
          { status: 403 }
        );
      }
    }

    const body = (await request.json()) as Record<string, unknown>;

    const updateData: Record<string, unknown> = {};
    const textFields = [
      "nome", "nif", "setor", "website", "descricao",
      "morada", "codigoPostal", "localidade", "concelho", "distrito",
      "pais", "emailGeral", "telefone", "logoUrl",
    ];

    for (const field of textFields) {
      if (body[field] !== undefined) {
        updateData[field] = typeof body[field] === "string" ? (body[field] as string).trim() : body[field];
      }
    }

    if (updateData.nome !== undefined) {
      updateData.nomeNormalizado = (updateData.nome as string).toLowerCase().replace(/\s+/g, " ").trim();
    }

    if (body.ativa !== undefined) {
      updateData.ativa = Boolean(body.ativa);
      if (!body.ativa) {
        updateData.archivedAt = FieldValue.serverTimestamp();
        updateData.archivedBy = uid;
      } else {
        updateData.archivedAt = null;
        updateData.archivedBy = null;
      }
    }

    updateData.updatedAt = FieldValue.serverTimestamp();
    updateData.updatedBy = uid;

    await db.collection("empresas").doc(id).update(updateData);

    const updatedSnap = await db.collection("empresas").doc(id).get();
    const updatedData = updatedSnap.data();

    return NextResponse.json({
      ok: true,
      empresa: { id: updatedSnap.id, ...updatedData },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
