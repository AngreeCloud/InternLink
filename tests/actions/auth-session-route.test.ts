import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifyIdToken = vi.fn();
const mockCreateSessionCookie = vi.fn();
const mockVerifySessionCookie = vi.fn();
const mockRevokeRefreshTokens = vi.fn();
const mockGetUser = vi.fn();
const mockSetCustomUserClaims = vi.fn();
const mockUserDocGet = vi.fn();
const mockCookies = vi.fn();

vi.mock("@/lib/firebase-admin", () => ({
  getFirebaseAdminAuth: () => ({
    verifyIdToken: mockVerifyIdToken,
    createSessionCookie: mockCreateSessionCookie,
    verifySessionCookie: mockVerifySessionCookie,
    revokeRefreshTokens: mockRevokeRefreshTokens,
    getUser: mockGetUser,
    setCustomUserClaims: mockSetCustomUserClaims,
  }),
  getFirebaseAdminDb: () => ({
    collection: () => ({
      doc: () => ({
        get: mockUserDocGet,
      }),
    }),
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
  it("creates session cookie from idToken when claims are already synced", async () => {
    const { POST } = await import("@/app/api/auth/session/route");

    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-123",
      role: "professor",
      estado: "ativo",
    });
    mockGetUser.mockResolvedValueOnce({
      customClaims: { role: "professor", estado: "ativo" },
    });
    mockUserDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "professor", estado: "ativo" }),
    });
    mockCreateSessionCookie.mockResolvedValueOnce("session-cookie-value");

    const request = new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "token-123" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { ok?: boolean; role?: string; estado?: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.role).toBe("professor");
    expect(payload.estado).toBe("ativo");
    expect(mockVerifyIdToken).toHaveBeenCalledWith("token-123");
    expect(mockGetUser).toHaveBeenCalledWith("uid-123");
    expect(mockUserDocGet).toHaveBeenCalled();
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockCreateSessionCookie).toHaveBeenCalledTimes(1);
    expect(response.headers.get("set-cookie") || "").toContain("internlink_session=session-cookie-value");
  });

  it("returns 428 when claims need refreshing", async () => {
    const { POST } = await import("@/app/api/auth/session/route");

    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-123",
      role: undefined,
      estado: undefined,
    });
    mockGetUser.mockResolvedValueOnce({
      customClaims: {},
    });
    mockUserDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "professor", estado: "ativo" }),
    });
    mockSetCustomUserClaims.mockResolvedValueOnce(undefined);

    const request = new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "token-123" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { claimsUpdated?: boolean; ok?: boolean };

    expect(response.status).toBe(428);
    expect(payload.claimsUpdated).toBe(true);
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("uid-123", {
      role: "professor",
      estado: "ativo",
    });
    expect(mockCreateSessionCookie).not.toHaveBeenCalled();
  });

  it("returns 428 when idToken claims are stale even if custom claims are synced", async () => {
    const { POST } = await import("@/app/api/auth/session/route");

    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-123",
      role: undefined,
      estado: undefined,
    });
    mockGetUser.mockResolvedValueOnce({
      customClaims: { role: "professor", estado: "ativo" },
    });
    mockUserDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "professor", estado: "ativo" }),
    });

    const request = new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "token-123" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { claimsUpdated?: boolean; refreshRequired?: boolean };

    expect(response.status).toBe(428);
    expect(payload.claimsUpdated).toBe(true);
    expect(payload.refreshRequired).toBe(true);
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockCreateSessionCookie).not.toHaveBeenCalled();
  });

  it("returns 428 when token still has pending aluno claims but source of truth is ativo", async () => {
    const { POST } = await import("@/app/api/auth/session/route");

    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-456",
      role: "aluno",
      estado: "pendente",
    });
    mockGetUser.mockResolvedValueOnce({
      customClaims: { role: "aluno", estado: "ativo" },
    });
    mockUserDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "aluno", estado: "ativo" }),
    });

    const request = new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "token-456" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      claimsUpdated?: boolean;
      refreshRequired?: boolean;
      role?: string;
      estado?: string;
    };

    expect(response.status).toBe(428);
    expect(payload.claimsUpdated).toBe(true);
    expect(payload.refreshRequired).toBe(true);
    expect(payload.role).toBe("aluno");
    expect(payload.estado).toBe("ativo");
    expect(mockCreateSessionCookie).not.toHaveBeenCalled();
  });

  it("creates session cookie from pendingRegistrations when users doc does not exist", async () => {
    const { POST } = await import("@/app/api/auth/session/route");

    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "uid-pending",
      role: "professor",
      estado: "pendente",
    });
    mockGetUser.mockResolvedValueOnce({
      customClaims: { role: "professor", estado: "pendente" },
    });
    mockUserDocGet.mockResolvedValueOnce({
      exists: false,
      data: () => null,
    });
    mockUserDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "professor", estado: "pendente" }),
    });
    mockCreateSessionCookie.mockResolvedValueOnce("session-cookie-value");

    const request = new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "token-pending" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { ok?: boolean; role?: string; estado?: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.role).toBe("professor");
    expect(payload.estado).toBe("pendente");
    expect(mockCreateSessionCookie).toHaveBeenCalledTimes(1);
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
    expect(mockVerifySessionCookie).toHaveBeenCalledWith("session-cookie-value", false);
    expect(mockRevokeRefreshTokens).toHaveBeenCalledWith("uid-123");
    expect(response.headers.get("set-cookie") || "").toContain("internlink_session=");
  });
});
