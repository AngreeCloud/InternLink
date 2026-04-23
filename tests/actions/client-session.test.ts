import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAuthRuntime = vi.fn();
const mockGetIdToken = vi.fn();

vi.mock("@/lib/firebase-runtime", () => ({
  getAuthRuntime: (...args: unknown[]) => mockGetAuthRuntime(...args),
}));

import { createServerSession, waitForLogoutTransition } from "@/lib/auth/client-session";

describe("createServerSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetAuthRuntime.mockResolvedValue({ signOut: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries after claims refresh response", async () => {
    mockGetIdToken
      .mockResolvedValueOnce("token-old")
      .mockResolvedValueOnce("token-new");

    const user = {
      getIdToken: mockGetIdToken,
    } as any;

    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 428,
        json: async () => ({ claimsUpdated: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, role: "professor", estado: "ativo" }),
      } as Response);

    const sessionPromise = createServerSession(user);
    await vi.runAllTimersAsync();
    await sessionPromise;

    expect(mockGetIdToken).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/auth/session",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/session",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("retries multiple times when refresh is still propagating", async () => {
    mockGetIdToken
      .mockResolvedValueOnce("token-1")
      .mockResolvedValueOnce("token-2")
      .mockResolvedValueOnce("token-3")
      .mockResolvedValueOnce("token-4");

    const user = {
      getIdToken: mockGetIdToken,
    } as any;

    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 428,
        json: async () => ({ claimsUpdated: true, refreshRequired: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 428,
        json: async () => ({ claimsUpdated: true, refreshRequired: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 428,
        json: async () => ({ claimsUpdated: true, refreshRequired: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, role: "professor", estado: "ativo" }),
      } as Response);

    const sessionPromise = createServerSession(user);
    await vi.runAllTimersAsync();
    await sessionPromise;

    expect(mockGetIdToken).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("waitForLogoutTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("waits at least the minimum overlay duration when logout resolves early", async () => {
    const transitionPromise = waitForLogoutTransition(Promise.resolve(), 1000, { maxWaitMs: 5000 });

    let settled = false;
    void transitionPromise.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(900);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(100);
    await transitionPromise;
    expect(settled).toBe(true);
  });

  it("does not hang forever when logout promise never settles", async () => {
    const neverSettles = new Promise<void>(() => {
      // Intentionally unresolved.
    });

    const transitionPromise = waitForLogoutTransition(neverSettles, 1000, { maxWaitMs: 1200 });

    let settled = false;
    void transitionPromise.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(1100);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(100);
    await transitionPromise;
    expect(settled).toBe(true);
  });
});
