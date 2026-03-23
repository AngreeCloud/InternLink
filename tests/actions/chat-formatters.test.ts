import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { formatChatRelativeTime, isSameDay } from "@/lib/chat/realtime-chat";

describe("chat formatters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats relative seconds and minutes", () => {
    expect(formatChatRelativeTime(new Date("2026-03-23T11:59:59Z").getTime())).toBe("1s");
    expect(formatChatRelativeTime(new Date("2026-03-23T11:59:40Z").getTime())).toBe("20s");
    expect(formatChatRelativeTime(new Date("2026-03-23T11:50:00Z").getTime())).toBe("10min");
  });

  it("formats relative hours and days", () => {
    expect(formatChatRelativeTime(new Date("2026-03-23T10:00:00Z").getTime())).toBe("2h");
    expect(formatChatRelativeTime(new Date("2026-03-22T12:00:00Z").getTime())).toBe("1d");
    expect(formatChatRelativeTime(new Date("2026-03-20T12:00:00Z").getTime())).toBe("20/03/2026");
  });

  it("detects same day correctly", () => {
    const a = new Date("2026-03-23T00:01:00Z").getTime();
    const b = new Date("2026-03-23T23:59:00Z").getTime();
    const c = new Date("2026-03-22T23:59:00Z").getTime();

    expect(isSameDay(a, b)).toBe(true);
    expect(isSameDay(a, c)).toBe(false);
  });
});
