const GRANT_ORDER: Record<string, number> = {
  none: 0,
  read: 1,
  write: 2,
};

export function hasEmpresaAccess(params: {
  uid: string;
  role: string;
  empresaGrants?: Record<string, "read" | "write"> | null;
  requiredLevel: "read" | "write";
  globalProfAccess?: "none" | "read" | "write";
}): boolean {
  const { uid, role, empresaGrants, requiredLevel, globalProfAccess } = params;

  if (role === "admin_escolar") return true;

  if (role !== "professor") return false;

  const effectiveGlobal = globalProfAccess ?? "none";
  const globalLevel = GRANT_ORDER[effectiveGlobal] ?? 0;
  const requiredNum = GRANT_ORDER[requiredLevel] ?? 0;

  if (globalLevel < requiredNum) return false;

  const grant = empresaGrants?.[uid];
  if (!grant) return false;

  const grantLevel = GRANT_ORDER[grant] ?? 0;
  if (grantLevel < requiredNum) return false;

  const cappedLevel = Math.min(grantLevel, globalLevel);
  return cappedLevel >= requiredNum;
}

export function filterEmpresasByAccess<T extends { empresaGrants?: Record<string, "read" | "write"> | null }>(
  empresas: T[],
  uid: string,
  role: string,
  globalProfAccess?: "none" | "read" | "write"
): T[] {
  if (role === "admin_escolar") return empresas;

  if (role !== "professor") return [];

  const effectiveGlobal = globalProfAccess ?? "none";
  const globalLevel = GRANT_ORDER[effectiveGlobal] ?? 0;
  if (globalLevel < 1) return [];

  return empresas.filter((emp) => {
    const grant = emp.empresaGrants?.[uid];
    if (!grant) return false;
    const grantLevel = GRANT_ORDER[grant] ?? 0;
    const capped = Math.min(grantLevel, globalLevel);
    return capped >= 1;
  });
}
