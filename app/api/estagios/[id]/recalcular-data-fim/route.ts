import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import {
  recalcularDataFimEstimada,
  calcularDataFimComAusencias,
  calcularReplayAbsences,
  type DiasSemana,
  type AusenciaRequest,
  type ReplayRequest,
} from "@/lib/estagios/date-calc";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await assertEstagioAccess(id, "member");

    const db = getFirebaseAdminDb();
    const estagioRef = db.collection("estagios").doc(id);
    const estagioData = session.estagio as Record<string, unknown>;
    const totalHoras = Number(estagioData.totalHoras ?? 0) || 0;
    const horasDiarias =
      Number(estagioData.horasDiarias ?? estagioData.horasPorDia ?? 0) || 0;

    if (totalHoras <= 0 || horasDiarias <= 0) {
      return NextResponse.json({
        ok: true,
        recalculado: false,
        motivo: "Total de horas ou horas por dia inválidos.",
        dataFimEstimada: null,
      });
    }

    // Buscar presenças e somar horas realizadas
    const presencasSnap = await estagioRef.collection("presencas").get();
    let horasRealizadas = 0;
    let ultimaPresenca = (estagioData.dataInicio as string) || "";
    presencasSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const hr = Number(data.hoursWorked ?? 0) || 0;
      horasRealizadas += hr;
      const dateIso = (data.date as string) || d.id;
      if (hr > 0 && dateIso > ultimaPresenca) {
        ultimaPresenca = dateIso;
      }
    });

    // Construir DiasSemana a partir dos dados
    const rawDias = (estagioData.diasSemana as Record<string, boolean>) ?? {};
    const diasSemana: DiasSemana = {
      seg: rawDias.seg ?? false,
      ter: rawDias.ter ?? false,
      qua: rawDias.qua ?? false,
      qui: rawDias.qui ?? false,
      sex: rawDias.sex ?? false,
      sab: rawDias.sab ?? false,
      dom: rawDias.dom ?? false,
    };

    // Buscar schedule_change_requests aprovados
    const scrSnap = await estagioRef.collection("schedule_change_requests").get();
    const ausenciaRequests: AusenciaRequest[] = [];
    const replayRequests: ReplayRequest[] = [];
    scrSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      if (data.status === "approved") {
        const req: AusenciaRequest = {
          targetDate: (data.targetDate as string) || d.id,
          absenceType: data.absenceType as string | undefined,
          hoursAffected: Number(data.hoursAffected ?? 0),
        };
        ausenciaRequests.push(req);
        replayRequests.push({
          absenceType: req.absenceType,
          hoursAffected: req.hoursAffected,
        });
      }
    });

    // Recalcular data fim considerando ausências
    const currentDataFim = estagioData.dataFimEstimada as string | undefined;
    const storedAcc = Number(estagioData.horasAusenciaAcumuladas ?? 0);
    const result = recalcularDataFimEstimada({
      totalHoras,
      horasRealizadas,
      horasDiarias,
      diasSemana,
      startFrom: ultimaPresenca,
    });

    // Data com ausências (walk real)
    const ausenciasResult = calcularDataFimComAusencias({
      totalHoras,
      horasRealizadas,
      horasDiarias,
      diasSemana,
      startFrom: ultimaPresenca,
      requests: ausenciaRequests,
    });

    let newDataFim = ausenciasResult.dataFim || result.dataFimEstimada;
    if (!newDataFim && horasRealizadas >= totalHoras) {
      newDataFim = ultimaPresenca;
    }

    // horasAusenciaAcumuladas corrigido via replay
    const replayResult = storedAcc > 0
      ? calcularReplayAbsences(storedAcc, replayRequests, horasDiarias)
      : null;
    const correctAcc = replayResult?.correctAcc ?? 0;

    console.log("[recalcular-data-fim]", {
      estagioId: id,
      totalHoras,
      horasRealizadas,
      horasDiarias,
      rawDiasKeys: Object.keys(rawDias).filter((k) => rawDias[k]),
      rawResult: result,
      ausenciasResult,
      newDataFim,
      correctAcc,
    });

    if (!newDataFim) {
      return NextResponse.json({
        ok: true,
        recalculado: false,
        motivo: "Não foi possível recalcular.",
        dataFimEstimada: null,
      });
    }

    // Só atualizar se algo mudou
    if (newDataFim === currentDataFim && correctAcc === storedAcc) {
      return NextResponse.json({
        ok: true,
        recalculado: false,
        motivo: "Data fim e accumulated já estão corretos.",
        dataFimEstimada: newDataFim,
      });
    }

    const updateData: Record<string, unknown> = {
      dataFimEstimada: newDataFim,
      horasRealizadas,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (replayResult && correctAcc !== storedAcc) {
      updateData.horasAusenciaAcumuladas = correctAcc;
    }

    await estagioRef.update(updateData);

    return NextResponse.json({
      ok: true,
      recalculado: true,
      dataFimEstimada: newDataFim,
      horasAusenciaAcumuladas: correctAcc,
      diasUteis: ausenciasResult.diasUteis || result.diasUteis || Math.ceil(horasRealizadas / horasDiarias),
      horasRestantes: Math.max(0, totalHoras - horasRealizadas),
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
