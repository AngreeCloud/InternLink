import { NextResponse } from "next/server";
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
    return { error: "Sem permissão", status: 403 } as const;
  }
  if (!userData.schoolId) {
    return { error: "Utilizador sem escola associada", status: 403 } as const;
  }

  return { uid, schoolId: userData.schoolId, role: userData.role, db } as const;
}

const ESTADO_TO_ESTAGIO: Record<string, string> = {
  ativo: "em_curso",
  activo: "em_curso",
  active: "em_curso",
  concluido: "concluido",
  finished: "concluido",
  suspenso: "suspenso",
  suspended: "suspenso",
};

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

    const empresaSnap = await db.collection("empresas").doc(id).get();
    if (!empresaSnap.exists) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }
    const empresaData = empresaSnap.data();
    if (empresaData?.schoolId !== schoolId) {
      return NextResponse.json({ error: "Empresa não pertence a esta escola" }, { status: 403 });
    }

    if (role !== "admin_escolar") {
      if (!hasEmpresaAccess({
        uid, role,
        empresaGrants: empresaData?.empresaGrants,
        requiredLevel: "read",
      })) {
        return NextResponse.json({ error: "Sem permissão para aceder a esta empresa" }, { status: 403 });
      }
    }

    const snap = await db
      .collection("estagios")
      .where("empresaId", "==", id)
      .where("schoolId", "==", schoolId)
      .orderBy("createdAt", "desc")
      .get();

    const professorIdsToResolve = new Set<string>();
    const rawDocs = snap.docs.map((doc) => {
      const d = doc.data() as Record<string, unknown>;
      if (!d.professorNome && d.professorId) {
        professorIdsToResolve.add(d.professorId as string);
      }
      return { _id: doc.id, ...d };
    });

    const professorNames = new Map<string, string>();
    if (professorIdsToResolve.size > 0) {
      const refs = [...professorIdsToResolve].map((pid) =>
        db.collection("users").doc(pid)
      );
      const profSnap = await db.getAll(...refs);
      profSnap.forEach((s) => {
        if (s.exists) {
          const data = s.data();
          professorNames.set(
            s.id,
            (data?.nome as string) || (data?.displayName as string) || ""
          );
        }
      });
    }

    const estagios = rawDocs.map((d) => {
      const estadoRaw = (d.estadoEstagio as string) || (d.estado as string) || (d.status as string) || "";
      const estadoEstagio = ESTADO_TO_ESTAGIO[estadoRaw] || estadoRaw;
      const professorNome =
        (d.professorNome as string) ||
        professorNames.get(d.professorId as string) ||
        "";

      return {
        id: d._id as string,
        titulo: d.titulo as string,
        alunoNome: d.alunoNome as string,
        professorNome,
        tutorNome: d.tutorNome as string,
        estadoEstagio,
        dataInicio: d.dataInicio as string | undefined,
        dataFimEstimada: d.dataFimEstimada as string | undefined,
        totalHoras: d.totalHoras as number | undefined,
        horasRealizadas: d.horasRealizadas as number | undefined,
        courseNome: d.courseNome as string | undefined,
        createdAt:
          ((d.createdAt as { toMillis?: () => number })?.toMillis?.() ?? null),
      };
    });

    return NextResponse.json({ estagios });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
