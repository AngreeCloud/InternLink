import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { proxy } from "@/proxy";
import { clearGoogleJwksCacheForTests } from "@/lib/auth/edge-jwks";
import { clearValidatedSessionCacheForTests } from "@/lib/auth/jwt-session";

let integrationPrivateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let integrationPublicJwk: Awaited<ReturnType<typeof exportJWK>>;

async function createValidSessionToken(
  projectId: string,
  uid: string,
  role: string,
  estado: string,
  expiresInSeconds = 3600
) {
  const token = await new SignJWT({ role, estado })
    .setProtectedHeader({ alg: "RS256", kid: "integration-kid" })
    .setSubject(uid)
    .setAudience(projectId)
    .setIssuer(`https://session.firebase.google.com/${projectId}`)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(integrationPrivateKey);

  return { token, publicJwk: integrationPublicJwk };
}

function createRequest(pathname: string, sessionCookie?: string) {
  return {
    url: `http://localhost${pathname}`,
    nextUrl: { pathname },
    headers: new Headers(sessionCookie ? { cookie: `internlink_session=${sessionCookie}` } : {}),
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
  beforeAll(async () => {
    clearGoogleJwksCacheForTests();
    clearValidatedSessionCacheForTests();

    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "integration-kid";
    publicJwk.alg = "RS256";
    publicJwk.use = "sig";

    integrationPrivateKey = privateKey;
    integrationPublicJwk = publicJwk;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "demo-project");
    clearValidatedSessionCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("login cookie -> proxy validates JWT and authorizes role", async () => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project";
    const { token, publicJwk } = await createValidSessionToken(projectId, "uid-1", "professor", "ativo", 600);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "cache-control": "public, max-age=86400" }),
      json: async () => ({ keys: [publicJwk] }),
    } as Response);

    const response = await proxy(createRequest("/professor", token));

    expect(response.headers.get("location")).toBeNull();
  });

  it("logout cookie removed -> proxy blocks", async () => {
    const response = await proxy(createRequest("/professor"));
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("expired token -> proxy blocks", async () => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project";
    const { token, publicJwk } = await createValidSessionToken(projectId, "uid-2", "professor", "ativo", -10);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "cache-control": "public, max-age=86400" }),
      json: async () => ({ keys: [publicJwk] }),
    } as Response);

    const response = await proxy(createRequest("/professor", token));
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
});
