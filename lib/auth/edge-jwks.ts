import {
  createLocalJWKSet,
  exportJWK,
  importX509,
  type JSONWebKey,
  type JWTVerifyGetKey,
  type JSONWebKeySet,
} from "jose";

const GOOGLE_SESSION_COOKIE_PUBLIC_KEYS_URL =
  "https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys";
const DEFAULT_JWKS_CACHE_MS = 24 * 60 * 60 * 1000;

type JwksCacheEntry = {
  expiresAt: number;
  jwks: JSONWebKeySet;
};

let jwksCache: JwksCacheEntry | null = null;
let jwksKeyResolver: JWTVerifyGetKey | null = null;

type X509CertMap = Record<string, string>;

function resolveTtlMs(cacheControl: string | null): number {
  if (!cacheControl) {
    return DEFAULT_JWKS_CACHE_MS;
  }

  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) {
    return DEFAULT_JWKS_CACHE_MS;
  }

  const maxAgeSeconds = Number.parseInt(match[1] ?? "0", 10);
  if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) {
    return DEFAULT_JWKS_CACHE_MS;
  }

  return Math.min(maxAgeSeconds * 1000, DEFAULT_JWKS_CACHE_MS);
}

function isJwks(payload: unknown): payload is JSONWebKeySet {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as { keys?: unknown };
  return Array.isArray(candidate.keys) && candidate.keys.length > 0;
}

function isX509CertMap(payload: unknown): payload is X509CertMap {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const entries = Object.entries(payload as Record<string, unknown>);
  if (entries.length === 0) {
    return false;
  }

  return entries.every(([, value]) => typeof value === "string");
}

async function convertX509MapToJwks(certMap: X509CertMap): Promise<JSONWebKeySet> {
  const keys: JSONWebKey[] = [];

  for (const [kid, cert] of Object.entries(certMap)) {
    const keyLike = await importX509(cert, "RS256");
    const jwk = await exportJWK(keyLike);
    jwk.kid = kid;
    jwk.use = "sig";
    jwk.alg = "RS256";
    keys.push(jwk);
  }

  if (keys.length === 0) {
    throw new Error("Session key payload missing keys");
  }

  return { keys };
}

async function normalizePayloadToJwks(payload: unknown): Promise<JSONWebKeySet> {
  if (isJwks(payload)) {
    return payload;
  }

  if (isX509CertMap(payload)) {
    return convertX509MapToJwks(payload);
  }

  throw new Error("Unsupported session key payload format");
}

export async function getGoogleJwks(
  fetchImpl: typeof fetch = fetch,
  options: { forceRefresh?: boolean } = {}
): Promise<JSONWebKeySet> {
  const forceRefresh = options.forceRefresh === true;

  if (!forceRefresh && jwksCache && jwksCache.expiresAt > Date.now()) {
    return jwksCache.jwks;
  }

  const response = await fetchImpl(GOOGLE_SESSION_COOKIE_PUBLIC_KEYS_URL, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google JWKS: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const jwks = await normalizePayloadToJwks(payload);

  const ttlMs = resolveTtlMs(response.headers.get("cache-control"));
  jwksCache = {
    jwks,
    expiresAt: Date.now() + ttlMs,
  };
  jwksKeyResolver = createLocalJWKSet(jwks);

  return jwks;
}

export async function getGoogleJwksKeyResolver(
  fetchImpl: typeof fetch = fetch,
  options: { forceRefresh?: boolean } = {}
): Promise<JWTVerifyGetKey> {
  const forceRefresh = options.forceRefresh === true;

  if (!forceRefresh && jwksCache && jwksCache.expiresAt > Date.now() && jwksKeyResolver) {
    return jwksKeyResolver;
  }

  const jwks = await getGoogleJwks(fetchImpl, { forceRefresh });
  jwksKeyResolver = createLocalJWKSet(jwks);
  return jwksKeyResolver;
}

export function clearGoogleJwksCacheForTests() {
  jwksCache = null;
  jwksKeyResolver = null;
}
