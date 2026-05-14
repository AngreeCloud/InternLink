import { describe, expect, it } from "vitest";
import {
  canRequestEarlyTermination,
  calcNewEndDate,
  getNextStatus,
  validateNoOverlap,
} from "@/lib/estagios/schedule-change-requests";

// ---------------------------------------------------------------------------
// canRequestEarlyTermination
// ---------------------------------------------------------------------------
describe("canRequestEarlyTermination", () => {
  it("returns true when restantes < horasDia (strictly less than)", () => {
    expect(canRequestEarlyTermination(3, 8)).toBe(true);
    expect(canRequestEarlyTermination(0, 8)).toBe(true);
    expect(canRequestEarlyTermination(7.9, 8)).toBe(true);
  });

  it("returns false when restantes >= horasDia", () => {
    expect(canRequestEarlyTermination(8, 8)).toBe(false);
    expect(canRequestEarlyTermination(16, 8)).toBe(false);
    expect(canRequestEarlyTermination(8.1, 8)).toBe(false);
  });

  it("returns false for invalid inputs", () => {
    expect(canRequestEarlyTermination(Number.NaN, 8)).toBe(false);
    expect(canRequestEarlyTermination(4, 0)).toBe(false);
    expect(canRequestEarlyTermination(4, -1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getNextStatus — state machine
// ---------------------------------------------------------------------------
describe("getNextStatus", () => {
  it("professor can approve pending_professor → pending_tutor", () => {
    const result = getNextStatus("pending_professor", "professor", "approve");
    expect(result).toEqual({ ok: true, nextStatus: "pending_tutor" });
  });

  it("diretor can approve pending_professor → pending_tutor", () => {
    const result = getNextStatus("pending_professor", "diretor", "approve");
    expect(result).toEqual({ ok: true, nextStatus: "pending_tutor" });
  });

  it("professor can reject pending_professor → rejected", () => {
    const result = getNextStatus("pending_professor", "professor", "reject");
    expect(result).toEqual({ ok: true, nextStatus: "rejected" });
  });

  it("tutor can approve pending_tutor → approved", () => {
    const result = getNextStatus("pending_tutor", "tutor", "approve");
    expect(result).toEqual({ ok: true, nextStatus: "approved" });
  });

  it("tutor can reject pending_tutor → rejected", () => {
    const result = getNextStatus("pending_tutor", "tutor", "reject");
    expect(result).toEqual({ ok: true, nextStatus: "rejected" });
  });

  it("tutor cannot act on pending_professor", () => {
    const result = getNextStatus("pending_professor", "tutor", "approve");
    expect(result.ok).toBe(false);
  });

  it("professor cannot act on pending_tutor", () => {
    const result = getNextStatus("pending_tutor", "professor", "approve");
    expect(result.ok).toBe(false);
  });

  it("nobody can approve an already-approved request", () => {
    const result = getNextStatus("approved", "professor", "approve");
    expect(result.ok).toBe(false);
  });

  it("nobody can act on a rejected request", () => {
    const result = getNextStatus("rejected", "tutor", "reject");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateNoOverlap
// ---------------------------------------------------------------------------
describe("validateNoOverlap", () => {
  const existing = [
    { targetDate: "2025-06-10", status: "pending_professor" as const },
    { targetDate: "2025-06-11", status: "approved" as const },
    { targetDate: "2025-06-12", status: "rejected" as const },
    { targetDate: "2025-06-13", status: "cancelled" as const },
  ];

  it("detects conflict with pending_professor request on same date", () => {
    const result = validateNoOverlap(existing, "2025-06-10");
    expect(result.ok).toBe(false);
    expect(result.conflictingStatus).toBe("pending_professor");
  });

  it("detects conflict with approved request on same date", () => {
    const result = validateNoOverlap(existing, "2025-06-11");
    expect(result.ok).toBe(false);
    expect(result.conflictingStatus).toBe("approved");
  });

  it("allows a new request when existing is rejected", () => {
    const result = validateNoOverlap(existing, "2025-06-12");
    expect(result.ok).toBe(true);
  });

  it("allows a new request when existing is cancelled", () => {
    const result = validateNoOverlap(existing, "2025-06-13");
    expect(result.ok).toBe(true);
  });

  it("allows a new request on a date with no existing requests", () => {
    const result = validateNoOverlap(existing, "2025-06-20");
    expect(result.ok).toBe(true);
  });

  it("returns ok with empty existing list", () => {
    const result = validateNoOverlap([], "2025-06-10");
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calcNewEndDate
// ---------------------------------------------------------------------------
describe("calcNewEndDate", () => {
  // Monday–Friday schedule
  const weekdayDias = { seg: true, ter: true, qua: true, qui: true, sex: true };

  it("advances one workday from a Friday to the following Monday", () => {
    // 2025-06-06 is a Friday
    const result = calcNewEndDate("2025-06-06", weekdayDias);
    // Next workday is Monday 2025-06-09
    expect(result).toBe("2025-06-09");
  });

  it("advances from a Wednesday to Thursday", () => {
    // 2025-06-04 is a Wednesday
    const result = calcNewEndDate("2025-06-04", weekdayDias);
    expect(result).toBe("2025-06-05");
  });

  it("skips Saturday when only weekdays are active", () => {
    // 2025-06-06 is Friday; next workday skips Sat/Sun
    const result = calcNewEndDate("2025-06-06", weekdayDias);
    expect(result).not.toBe("2025-06-07"); // Saturday
    expect(result).not.toBe("2025-06-08"); // Sunday
  });

  it("returns the original date when diasSemana is empty (no valid days)", () => {
    const result = calcNewEndDate("2025-06-06", {});
    expect(result).toBe("2025-06-06");
  });

  it("returns the original date when currentEndDate is empty", () => {
    const result = calcNewEndDate("", weekdayDias);
    expect(result).toBe("");
  });
});
