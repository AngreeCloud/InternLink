import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { buildEmpresaSnapshot } from "@/lib/types/empresa";
import { filterEmpresasByAccess } from "@/lib/empresas/empresa-access";
import { validateNIF as validateNif } from "@/lib/validators/nif";

export const runtime = "nodejs";

type CreateEmpresaBody = {
  nome: string;
  nif?: string;
  setor?: string;
  website?: string;
  descricao?: string;
  morada?: string;
  codigoPostal?: string;
  localidade?: string;
  concelho?: string;
  distrito?: string;
  pais?: string;
  emailGeral?: string;
  telefone?: string;
  logoUrl?: string;
};

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

export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { uid, schoolId, role, db } = auth;
    const q = db
      .collection("empresas")
      .where("schoolId", "==", schoolId)
      .orderBy("nomeNormalizado", "asc");

    const snap = await q.get();
    let empresas = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        nome: data.nome as string,
        nomeNormalizado: data.nomeNormalizado as string,
        setor: data.setor as string | undefined,
        localidade: data.localidade as string | undefined,
        distrito: data.distrito as string | undefined,
        logoUrl: data.logoUrl as string | undefined,
        nif: data.nif as string | undefined,
        ativa: data.ativa as boolean,
        tutorIds: (data.tutorIds as string[]) ?? [],
        empresaGrants: (data.empresaGrants as Record<string, "read" | "write"> | undefined) ?? null,
      };
    });

    if (role !== "admin_escolar") {
      empresas = filterEmpresasByAccess(empresas, uid, role);
    }

    // Count estagios per empresa
    const estagiosSnap = await db
      .collection("estagios")
      .where("schoolId", "==", schoolId)
      .select("empresaId")
      .get();

    const estagioCountMap = new Map<string, number>();
    estagiosSnap.forEach((doc) => {
      const empresaId = doc.data().empresaId as string | undefined;
      if (empresaId) {
        estagioCountMap.set(empresaId, (estagioCountMap.get(empresaId) ?? 0) + 1);
      }
    });

    empresas = empresas.map((e) => ({
      ...e,
      estagioCount: estagioCountMap.get(e.id) ?? 0,
      tutorCount: e.tutorIds.length,
    }));

    return NextResponse.json({ empresas });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { uid, schoolId, db } = auth;

    const optional = <T>(val: T | undefined | null): T | undefined =>
      val == null || (typeof val === "string" && val.trim() === "") ? undefined : val;

    const body = (await request.json()) as CreateEmpresaBody;
    const nome = (body.nome ?? "").trim();
    if (!nome) {
      return NextResponse.json({ error: "Nome da empresa é obrigatório" }, { status: 400 });
    }

    const nomeNormalizado = nome.toLowerCase().replace(/\s+/g, " ").trim();

    const existing = await db
      .collection("empresas")
      .where("schoolId", "==", schoolId)
      .where("nomeNormalizado", "==", nomeNormalizado)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        { error: "Já existe uma empresa com este nome nesta escola" },
        { status: 409 }
      );
    }

    const nifRaw = optional(body.nif);
    if (nifRaw) {
      const nifCheck = validateNif(nifRaw);
      if (!nifCheck.valid) {
        return NextResponse.json({ error: nifCheck.message ?? "NIF inválido" }, { status: 400 });
      }
    }

    const nifNormalizado = nifRaw
      ? nifRaw.replace(/\s+/g, "").replace(/[^0-9]/g, "")
      : undefined;

    if (nifNormalizado) {
      const nifExists = await db
        .collection("empresas")
        .where("schoolId", "==", schoolId)
        .where("nifNormalizado", "==", nifNormalizado)
        .limit(1)
        .get();

      if (!nifExists.empty) {
        return NextResponse.json(
          { error: "Já existe uma empresa com este NIF nesta escola" },
          { status: 409 }
        );
      }
    }

    const now = FieldValue.serverTimestamp();
    const empresaRef = db.collection("empresas").doc();

    const empresaData: Record<string, unknown> = {
      schoolId,
      nome,
      nomeNormalizado,
      nif: nifRaw,
      nifNormalizado,
      setor: optional(body.setor),
      website: optional(body.website),
      descricao: optional(body.descricao),
      morada: optional(body.morada),
      codigoPostal: optional(body.codigoPostal),
      localidade: optional(body.localidade),
      concelho: optional(body.concelho),
      distrito: optional(body.distrito),
      pais: optional(body.pais) ?? "Portugal",
      emailGeral: optional(body.emailGeral),
      telefone: optional(body.telefone),
      logoUrl: optional(body.logoUrl),
      tutorIds: [],
      ativa: true,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      updatedBy: uid,
    };

    if (role === "professor") {
      empresaData.empresaGrants = { [uid]: "write" };
    }

    const clean = Object.fromEntries(
      Object.entries(empresaData).filter(([, v]) => v !== undefined)
    );

    await empresaRef.set(clean);

    return NextResponse.json({
      ok: true,
      id: empresaRef.id,
      empresa: { ...empresaData, id: empresaRef.id },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
