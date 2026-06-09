import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { buildEmpresaSnapshot } from "@/lib/types/empresa";
import { hasEmpresaAccess } from "@/lib/empresas/empresa-access";
import { validateNIF as validateNif } from "@/lib/validators/nif";

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

    const { uid, schoolId, role, db } = auth;
    const { id } = await params;

    const docSnap = await db.collection("empresas").doc(id).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }

    const data = docSnap.data();
    if (data?.schoolId !== schoolId) {
      return NextResponse.json({ error: "Empresa não pertence a esta escola" }, { status: 403 });
    }

    if (role !== "admin_escolar") {
      if (!hasEmpresaAccess({
        uid,
        role,
        empresaGrants: data?.empresaGrants,
        requiredLevel: "read",
      })) {
        return NextResponse.json({ error: "Sem permissão para aceder a esta empresa" }, { status: 403 });
      }
    }

    const canWrite = role === "admin_escolar" || data?.empresaGrants?.[uid] === "write";

    const uidsToResolve = new Set<string>();
    if (data?.createdBy) uidsToResolve.add(data.createdBy);
    if (data?.updatedBy) uidsToResolve.add(data.updatedBy);
    if (data?.archivedBy) uidsToResolve.add(data.archivedBy);

    const userNames = new Map<string, string>();
    if (uidsToResolve.size > 0) {
      const refs = [...uidsToResolve].map((uid) => db.collection("users").doc(uid));
      const userSnaps = await db.getAll(...refs);
      userSnaps.forEach((s) => {
        if (s.exists) {
          const d = s.data();
          userNames.set(s.id, (d?.nome as string) || (d?.displayName as string) || s.id);
        }
      });
    }

    const empresa = {
      id: docSnap.id,
      ...data,
      createdByName: data?.createdBy ? (userNames.get(data.createdBy) ?? data.createdBy) : undefined,
      updatedByName: data?.updatedBy ? (userNames.get(data.updatedBy) ?? data.updatedBy) : undefined,
      archivedByName: data?.archivedBy ? (userNames.get(data.archivedBy) ?? data.archivedBy) : undefined,
    };

    return NextResponse.json({ empresa, role, canWrite });
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
      if (!hasEmpresaAccess({
        uid,
        role,
        empresaGrants: currentData?.empresaGrants,
        requiredLevel: "write",
      })) {
        return NextResponse.json(
          { error: "Não tens permissão de escrita nesta empresa" },
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

    if (updateData.nif !== undefined) {
      const nifRaw = updateData.nif as string;
      if (nifRaw) {
        const nifCheck = validateNif(nifRaw);
        if (!nifCheck.valid) {
          return NextResponse.json({ error: nifCheck.message ?? "NIF inválido" }, { status: 400 });
        }
      }
      const nifNormalizado = nifRaw
        ? nifRaw.replace(/\s+/g, "").replace(/[^0-9]/g, "")
        : "";

      if (nifNormalizado) {
        updateData.nifNormalizado = nifNormalizado;

        const nifExists = await db
          .collection("empresas")
          .where("schoolId", "==", schoolId)
          .where("nifNormalizado", "==", nifNormalizado)
          .limit(2)
          .get();

        const otherMatch = nifExists.docs.find((doc) => doc.id !== id);
        if (otherMatch) {
          return NextResponse.json(
            { error: "Já existe uma empresa com este NIF nesta escola" },
            { status: 409 }
          );
        }
      } else {
        updateData.nifNormalizado = null;
      }
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

    if (body.fotos !== undefined) {
      updateData.fotos = body.fotos;
    }

    if (body.empresaGrants !== undefined) {
      if (role !== "admin_escolar") {
        return NextResponse.json(
          { error: "Apenas o administrador escolar pode gerir permissões" },
          { status: 403 }
        );
      }

      const incoming = body.empresaGrants as Record<string, unknown>;
      const existing: Record<string, "read" | "write"> = (currentData?.empresaGrants as Record<string, "read" | "write"> | undefined) ?? {};
      const merged: Record<string, "read" | "write"> = { ...existing };

      for (const [key, val] of Object.entries(incoming)) {
        if (val === "read" || val === "write") {
          merged[key] = val;
        } else {
          delete merged[key];
        }
      }

      updateData.empresaGrants = merged;
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
