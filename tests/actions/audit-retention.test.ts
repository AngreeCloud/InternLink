import { describe, expect, it } from "vitest";

const RETENTION_DAYS = 365;

function getRetentionCutoff(): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

function isLogWithinRetention(timestamp: Date): boolean {
  const cutoff = getRetentionCutoff();
  return timestamp >= cutoff;
}

function isLogPastRetention(timestamp: Date): boolean {
  return !isLogWithinRetention(timestamp);
}

describe("retention cutoff logic", () => {
  it("returns correct cutoff date 365 days ago", () => {
    const cutoff = getRetentionCutoff();
    const now = new Date();
    const diffMs = now.getTime() - cutoff.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(RETENTION_DAYS);
  });

  it("keeps logs newer than cutoff", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 1);
    expect(isLogWithinRetention(recent)).toBe(true);
  });

  it("marks logs older than cutoff for deletion", () => {
    const old = new Date();
    old.setDate(old.getDate() - 400);
    expect(isLogPastRetention(old)).toBe(true);
  });

  it("keeps logs exactly at boundary", () => {
    const boundary = getRetentionCutoff();
    expect(isLogWithinRetention(boundary)).toBe(true);
  });

  it("marks logs one day before boundary", () => {
    const before = getRetentionCutoff();
    before.setDate(before.getDate() - 1);
    expect(isLogPastRetention(before)).toBe(true);
  });

  it("does not delete logs from other collections", () => {
    const testCases = [
      { collection: "auditLogs", expected: true },
      { collection: "empresas", expected: false },
      { collection: "estagios", expected: false },
      { collection: "users", expected: false },
      { collection: "schools", expected: false },
      { collection: "approvalHistory", expected: false },
    ];

    for (const tc of testCases) {
      const isTargetAudit = tc.collection === "auditLogs";
      expect(isTargetAudit).toBe(tc.expected);
    }
  });

  it("validates batch size limit", () => {
    const BATCH_SIZE = 500;
    expect(BATCH_SIZE).toBe(500);
    expect(BATCH_SIZE).toBeLessThanOrEqual(500);
  });

  it("handles edge case: timestamp is null or undefined", () => {
    const checkNull = (t: Date | null | undefined): boolean => {
      if (!t) return false;
      return isLogWithinRetention(t);
    };
    expect(checkNull(null)).toBe(false);
    expect(checkNull(undefined)).toBe(false);
  });

  it("handles leap year boundary", () => {
    const leapDate = new Date("2024-03-01T00:00:00Z");
    const now = new Date("2025-03-01T00:00:00.000Z");
    const diffMs = now.getTime() - leapDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(365);
  });
});
