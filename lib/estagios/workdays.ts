import { getPortugueseHolidays } from "@/lib/estagios/pt-holidays";

export type DiasSemanaMap = {
  dom?: boolean;
  seg?: boolean;
  ter?: boolean;
  qua?: boolean;
  qui?: boolean;
  sex?: boolean;
  sab?: boolean;
};

const WEEKDAY_KEYS: (keyof DiasSemanaMap)[] = [
  "dom",
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sab",
];

const WEEKDAY_LABEL = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const WEEKDAY_LABEL_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIsoDate(iso: string): Date | null {
  if (!iso || typeof iso !== "string" || iso.length < 10) return null;
  const [y, m, d] = iso.split("-").map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatIsoPt(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function weekdayLabel(d: Date, short = false): string {
  return short ? WEEKDAY_LABEL_SHORT[d.getDay()] : WEEKDAY_LABEL[d.getDay()];
}

/**
 * Devolve o ISO-week (ano + semana) para uma data.
 * Norma ISO 8601: a semana 1 é a que contém a primeira quinta-feira do ano.
 */
export function getIsoWeek(date: Date): { year: number; week: number; weekId: string } {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Quinta-feira da mesma semana
  const dayNr = (target.getDay() + 6) % 7; // segunda=0, domingo=6
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstThursdayDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDayNr + 3);
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  const year = target.getFullYear();
  return { year, week, weekId: `${year}-W${pad(week)}` };
}

/**
 * Monday do ISO-week que contém a data dada.
 */
export function getIsoWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNr = (d.getDay() + 6) % 7; // segunda=0
  d.setDate(d.getDate() - dayNr);
  return d;
}

export type WorkDay = {
  iso: string;
  date: Date;
  weekday: number; // 0=Dom..6=Sáb
  weekId: string;
  weekStartIso: string;
  weekEndIso: string;
  weekNumber: number;
  weekYear: number;
};

export type WorkWeek = {
  weekId: string;
  weekNumber: number;
  weekYear: number;
  weekStartIso: string;
  weekEndIso: string;
  days: WorkDay[];
};

/**
 * Devolve todos os dias úteis (per diasSemana, excluindo feriados PT) entre
 * dataInicio e dataFim (inclusivo). Limitado a um intervalo razoável.
 */
export function listWorkDays(
  dataInicio: string,
  dataFim: string,
  diasSemana: DiasSemanaMap
): WorkDay[] {
  const start = parseIsoDate(dataInicio);
  const end = parseIsoDate(dataFim);
  if (!start || !end) return [];
  if (end.getTime() < start.getTime()) return [];

  const anyDayActive = WEEKDAY_KEYS.some((k) => diasSemana[k]);
  if (!anyDayActive) return [];

  const holidays = getPortugueseHolidays(start.getFullYear(), end.getFullYear() + 1);
  const days: WorkDay[] = [];
  const cursor = new Date(start);
  let safety = 0;
  const HARD_LIMIT = 366 * 6; // estágio máx ~6 anos
  while (cursor.getTime() <= end.getTime() && safety < HARD_LIMIT) {
    const iso = toIsoDate(cursor);
    const weekday = cursor.getDay();
    const key = WEEKDAY_KEYS[weekday];
    const isWorkday = Boolean(diasSemana[key]);
    const isHoliday = holidays.has(iso);
    if (isWorkday && !isHoliday) {
      const w = getIsoWeek(cursor);
      const weekStart = getIsoWeekStart(cursor);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      days.push({
        iso,
        date: new Date(cursor),
        weekday,
        weekId: w.weekId,
        weekStartIso: toIsoDate(weekStart),
        weekEndIso: toIsoDate(weekEnd),
        weekNumber: w.week,
        weekYear: w.year,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
    safety += 1;
  }
  return days;
}

/**
 * Agrupa dias úteis por ISO-week.
 */
export function groupWorkDaysByWeek(days: WorkDay[]): WorkWeek[] {
  const map = new Map<string, WorkWeek>();
  for (const d of days) {
    const existing = map.get(d.weekId);
    if (existing) {
      existing.days.push(d);
    } else {
      map.set(d.weekId, {
        weekId: d.weekId,
        weekNumber: d.weekNumber,
        weekYear: d.weekYear,
        weekStartIso: d.weekStartIso,
        weekEndIso: d.weekEndIso,
        days: [d],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.weekStartIso.localeCompare(b.weekStartIso)
  );
}

export function normalizeDiasSemana(raw: unknown): DiasSemanaMap {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: DiasSemanaMap = {};
  for (const k of WEEKDAY_KEYS) {
    if (o[k] === true) out[k] = true;
  }
  return out;
}
