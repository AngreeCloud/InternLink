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
  try {
    validatedSession = await validateFirebaseSessionJwt(sessionCookie);
  } catch {
    validatedSession = null;
  }

  if (!validatedSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { uid, exp, role, estado } = validatedSession;
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!role || !estado) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cachedProfile = getCachedProfile(uid, exp);
  if (cachedProfile) {
    if (!isRoleAllowedForPath(pathname, cachedProfile)) {
      return NextResponse.redirect(new URL("/account-status", request.url));
    }

    return NextResponse.next();
  }

  const resolvedProfile = { role, estado };
  setCachedProfile(uid, exp, resolvedProfile);
  if (!isRoleAllowedForPath(pathname, resolvedProfile)) {
    return NextResponse.redirect(new URL("/account-status", request.url));
  }

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
