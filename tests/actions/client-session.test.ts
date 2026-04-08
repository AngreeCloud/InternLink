import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAuthRuntime = vi.fn();
const mockGetIdToken = vi.fn();

vi.mock("@/lib/firebase-runtime", () => ({
  getAuthRuntime: (...args: unknown[]) => mockGetAuthRuntime(...args),
}));

import { createServerSession } from "@/lib/auth/client-session";

describe("createServerSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthRuntime.mockResolvedValue({ signOut: vi.fn() });
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
        json: async () => ({ ok: true }),
      } as Response);

    await createServerSession(user);

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
        json: async () => ({ ok: true }),
      } as Response);

    await createServerSession(user);

    expect(mockGetIdToken).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
