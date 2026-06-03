import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { calcNewEndDate } from "@/lib/estagios/schedule-change-requests";
import { normalizeDiasSemana } from "@/lib/estagios/workdays";

export const runtime = "nodejs";

async function requireAuth() {
  const jar = await cookies();
  const sessionCookie = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;
  const auth = getFirebaseAdminAuth();
  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await requireAuth();
    if (!decoded) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const sessionUid = decoded.uid;
    const { id: empresaId } = await context.params;
    const db = getFirebaseAdminDb();

    const empresaSnap = await db.collection("empresas").doc(empresaId).get();
    if (!empresaSnap.exists) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
    const empresa = empresaSnap.data() as { tutorIds?: string[] };
    if (!empresa.tutorIds?.includes(sessionUid)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const snap = await db.collection("empresas").doc(empresaId).collection("fechos").orderBy("createdAt", "desc").get();
    const fechos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ ok: true, fechos });
  } catch (error) {
    console.error("GET fechos error", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await requireAuth();
    if (!decoded) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const sessionUid = decoded.uid;

    const { id: empresaId } = await context.params;
    const body = await request.json();
    const { targetDate, reason, scope, studentId } = body;

    if (!targetDate || typeof targetDate !== "string") {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    }

    const db = getFirebaseAdminDb();
    
    // Validate tutor is in company
    const empresaSnap = await db.collection("empresas").doc(empresaId).get();
    if (!empresaSnap.exists) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
    const empresa = empresaSnap.data() as { tutorIds?: string[] };
    if (!empresa.tutorIds?.includes(sessionUid)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const fechoRef = db.collection("empresas").doc(empresaId).collection("fechos").doc(targetDate);
    
    // We use transaction to prevent duplicates
    const success = await db.runTransaction(async (t) => {
      const snap = await t.get(fechoRef);
      if (snap.exists) {
        return false;
      }
      t.set(fechoRef, {
        targetDate,
        reason: reason || "Dia sem estágio",
        scope,
        createdBy: sessionUid,
        createdAt: FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (!success) {
      return NextResponse.json({ error: "Este dia já foi marcado como fechado para a empresa." }, { status: 409 });
    }

    // Now process the batch
    let estagiosQuery = db.collection("estagios").where("empresaId", "==", empresaId).where("estado", "==", "ativo");
    
    if (scope === "mine") {
      estagiosQuery = estagiosQuery.where("tutorId", "==", sessionUid);
    } else if (scope === "specific" && studentId) {
      estagiosQuery = estagiosQuery.where("alunoId", "==", studentId);
    }

    const estagiosSnap = await estagiosQuery.get();
    let estagioDocs = estagiosSnap.docs;

    // Safeguard: also catch estagios missing empresaId but managed by same tutors
    if (scope !== "specific" && empresa.tutorIds?.length) {
      const orphanSnap = await db.collection("estagios")
        .where("estado", "==", "ativo")
        .where("tutorId", "in", empresa.tutorIds)
        .get();
      const existingIds = new Set(estagioDocs.map(d => d.id));
      for (const doc of orphanSnap.docs) {
        if (existingIds.has(doc.id)) continue;
        const data = doc.data() as { empresaId?: string };
        if (!data.empresaId) {
          estagioDocs.push(doc);
        }
      }
    }

    const batch = db.batch();

    estagioDocs.forEach(doc => {
      const estagio = doc.data();
      const reqRef = doc.ref.collection("schedule_change_requests").doc();
      
      batch.set(reqRef, {
        estagioId: doc.id,
        studentId: estagio.alunoId,
        professorId: estagio.professorId || "",
        tutorId: estagio.tutorId || "",
        type: "company_closure",
        targetDate,
        absenceType: "total",
        hoursAffected: 0,
        reason: reason || "Dia de encerramento da empresa / Tolerância de ponto",
        status: "approved",
        comments: [{
          authorId: sessionUid,
          authorRole: "tutor",
          text: "Auto-gerado: Fecho da empresa comunicado pelo tutor.",
          createdAt: new Date().toISOString()
        }],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update dataFimEstimada
      const currentEnd = (estagio.dataFimEstimada as string) || (estagio.dataFim as string) || "";
      if (currentEnd) {
        const diasSemana = normalizeDiasSemana(estagio.diasSemana);
        const newEnd = calcNewEndDate(currentEnd, diasSemana);
        if (newEnd !== currentEnd) {
          batch.update(doc.ref, { 
            dataFimEstimada: newEnd,
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }
    });

    await batch.commit();

    return NextResponse.json({ ok: true, affectedCount: estagioDocs.length });
  } catch (error) {
    console.error("Fecho error", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
