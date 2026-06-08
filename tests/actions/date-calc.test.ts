import { describe, expect, it } from "vitest";
import {
  recalcularDataFimEstimada,
  calcularDataFimEstimada,
  calcularDataFimComAusencias,
  calcularReplayAbsences,
  calcularReplayFormula,
  type DiasSemana,
  type ReplayRequest,
  type AusenciaRequest,
} from "@/lib/estagios/date-calc";

const segSex: DiasSemana = { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false };
const onlySab: DiasSemana = { seg: false, ter: false, qua: false, qui: false, sex: false, sab: true, dom: false };
const nenhum: DiasSemana = { seg: false, ter: false, qua: false, qui: false, sex: false, sab: false, dom: false };

/**
 * Pipeline completo:
 *   1) recalcularDataFimEstimada (raw, só presenças)
 *   2) calcularReplayAbsences (excesso de pushes)
 *   3) calcularDataFimComAusencias (walk real com ausências, função da app)
 * Faz asserções em todos os valores esperados.
 */
function testPipeline(
  totalHoras: number,
  horasRealizadas: number,
  horasDiarias: number,
  diasSemana: DiasSemana,
  startFrom: string,
  requests: { targetDate: string; isPartial: boolean; hoursAffected: number }[],
  preAcc: number,
  guardCurrentDate: string | null,
  want: {
    rawDate: string;
    diasUteis: number;
    excessPushes: number;
    correctAcc: number;
    realDate: string;
    realDays: number;
    realInicio: number;
    realFim: number;
  },
) {
  const horasRestantes = Math.max(0, totalHoras - horasRealizadas);

  // 1) Raw (só presenças)
  const raw = recalcularDataFimEstimada({
    totalHoras,
    horasRealizadas,
    horasDiarias,
    diasSemana,
    startFrom,
  });
  expect(raw.dataFimEstimada).toBe(want.rawDate);
  expect(raw.diasUteis).toBe(want.diasUteis);
  assertHorasUltimoDia(totalHoras, horasRestantes, want.diasUteis, horasDiarias, true);

  // 2) Replay de ausências
  const replayRequests: ReplayRequest[] = requests.map((r) => ({
    absenceType: r.isPartial ? "partial" : undefined,
    hoursAffected: r.hoursAffected,
  }));
  const replay = calcularReplayAbsences(preAcc, replayRequests, horasDiarias);
  expect(replay.excessPushes).toBe(want.excessPushes);
  expect(replay.correctAcc).toBe(want.correctAcc);

  // 3) Walk real com ausências (função exportada da app)
  const ausenciaRequests: AusenciaRequest[] = requests.map((r) => ({
    targetDate: r.targetDate,
    absenceType: r.isPartial ? "partial" : undefined,
    hoursAffected: r.hoursAffected,
  }));
  const real = calcularDataFimComAusencias({
    totalHoras,
    horasRealizadas,
    horasDiarias,
    diasSemana,
    startFrom,
    requests: ausenciaRequests,
  });
  expect(real.dataFim).toBe(want.realDate);
  expect(real.diasUteis).toBe(want.realDays);
  expect(real.horasAcumInicio).toBe(want.realInicio);
  expect(real.horasAcumFim).toBe(want.realFim);
}

function assertHorasUltimoDia(
  totalHoras: number,
  horasRestantes: number,
  diasUteis: number,
  horasDiarias: number,
  isRecalcular: boolean,
) {
  if (diasUteis <= 0) return;
  const diasReais = isRecalcular ? diasUteis - 1 : diasUteis;
  if (diasReais <= 0) return;
  const horasUltimoDia = horasRestantes - (diasReais - 1) * horasDiarias;
  expect(horasUltimoDia).toBeGreaterThan(0);
  expect(horasUltimoDia).toBeLessThanOrEqual(horasDiarias);
}

