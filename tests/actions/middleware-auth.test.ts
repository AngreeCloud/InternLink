import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateFirebaseSessionJwt = vi.fn();

vi.mock("@/lib/auth/jwt-session", () => ({
  validateFirebaseSessionJwt: (...args: unknown[]) => mockValidateFirebaseSessionJwt(...args),
  clearValidatedSessionCacheForTests: vi.fn(),
}));

import { proxy } from "@/proxy";

function createRequest(pathname: string, sessionCookie?: string) {
  return {
    url: `http://localhost${pathname}`,
    nextUrl: { pathname },
    headers: new Headers(),
    cookies: {
      get: (name: string) =>
        name === "internlink_session" && sessionCookie
          ? {
              value: sessionCookie,
            }
          : undefined,
    },
  } as any;
}

describe("proxy session auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts request with valid session cookie", async () => {
    mockValidateFirebaseSessionJwt.mockResolvedValue({
      uid: "user-1",
      exp: Math.floor(Date.now() / 1000) + 600,
      role: "aluno",
      estado: "ativo",
    });

    const response = await proxy(createRequest("/dashboard", "valid-cookie"));

    expect(mockValidateFirebaseSessionJwt).toHaveBeenCalledWith(
      "valid-cookie",
      expect.objectContaining({
        onFailure: expect.any(Function),
      })
    );
    expect(response.headers.get("location")).toBeNull();
  });

  it("rejects request without cookie", async () => {
    const response = await proxy(createRequest("/dashboard"));
    expect(response.headers.get("location")).toBe("http://localhost/login");
    expect(mockValidateFirebaseSessionJwt).not.toHaveBeenCalled();
  });

  it("rejects request with invalid cookie", async () => {
    mockValidateFirebaseSessionJwt.mockResolvedValue(null);

    const response = await proxy(createRequest("/dashboard", "bad-cookie"));

    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("rejects request with missing claims", async () => {
    mockValidateFirebaseSessionJwt.mockResolvedValue({
      uid: "user-1",
      exp: Math.floor(Date.now() / 1000) + 600,
      role: "",
      estado: "",
    });

    const response = await proxy(createRequest("/dashboard", "bad-cookie"));

    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("skips auth validation on public path", async () => {
    const response = await proxy(createRequest("/sobre"));

    expect(response.headers.get("location")).toBeNull();
    expect(mockValidateFirebaseSessionJwt).not.toHaveBeenCalled();
  });
});
