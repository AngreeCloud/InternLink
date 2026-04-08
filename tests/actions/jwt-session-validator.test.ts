import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import {
  clearGoogleJwksCacheForTests,
  getGoogleJwks,
} from "@/lib/auth/edge-jwks";
import {
  clearValidatedSessionCacheForTests,
  validateFirebaseSessionJwt,
} from "@/lib/auth/jwt-session";

type TokenFixture = {
  projectId: string;
  token: string;
  jwksFetch: typeof fetch;
};

async function createTokenFixture(options?: {
  projectId?: string;
  subject?: string;
  issuer?: string;
  audience?: string;
  includeRole?: boolean;
  includeEstado?: boolean;
  roleValue?: string;
  estadoValue?: string;
  expiresInSeconds?: number;
  signWithDifferentKey?: boolean;
}) {
  const projectId = options?.projectId ?? "demo-project";
  const signingPair = await generateKeyPair("RS256");
  const verifyPair = options?.signWithDifferentKey ? await generateKeyPair("RS256") : signingPair;

  const publicJwk = await exportJWK(verifyPair.publicKey);
  publicJwk.kid = "jwt-test-kid";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  const payload: Record<string, unknown> = {};
  if (options?.includeRole !== false) {
    payload.role = options?.roleValue ?? "professor";
  }
  if (options?.includeEstado !== false) {
    payload.estado = options?.estadoValue ?? "ativo";
  }

  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: "jwt-test-kid" })
    .setAudience(options?.audience ?? projectId)
    .setIssuer(options?.issuer ?? `https://session.firebase.google.com/${projectId}`)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + (options?.expiresInSeconds ?? 3600));

  if (options?.subject !== "__missing__") {
    jwt.setSubject(options?.subject ?? "uid-1");
  }

  const token = await jwt.sign(signingPair.privateKey);
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ "cache-control": "public, max-age=86400" }),
    json: async () => ({ keys: [publicJwk] }),
  } as Response);

  return {
    projectId,
    token,
    jwksFetch: fetchMock as unknown as typeof fetch,
  } satisfies TokenFixture;
}

describe("validateFirebaseSessionJwt", () => {
  beforeEach(() => {
    clearGoogleJwksCacheForTests();
    clearValidatedSessionCacheForTests();
  });

  it("accepts a valid token", async () => {
    const fixture = await createTokenFixture();

    const session = await validateFirebaseSessionJwt(fixture.token, {
      projectId: fixture.projectId,
      fetchImpl: fixture.jwksFetch,
    });

    expect(session).toEqual(
      expect.objectContaining({
        uid: "uid-1",
        role: "professor",
        estado: "ativo",
      })
    );
  });

  it("rejects expired token", async () => {
    const fixture = await createTokenFixture({ expiresInSeconds: -10 });

    const session = await validateFirebaseSessionJwt(fixture.token, {
      projectId: fixture.projectId,
      fetchImpl: fixture.jwksFetch,
    });

    expect(session).toBeNull();
  });

  it("rejects token with wrong issuer", async () => {
    const fixture = await createTokenFixture({ issuer: "https://invalid.example.com" });

    const session = await validateFirebaseSessionJwt(fixture.token, {
      projectId: fixture.projectId,
      fetchImpl: fixture.jwksFetch,
    });

    expect(session).toBeNull();
  });

  it("rejects token with wrong audience", async () => {
    const fixture = await createTokenFixture({ audience: "other-project" });

    const session = await validateFirebaseSessionJwt(fixture.token, {
      projectId: fixture.projectId,
      fetchImpl: fixture.jwksFetch,
    });

    expect(session).toBeNull();
  });

  it("rejects token with invalid signature", async () => {
    const fixture = await createTokenFixture({ signWithDifferentKey: true });

    const session = await validateFirebaseSessionJwt(fixture.token, {
      projectId: fixture.projectId,
      fetchImpl: fixture.jwksFetch,
    });

    expect(session).toBeNull();
  });

  it("rejects token without UID in sub", async () => {
    const fixture = await createTokenFixture({ subject: "__missing__" });

    const session = await validateFirebaseSessionJwt(fixture.token, {
      projectId: fixture.projectId,
      fetchImpl: fixture.jwksFetch,
    });

    expect(session).toBeNull();
  });

  it("rejects token without role claim", async () => {
    const fixture = await createTokenFixture({ includeRole: false });

    const session = await validateFirebaseSessionJwt(fixture.token, {
      projectId: fixture.projectId,
      fetchImpl: fixture.jwksFetch,
    });

    expect(session).toBeNull();
  });

  it("rejects token without estado claim", async () => {
    const fixture = await createTokenFixture({ includeEstado: false });

    const session = await validateFirebaseSessionJwt(fixture.token, {
      projectId: fixture.projectId,
      fetchImpl: fixture.jwksFetch,
    });

    expect(session).toBeNull();
  });

  it("accepts token with legacy inativo estado", async () => {
    const fixture = await createTokenFixture({ estadoValue: "inativo" });

    const session = await validateFirebaseSessionJwt(fixture.token, {
      projectId: fixture.projectId,
      fetchImpl: fixture.jwksFetch,
    });

    expect(session).toEqual(
      expect.objectContaining({
        uid: "uid-1",
        role: "professor",
        estado: "inativo",
      })
    );
  });

  it("uses validation cache for repeated calls", async () => {
    const fixture = await createTokenFixture();
    const fetchSpy = async () => {
      const result = await fixture.jwksFetch("https://unused.local");
      return result;
    };

    const first = await validateFirebaseSessionJwt(fixture.token, {
      projectId: fixture.projectId,
      fetchImpl: fetchSpy as typeof fetch,
    });
    const second = await validateFirebaseSessionJwt(fixture.token, {
      projectId: fixture.projectId,
      fetchImpl: fetchSpy as typeof fetch,
    });

    expect(first?.uid).toBe("uid-1");
    expect(second?.uid).toBe("uid-1");
  });

  it("loads JWKS payload shape correctly", async () => {
    const fixture = await createTokenFixture();
    const jwks = await getGoogleJwks(fixture.jwksFetch);
    expect(Array.isArray(jwks.keys)).toBe(true);
    expect(jwks.keys.length).toBeGreaterThan(0);
  });
});
