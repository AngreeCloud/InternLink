import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse, EstagioAccessError } from "@/lib/estagios/estagio-access";
import { checkEligibility } from "@/lib/estagios/termino-antecipado";
import { normalizeDiasSemana } from "@/lib/estagios/workdays";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await assertEstagioAccess(id, "member");

    if (session.role !== "aluno") {
      throw new EstagioAccessError(403, "not_aluno", "Apenas o aluno pode verificar a elegibilidade.");
    }

    const estagio = session.estagio as Record<string, unknown>;
    const totalHoras = Number(estagio.totalHoras ?? 0) || 0;
    const horasDiarias = Number(estagio.horasDiarias ?? estagio.horasPorDia ?? 0) || 0;
    const dataInicio = (estagio.dataInicio as string | undefined) ?? "";
    const dataFim = (estagio.dataFimEstimada as string | undefined) ?? (estagio.dataFim as string | undefined) ?? "";
    const diasSemana = normalizeDiasSemana(estagio.diasSemana);

    if (!dataInicio || !dataFim || totalHoras <= 0 || horasDiarias <= 0) {
      return NextResponse.json({
        elegivel: false,
        motivoNaoElegivel: "Configuração de horário do estágio incompleta.",
        horasPrevistasTotais: totalHoras,
        horasRealizadas: 0,
        horasRestantes: 0,
        horasPorDia: horasDiarias,
        diasParaCumprir: [],
      });
    }

    const db = getFirebaseAdminDb();
    const presencasSnap = await db
      .collection("estagios")
      .doc(id)
      .collection("presencas")
      .get();

    let horasRealizadas = 0;
    presencasSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      horasRealizadas += Number(data.hoursWorked ?? 0) || 0;
    });

    const result = checkEligibility(
      horasRealizadas,
      totalHoras,
      horasDiarias,
      dataInicio,
      dataFim,
      diasSemana
    );

    return NextResponse.json(result);
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
