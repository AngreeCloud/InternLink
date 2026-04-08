import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { proxy } from "@/proxy";
import { clearGoogleJwksCacheForTests } from "@/lib/auth/edge-jwks";
import { clearValidatedSessionCacheForTests } from "@/lib/auth/jwt-session";

async function createValidSessionToken(projectId: string, uid: string, expiresInSeconds = 3600) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "integration-kid";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "integration-kid" })
    .setSubject(uid)
    .setAudience(projectId)
    .setIssuer(`https://session.firebase.google.com/${projectId}`)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(privateKey);

  return { token, publicJwk };
}

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

describe("proxy integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "demo-project");
    clearGoogleJwksCacheForTests();
    clearValidatedSessionCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("login cookie -> proxy validates JWT and authorizes role", async () => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project";
    const { token, publicJwk } = await createValidSessionToken(projectId, "uid-1", 600);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("securetoken@system.gserviceaccount.com")) {
        return {
          ok: true,
          headers: new Headers({ "cache-control": "public, max-age=86400" }),
          json: async () => ({ keys: [publicJwk] }),
        } as Response;
      }

      if (url.includes("/api/auth/session/verify")) {
        return {
          ok: true,
          json: async () => ({
            valid: true,
            uid: "uid-1",
            role: "professor",
            estado: "ativo",
            exp: Math.floor(Date.now() / 1000) + 600,
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const response = await proxy(createRequest("/professor", token));

    expect(response.headers.get("location")).toBeNull();
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("logout cookie removed -> proxy blocks", async () => {
    const response = await proxy(createRequest("/professor"));
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("expired token -> proxy blocks", async () => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project";
    const { token, publicJwk } = await createValidSessionToken(projectId, "uid-2", -10);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "cache-control": "public, max-age=86400" }),
      json: async () => ({ keys: [publicJwk] }),
    } as Response);

    const response = await proxy(createRequest("/professor", token));
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
});
