import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

const TEST_PROJECT_ID = "demo-project";
const TEST_KID = "jwt-test-kid";

let sharedSigningPrivateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let sharedInvalidPrivateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let sharedVerifyJwk: Awaited<ReturnType<typeof exportJWK>>;

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
  const projectId = options?.projectId ?? TEST_PROJECT_ID;
  const signingKey = options?.signWithDifferentKey ? sharedInvalidPrivateKey : sharedSigningPrivateKey;

  const publicJwk = {
    ...sharedVerifyJwk,
    kid: TEST_KID,
    alg: "RS256",
    use: "sig",
  };

  const payload: Record<string, unknown> = {};
  if (options?.includeRole !== false) {
    payload.role = options?.roleValue ?? "professor";
  }
  if (options?.includeEstado !== false) {
    payload.estado = options?.estadoValue ?? "ativo";
  }

  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: TEST_KID })
    .setAudience(options?.audience ?? projectId)
    .setIssuer(options?.issuer ?? `https://session.firebase.google.com/${projectId}`)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + (options?.expiresInSeconds ?? 3600));

  if (options?.subject !== "__missing__") {
    jwt.setSubject(options?.subject ?? "uid-1");
  }

  const token = await jwt.sign(signingKey);
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
  beforeAll(async () => {
    clearGoogleJwksCacheForTests();
    clearValidatedSessionCacheForTests();

    const signingPair = await generateKeyPair("RS256");
    const invalidPair = await generateKeyPair("RS256");

    sharedSigningPrivateKey = signingPair.privateKey;
    sharedInvalidPrivateKey = invalidPair.privateKey;

    const verifyJwk = await exportJWK(signingPair.publicKey);
    verifyJwk.kid = TEST_KID;
    verifyJwk.alg = "RS256";
    verifyJwk.use = "sig";
    sharedVerifyJwk = verifyJwk;
  });

  beforeEach(() => {
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

  it("rejects ID-token issuer for session validation", async () => {
    const fixture = await createTokenFixture({ issuer: "https://securetoken.google.com/demo-project" });

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
