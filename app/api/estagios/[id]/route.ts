import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse } from "@/lib/estagios/estagio-access";
import {
  calcularDataFimEstimada,
  DEFAULT_DIAS_SEMANA,
  type DiasSemana,
} from "@/lib/estagios/date-calc";

export const runtime = "nodejs";

type PatchBody = {
  titulo?: string;
  empresa?: string;
  entidadeAcolhimento?: string;
  tutorId?: string;
  dataInicio?: string;
  totalHoras?: number;
  horasDiarias?: number;
  diasSemana?: Partial<DiasSemana>;
  estadoEstagio?: "em_curso" | "concluido" | "suspenso";
  horasRealizadas?: number;
};

function normalizeDiasSemana(input?: Partial<DiasSemana>): DiasSemana {
  return {
    seg: input?.seg ?? DEFAULT_DIAS_SEMANA.seg,
    ter: input?.ter ?? DEFAULT_DIAS_SEMANA.ter,
    qua: input?.qua ?? DEFAULT_DIAS_SEMANA.qua,
    qui: input?.qui ?? DEFAULT_DIAS_SEMANA.qui,
    sex: input?.sex ?? DEFAULT_DIAS_SEMANA.sex,
    sab: input?.sab ?? DEFAULT_DIAS_SEMANA.sab,
    dom: input?.dom ?? DEFAULT_DIAS_SEMANA.dom,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await assertEstagioAccess(id, "director");
    const body = (await request.json()) as PatchBody;
    const db = getFirebaseAdminDb();

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (typeof body.titulo === "string" && body.titulo.trim().length > 0) {
      updates.titulo = body.titulo.trim();
    }
    if (typeof body.empresa === "string") {
      updates.empresa = body.empresa.trim();
      updates.entidadeAcolhimento = body.entidadeAcolhimento ?? body.empresa.trim();
    }
    if (typeof body.entidadeAcolhimento === "string") {
      updates.entidadeAcolhimento = body.entidadeAcolhimento.trim();
    }
    if (typeof body.tutorId === "string") {
      updates.tutorId = body.tutorId.trim();
    }
    if (
      body.estadoEstagio &&
      ["em_curso", "concluido", "suspenso"].includes(body.estadoEstagio)
    ) {
      updates.estadoEstagio = body.estadoEstagio;
      updates.estado = body.estadoEstagio === "concluido" ? "concluido" : "ativo";
    }
    if (typeof body.horasRealizadas === "number" && body.horasRealizadas >= 0) {
      updates.horasRealizadas = body.horasRealizadas;
    }

    const hasScheduleChanges =
      typeof body.dataInicio === "string" ||
      typeof body.totalHoras === "number" ||
      typeof body.horasDiarias === "number" ||
      body.diasSemana;

    if (hasScheduleChanges) {
      const existing = session.estagio as typeof session.estagio & {
        dataInicio?: string;
        totalHoras?: number;
        horasDiarias?: number;
        diasSemana?: Partial<DiasSemana>;
      };
      const dataInicio = body.dataInicio ?? existing.dataInicio ?? "";
      const totalHoras = Number(body.totalHoras ?? existing.totalHoras ?? 0);
      const horasDiarias = Number(body.horasDiarias ?? existing.horasDiarias ?? 0);
      const diasSemana = normalizeDiasSemana(body.diasSemana ?? existing.diasSemana);

      if (dataInicio && totalHoras > 0 && horasDiarias > 0) {
        const dateCalc = calcularDataFimEstimada({
          dataInicio,
          totalHoras,
          horasDiarias,
          diasSemana,
        });
        updates.dataInicio = dataInicio;
        updates.totalHoras = totalHoras;
        updates.horasDiarias = horasDiarias;
        updates.diasSemana = diasSemana;
        updates.dataFimEstimada = dateCalc.dataFimEstimada;
      }
    }

    await db.collection("estagios").doc(id).update(updates);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
