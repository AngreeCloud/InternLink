/**
 * Pure business logic for Termino Antecipado (early internship termination).
 * No Firebase dependencies — fully testable in isolation.
 */

import { listWorkDays, toIsoDate, type DiasSemanaMap } from "@/lib/estagios/workdays";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TerminoAntecipadoStatus =
  | "pendente"
  | "aprovado"
  | "recusado"
  | "invalidado_por_incumprimento";

export type TerminoAntecipado = {
  id: string;
  estagioId: string;
  alunoId: string;
  alunoNome: string;
  tutorId: string;
  tutorNome: string;
  professorOrientadorId: string;
  professorOrientadorNome: string;
  encarregadoEducacaoId?: string;
  encarregadoEducacaoNome?: string;
  horasPrevistasTotais: number;
  horasRealizadasNaSubmissao: number;
  horasRestantesNaSubmissao: number;
  horasPorDia: number;
  diasParaCumprir: string[];
  diaDeDispensa: string;
  estado: TerminoAntecipadoStatus;
  submittedAt: unknown;
  respondidoAt?: unknown;
  motivoRecusa?: string;
  diaDeIncumprimento?: string;
  notificadosReadOnly: string[];
};

export type EligibilityResult = {
  elegivel: boolean;
  motivoNaoElegivel?: string;
  horasPrevistasTotais: number;
  horasRealizadas: number;
  horasRestantes: number;
  horasPorDia: number;
  diasParaCumprir: string[];
  diaDeDispensa?: string;
};

// ---------------------------------------------------------------------------
// Eligibility calculation
// ---------------------------------------------------------------------------

const LIMIAR_DIAS = 5;

/**
 * Checks if the student is eligible for an early termination request.
 *
 * Conditions:
 * 1. horasRestantes > 0
 * 2. horasRestantes < horasPorDia * 5
 * 3. There exists a partial last day (horasRestantes % horasPorDia !== 0)
 * 4. There are enough future workdays to calculate projection
 */
export function checkEligibility(
  horasRealizadas: number,
  totalHorasPrevistas: number,
  horasPorDia: number,
  dataInicio: string,
  dataFim: string,
  diasSemana: DiasSemanaMap
): EligibilityResult {
  const base = {
    horasPrevistasTotais: totalHorasPrevistas,
    horasRealizadas,
    horasRestantes: 0,
    horasPorDia,
    diasParaCumprir: [] as string[],
    diaDeDispensa: undefined as string | undefined,
  };

  if (!Number.isFinite(horasRealizadas) || !Number.isFinite(totalHorasPrevistas) || !Number.isFinite(horasPorDia)) {
    return { ...base, elegivel: false, motivoNaoElegivel: "Dados de horas inválidos." };
  }

  if (totalHorasPrevistas <= 0 || horasPorDia <= 0) {
    return { ...base, elegivel: false, motivoNaoElegivel: "Horas previstas ou horas por dia inválidas." };
  }

  const horasRestantes = Math.max(0, totalHorasPrevistas - horasRealizadas);
  base.horasRestantes = horasRestantes;

  if (horasRestantes <= 0) {
    return { ...base, elegivel: false, motivoNaoElegivel: "Total de horas já cumprido." };
  }

  const limiarAtivacao = horasPorDia * LIMIAR_DIAS;

  if (horasRestantes >= limiarAtivacao) {
    return {
      ...base,
      elegivel: false,
      motivoNaoElegivel: `Ainda faltam ${Math.ceil(horasRestantes / horasPorDia)} dias completos. O pedido só fica disponível quando as horas restantes forem inferiores a ${LIMIAR_DIAS} dias completos de trabalho.`,
    };
  }

  const horasNoUltimoDia = horasRestantes % horasPorDia;
  const temUltimoDiaParcial = horasNoUltimoDia > 0 && horasRestantes < limiarAtivacao;

  if (!temUltimoDiaParcial) {
    return {
      ...base,
      elegivel: false,
      motivoNaoElegivel: "As horas restantes equivalem a dias completos. Sem último dia parcial dispensável.",
    };
  }

  const projection = calculateProjection(horasRestantes, horasPorDia, dataInicio, dataFim, diasSemana);

  if (!projection) {
    return {
      ...base,
      elegivel: false,
      motivoNaoElegivel: "Não foi possível calcular a projeção de dias futuros.",
    };
  }

  if (projection.diasParaCumprir.length === 0) {
    return {
      ...base,
      elegivel: false,
      motivoNaoElegivel: "Não existem dias futuros suficientes para a projeção.",
    };
  }

  return {
    ...base,
    elegivel: true,
    diasParaCumprir: projection.diasParaCumprir,
    diaDeDispensa: projection.diaDeDispensa,
  };
}

