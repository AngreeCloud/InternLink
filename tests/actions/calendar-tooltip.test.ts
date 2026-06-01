import { describe, expect, it } from "vitest";
import { calcTooltipDayInfo } from "@/lib/estagios/calendar-tooltip";
import type { TooltipDayInfo } from "@/lib/estagios/calendar-tooltip";

type ReqEntry = { status: string; absenceType?: string; hoursAffected?: number };

function reqs(
  entries: [string, ReqEntry][],
): Map<string, ReqEntry> {
  return new Map(entries);
}

function fixt(
  tooltipDay: string,
  overrides?: Partial<{
    workDays: { iso: string }[];
    presencas: Record<string, { hoursWorked?: number }>;
    presencaSet: Set<string>;
    requestsByDate: Map<string, ReqEntry>;
    horasDiarias: number;
  }>,
): TooltipDayInfo {
  const workDays = overrides?.workDays ?? [
    { iso: "2026-05-11" },
    { iso: "2026-05-12" },
    { iso: "2026-05-13" },
    { iso: "2026-05-14" },
    { iso: "2026-05-15" },
  ];
  const presencas = overrides?.presencas ?? {};
  const presencaSet = overrides?.presencaSet ?? new Set<string>();
  const requestsByDate = overrides?.requestsByDate ?? new Map();
  const horasDiarias = overrides?.horasDiarias ?? 7.5;
  return calcTooltipDayInfo(
    tooltipDay,
    workDays,
    presencas,
    presencaSet,
    requestsByDate,
    horasDiarias,
  );
}

function presenca(iso: string, hours: number): Record<string, { hoursWorked: number }> {
  return { [iso]: { hoursWorked: hours } };
}

function presencaSetFrom(...isos: string[]): Set<string> {
  return new Set(isos);
}

