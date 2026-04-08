import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifySessionCookie = vi.fn();
const mockCookies = vi.fn();

vi.mock("@/lib/firebase-admin", () => ({
  getFirebaseAdminAuth: () => ({
    verifySessionCookie: mockVerifySessionCookie,
  }),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/auth/session/verify", () => {
  it("returns role and estado directly from JWT custom claims", async () => {
    const { POST } = await import("@/app/api/auth/session/verify/route");

    mockCookies.mockResolvedValueOnce({
      get: () => ({ value: "session-cookie-value" }),
    });
    mockVerifySessionCookie.mockResolvedValueOnce({
      uid: "uid-1",
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: "professor",
      estado: "ativo",
    });

    const response = await POST();
    const payload = (await response.json()) as {
      valid?: boolean;
      role?: string;
      estado?: string;
      uid?: string;
    };

    expect(response.status).toBe(200);
    expect(payload.valid).toBe(true);
    expect(payload.uid).toBe("uid-1");
    expect(payload.role).toBe("professor");
    expect(payload.estado).toBe("ativo");
  });

  it("returns 401 when cookie is missing", async () => {
    const { POST } = await import("@/app/api/auth/session/verify/route");

    mockCookies.mockResolvedValueOnce({
      get: () => undefined,
    });

    const response = await POST();
    const payload = (await response.json()) as { valid?: boolean };

    expect(response.status).toBe(401);
    expect(payload.valid).toBe(false);
  });
});
