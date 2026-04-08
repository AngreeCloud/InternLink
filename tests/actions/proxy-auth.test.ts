import { beforeEach, describe, expect, it, vi } from "vitest";

function createProxyRequest(pathname: string, sessionCookie?: string) {
  return {
    url: `http://localhost${pathname}`,
    nextUrl: { pathname },
    headers: {
      get: (name: string) => (name.toLowerCase() === "cookie" && sessionCookie ? `internlink_session=${sessionCookie}` : null),
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
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("proxy auth + role checks", () => {
  it("redirects to /login when session cookie is missing", async () => {
    const { proxy } = await import("@/proxy");

    const response = await proxy(createProxyRequest("/professor"));

    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("blocks wrong role access (tutor -> /professor)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: true,
        exp: Math.floor(Date.now() / 1000) + 600,
        role: "tutor",
      }),
    } as Response);

    const { proxy } = await import("@/proxy");

    const response = await proxy(createProxyRequest("/professor", "cookie-1"));

    expect(response.headers.get("location")).toBe("http://localhost/account-status");
  });

  it("allows matching role and caches verification", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        exp: Math.floor(Date.now() / 1000) + 600,
        role: "professor",
        estado: "ativo",
      }),
    } as Response);

    const { proxy } = await import("@/proxy");

    const first = await proxy(createProxyRequest("/professor", "cookie-2"));
    const second = await proxy(createProxyRequest("/professor/estagios", "cookie-2"));

    expect(first.headers.get("location")).toBeNull();
    expect(second.headers.get("location")).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
