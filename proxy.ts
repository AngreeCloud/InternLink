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
const AUTH_DEBUG = process.env.AUTH_DEBUG === "true";

function logAuthDebug(event: string, details?: Record<string, unknown>) {
  if (!AUTH_DEBUG) return;
  console.info("[auth-proxy]", event, details ?? {});
}

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    logAuthDebug("missing_session_cookie", { pathname });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let validatedSession = null;
  try {
    validatedSession = await validateFirebaseSessionJwt(sessionCookie, {
      onFailure: (reason, details) => {
        logAuthDebug("jwt_validation_failed", {
          pathname,
          reason,
          ...details,
        });
      },
    });
  } catch {
    logAuthDebug("jwt_validation_exception", { pathname });
    validatedSession = null;
  }

  if (!validatedSession) {
    logAuthDebug("redirect_login_invalid_session", { pathname });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { uid, exp, role, estado } = validatedSession;
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    logAuthDebug("redirect_login_expired", { pathname, uid, exp });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!role || !estado) {
    logAuthDebug("redirect_login_missing_claims", { pathname, uid, role, estado });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cachedProfile = getCachedProfile(uid, exp);
  if (cachedProfile) {
    if (!isRoleAllowedForPath(pathname, cachedProfile)) {
      logAuthDebug("redirect_account_status_cached_profile_denied", {
        pathname,
        uid,
        role: cachedProfile.role,
        estado: cachedProfile.estado,
      });
      return NextResponse.redirect(new URL("/account-status", request.url));
    }

    logAuthDebug("allow_cached_profile", { pathname, uid });
    return NextResponse.next();
  }

  const resolvedProfile = { role, estado };
  setCachedProfile(uid, exp, resolvedProfile);
  if (!isRoleAllowedForPath(pathname, resolvedProfile)) {
    logAuthDebug("redirect_account_status_profile_denied", {
      pathname,
      uid,
      role,
      estado,
    });
    return NextResponse.redirect(new URL("/account-status", request.url));
  }

  logAuthDebug("allow_profile", { pathname, uid, role, estado });
  return NextResponse.next();
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
