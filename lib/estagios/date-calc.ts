import { getPortugueseHolidays } from "@/lib/estagios/pt-holidays";

export type DiasSemana = {
  seg: boolean;
  ter: boolean;
  qua: boolean;
  qui: boolean;
  sex: boolean;
  sab: boolean;
  dom: boolean;
};

export const DEFAULT_DIAS_SEMANA: DiasSemana = {
  seg: true,
  ter: true,
  qua: true,
  qui: true,
  sex: true,
  sab: false,
  dom: false,
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const WEEKDAY_KEYS: (keyof DiasSemana)[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export type DateCalcInput = {
  dataInicio: string; // ISO YYYY-MM-DD
  totalHoras: number;
  horasDiarias: number;
  diasSemana: DiasSemana;
};

export type DateCalcResult = {
  dataFimEstimada: string; // ISO YYYY-MM-DD
  diasUteis: number;
  horasPorDia: number;
  totalHoras: number;
};

/**
 * Dada a configuração de um estágio, calcula a data estimada de fim.
 * Avança dia a dia a partir de `dataInicio`, acumulando `horasDiarias` por cada
 * dia útil (ativo em `diasSemana` e fora de feriados nacionais portugueses),
 * até atingir `totalHoras`. Devolve também o número de dias úteis consumidos.
 */
export function calcularDataFimEstimada(input: DateCalcInput): DateCalcResult {
  const { dataInicio, totalHoras, horasDiarias, diasSemana } = input;

  if (!dataInicio || !Number.isFinite(totalHoras) || totalHoras <= 0) {
    return { dataFimEstimada: dataInicio, diasUteis: 0, horasPorDia: horasDiarias, totalHoras };
  }

  if (!Number.isFinite(horasDiarias) || horasDiarias <= 0) {
    return { dataFimEstimada: dataInicio, diasUteis: 0, horasPorDia: horasDiarias, totalHoras };
  }

  const anyDayActive = WEEKDAY_KEYS.some((key) => diasSemana[key]);
  if (!anyDayActive) {
    return { dataFimEstimada: dataInicio, diasUteis: 0, horasPorDia: horasDiarias, totalHoras };
  }

  const [ySt, mSt, dSt] = dataInicio.split("-").map((n) => Number.parseInt(n, 10));
  if (!ySt || !mSt || !dSt) {
    return { dataFimEstimada: dataInicio, diasUteis: 0, horasPorDia: horasDiarias, totalHoras };
  }

  // Ceil para número de dias úteis necessários.
  const diasNecessarios = Math.ceil(totalHoras / horasDiarias);

  // Limite superior razoável para evitar loops patológicos (estágio máximo ~10 anos).
  const HARD_LIMIT_DAYS = 366 * 10;

  const cursor = new Date(ySt, mSt - 1, dSt);
  const holidays = getPortugueseHolidays(ySt, ySt + 10);
  let diasUteisRestantes = diasNecessarios;
  let ultimoDiaUtil = toIsoDate(cursor);
  let safety = 0;

  while (diasUteisRestantes > 0 && safety < HARD_LIMIT_DAYS) {
    const iso = toIsoDate(cursor);
    const weekday = cursor.getDay(); // 0=Dom, 6=Sáb
    const keyIdx = weekday; // index in WEEKDAY_KEYS
    const key = WEEKDAY_KEYS[keyIdx];
    const isActiveDay = Boolean(diasSemana[key]);
    const isHoliday = holidays.has(iso);

    if (isActiveDay && !isHoliday) {
      ultimoDiaUtil = iso;
      diasUteisRestantes -= 1;
      if (diasUteisRestantes <= 0) break;
    }

    cursor.setDate(cursor.getDate() + 1);
    safety += 1;
  }

  return {
    dataFimEstimada: ultimoDiaUtil,
    diasUteis: diasNecessarios,
    horasPorDia: horasDiarias,
    totalHoras,
  };
}

/**
 * Recalcula a data de fim estimada com base nas horas efetivamente realizadas.
 *
 * Projeta a partir de `startFrom`+1 dia (se fornecido) ou hoje+1 (fallback),
 * garantindo que o estágio tenha sempre dias futuros suficientes.
 *
 * Se horasRestantes <= 0, retorna dataFimEstimada vazia (estágio concluído).
 */
export function recalcularDataFimEstimada(input: {
  totalHoras: number;
  horasRealizadas: number;
  horasDiarias: number;
  diasSemana: DiasSemana;
  startFrom?: string; // ISO YYYY-MM-DD — project from day AFTER this
}): DateCalcResult {
  const { totalHoras, horasRealizadas, horasDiarias, diasSemana, startFrom } = input;

  if (!Number.isFinite(totalHoras) || !Number.isFinite(horasRealizadas)) {
    return { dataFimEstimada: "", diasUteis: 0, horasPorDia: horasDiarias, totalHoras };
  }

  if (!Number.isFinite(horasDiarias) || horasDiarias <= 0) {
    return { dataFimEstimada: "", diasUteis: 0, horasPorDia: horasDiarias, totalHoras };
  }

  const anyDayActive = WEEKDAY_KEYS.some((key) => diasSemana[key]);
  if (!anyDayActive) {
    return { dataFimEstimada: "", diasUteis: 0, horasPorDia: horasDiarias, totalHoras };
  }

  const horasRestantes = Math.max(0, totalHoras - horasRealizadas);
  if (horasRestantes <= 0) {
    return { dataFimEstimada: "", diasUteis: 0, horasPorDia: horasDiarias, totalHoras }; // concluído
  }

  const diasNecessarios = Math.ceil(horasRestantes / horasDiarias) + 1; // +1 día extra para garantir horas completas

  // Projetar a partir do dia seguinte a startFrom (ou hoje+1 se não fornecido)
  let cursor: Date;
  if (startFrom) {
    const [y, m, d] = startFrom.split("-").map(Number);
    cursor = new Date(y, m - 1, d + 1);
  } else {
    const hoje = new Date();
    cursor = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
  }
  const holidays = getPortugueseHolidays(cursor.getFullYear(), cursor.getFullYear() + 10);
  let diasUteisRestantes = diasNecessarios;
  let ultimoDiaUtil = toIsoDate(cursor);
  let safety = 0;
  const HARD_LIMIT_DAYS = 366 * 10;

  while (diasUteisRestantes > 0 && safety < HARD_LIMIT_DAYS) {
    const iso = toIsoDate(cursor);
    const weekday = cursor.getDay();
    const key = WEEKDAY_KEYS[weekday] as keyof DiasSemana;
    const isActiveDay = Boolean(diasSemana[key]);
    const isHoliday = holidays.has(iso);

    if (isActiveDay && !isHoliday) {
      ultimoDiaUtil = iso;
      diasUteisRestantes -= 1;
      if (diasUteisRestantes <= 0) break;
    }

    cursor.setDate(cursor.getDate() + 1);
    safety += 1;
  }

  return {
    dataFimEstimada: ultimoDiaUtil,
    diasUteis: diasNecessarios,
    horasPorDia: horasDiarias,
    totalHoras,
  };
}

// ---------------------------------------------------------------------------
// Replay de aprovações (cálculo de excesso de pushes / accumulated corrigido)
// ---------------------------------------------------------------------------

export type ReplayRequest = {
  hoursAffected: number;
  absenceType?: string;
};

export type ReplayResult = {
  excessPushes: number;
  correctAcc: number;
  oldPushes: number;
  newPushes: number;
  oldAcc: number;
  newAcc: number;
};

/**
 * Replay das aprovações de future_absence para calcular:
 * - oldPushes / oldAcc: quantos pushes e accumulated o código antigo teria gerado
 *   (cada pedido usa horasPorDia, ignorando hoursAffected)
 * - newPushes / newAcc: quantos pushes e accumulated o código corrigido gera
 *   (pedidos parciais usam hoursAffected real)
 *
 * excessPushes = oldPushes - newPushes  (dias a recuar na dataFimEstimada)
 * correctAcc   = newAcc                (accumulated corrigido)
 */
export function calcularReplayAbsences(
  preAcc: number,
  requests: ReplayRequest[],
  horasPorDia: number,
): ReplayResult {
  let oldAcc = preAcc;
  let newAcc = preAcc;
  let oldPushes = 0;
  let newPushes = 0;

  for (const req of requests) {
    // Old code path: sempre usava horasPorDia (hoursAffected era 0 ou ignorado)
    oldAcc += horasPorDia;
    while (oldAcc >= horasPorDia) {
      oldAcc -= horasPorDia;
      oldPushes++;
    }

    // New code path: usa hoursAffected se for partial && > 0, senão horasPorDia
    const addedHours =
      req.absenceType === "partial" && req.hoursAffected > 0
        ? req.hoursAffected
        : horasPorDia;
    newAcc += addedHours;
    while (newAcc >= horasPorDia) {
      newAcc -= horasPorDia;
      newPushes++;
    }
  }

  return {
    excessPushes: oldPushes - newPushes,
    correctAcc: newAcc,
    oldPushes,
    newPushes,
    oldAcc,
    newAcc,
  };
}

/**
 * Versão por fórmula fechada do replay — deve dar o mesmo resultado que
 * calcularReplayAbsences. Útil para verificação cruzada em testes.
 */
export function calcularReplayFormula(
  preAcc: number,
  requests: ReplayRequest[],
  horasPorDia: number,
): Pick<ReplayResult, "excessPushes" | "correctAcc"> {
  let oldTotal = 0;
  let newTotal = 0;

  for (const req of requests) {
    oldTotal += horasPorDia;
    const addedHours =
      req.absenceType === "partial" && req.hoursAffected > 0
        ? req.hoursAffected
        : horasPorDia;
    newTotal += addedHours;
  }

  const oldPushes = Math.floor((preAcc + oldTotal) / horasPorDia);
  const newPushes = Math.floor((preAcc + newTotal) / horasPorDia);

  return {
    excessPushes: Math.max(0, oldPushes - newPushes),
    correctAcc: (preAcc + newTotal) % horasPorDia,
  };
}

// ---------------------------------------------------------------------------
// Cálculo de data fim com ausências (walk real dia-a-dia)
// ---------------------------------------------------------------------------

export type AusenciaRequest = {
  targetDate: string;
  absenceType?: string;
  hoursAffected: number;
};

export type DataFimComAusenciasResult = {
  dataFim: string;
  diasUteis: number;
  horasAcumInicio: number;
  horasAcumFim: number;
};

/**
 * Projeta a data de fim considerando ausências aprovadas.
 *
 * Caminha dia-a-dia a partir de `startFrom+1`, acumulando horas reais:
 *   - partial absence: usa `hoursAffected`
 *   - total absence / company_closure: usa 0h
 *   - sem ausência: usa `horasDiarias`
 *
 * Para quando accumulated >= totalHoras.
 */
export function calcularDataFimComAusencias(input: {
  totalHoras: number;
  horasRealizadas: number;
  horasDiarias: number;
  diasSemana: DiasSemana;
  startFrom: string;
  requests: AusenciaRequest[];
}): DataFimComAusenciasResult {
  const { totalHoras, horasRealizadas, horasDiarias, diasSemana, startFrom, requests } = input;

  const absMap = new Map<string, number>();
  for (const r of requests) {
    const isPartial = r.absenceType === "partial" && r.hoursAffected > 0;
    absMap.set(r.targetDate, isPartial ? r.hoursAffected : 0);
  }

  const [y, m, d] = startFrom.split("-").map(Number);
  const cursor = new Date(y, m - 1, d + 1);
  const holidays = getPortugueseHolidays(cursor.getFullYear(), cursor.getFullYear() + 10);

  let acc = horasRealizadas;
  let days = 0;
  let lastDate = "";
  let accInicio = 0;

  while (acc < totalHoras) {
    const iso = toIsoDate(cursor);
    const key = WEEKDAY_KEYS[cursor.getDay()] as keyof DiasSemana;

    if (diasSemana[key] && !holidays.has(iso)) {
      const h = absMap.has(iso) ? (absMap.get(iso) as number) : horasDiarias;
      accInicio = acc;
      acc += h;
      days++;
      lastDate = iso;
      if (acc >= totalHoras) break;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    dataFim: lastDate,
    diasUteis: days,
    horasAcumInicio: accInicio,
    horasAcumFim: acc,
  };
}

export function formatIsoDatePt(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