// ===========================================================================
// recalcularDataFimEstimada — full pipeline (presenças + ausências + walk)
// ===========================================================================
describe("recalcularDataFimEstimada — full pipeline", () => {
  type FullCase = {
    name: string;
    totalHoras: number;
    horasRealizadas: number;
    horasDiarias: number;
    diasSemana: DiasSemana;
    startFrom: string;
    requests: AbsenceRequest[];
    preAcc: number;
    guardCurrentDate: string | null;
    want: {
      rawDate: string;
      diasUteis: number;
      excessPushes: number;
      correctAcc: number;
      realDate: string;
      realDays: number;
      realInicio: number;
      realFim: number;
    };
  };

  const cases: FullCase[] = [
    // ════════════════════════════════════════════════════════════════════
    // CASO REAL — João da Ega
    //   total=400, realizadas=247, restantes=153, hpd=8, seg-sex
    //   ultPres=2026-06-03
    //   Ausências futuras:
    //     2026-06-05: company_closure (total)     → 0h
    //     2026-06-16: future_absence (partial 4h)  → 4h
    //     2026-06-23: future_absence (partial 4h)  → 4h
    //     2026-06-24: company_closure (total)     → 0h
    //     2026-06-30: future_absence (partial 4h)  → 4h
    // ════════════════════════════════════════════════════════════════════
    {
      name: "CASO REAL: 400h, 247 realiz, 8h/dia, 5 ausências futuras",
      totalHoras: 400, horasRealizadas: 247, horasDiarias: 8, diasSemana: segSex, startFrom: "2026-06-03",
      requests: [
        { targetDate: "2026-06-05", isPartial: false, hoursAffected: 0 },
        { targetDate: "2026-06-16", isPartial: true, hoursAffected: 4 },
        { targetDate: "2026-06-23", isPartial: true, hoursAffected: 4 },
        { targetDate: "2026-06-24", isPartial: false, hoursAffected: 0 },
        { targetDate: "2026-06-30", isPartial: true, hoursAffected: 4 },
      ],
      preAcc: 7,
      guardCurrentDate: null,
      want: {
        rawDate: "2026-07-06",         // ceil(153/8)+1 = 21 days
        diasUteis: 21,
        excessPushes: 1,               // old=8 pushes, new=7 pushes
        correctAcc: 3,
        realDate: "2026-07-08",        // walk: 23 days, last=Jul 8
        realDays: 23,
        realInicio: 395,
        realFim: 403,
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // 2h restantes + 1 partial 4h on 2026-06-05
    //   Walk: Jun 5 (partial 4h) → 402 ≥ 400 ✓  last=2026-06-05
    // ════════════════════════════════════════════════════════════════════
    {
      name: "2h restantes + 1 partial 4h: raw=2026-06-08, real=2026-06-05",
      totalHoras: 400, horasRealizadas: 398, horasDiarias: 8, diasSemana: segSex, startFrom: "2026-06-03",
      requests: [
        { targetDate: "2026-06-05", isPartial: true, hoursAffected: 4 },
      ],
      preAcc: 0,
      guardCurrentDate: null,
      want: {
        rawDate: "2026-06-08",         // ceil(2/8)+1 = 2 days
        diasUteis: 2,
        excessPushes: 1,
        correctAcc: 4,
        realDate: "2026-06-05",        // 1 day, partial 4h → completes
        realDays: 1,
        realInicio: 398,
        realFim: 402,
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // 400h scratch + 1 total on 2026-05-04 (Monday after Labour Day)
    //   Walk: May 4 → 0h. Precisa de 51 dias (50×8h + 1×0h = 400h)
    //   Sem ausência: 50 dias → Jun 25
    //   Com ausência: 51 dias → Jun 26
    // ════════════════════════════════════════════════════════════════════
    {
      name: "400h scratch + 1 total on 2026-05-04: real=2026-06-26",
      totalHoras: 400, horasRealizadas: 0, horasDiarias: 8, diasSemana: segSex, startFrom: "2026-04-13",
      requests: [
        { targetDate: "2026-05-04", isPartial: false, hoursAffected: 0 },
      ],
      preAcc: 0,
      guardCurrentDate: null,
      want: {
        rawDate: "2026-06-26",        // ceil(400/8)+1 = 51
        diasUteis: 51,
        excessPushes: 0,              // total absence: same on old+new paths
        correctAcc: 0,
        realDate: "2026-06-26",       // 51 days (50×8h + 1×0h)
        realDays: 51,
        realInicio: 392,
        realFim: 400,
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // Only saturday + 2 partial 4h
    //   2026-06-06 (Sat): partial 4h
    //   2026-06-13 (Sat): partial 4h
    // ════════════════════════════════════════════════════════════════════
    {
      name: "only saturday + 2 partial 4h: real=2026-09-05",
      totalHoras: 200, horasRealizadas: 100, horasDiarias: 8, diasSemana: onlySab, startFrom: "2026-06-03",
      requests: [
        { targetDate: "2026-06-06", isPartial: true, hoursAffected: 4 },
        { targetDate: "2026-06-13", isPartial: true, hoursAffected: 4 },
      ],
      preAcc: 0,
      guardCurrentDate: null,
      want: {
        rawDate: "2026-09-12",
        diasUteis: 14,
        excessPushes: 1,
        correctAcc: 0,
        realDate: "2026-09-12",
        realDays: 14,
        realInicio: 196,
        realFim: 204,
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // 200h restantes + 1 partial 6h on 2026-06-05
    //   Walk: Jun 5 (6h) + 25×8h = 206h. Último dia = Jul 13 (26th day).
    // ════════════════════════════════════════════════════════════════════
    {
      name: "200h restantes + 1 partial 6h: real=2026-07-13",
      totalHoras: 400, horasRealizadas: 200, horasDiarias: 8, diasSemana: segSex, startFrom: "2026-06-03",
      requests: [
        { targetDate: "2026-06-05", isPartial: true, hoursAffected: 6 },
      ],
      preAcc: 0,
      guardCurrentDate: null,
      want: {
        rawDate: "2026-07-13",
        diasUteis: 26,
        excessPushes: 1,
        correctAcc: 6,
        realDate: "2026-07-13",
        realDays: 26,
        realInicio: 398,
        realFim: 406,
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // 8h scratch + 1 partial 2h (preAcc=6 carry) on 2026-06-11
    //   Walk: Jun 11 (2h) → acc=2 (<8). Jun 12 (8h) → acc=10 ≥ 8 ✓
    //   preAcc=6 é do replay (counter), não afeta walk real.
    // ════════════════════════════════════════════════════════════════════
    {
      name: "8h scratch + 1 partial 2h (preAcc=6 carry): real=2026-06-12",
      totalHoras: 8, horasRealizadas: 0, horasDiarias: 8, diasSemana: segSex, startFrom: "2026-06-09",
      requests: [
        { targetDate: "2026-06-11", isPartial: true, hoursAffected: 2 },
      ],
      preAcc: 6,
      guardCurrentDate: null,
      want: {
        rawDate: "2026-06-12",
        diasUteis: 2,
        excessPushes: 0,
        correctAcc: 0,
        realDate: "2026-06-12",
        realDays: 2,
        realInicio: 2,
        realFim: 10,
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // 3 partial 4h (preAcc=7) — simplified CASO REAL sem total/closure
    //   Ausências em 2026-06-16, 2026-06-23, 2026-06-30
    //   Perde 12h (3×4h) vs raw 8h/dia → precisa +1 dia. 21 dias → Jul 6.
    // ════════════════════════════════════════════════════════════════════
    {
      name: "3 partial 4h (preAcc=7): 153h restantes, 3×4h ausências",
      totalHoras: 400, horasRealizadas: 247, horasDiarias: 8, diasSemana: segSex, startFrom: "2026-06-03",
      requests: [
        { targetDate: "2026-06-16", isPartial: true, hoursAffected: 4 },
        { targetDate: "2026-06-23", isPartial: true, hoursAffected: 4 },
        { targetDate: "2026-06-30", isPartial: true, hoursAffected: 4 },
      ],
      preAcc: 7,
      guardCurrentDate: null,
      want: {
        rawDate: "2026-07-06",
        diasUteis: 21,
        excessPushes: 1,
        correctAcc: 3,
        realDate: "2026-07-06",
        realDays: 21,
        realInicio: 395,
        realFim: 403,
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // CASO PÓS-PATCH: 260h realizadas, 4 ausências (sem closure Jun 5,
    // que está antes do startFromProjecao). startFrom=Jun 8 para
    // simular o safeguard que cap ultimaPresenca a ontem.
    //   Walk: Jun 9 a Jul 7 = 20 dias, acum 392→400 (exactas).
    // ════════════════════════════════════════════════════════════════════
    {
      name: "PÓS-PATCH: 260h, 4 ausências, startFrom=Jun 8 → Jul 7 com 400h exactas",
      totalHoras: 400, horasRealizadas: 260, horasDiarias: 8, diasSemana: segSex, startFrom: "2026-06-08",
      requests: [
        { targetDate: "2026-06-16", isPartial: true, hoursAffected: 4 },
        { targetDate: "2026-06-23", isPartial: true, hoursAffected: 4 },
        { targetDate: "2026-06-24", isPartial: false, hoursAffected: 0 },
        { targetDate: "2026-06-30", isPartial: true, hoursAffected: 4 },
      ],
      preAcc: 7,
      guardCurrentDate: null,
      want: {
        rawDate: "2026-07-06",
        diasUteis: 19,
        excessPushes: 1,
        correctAcc: 3,
        realDate: "2026-07-07",
        realDays: 20,
        realInicio: 392,
        realFim: 400,
      },
    },
  ];

  for (const c of cases) {
    it(c.name, () => testPipeline(
      c.totalHoras, c.horasRealizadas, c.horasDiarias, c.diasSemana, c.startFrom,
      c.requests, c.preAcc, c.guardCurrentDate, c.want,
    ));
  }

  // ---- Concluído ----
  it("returns empty when all hours done", () => {
    const result = recalcularDataFimEstimada({
      totalHoras: 400, horasRealizadas: 400, horasDiarias: 8, diasSemana: segSex, startFrom: "2026-06-03",
    });
    expect(result.dataFimEstimada).toBe("");
    expect(result.diasUteis).toBe(0);
  });

  it("returns empty when more hours than total", () => {
    const result = recalcularDataFimEstimada({
      totalHoras: 400, horasRealizadas: 420, horasDiarias: 8, diasSemana: segSex, startFrom: "2026-06-03",
    });
    expect(result.dataFimEstimada).toBe("");
  });

  // ---- Invalid inputs ----
  it("returns empty when totalHoras=0", () => {
    const result = recalcularDataFimEstimada({
      totalHoras: 0, horasRealizadas: 0, horasDiarias: 8, diasSemana: segSex,
    });
    expect(result.dataFimEstimada).toBe("");
  });

  it("returns empty when horasDiarias=0", () => {
    const result = recalcularDataFimEstimada({
      totalHoras: 400, horasRealizadas: 200, horasDiarias: 0, diasSemana: segSex,
    });
    expect(result.dataFimEstimada).toBe("");
  });

  it("returns empty when no workdays active", () => {
    const result = recalcularDataFimEstimada({
      totalHoras: 400, horasRealizadas: 200, horasDiarias: 8, diasSemana: nenhum,
    });
    expect(result.dataFimEstimada).toBe("");
  });

  it("returns empty when NaN totalHoras", () => {
    const result = recalcularDataFimEstimada({
      totalHoras: Number.NaN, horasRealizadas: 200, horasDiarias: 8, diasSemana: segSex,
    });
    expect(result.dataFimEstimada).toBe("");
  });
});

// ===========================================================================
// calcularDataFimEstimada (a partir de dataInicio — sem pipeline de ausências)
// ===========================================================================
describe("calcularDataFimEstimada", () => {
  it("400h from 2026-04-13, 8h/dia, seg-sex", () => {
    const result = calcularDataFimEstimada({
      dataInicio: "2026-04-13",
      totalHoras: 400,
      horasDiarias: 8,
      diasSemana: segSex,
    });
    expect(result.dataFimEstimada).toBe("2026-06-24");
    expect(result.diasUteis).toBe(50);
    assertHorasUltimoDia(400, 400, 50, 8, false);
  });

  it("400h from 2026-04-13, 6h/dia", () => {
    const result = calcularDataFimEstimada({
      dataInicio: "2026-04-13",
      totalHoras: 400,
      horasDiarias: 6,
      diasSemana: segSex,
    });
    expect(result.diasUteis).toBe(67);
    const d = new Date(result.dataFimEstimada);
    expect(d.getDay()).not.toBe(0);
    expect(d.getDay()).not.toBe(6);
    assertHorasUltimoDia(400, 400, 67, 6, false);
  });

  it("only saturday, 400h from 2026-04-13", () => {
    const result = calcularDataFimEstimada({
      dataInicio: "2026-04-13",
      totalHoras: 400,
      horasDiarias: 8,
      diasSemana: onlySab,
    });
    expect(result.diasUteis).toBe(50);
    const d = new Date(result.dataFimEstimada);
    expect(d.getDay()).toBe(6);
    assertHorasUltimoDia(400, 400, 50, 8, false);
  });

  it("empty when no workdays", () => {
    const result = calcularDataFimEstimada({
      dataInicio: "2026-04-13",
      totalHoras: 400,
      horasDiarias: 8,
      diasSemana: nenhum,
    });
    expect(result.dataFimEstimada).toBe("2026-04-13");
    expect(result.diasUteis).toBe(0);
  });
});

// ===========================================================================
// calcularReplayAbsences
// ===========================================================================
describe("calcularReplayAbsences — replay de aprovações", () => {
  type Case = {
    name: string;
    preAcc: number;
    requests: ReplayRequest[];
    hpd: number;
    want: { excessPushes: number; correctAcc: number };
  };

  const cases: Case[] = [
    { name: "0→8→4: sem carry-over", preAcc: 0, requests: [{ absenceType: "partial", hoursAffected: 4 }], hpd: 8, want: { excessPushes: 1, correctAcc: 4 } },
    { name: "0→16→8: 2 parciais, sem carry", preAcc: 0, requests: [{ absenceType: "partial", hoursAffected: 4 }, { absenceType: "partial", hoursAffected: 4 }], hpd: 8, want: { excessPushes: 1, correctAcc: 0 } },
    { name: "0→24→12: 3 parciais, sem carry", preAcc: 0, requests: [{ absenceType: "partial", hoursAffected: 4 }, { absenceType: "partial", hoursAffected: 4 }, { absenceType: "partial", hoursAffected: 4 }], hpd: 8, want: { excessPushes: 2, correctAcc: 4 } },
    { name: "CASO REAL: 7→24→12 (preAcc=7)", preAcc: 7, requests: [{ absenceType: "partial", hoursAffected: 4 }, { absenceType: "partial", hoursAffected: 4 }, { absenceType: "partial", hoursAffected: 4 }], hpd: 8, want: { excessPushes: 1, correctAcc: 3 } },
    { name: "PÓS-FIX: 3→24→12 (preAcc=3, stored já corrigido)", preAcc: 3, requests: [{ absenceType: "partial", hoursAffected: 4 }, { absenceType: "partial", hoursAffected: 4 }, { absenceType: "partial", hoursAffected: 4 }], hpd: 8, want: { excessPushes: 2, correctAcc: 7 } },
    { name: "1 parcial 8→6h", preAcc: 0, requests: [{ absenceType: "partial", hoursAffected: 6 }], hpd: 8, want: { excessPushes: 1, correctAcc: 6 } },
    { name: "2 parciais 16→6+6=12", preAcc: 0, requests: [{ absenceType: "partial", hoursAffected: 6 }, { absenceType: "partial", hoursAffected: 6 }], hpd: 8, want: { excessPushes: 1, correctAcc: 4 } },
    { name: "preAcc=6, 8→2h", preAcc: 6, requests: [{ absenceType: "partial", hoursAffected: 2 }], hpd: 8, want: { excessPushes: 0, correctAcc: 0 } },
    { name: "2h carryover: 6+2=8→push0", preAcc: 6, requests: [{ absenceType: "partial", hoursAffected: 2 }], hpd: 8, want: { excessPushes: 0, correctAcc: 0 } },
    { name: "sem pedidos", preAcc: 0, requests: [], hpd: 8, want: { excessPushes: 0, correctAcc: 0 } },
    { name: "pedido full-day (absenceType ausente)", preAcc: 0, requests: [{ hoursAffected: 4 }], hpd: 8, want: { excessPushes: 0, correctAcc: 0 } },
    { name: "partial com hoursAffected=0 → usa hpd", preAcc: 0, requests: [{ absenceType: "partial", hoursAffected: 0 }], hpd: 8, want: { excessPushes: 0, correctAcc: 0 } },
    { name: "mistura: 1 partial + 1 full", preAcc: 0, requests: [{ absenceType: "partial", hoursAffected: 4 }, { hoursAffected: 8 }], hpd: 8, want: { excessPushes: 1, correctAcc: 4 } },
    { name: "preAcc grande: 7, 1×8→4", preAcc: 7, requests: [{ absenceType: "partial", hoursAffected: 4 }], hpd: 8, want: { excessPushes: 0, correctAcc: 3 } },
    { name: "1 requisição, 0→8h total (full-day, não partial)", preAcc: 0, requests: [{ hoursAffected: 0 }], hpd: 8, want: { excessPushes: 0, correctAcc: 0 } },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const result = calcularReplayAbsences(c.preAcc, c.requests, c.hpd);
      expect(result.excessPushes).toBe(c.want.excessPushes);
      expect(result.correctAcc).toBe(c.want.correctAcc);
    });
  }

  // ---- Verificação adicional: oldAcc deve ser sempre igual a preAcc
  it("oldAcc always equals preAcc when all requests push at least once", () => {
    const result = calcularReplayAbsences(7, [
      { absenceType: "partial", hoursAffected: 4 },
      { absenceType: "partial", hoursAffected: 4 },
      { absenceType: "partial", hoursAffected: 4 },
    ], 8);
    expect(result.oldAcc).toBe(7);
    expect(result.oldPushes).toBe(3);
  });

  it("oldAcc = preAcc even when preAcc is 0", () => {
    const result = calcularReplayAbsences(0, [
      { absenceType: "partial", hoursAffected: 4 },
    ], 8);
    expect(result.oldAcc).toBe(0);
    expect(result.oldPushes).toBe(1);
  });

  // ---- Verificação cruzada: replay (while-loop) == formula (fechada) ----
  function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  it("FORMULA: replay com while-loop deve dar igual à fórmula fechada", () => {
    for (let trial = 0; trial < 50; trial++) {
      const preAcc = randomInt(0, 7);
      const hpd = 8;
      const n = randomInt(0, 5);
      const requests: ReplayRequest[] = [];
      for (let i = 0; i < n; i++) {
        const isPartial = Math.random() > 0.3;
        requests.push({
          absenceType: isPartial ? "partial" : undefined,
          hoursAffected: isPartial ? randomInt(1, 7) : 0,
        });
      }
      const replay = calcularReplayAbsences(preAcc, requests, hpd);
      const formula = calcularReplayFormula(preAcc, requests, hpd);
      expect(replay.excessPushes).toBe(formula.excessPushes);
      expect(replay.correctAcc).toBe(formula.correctAcc);
    }
  });

  // ---- Invariantes ----
  it("correctAcc está sempre entre 0 e hpd-1", () => {
    for (let trial = 0; trial < 50; trial++) {
      const preAcc = randomInt(0, 7);
      const hpd = 8;
      const n = randomInt(0, 5);
      const requests: ReplayRequest[] = [];
      for (let i = 0; i < n; i++) {
        requests.push({
          absenceType: Math.random() > 0.3 ? "partial" : undefined,
          hoursAffected: randomInt(0, 8),
        });
      }
      const result = calcularReplayAbsences(preAcc, requests, hpd);
      expect(result.correctAcc).toBeGreaterThanOrEqual(0);
      expect(result.correctAcc).toBeLessThan(hpd);
      expect(result.oldAcc).toBeGreaterThanOrEqual(0);
      expect(result.oldAcc).toBeLessThan(hpd);
    }
  });

  it("excessPushes nunca é negativo", () => {
    const result = calcularReplayAbsences(0, [{ absenceType: "partial", hoursAffected: 10 }], 8);
    expect(result.excessPushes).toBe(0);
    expect(result.excessPushes).toBeGreaterThanOrEqual(0);
  });

  it("oldPushes === requests.length quando preAcc >= 0 (old code always pushes)", () => {
    const result = calcularReplayAbsences(0, [
      { hoursAffected: 0 },
      { hoursAffected: 0 },
      { hoursAffected: 0 },
    ], 8);
    expect(result.oldPushes).toBe(3);
  });
});
