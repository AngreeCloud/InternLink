/**
 * Feriados portugueses (nacionais) — fixos e móveis (baseados na Páscoa).
 *
 * Fonte: Lei n.º 23/2012 e alterações posteriores. Inclui os feriados nacionais
 * observados regularmente em Portugal continental. Feriados municipais e dias de
 * descanso locais NÃO são considerados — o utilizador pode excluí-los manualmente
 * via `diasSemana` se necessário.
 */

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Algoritmo de Meeus/Jones/Butcher para calcular a Páscoa no calendário gregoriano.
 * Devolve a data da Páscoa (Domingo de Páscoa) para um dado ano.
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Abr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Devolve um Set de datas ISO (YYYY-MM-DD) com todos os feriados nacionais
 * portugueses entre `yearStart` e `yearEnd` (inclusivo).
 */
export function getPortugueseHolidays(yearStart: number, yearEnd: number): Set<string> {
  const set = new Set<string>();
  for (let year = yearStart; year <= yearEnd; year++) {
    // Fixos
    set.add(`${year}-01-01`); // Ano Novo
    set.add(`${year}-04-25`); // Dia da Liberdade
    set.add(`${year}-05-01`); // Dia do Trabalhador
    set.add(`${year}-06-10`); // Dia de Portugal
    set.add(`${year}-08-15`); // Assunção de Nossa Senhora
    set.add(`${year}-10-05`); // Implantação da República
    set.add(`${year}-11-01`); // Dia de Todos-os-Santos
    set.add(`${year}-12-01`); // Restauração da Independência
    set.add(`${year}-12-08`); // Imaculada Conceição
    set.add(`${year}-12-25`); // Natal

    // Móveis (baseados na Páscoa)
    const easter = getEasterSunday(year);
    set.add(toIsoDate(addDays(easter, -47))); // Carnaval (feriado facultativo, mas habitualmente observado)
    set.add(toIsoDate(addDays(easter, -2))); // Sexta-feira Santa
    set.add(toIsoDate(easter)); // Domingo de Páscoa
    set.add(toIsoDate(addDays(easter, 60))); // Corpo de Deus
  }
  return set;
}

export function isPortugueseHoliday(dateIso: string, holidays: Set<string>): boolean {
  return holidays.has(dateIso);
}
