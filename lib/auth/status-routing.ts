export function getDashboardRouteForRole(role: string): string {
  if (role === "admin_escolar") return "/school-admin";
  if (role === "professor") return "/professor";
  if (role === "tutor") return "/tutor";
  if (role === "encarregado") return "/encarregado";
  return "/dashboard";
}

export function getLoginRedirectRoute(role: string, estado: string): string {
  if (role === "admin_escolar") {
    return "/school-admin";
  }

  if (role === "aluno" && estado !== "ativo") {
    return "/waiting";
  }

  if (role === "aluno") {
    return "/dashboard";
  }

  if (role === "professor" && estado === "ativo") {
    return "/professor";
  }

  if (role === "tutor" && estado === "ativo") {
    return "/tutor";
  }

  if (role === "encarregado" && estado === "ativo") {
    return "/encarregado";
  }

  return "/account-status";
}
