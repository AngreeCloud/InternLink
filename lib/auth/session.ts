export const SESSION_COOKIE_NAME = "internlink_session";
export const SESSION_VERIFY_CACHE_TTL_MS = 60_000;
export const SESSION_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export type AppUserRole = "aluno" | "professor" | "tutor" | "admin_escolar";

export type SessionUserProfile = {
  role?: string;
  estado?: string;
};

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

export function isRoleAllowedForPath(pathname: string, profile: SessionUserProfile): boolean {
  const role = profile.role as AppUserRole | undefined;
  if (!role) return false;

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname === "/student" || pathname.startsWith("/student/")) {
    return role === "aluno" && profile.estado === "ativo";
  }

  if (pathname === "/professor" || pathname.startsWith("/professor/")) {
    return role === "professor" && profile.estado === "ativo";
  }

  if (pathname === "/tutor" || pathname.startsWith("/tutor/")) {
    return role === "tutor";
  }

  if (pathname === "/school-admin" || pathname.startsWith("/school-admin/")) {
    return role === "admin_escolar";
  }

  return true;
}
