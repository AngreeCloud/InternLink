import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  isProtectedPath,
  isRoleAllowedForPath,
} from "@/lib/auth/session";
import { validateFirebaseSessionJwt } from "@/lib/auth/jwt-session";

type RoleCacheEntry = {
  expiresAt: number;
  uid: string;
  role?: string;
  estado?: string;
};

const roleCache = new Map<string, RoleCacheEntry>();

function getRoleCacheKey(uid: string, exp: number): string {
  return `${uid}:${exp}`;
}

function getCachedProfile(uid: string, exp: number): { role?: string; estado?: string } | null {
  const entry = roleCache.get(getRoleCacheKey(uid, exp));
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    roleCache.delete(getRoleCacheKey(uid, exp));
    return null;
  }

  return {
    role: entry.role,
    estado: entry.estado,
  };
}

function setCachedProfile(uid: string, exp: number, profile: { role?: string; estado?: string }) {
  roleCache.set(getRoleCacheKey(uid, exp), {
    uid,
    expiresAt: exp * 1000,
    role: profile.role,
    estado: profile.estado,
  });
}

async function loadRoleProfileFromVerifyApi(
  request: NextRequest,
  sessionCookie: string
): Promise<{ valid: boolean; uid?: string; role?: string; estado?: string; exp?: number }> {
  const verifyUrl = new URL("/api/auth/session/verify", request.url);
  const response = await fetch(verifyUrl, {
    method: "POST",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return { valid: false };
  }

  const payload = (await response.json()) as {
    valid?: boolean;
    uid?: string;
    role?: string;
    estado?: string;
    exp?: number;
  };

  if (!payload.valid) {
    return { valid: false };
  }

  return {
    valid: true,
    uid: payload.uid,
    role: payload.role,
    estado: payload.estado,
    exp: payload.exp,
  };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let validatedSession = null;
  let preloadedProfile: { role?: string; estado?: string } | null = null;
  try {
    validatedSession = await validateFirebaseSessionJwt(sessionCookie);
  } catch {
    validatedSession = null;
  }

  if (!validatedSession) {
    // Fallback path to prevent false-negatives in local JWT validation
    // (e.g., temporary key rotation or env mismatch during dev).
    try {
      const fallback = await loadRoleProfileFromVerifyApi(request, sessionCookie);
      if (!fallback.valid || !fallback.uid || typeof fallback.exp !== "number") {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      validatedSession = {
        uid: fallback.uid,
        exp: fallback.exp,
      };
      preloadedProfile = {
        role: fallback.role,
        estado: fallback.estado,
      };
    } catch {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  const { uid, exp } = validatedSession;
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cachedProfile = getCachedProfile(uid, exp);
  if (cachedProfile) {
    if (!isRoleAllowedForPath(pathname, cachedProfile)) {
      return NextResponse.redirect(new URL("/account-status", request.url));
    }

    return NextResponse.next();
  }

  try {
    let resolvedProfile = preloadedProfile;
    if (!resolvedProfile) {
      const profileResponse = await loadRoleProfileFromVerifyApi(request, sessionCookie);
      if (!profileResponse.valid || profileResponse.uid !== uid) {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      resolvedProfile = {
        role: profileResponse.role,
        estado: profileResponse.estado,
      };
    }

    setCachedProfile(uid, exp, resolvedProfile);
    if (!isRoleAllowedForPath(pathname, resolvedProfile)) {
      return NextResponse.redirect(new URL("/account-status", request.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    "/student/:path*",
    "/dashboard/:path*",
    "/professor/:path*",
    "/tutor/:path*",
    "/school-admin/:path*",
  ],
};
