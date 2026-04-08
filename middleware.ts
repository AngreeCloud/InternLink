import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_VERIFY_CACHE_TTL_MS,
  isProtectedPath,
} from "@/lib/auth/session";

type CacheEntry = {
  expiresAt: number;
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

function setCachedSessionValidity(sessionCookie: string, tokenExpUnix?: number): void {
  const tokenExpiryMs = tokenExpUnix ? tokenExpUnix * 1000 : Date.now() + SESSION_VERIFY_CACHE_TTL_MS;
  const expiresAt = Math.min(tokenExpiryMs, Date.now() + SESSION_VERIFY_CACHE_TTL_MS);
  sessionVerificationCache.set(sessionCookie, { expiresAt });
}

async function verifySessionCookie(request: NextRequest): Promise<{ valid: boolean; exp?: number }> {
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

  const data = (await response.json()) as { valid?: boolean; exp?: number };
  if (!data.valid) {
    return { valid: false };
  }

  return { valid: true, exp: data.exp };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (getCachedSessionValidity(sessionCookie)) {
    return NextResponse.next();
  }

  try {
    const verification = await verifySessionCookie(request);
    if (!verification.valid) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    setCachedSessionValidity(sessionCookie, verification.exp);
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
