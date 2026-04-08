import { createLocalJWKSet, type JWTVerifyGetKey, type JSONWebKeySet } from "jose";

const GOOGLE_SECURETOKEN_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const DEFAULT_JWKS_CACHE_MS = 24 * 60 * 60 * 1000;

type JwksCacheEntry = {
  expiresAt: number;
  jwks: JSONWebKeySet;
};

let jwksCache: JwksCacheEntry | null = null;
let jwksKeyResolver: JWTVerifyGetKey | null = null;

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

function assertJwks(payload: unknown): asserts payload is JSONWebKeySet {
  if (!payload || typeof payload !== "object") {
    throw new Error("JWKS payload invalid");
  }

  const candidate = payload as { keys?: unknown };
  if (!Array.isArray(candidate.keys) || candidate.keys.length === 0) {
    throw new Error("JWKS payload missing keys");
  }
}

export async function getGoogleJwks(fetchImpl: typeof fetch = fetch): Promise<JSONWebKeySet> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) {
    return jwksCache.jwks;
  }

  const response = await fetchImpl(GOOGLE_SECURETOKEN_JWKS_URL, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google JWKS: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  assertJwks(payload);

  const ttlMs = resolveTtlMs(response.headers.get("cache-control"));
  jwksCache = {
    jwks: payload,
    expiresAt: Date.now() + ttlMs,
  };
  jwksKeyResolver = createLocalJWKSet(payload);

  return payload;
}

export async function getGoogleJwksKeyResolver(
  fetchImpl: typeof fetch = fetch
): Promise<JWTVerifyGetKey> {
  if (jwksCache && jwksCache.expiresAt > Date.now() && jwksKeyResolver) {
    return jwksKeyResolver;
  }

  const jwks = await getGoogleJwks(fetchImpl);
  jwksKeyResolver = createLocalJWKSet(jwks);
  return jwksKeyResolver;
}

export function clearGoogleJwksCacheForTests() {
  jwksCache = null;
  jwksKeyResolver = null;
}
