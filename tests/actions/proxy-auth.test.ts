import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { clearValidatedSessionCacheForTests } from "@/lib/auth/jwt-session";

const mockValidateFirebaseSessionJwt = vi.fn();

vi.mock("@/lib/auth/jwt-session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/jwt-session")>("@/lib/auth/jwt-session");
  return {
    ...actual,
    validateFirebaseSessionJwt: (...args: unknown[]) => mockValidateFirebaseSessionJwt(...args),
  };
});

function createProxyRequest(pathname: string, sessionCookie?: string) {
  return {
    url: `http://localhost${pathname}`,
    nextUrl: { pathname },
    headers: new Headers(sessionCookie ? { cookie: `internlink_session=${sessionCookie}` } : {}),
    cookies: {
      get: (name: string) =>
        name === "internlink_session" && sessionCookie
          ? { value: sessionCookie }
          : undefined,
    },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearValidatedSessionCacheForTests();
});

describe("proxy auth + role checks", () => {
  it("redirects to /login when session cookie is missing", async () => {
    const response = await proxy(createProxyRequest("/professor"));
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("blocks wrong role access (tutor -> /professor)", async () => {
    mockValidateFirebaseSessionJwt.mockResolvedValueOnce({
      uid: "user-1",
      exp: Math.floor(Date.now() / 1000) + 600,
      role: "tutor",
      estado: "ativo",
    });

    const response = await proxy(createProxyRequest("/professor", "cookie-1"));

    expect(response.headers.get("location")).toBe("http://localhost/account-status");
  });

  it("allows matching role and caches verification", async () => {
    mockValidateFirebaseSessionJwt.mockResolvedValue({
      uid: "user-2",
      exp: Math.floor(Date.now() / 1000) + 600,
      role: "professor",
      estado: "ativo",
    });

    const first = await proxy(createProxyRequest("/professor", "cookie-2"));
    const second = await proxy(createProxyRequest("/professor/estagios", "cookie-2"));

    expect(first.headers.get("location")).toBeNull();
    expect(second.headers.get("location")).toBeNull();
  });

  it("redirects to /login when JWT validation fails", async () => {
    mockValidateFirebaseSessionJwt.mockResolvedValueOnce(null);

    const response = await proxy(createProxyRequest("/professor", "cookie-2"));

    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("redirects to /login when claims are missing", async () => {
    mockValidateFirebaseSessionJwt.mockResolvedValueOnce({
      uid: "user-3",
      exp: Math.floor(Date.now() / 1000) + 600,
      role: "professor",
      estado: "",
    });

    const response = await proxy(createProxyRequest("/professor", "cookie-3"));

    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
});
