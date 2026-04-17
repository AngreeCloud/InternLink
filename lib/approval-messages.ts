export function getApprovalResponsibleLabel(role: string) {
  if (role === "professor") {
    return "administrador escolar da sua escola";
  }

  return "professor responsável";
}

export function getWaitingApprovalMessage(role: string) {
  if (role === "tutor") {
    return "A sua conta de tutor está temporariamente inativa. Verifique o email para ativar o acesso.";
  }

  const responsible = getApprovalResponsibleLabel(role);
  return `O seu registo foi submetido. A conta será ativada manualmente pelo ${responsible}.`;
}

export function getAccountStatusApprovalMessage(role: string, estado?: string) {
  if (role === "tutor") {
    if (estado === "inativo") {
      return "A conta de tutor está inativa. Verifique o email e volte a iniciar sessão.";
    }

    return "A conta de tutor está a concluir validações de acesso.";
  }

  if (estado === "inativo" || estado === "removido" || estado === "rejeitado") {
    return "A conta está inativa para acesso. Re-solicite acesso escolhendo escola e turma para nova avaliação.";
  }

  const responsible = getApprovalResponsibleLabel(role);
  return `A sua conta está pendente de aprovação manual pelo ${responsible}.`;
}
