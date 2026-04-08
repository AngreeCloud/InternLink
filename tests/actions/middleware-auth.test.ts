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
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        uid: "user-1",
        role: "aluno",
        estado: "ativo",
      }),
    } as Response);

    const response = await proxy(createRequest("/dashboard", "valid-cookie"));

    expect(mockValidateFirebaseSessionJwt).toHaveBeenCalledWith("valid-cookie");
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

  it("skips auth validation on public path", async () => {
    const response = await proxy(createRequest("/sobre"));

    expect(response.headers.get("location")).toBeNull();
    expect(mockValidateFirebaseSessionJwt).not.toHaveBeenCalled();
  });
});
