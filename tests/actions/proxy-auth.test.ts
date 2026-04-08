import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { clearValidatedSessionCacheForTests } from "@/lib/auth/jwt-session";

const mockValidateFirebaseSessionJwt = vi.fn();

vi.mock("@/lib/auth/jwt-session", async () => {
  const actual = await vi.importActual("@/lib/auth/jwt-session");
  return {
    ...actual,
    validateFirebaseSessionJwt: (...args: unknown[]) =>
      mockValidateFirebaseSessionJwt(...args),
  };
});

function createProxyRequest(
  pathname: string,
  sessionCookie?: string
) {
  const requestHeaders = new Map<string, string>();
  if (sessionCookie) {
    requestHeaders.set("cookie", `internlink_session=${sessionCookie}`);
  }

  return {
    url: `http://localhost${pathname}`,
    nextUrl: { pathname },
    headers: {
      get: (name: string) => requestHeaders.get(name.toLowerCase()) ?? null,
    },
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

beforeEach(() => {
  vi.clearAllMocks();
  clearValidatedSessionCacheForTests();
  mockValidateFirebaseSessionJwt.mockResolvedValue({
    uid: "user-2",
    exp: Math.floor(Date.now() / 1000) + 600,
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      valid: true,
      uid: "user-2",
      role: "professor",
      estado: "ativo",
      exp: Math.floor(Date.now() / 1000) + 600,
    }),
  } as Response);
});

describe("proxy auth + role checks", () => {
  it("redirects to /login when session cookie is missing", async () => {
    const response = await proxy(createProxyRequest("/professor"));
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("blocks wrong role access (tutor -> /professor)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: true,
        uid: "user-1",
        role: "tutor",
        estado: "ativo",
        exp: Math.floor(Date.now() / 1000) + 600,
      }),
    } as Response);

    mockValidateFirebaseSessionJwt.mockResolvedValueOnce({
      uid: "user-1",
      exp: Math.floor(Date.now() / 1000) + 600,
    });

    const response = await proxy(createProxyRequest("/professor", "cookie-1"));

    expect(response.headers.get("location")).toBe("http://localhost/account-status");
  });

  it("allows matching role and caches verification", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const first = await proxy(createProxyRequest("/professor", "cookie-2"));
    const second = await proxy(createProxyRequest("/professor/estagios", "cookie-2"));

    expect(first.headers.get("location")).toBeNull();
    expect(second.headers.get("location")).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("redirects to /login when JWT validation fails", async () => {
    mockValidateFirebaseSessionJwt.mockResolvedValueOnce(null);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ valid: false }),
    } as Response);

    const response = await proxy(createProxyRequest("/professor", "cookie-2"));
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("redirects to /login when verify route returns mismatched uid", async () => {
    mockValidateFirebaseSessionJwt.mockResolvedValueOnce({
      uid: "user-3",
      exp: Math.floor(Date.now() / 1000) + 600,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: true,
        uid: "other-user",
        role: "professor",
        estado: "ativo",
      }),
    } as Response);

    const response = await proxy(createProxyRequest("/professor", "cookie-3"));

    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
});
