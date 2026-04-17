import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jwtVerify, SignJWT, exportJWK, generateKeyPair } from "jose";
import {
  clearGoogleJwksCacheForTests,
  getGoogleJwks,
  getGoogleJwksKeyResolver,
} from "@/lib/auth/edge-jwks";

const projectId = "demo-project";
let cachedPublicJwk: Awaited<ReturnType<typeof exportJWK>>;
let cachedToken = "";

describe("edge JWKS cache", () => {
  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "jwks-cache-test";
    publicJwk.alg = "RS256";
    publicJwk.use = "sig";

    cachedPublicJwk = publicJwk;
    cachedToken = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "jwks-cache-test" })
      .setSubject("uid-123")
      .setAudience(projectId)
      .setIssuer(`https://session.firebase.google.com/${projectId}`)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
  });

  beforeEach(() => {
    clearGoogleJwksCacheForTests();
    vi.clearAllMocks();
  });

  it("loads JWKS and caches it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "cache-control": "public, max-age=3600" }),
      json: async () => ({ keys: [cachedPublicJwk] }),
    });

    const first = await getGoogleJwks(fetchMock as unknown as typeof fetch);
    const second = await getGoogleJwks(fetchMock as unknown as typeof fetch);

    expect(first.keys.length).toBe(1);
    expect(second.keys.length).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses cached JWKS key resolver to validate signature", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "cache-control": "public, max-age=86400" }),
      json: async () => ({ keys: [cachedPublicJwk] }),
    });

    const keyResolver = await getGoogleJwksKeyResolver(fetchMock as unknown as typeof fetch);
    const verified = await jwtVerify(cachedToken, keyResolver, {
      audience: projectId,
      issuer: [`https://session.firebase.google.com/${projectId}`],
    });

    expect(verified.payload.sub).toBe("uid-123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
