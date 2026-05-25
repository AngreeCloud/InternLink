import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { hasEmpresaAccess } from "@/lib/empresas/empresa-access";

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
    return { error: "Sem permissão para gerir empresas", status: 403 } as const;
  }
  if (!userData.schoolId) {
    return { error: "Utilizador sem escola associada", status: 403 } as const;
  }

  return { uid, schoolId: userData.schoolId, role: userData.role, db } as const;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; tutorId: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { uid, schoolId, role, db } = auth;
    const { id, tutorId } = await params;

    const empresaSnap = await db.collection("empresas").doc(id).get();
    if (!empresaSnap.exists) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }
    const empresaData = empresaSnap.data();
    if (empresaData?.schoolId !== schoolId) {
      return NextResponse.json({ error: "Empresa não pertence a esta escola" }, { status: 403 });
    }

    if (role !== "admin_escolar") {
      const schoolSnap = await db.collection("schools").doc(schoolId).get();
      const empresasPageAccess = (schoolSnap.data()?.empresasPageAccess as
        | { professores?: string }
        | undefined)?.professores as "none" | "read" | "write" | undefined;

      if (!hasEmpresaAccess({
        uid, role,
        empresaGrants: empresaData?.empresaGrants,
        requiredLevel: "write",
        globalProfAccess: empresasPageAccess,
      })) {
        return NextResponse.json({ error: "Sem permissão de escrita nesta empresa" }, { status: 403 });
      }
    }

    const body = (await request.json()) as {
      funcaoEmpresaOverride?: string;
      telefoneOverride?: string;
      notasInternas?: string;
    };

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    };

    if (body.funcaoEmpresaOverride !== undefined) {
      updateData.funcaoEmpresaOverride = body.funcaoEmpresaOverride;
    }
    if (body.telefoneOverride !== undefined) {
      updateData.telefoneOverride = body.telefoneOverride;
    }
    if (body.notasInternas !== undefined) {
      updateData.notasInternas = body.notasInternas;
    }

    await db.collection("empresas").doc(id).collection("tutores").doc(tutorId).set(
      {
        tutorId,
        ...updateData,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; tutorId: string }> }
) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { uid, schoolId, role, db } = auth;
    const { id, tutorId } = await params;

    const empresaSnap = await db.collection("empresas").doc(id).get();
    if (!empresaSnap.exists) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }
    const empresaData = empresaSnap.data();
    if (empresaData?.schoolId !== schoolId) {
      return NextResponse.json({ error: "Empresa não pertence a esta escola" }, { status: 403 });
    }

    if (role !== "admin_escolar") {
      const schoolSnap = await db.collection("schools").doc(schoolId).get();
      const empresasPageAccess = (schoolSnap.data()?.empresasPageAccess as
        | { professores?: string }
        | undefined)?.professores as "none" | "read" | "write" | undefined;

      if (!hasEmpresaAccess({
        uid, role,
        empresaGrants: empresaData?.empresaGrants,
        requiredLevel: "write",
        globalProfAccess: empresasPageAccess,
      })) {
        return NextResponse.json({ error: "Sem permissão de escrita nesta empresa" }, { status: 403 });
      }
    }

    const currentIds = (empresaData?.tutorIds as string[]) ?? [];
    if (!currentIds.includes(tutorId)) {
      return NextResponse.json({ error: "Tutor não está associado a esta empresa" }, { status: 404 });
    }

    await db.collection("empresas").doc(id).update({
      tutorIds: FieldValue.arrayRemove(tutorId),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
