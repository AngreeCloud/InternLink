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

export function formatIsoDatePt(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