// ---------------------------------------------------------------------------
// hasRegistered
// ---------------------------------------------------------------------------
describe("hasRegistered", () => {
  it("returns true when day has registered hours > 0", () => {
    const r = fixt("2026-05-13", {
      presencas: presenca("2026-05-13", 3),
      presencaSet: presencaSetFrom("2026-05-13"),
    });
    expect(r.hasRegistered).toBe(true);
    expect(r.registadasDia).toBe(3);
  });

  it("returns false when day has no presenca", () => {
    const r = fixt("2026-05-13");
    expect(r.hasRegistered).toBe(false);
    expect(r.registadasDia).toBe(0);
  });

  it("returns false when presenca exists but hoursWorked = 0", () => {
    const r = fixt("2026-05-13", {
      presencas: { "2026-05-13": { hoursWorked: 0 } },
      presencaSet: new Set<string>(),
    });
    expect(r.hasRegistered).toBe(false);
    expect(r.registadasDia).toBe(0);
  });

  it("returns false when presencaSet lacks the day even if presencas dict has it", () => {
    const r = fixt("2026-05-13", {
      presencas: presenca("2026-05-13", 3),
      presencaSet: new Set<string>(),
    });
    expect(r.hasRegistered).toBe(false);
    expect(r.registadasDia).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// acumuladas
// ---------------------------------------------------------------------------
describe("acumuladas", () => {
  it("sums all registered hours when all days have presencas", () => {
    const r = fixt("2026-05-14", {
      presencas: {
        "2026-05-11": { hoursWorked: 7 },
        "2026-05-12": { hoursWorked: 7 },
        "2026-05-13": { hoursWorked: 3 },
        "2026-05-14": { hoursWorked: 7 },
      },
      presencaSet: presencaSetFrom("2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14"),
    });
    expect(r.acumuladas).toBe(24);
  });

  it("uses horasDiarias when no presenca exists for a day", () => {
    const r = fixt("2026-05-13", { horasDiarias: 7.5 });
    expect(r.acumuladas).toBe(22.5); // 3 dias × 7.5
  });

  it("mixes real registered hours with predicted for unregistered days", () => {
    const r = fixt("2026-05-14", {
      workDays: [
        { iso: "2026-05-11" },
        { iso: "2026-05-12" },
        { iso: "2026-05-13" },
        { iso: "2026-05-14" },
      ],
      presencas: presenca("2026-05-12", 7),
      presencaSet: presencaSetFrom("2026-05-12"),
      horasDiarias: 7.5,
    });
    // day11: 7.5 (predicted), day12: 7 (real), day13: 7.5, day14: 7.5
    expect(r.acumuladas).toBe(29.5);
  });

  it("returns 0 when workDays is empty", () => {
    const r = fixt("2026-05-13", { workDays: [] });
    expect(r.acumuladas).toBe(0);
  });

  it("stops at tooltipDay and does not include later days", () => {
    const r = fixt("2026-05-12", {
      presencas: {
        "2026-05-11": { hoursWorked: 7 },
        "2026-05-12": { hoursWorked: 7 },
        "2026-05-15": { hoursWorked: 99 },
      },
      presencaSet: presencaSetFrom("2026-05-11", "2026-05-12", "2026-05-15"),
    });
    expect(r.acumuladas).toBe(14); // day15 excluded
  });
});

// ---------------------------------------------------------------------------
// absences via requestsByDate
// ---------------------------------------------------------------------------
describe("absences via requestsByDate", () => {
  it("total absence → 0 for that day", () => {
    const r = fixt("2026-05-14", {
      workDays: [{ iso: "2026-05-12" }, { iso: "2026-05-13" }, { iso: "2026-05-14" }],
      requestsByDate: reqs([["2026-05-13", { status: "approved", absenceType: "total", hoursAffected: 0 }]]),
      horasDiarias: 7.5,
    });
    expect(r.acumuladas).toBe(15); // 7.5 + 0 + 7.5
  });

  it("partial absence → reduced hours for that day", () => {
    const r = fixt("2026-05-14", {
      workDays: [{ iso: "2026-05-12" }, { iso: "2026-05-13" }, { iso: "2026-05-14" }],
      requestsByDate: reqs([["2026-05-13", { status: "approved", absenceType: "partial", hoursAffected: 3.5 }]]),
      horasDiarias: 7.5,
    });
    expect(r.acumuladas).toBe(19); // 7.5 + 4 + 7.5
  });

  it("pending absence treated same as approved", () => {
    const r = fixt("2026-05-14", {
      workDays: [{ iso: "2026-05-12" }, { iso: "2026-05-13" }, { iso: "2026-05-14" }],
      requestsByDate: reqs([["2026-05-13", { status: "pending_professor", absenceType: "total", hoursAffected: 0 }]]),
      horasDiarias: 7.5,
    });
    expect(r.acumuladas).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// previstasDia
// ---------------------------------------------------------------------------
describe("previstasDia", () => {
  it("returns horasDiarias when no request for the day", () => {
    const r = fixt("2026-05-13");
    expect(r.previstasDia).toBe(7.5);
  });

  it("returns 0 when total absence is approved", () => {
    const r = fixt("2026-05-13", {
      requestsByDate: reqs([["2026-05-13", { status: "approved", absenceType: "total" }]]),
    });
    expect(r.previstasDia).toBe(0);
  });

  it("returns reduced hours for partial absence", () => {
    const r = fixt("2026-05-13", {
      requestsByDate: reqs([["2026-05-13", { status: "approved", absenceType: "partial", hoursAffected: 3 }]]),
      horasDiarias: 7.5,
    });
    expect(r.previstasDia).toBe(4.5);
  });

  it("returns horasDiarias for rejected request", () => {
    const r = fixt("2026-05-13", {
      requestsByDate: reqs([["2026-05-13", { status: "rejected", absenceType: "total" }]]),
    });
    expect(r.previstasDia).toBe(7.5);
  });
});

// ---------------------------------------------------------------------------
// 0h registered + pending absence = 0h (not predicted)
// ---------------------------------------------------------------------------
describe("0h registadas + pedido de ausência", () => {
  it("day with 0h and absence returns hasRegistered=false, acumuladas=0 for that day", () => {
    const r = fixt("2026-05-13", {
      workDays: [{ iso: "2026-05-12" }, { iso: "2026-05-13" }, { iso: "2026-05-14" }],
      presencas: { "2026-05-12": { hoursWorked: 7 }, "2026-05-13": { hoursWorked: 0 } },
      presencaSet: presencaSetFrom("2026-05-12"),
      requestsByDate: reqs([["2026-05-13", { status: "approved", absenceType: "total" }]]),
      horasDiarias: 7.5,
    });
    expect(r.hasRegistered).toBe(false);
    expect(r.acumuladas).toBe(7); // 7 (real) + 0 (absence)
    expect(r.registadasDia).toBe(0);
    expect(r.previstasDia).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// base schedule change (7h → 7.5h)
// ---------------------------------------------------------------------------
describe("base schedule change 7h -> 7.5h", () => {
  it("past registered days use their real 7h, unregistered use new 7.5h", () => {
    const r = fixt("2026-05-15", {
      workDays: [
        { iso: "2026-05-11" },
        { iso: "2026-05-12" },
        { iso: "2026-05-13" },
        { iso: "2026-05-14" },
        { iso: "2026-05-15" },
      ],
      presencas: {
        "2026-05-11": { hoursWorked: 7 },
        "2026-05-12": { hoursWorked: 7 },
        "2026-05-14": { hoursWorked: 7 },
      },
      presencaSet: presencaSetFrom("2026-05-11", "2026-05-12", "2026-05-14"),
      horasDiarias: 7.5,
    });
    // day11: 7 (real), day12: 7 (real), day13: 7.5 (predicted), day14: 7 (real), day15: 7.5 (predicted)
    expect(r.acumuladas).toBe(36);
  });
});

// ---------------------------------------------------------------------------
// edge cases
// ---------------------------------------------------------------------------
describe("edge cases", () => {
  it("handles float hoursWorked correctly", () => {
    const r = fixt("2026-05-13", {
      presencas: presenca("2026-05-13", 3.25),
      presencaSet: presencaSetFrom("2026-05-13"),
    });
    expect(r.hasRegistered).toBe(true);
    expect(r.registadasDia).toBe(3.25);
  });

  it("tooltipDay before any workDay returns 0 accumulated", () => {
    const r = fixt("2026-05-01", {
      workDays: [{ iso: "2026-05-11" }, { iso: "2026-05-12" }],
    });
    expect(r.acumuladas).toBe(0);
  });

  it("single workday with registered hours", () => {
    const r = fixt("2026-05-11", {
      workDays: [{ iso: "2026-05-11" }],
      presencas: presenca("2026-05-11", 5),
      presencaSet: presencaSetFrom("2026-05-11"),
    });
    expect(r.hasRegistered).toBe(true);
    expect(r.acumuladas).toBe(5);
  });

  it("single workday without registered hours", () => {
    const r = fixt("2026-05-11", {
      workDays: [{ iso: "2026-05-11" }],
      horasDiarias: 7.5,
    });
    expect(r.hasRegistered).toBe(false);
    expect(r.acumuladas).toBe(7.5);
  });
});
