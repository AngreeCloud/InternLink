import { describe, expect, it } from "vitest";
import {
  calcNewEndDate,
  canRequestEarlyTermination,
  getNextStatus,
  validateNoOverlap,
  requiresApproval,
} from "@/lib/estagios/schedule-change-requests";

const weekdayDias = { seg: true, ter: true, qua: true, qui: true, sex: true };
const onlySab = { seg: false, ter: false, qua: false, qui: false, sex: false, sab: true, dom: false };
const segQua = { seg: true, ter: false, qua: true, qui: false, sex: false, sab: false, dom: false };

describe("calcNewEndDate", () => {
  // --- Básicos ---
  it("Wed→Thu same week", () => {
    expect(calcNewEndDate("2026-07-01", weekdayDias)).toBe("2026-07-02");
  });
  it("Fri→Mon skip weekend", () => {
    expect(calcNewEndDate("2026-07-03", weekdayDias)).toBe("2026-07-06");
  });
  it("Sat→Mon (sáb não é dia útil)", () => {
    expect(calcNewEndDate("2026-07-04", weekdayDias)).toBe("2026-07-06");
  });
  it("Sun→Mon", () => {
    expect(calcNewEndDate("2026-07-05", weekdayDias)).toBe("2026-07-06");
  });

  // --- Feriados portugueses ---
  it("skips Portugal Day (10 Jun)", () => {
    // 2026-06-09 Tue → next workday skips 10/Jun (feriado) → 11/Jun Thu
    expect(calcNewEndDate("2026-06-09", weekdayDias)).toBe("2026-06-11");
  });
  it("skips Labour Day (1 May)", () => {
    // 2026-04-30 Thu → next skips 01/May → 04/May Mon (02/May sáb, 03/May dom)
    expect(calcNewEndDate("2026-04-30", weekdayDias)).toBe("2026-05-04");
  });
  it("skips Christmas (25 Dec) — Fri 24 Dec → Mon 28 Dec", () => {
    // 2026-12-24 Thu → 25/Dec sex feriado → 26 sáb → 27 dom → 28 seg
    expect(calcNewEndDate("2026-12-24", weekdayDias)).toBe("2026-12-28");
  });
  it("skips New Year (1 Jan) — Wed 31 Dec → Fri 02 Jan", () => {
    // 2025-12-31 Wed → 01/Jan Thu feriado → 02/Jun sex (workday) → 02 Jan
    expect(calcNewEndDate("2025-12-31", weekdayDias)).toBe("2026-01-02");
  });

  it("skips multiple consecutive holidays — Easter + Liberty (25 Apr overlapping or close)", () => {
    // 2026-04-24 Fri → 25/Abr sáb (feriado) → 26 dom (não útil) → 27 seg
    // Wait, 25 Apr 2026 is Saturday. But our weekdays are seg-sex.
    // Fri 24 Apr → 25 Apr is Saturday (not a workday anyway) → 26 Sun → 27 Mon
    // But 25 Apr IS a Portuguese holiday. Saturday is not a workday in weekdayDias.
    // So the next workday after Fri 24 Apr is Mon 27 Apr.
    // Holidays on non-workdays don't matter — already skipped.
    expect(calcNewEndDate("2026-04-24", weekdayDias)).toBe("2026-04-27");
  });

  it("Easter Sunday 2026-04-05 — Fri 03 Apr → Wed 08 Apr (Mon 06 is holiday)", () => {
    // Easter 2026 is Apr 5 (Sunday). Carnival = -47 days, Good Friday = -2 days, Easter = 0, Corpus Christi = +60
    // Good Friday 2026 = Apr 3 (Friday!!!). Carnival 2026 = Feb 17.
    // So Fri Apr 3 is Good Friday = holiday. Next workday: Mon Apr 6 is the Monday after Easter...
    // Actually wait: Easter = Apr 5, 2026 (Sunday). Good Friday = Apr 3 (Friday).
    // Apr 3 is a Friday AND a holiday (Sexta-feira Santa).
    // So Apr 3 Fri is a holiday → skip. Apr 4 Sat → skip. Apr 5 Sun → skip. Apr 6 Mon → OK.
    expect(calcNewEndDate("2026-04-02", weekdayDias)).toBe("2026-04-06");
  });

  it("Corpus Christi 2026 — 04 Jun Thu → Mon 08 Jun (skip Fri? No, Corpus is Thu 04 Jun)", () => {
    // Corpus Christi 2026 = Easter + 60 days. Easter = Apr 5. Apr 5 + 60 = Jun 4, 2026.
    // Jun 4 2026 is Thursday. So Thu 04 Jun is a holiday.
    // calcNewEndDate("2026-06-03", weekdayDias) → next after Wed 03 Jun.
    // Thu 04 Jun is holiday → skip. Fri 05 Jun → OK.
    expect(calcNewEndDate("2026-06-03", weekdayDias)).toBe("2026-06-05");
  });

  // --- DiasSemana alternativos ---
  it("only sab: Fri 03 Jul → Sat 04 Jul", () => {
    expect(calcNewEndDate("2026-07-03", onlySab)).toBe("2026-07-04");
  });
  it("only sab: Sat 04 Jul → Mon 06? No, next Sat is 11 Jul (skip Sun-Fri)", () => {
    // Sat 04 Jul is a workday. Next workday = Sat 11 Jul.
    expect(calcNewEndDate("2026-07-04", onlySab)).toBe("2026-07-11");
  });
  it("seg+qua: Wed 08 Jul → Mon 13 Jul (skip qui,sex,sáb,dom)", () => {
    // seg+qua: Wed 08 Jul → Thu 09 (skip), Fri 10 (skip), Sat 11 (skip), Sun 12 (skip), Mon 13 (seg OK)
    expect(calcNewEndDate("2026-07-08", segQua)).toBe("2026-07-13");
  });
  it("seg+qua: Mon 13 Jul → Wed 15 Jul", () => {
    expect(calcNewEndDate("2026-07-13", segQua)).toBe("2026-07-15");
  });

  // --- Edge cases ---
  it("returns empty string when currentEndDate is empty", () => {
    expect(calcNewEndDate("", weekdayDias)).toBe("");
  });
  it("returns original when no workdays active", () => {
    expect(calcNewEndDate("2026-07-03", {})).toBe("2026-07-03");
  });
  it("returns original when invalid date", () => {
    expect(calcNewEndDate("not-a-date", weekdayDias)).toBe("not-a-date");
  });
});
