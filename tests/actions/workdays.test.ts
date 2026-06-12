import { describe, expect, it } from "vitest";
import { listWorkDays } from "@/lib/estagios/workdays";
import type { DiasSemanaMap } from "@/lib/estagios/workdays";

const SEG_SEX: DiasSemanaMap = {
  seg: true,
  ter: true,
  qua: true,
  qui: true,
  sex: true,
};

describe("listWorkDays — includedDates", () => {
  it("includes a holiday date passed in includedDates", () => {
    // 2026-06-10 is Dia de Portugal (feriado), a Wednesday
    const result = listWorkDays("2026-06-08", "2026-06-12", SEG_SEX, undefined, new Set(["2026-06-10"]));
    const isos = result.map((d) => d.iso);
    expect(isos).toContain("2026-06-10"); // holiday included via includedDates
    expect(isos).toContain("2026-06-08"); // normal workday
    expect(isos).toContain("2026-06-09"); // normal workday
    expect(isos).toContain("2026-06-11"); // normal workday
    expect(isos).toContain("2026-06-12"); // normal workday
  });

  it("includes multiple holiday dates", () => {
    // 2026-04-25 (Liberdade, Sat) and 2026-05-01 (Trabalhador, Fri)
    const result = listWorkDays("2026-04-20", "2026-05-08", SEG_SEX, undefined, new Set(["2026-04-25", "2026-05-01"]));
    const isos = result.map((d) => d.iso);
    expect(isos).toContain("2026-04-25");
    expect(isos).toContain("2026-05-01");
  });

  it("does not include a holiday when not in includedDates", () => {
    const result = listWorkDays("2026-06-08", "2026-06-12", SEG_SEX);
    const isos = result.map((d) => d.iso);
    expect(isos).not.toContain("2026-06-10"); // holiday not included
  });

  it("includes a date that is not a normal workday (e.g., Saturday)", () => {
    // 2026-06-13 is a Saturday, not in SEG_SEX
    const result = listWorkDays("2026-06-08", "2026-06-15", SEG_SEX, undefined, new Set(["2026-06-13"]));
    const isos = result.map((d) => d.iso);
    expect(isos).toContain("2026-06-13");
  });

  it("excludedDates takes precedence over includedDates", () => {
    const result = listWorkDays("2026-06-08", "2026-06-12", SEG_SEX, new Set(["2026-06-10"]), new Set(["2026-06-10"]));
    const isos = result.map((d) => d.iso);
    expect(isos).not.toContain("2026-06-10");
  });

  it("included date respects the date range", () => {
    const result = listWorkDays("2026-06-08", "2026-06-12", SEG_SEX, undefined, new Set(["2026-06-20"]));
    const isos = result.map((d) => d.iso);
    expect(isos).not.toContain("2026-06-20"); // outside range
  });

  it("returns empty array when no workdays active and no includedDates", () => {
    const result = listWorkDays("2026-06-08", "2026-06-12", {});
    expect(result).toHaveLength(0);
  });

  it("returns included date even when no workdays active", () => {
    const result = listWorkDays("2026-06-08", "2026-06-12", {}, undefined, new Set(["2026-06-10"]));
    const isos = result.map((d) => d.iso);
    expect(isos).toContain("2026-06-10");
  });
});
