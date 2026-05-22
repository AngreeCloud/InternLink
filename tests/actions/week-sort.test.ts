import { describe, expect, it } from "vitest";
import {
  isCurrentWeek,
  isFutureWeek,
  isPastWeek,
  sortWeeksHorario,
  sortWeeksSumarios,
  type WorkWeek,
} from "@/lib/estagios/workdays";

function makeWeek(
  weekId: string,
  start: string,
  end: string,
  num = 0,
  year = 2026,
): WorkWeek {
  return {
    weekId,
    weekNumber: num,
    weekYear: year,
    weekStartIso: start,
    weekEndIso: end,
    days: [],
  };
}

const W1 = makeWeek("2026-W17", "2026-04-20", "2026-04-26", 17);
const W2 = makeWeek("2026-W18", "2026-04-27", "2026-05-03", 18);
const W3 = makeWeek("2026-W19", "2026-05-04", "2026-05-10", 19);
const W4 = makeWeek("2026-W20", "2026-05-11", "2026-05-17", 20);
const W5 = makeWeek("2026-W21", "2026-05-18", "2026-05-24", 21);
const W6 = makeWeek("2026-W22", "2026-05-25", "2026-05-31", 22);

const ALL_WEEKS = [W1, W2, W3, W4, W5, W6];

// today = 2026-05-13 → W4 is current (2026-05-11 to 2026-05-17)
const TODAY = "2026-05-13";

// today past → W1, W2, W3 are past; W4 is current; W5, W6 are future

describe("isPastWeek / isCurrentWeek / isFutureWeek", () => {
  it("W1 (20-26 Apr) is past", () => {
    expect(isPastWeek(W1, TODAY)).toBe(true);
    expect(isCurrentWeek(W1, TODAY)).toBe(false);
    expect(isFutureWeek(W1, TODAY)).toBe(false);
  });

  it("W4 (11-17 May) is current", () => {
    expect(isPastWeek(W4, TODAY)).toBe(false);
    expect(isCurrentWeek(W4, TODAY)).toBe(true);
    expect(isFutureWeek(W4, TODAY)).toBe(false);
  });

  it("W6 (25-31 May) is future", () => {
    expect(isPastWeek(W6, TODAY)).toBe(false);
    expect(isCurrentWeek(W6, TODAY)).toBe(false);
    expect(isFutureWeek(W6, TODAY)).toBe(true);
  });
});

describe("sortWeeksHorario", () => {
  it("current week first, future next, past last (desc)", () => {
    const sorted = sortWeeksHorario(ALL_WEEKS, TODAY);
    // W4 (current) first
    expect(sorted[0].weekId).toBe("2026-W20");
    // W5, W6 (future) next
    expect(sorted[1].weekId).toBe("2026-W21");
    expect(sorted[2].weekId).toBe("2026-W22");
    // W3, W2, W1 (past) last, descending
    expect(sorted[3].weekId).toBe("2026-W19");
    expect(sorted[4].weekId).toBe("2026-W18");
    expect(sorted[5].weekId).toBe("2026-W17");
  });

  it("no current week when all weeks are past", () => {
    const allPast = [W1, W2, W3];
    const sorted = sortWeeksHorario(allPast, TODAY);
    // All past, no current → chronological
    expect(sorted[0].weekId).toBe("2026-W17");
    expect(sorted[1].weekId).toBe("2026-W18");
    expect(sorted[2].weekId).toBe("2026-W19");
  });

  it("internship ended → chronological order", () => {
    const ended = [W1, W2, W3];
    // All weeks end before today
    const sorted = sortWeeksHorario(ended, "2026-06-15");
    expect(sorted[0].weekId).toBe("2026-W17");
    expect(sorted[1].weekId).toBe("2026-W18");
    expect(sorted[2].weekId).toBe("2026-W19");
  });

  it("handles empty weeks", () => {
    expect(sortWeeksHorario([], TODAY)).toEqual([]);
  });
});

describe("sortWeeksSumarios", () => {
  function completed(w: WorkWeek): boolean {
    const completedMap: Record<string, boolean> = {
      "2026-W17": true,
      "2026-W19": true,
    };
    return Boolean(completedMap[w.weekId]);
  }

  it("uncompleted past first, current, future, completed past last", () => {
    const sorted = sortWeeksSumarios(ALL_WEEKS, TODAY, completed);
    // W2 (W18) is uncompleted past → first
    expect(sorted[0].weekId).toBe("2026-W18");
    // W4 (W20) current → second
    expect(sorted[1].weekId).toBe("2026-W20");
    // W5, W6 future → next
    expect(sorted[2].weekId).toBe("2026-W21");
    expect(sorted[3].weekId).toBe("2026-W22");
    // W1, W3 completed past → last (chronological)
    expect(sorted[4].weekId).toBe("2026-W17");
    expect(sorted[5].weekId).toBe("2026-W19");
  });

  it("all uncompleted past → chronological", () => {
    const allUncompleted = [W1, W2, W3];
    const sorted = sortWeeksSumarios(allUncompleted, TODAY, () => false);
    expect(sorted[0].weekId).toBe("2026-W17");
    expect(sorted[1].weekId).toBe("2026-W18");
    expect(sorted[2].weekId).toBe("2026-W19");
  });

  it("all completed past → chronological", () => {
    const allCompleted = [W1, W2, W3];
    const sorted = sortWeeksSumarios(allCompleted, TODAY, () => true);
    expect(sorted[0].weekId).toBe("2026-W17");
    expect(sorted[1].weekId).toBe("2026-W18");
    expect(sorted[2].weekId).toBe("2026-W19");
  });

  it("internship ended → uncompleted first, completed last", () => {
    const ended = [W1, W2, W3, W4, W5, W6];
    // All past, no current
    const sorted = sortWeeksSumarios(ended, "2026-07-01", completed);
    // W2, W4, W5, W6 (uncompleted) first
    expect(sorted[0].weekId).toBe("2026-W18"); // uncompleted
    expect(sorted[1].weekId).toBe("2026-W20"); // uncompleted
    expect(sorted[2].weekId).toBe("2026-W21"); // uncompleted
    expect(sorted[3].weekId).toBe("2026-W22"); // uncompleted
    // W1, W3 (completed) last
    expect(sorted[4].weekId).toBe("2026-W17"); // completed
    expect(sorted[5].weekId).toBe("2026-W19"); // completed
  });

  it("handles empty weeks", () => {
    expect(sortWeeksSumarios([], TODAY, () => false)).toEqual([]);
  });
});