// ---------------------------------------------------------------------------
// Projection calculation
// ---------------------------------------------------------------------------

export type Projection = {
  diasParaCumprir: string[];
  diaDeDispensa: string;
};

/**
 * Given remaining hours and the internship schedule, calculates which future
 * workdays must be completed and which last day can be dispensed.
 */
export function calculateProjection(
  horasRestantes: number,
  horasPorDia: number,
  dataInicio: string,
  dataFimEstimada: string,
  diasSemana: DiasSemanaMap
): Projection | null {
  if (!Number.isFinite(horasRestantes) || !Number.isFinite(horasPorDia) || horasPorDia <= 0) {
    return null;
  }

  if (horasRestantes <= 0) return null;

  const today = toIsoDate(new Date());

  const allWorkDays = listWorkDays(dataInicio, dataFimEstimada, diasSemana);
  if (allWorkDays.length === 0) return null;

  const futureDays = allWorkDays.filter((d) => d.iso >= today);
  if (futureDays.length === 0) return null;

  const diasNecessarios = Math.ceil(horasRestantes / horasPorDia);
  const diasAContar = futureDays.slice(0, diasNecessarios);

  if (diasAContar.length < 2) {
    return null;
  }

  const ultimoDiaPrevisto = diasAContar[diasAContar.length - 1];
  const diasParaCumprir = diasAContar.slice(0, -1);

  return {
    diasParaCumprir: diasParaCumprir.map((d) => d.iso),
    diaDeDispensa: ultimoDiaPrevisto.iso,
  };
}

// ---------------------------------------------------------------------------
// Validation for submission
// ---------------------------------------------------------------------------

export type SubmissionValidation =
  | { ok: true }
  | { ok: false; reason: string };

export function validateSubmission(
  horasRealizadas: number,
  totalHorasPrevistas: number,
  horasPorDia: number,
  existingActive: boolean
): SubmissionValidation {
  if (!Number.isFinite(horasRealizadas) || !Number.isFinite(totalHorasPrevistas) || !Number.isFinite(horasPorDia)) {
    return { ok: false, reason: "Dados de horas inválidos." };
  }

  const horasRestantes = Math.max(0, totalHorasPrevistas - horasRealizadas);

  if (horasRestantes <= 0) {
    return { ok: false, reason: "Total de horas já cumprido." };
  }

  if (horasRestantes >= horasPorDia * LIMIAR_DIAS) {
    return { ok: false, reason: "Horas restantes excedem o limite de 5 dias completos." };
  }

  if (horasRestantes % horasPorDia === 0) {
    return { ok: false, reason: "As horas restantes equivalem a dias completos. Sem dia parcial para dispensar." };
  }

  if (existingActive) {
    return { ok: false, reason: "Já existe uma solicitação ativa para este estágio." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Validation for approval
// ---------------------------------------------------------------------------

export function validateApproval(
  pedido: TerminoAntecipado,
  currentIso: string
): { ok: boolean; reason?: string } {
  if (pedido.estado !== "pendente") {
    return { ok: false, reason: `O pedido não está pendente (estado atual: ${pedido.estado}).` };
  }

  if (pedido.diaDeDispensa <= currentIso) {
    return { ok: false, reason: "O dia de dispensa já passou." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Invalidation check (called when presenca data changes)
// ---------------------------------------------------------------------------

export function checkInvalidation(
  pedido: TerminoAntecipado,
  dataPresenca: string,
  horasTrabalhadas: number,
  horasPrevistasNoDia: number
): { invalidar: boolean; motivo?: string } {
  if (pedido.estado !== "aprovado") {
    return { invalidar: false };
  }

  if (!pedido.diasParaCumprir.includes(dataPresenca)) {
    return { invalidar: false };
  }

  if (horasTrabalhadas < horasPrevistasNoDia) {
    return {
      invalidar: true,
      motivo: `Incumprimento horário no dia ${dataPresenca}: ${horasTrabalhadas}h trabalhadas vs ${horasPrevistasNoDia}h previstas.`,
    };
  }

  return { invalidar: false };
}

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

export function labelForTerminoStatus(status: TerminoAntecipadoStatus): string {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "aprovado":
      return "Aprovado";
    case "recusado":
      return "Recusado";
    case "invalidado_por_incumprimento":
      return "Invalidado por incumprimento";
  }
}

export function variantForTerminoStatus(
  status: TerminoAntecipadoStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "aprovado":
      return "default";
    case "pendente":
      return "secondary";
    case "recusado":
      return "destructive";
    case "invalidado_por_incumprimento":
      return "destructive";
  }
}
