import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_VERIFY_CACHE_TTL_MS,
  isProtectedPath,
  isRoleAllowedForPath,
} from "@/lib/auth/session";

type CacheEntry = {
  expiresAt: number;
  role?: string;
  estado?: string;
};

const sessionVerificationCache = new Map<string, CacheEntry>();

function getCachedSessionValidity(sessionCookie: string): boolean {
  const entry = sessionVerificationCache.get(sessionCookie);
  if (!entry) {
    return false;
  }

  if (entry.expiresAt <= Date.now()) {
    sessionVerificationCache.delete(sessionCookie);
    return false;
  }

  return true;
}

function getCachedSessionProfile(sessionCookie: string): { role?: string; estado?: string } | undefined {
  const entry = sessionVerificationCache.get(sessionCookie);
  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= Date.now()) {
    sessionVerificationCache.delete(sessionCookie);
    return undefined;
  }

  return {
    role: entry.role,
    estado: entry.estado,
  };
}

function setCachedSessionValidity(
  sessionCookie: string,
  tokenExpUnix?: number,
  profile?: { role?: string; estado?: string }
): void {
  const tokenExpiryMs = tokenExpUnix ? tokenExpUnix * 1000 : Date.now() + SESSION_VERIFY_CACHE_TTL_MS;
  const expiresAt = Math.min(tokenExpiryMs, Date.now() + SESSION_VERIFY_CACHE_TTL_MS);
  sessionVerificationCache.set(sessionCookie, {
    expiresAt,
    role: profile?.role,
    estado: profile?.estado,
  });
}

async function verifySessionCookie(
  request: NextRequest
): Promise<{ valid: boolean; exp?: number; role?: string; estado?: string }> {
  const verifyUrl = new URL("/api/auth/session/verify", request.url);

  const response = await fetch(verifyUrl, {
    method: "POST",
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return { valid: false };
  }

  const data = (await response.json()) as {
    valid?: boolean;
    exp?: number;
    role?: string;
    estado?: string;
  };
  if (!data.valid) {
    return { valid: false };
  }

  return {
    valid: true,
    exp: data.exp,
    role: data.role,
    estado: data.estado,
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

  if (getCachedSessionValidity(sessionCookie)) {
    const cachedProfile = getCachedSessionProfile(sessionCookie);
    if (cachedProfile && isRoleAllowedForPath(pathname, cachedProfile)) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL("/account-status", request.url));
  }

  try {
    const verification = await verifySessionCookie(request);
    if (!verification.valid) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const profile = {
      role: verification.role,
      estado: verification.estado,
    };

    setCachedSessionValidity(sessionCookie, verification.exp, profile);
    if (!isRoleAllowedForPath(pathname, profile)) {
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
