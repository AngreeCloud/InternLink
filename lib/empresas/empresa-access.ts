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
  const { uid, role, empresaGrants, requiredLevel } = params;

  if (role === "admin_escolar") return true;
  if (role !== "professor") return false;

  const grant = empresaGrants?.[uid];
  if (!grant) return false;

  const requiredNum = GRANT_ORDER[requiredLevel] ?? 0;
  const grantLevel = GRANT_ORDER[grant] ?? 0;
  return grantLevel >= requiredNum;
}

export function filterEmpresasByAccess<T extends { empresaGrants?: Record<string, "read" | "write"> | null }>(
  empresas: T[],
  uid: string,
  role: string,
  _globalProfAccess?: "none" | "read" | "write"
): T[] {
  if (role === "admin_escolar") return empresas;
  if (role !== "professor") return [];

  return empresas.filter((emp) => {
    const grant = emp.empresaGrants?.[uid];
    if (!grant) return false;
    return (GRANT_ORDER[grant] ?? 0) >= 1;
  });
}
