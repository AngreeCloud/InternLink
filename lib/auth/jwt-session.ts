import { jwtVerify } from "jose";
import { getGoogleJwksKeyResolver } from "@/lib/auth/edge-jwks";
import { isAppUserEstado, isAppUserRole } from "@/lib/auth/session";

export const AUTH_UID_HEADER = "x-auth-uid";
export const AUTH_EXP_HEADER = "x-auth-exp";

export type ValidatedSession = {
  uid: string;
  exp: number;
  role: string;
  estado: string;
};

type SessionCacheEntry = {
  uid: string;
  exp: number;
  role: string;
  estado: string;
  expiresAt: number;
};

type ValidateSessionOptions = {
  projectId?: string;
  nowMs?: () => number;
  fetchImpl?: typeof fetch;
  onFailure?: (reason: string, details?: Record<string, unknown>) => void;
};

const validatedSessionCache = new Map<string, SessionCacheEntry>();

function resolveProjectId(projectId?: string): string {
  const resolved =
    projectId ??
    process.env.FIREBASE_ADMIN_PROJECT_ID ??
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!resolved) {
    throw new Error("Missing Firebase project id for session JWT validation");
  }

  return resolved;
}

function getCachedSession(token: string, now: number): ValidatedSession | null {
  const entry = validatedSessionCache.get(token);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= now) {
    validatedSessionCache.delete(token);
    return null;
  }

  return {
    uid: entry.uid,
    exp: entry.exp,
    role: entry.role,
    estado: entry.estado,
  };
}

function cacheSession(token: string, session: ValidatedSession) {
  validatedSessionCache.set(token, {
    uid: session.uid,
    exp: session.exp,
    role: session.role,
    estado: session.estado,
    expiresAt: session.exp * 1000,
  });
}

export async function validateFirebaseSessionJwt(
  token: string,
  options: ValidateSessionOptions = {}
): Promise<ValidatedSession | null> {
  const reportFailure = (reason: string, details?: Record<string, unknown>) => {
    options.onFailure?.(reason, details);
  };

  const nowMs = options.nowMs?.() ?? Date.now();
  const cached = getCachedSession(token, nowMs);
  if (cached) {
    return cached;
  }

  const projectId = resolveProjectId(options.projectId);

  const issuerCandidates = [
    `https://session.firebase.google.com/${projectId}`,
    `https://securetoken.google.com/${projectId}`,
  ];

  const verifyToken = async (forceRefresh: boolean) => {
    const keyResolver = await getGoogleJwksKeyResolver(options.fetchImpl, { forceRefresh });
    return jwtVerify(token, keyResolver, {
      audience: projectId,
      issuer: issuerCandidates,
    });
  };

  try {
    let verified;
    try {
      verified = await verifyToken(false);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      const shouldRetryWithFreshKeys =
        message.includes("no applicable key") || message.includes("jwks") || message.includes("kid");

      if (!shouldRetryWithFreshKeys) {
        throw error;
      }

      verified = await verifyToken(true);
    }

    const { payload } = verified;

    const customClaims = payload as Record<string, unknown>;

    if (typeof payload.exp !== "number") {
      reportFailure("missing_exp_claim");
      return null;
    }

    if (payload.exp <= Math.floor(nowMs / 1000)) {
      reportFailure("expired_token", {
        exp: payload.exp,
        now: Math.floor(nowMs / 1000),
      });
      return null;
    }

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      reportFailure("missing_sub_claim");
      return null;
    }

    const roleClaim = customClaims.role;
    const estadoClaim = customClaims.estado;

    if (!isAppUserRole(roleClaim)) {
      reportFailure("invalid_role_claim", {
        role: typeof roleClaim === "string" ? roleClaim : String(roleClaim),
      });
      return null;
    }

    if (!isAppUserEstado(estadoClaim)) {
      reportFailure("invalid_estado_claim", {
        estado: typeof estadoClaim === "string" ? estadoClaim : String(estadoClaim),
      });
      return null;
    }

    const role = roleClaim;
    const estado = estadoClaim;

    const session: ValidatedSession = {
      uid: payload.sub,
      exp: payload.exp,
      role,
      estado,
    };

    cacheSession(token, session);
    return session;
  } catch (error) {
    reportFailure("jwt_verify_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function clearValidatedSessionCacheForTests() {
  validatedSessionCache.clear();
}
