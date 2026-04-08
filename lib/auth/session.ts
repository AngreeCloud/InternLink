export const SESSION_COOKIE_NAME = "internlink_session";
export const SESSION_VERIFY_CACHE_TTL_MS = 60_000;
export const SESSION_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export const PROTECTED_ROUTE_PREFIXES = [
  "/student",
  "/dashboard",
  "/professor",
  "/tutor",
  "/school-admin",
] as const;

export const PUBLIC_ROUTE_PREFIXES = ["/login", "/register", "/public"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
