import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifyIdToken = vi.fn();
const mockCreateSessionCookie = vi.fn();
const mockVerifySessionCookie = vi.fn();
const mockRevokeRefreshTokens = vi.fn();
const mockCookies = vi.fn();

vi.mock("@/lib/firebase-admin", () => ({
  getFirebaseAdminAuth: () => ({
    verifyIdToken: mockVerifyIdToken,
    createSessionCookie: mockCreateSessionCookie,
    verifySessionCookie: mockVerifySessionCookie,
    revokeRefreshTokens: mockRevokeRefreshTokens,
  }),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

beforeEach(() => {
  vi.resetAllMocks();
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
});

describe("/api/auth/session route", () => {
  it("creates session cookie from idToken", async () => {
    const { POST } = await import("@/app/api/auth/session/route");

    mockVerifyIdToken.mockResolvedValueOnce(undefined);
    mockCreateSessionCookie.mockResolvedValueOnce("session-cookie-value");

    const request = new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "token-123" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { ok?: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(mockVerifyIdToken).toHaveBeenCalledWith("token-123", true);
    expect(mockCreateSessionCookie).toHaveBeenCalledTimes(1);
    expect(response.headers.get("set-cookie") || "").toContain("internlink_session=session-cookie-value");
  });

  it("returns 400 when idToken is missing", async () => {
    const { POST } = await import("@/app/api/auth/session/route");

    const request = new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it("deletes session cookie and revokes refresh tokens", async () => {
    const { DELETE } = await import("@/app/api/auth/session/route");

    mockCookies.mockResolvedValueOnce({
      get: () => ({ value: "session-cookie-value" }),
    });
    mockVerifySessionCookie.mockResolvedValueOnce({ sub: "uid-123" });

    const response = await DELETE();
    const payload = (await response.json()) as { ok?: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(mockVerifySessionCookie).toHaveBeenCalledWith("session-cookie-value", true);
    expect(mockRevokeRefreshTokens).toHaveBeenCalledWith("uid-123");
    expect(response.headers.get("set-cookie") || "").toContain("internlink_session=");
  });
});
