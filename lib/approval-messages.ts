export function getApprovalResponsibleLabel(role: string) {
  if (role === "professor") {
    return "administrador escolar da sua escola";
  }

  if (role === "tutor") {
    return "equipa responsável da escola";
  }

  return "professor responsável";
}

export function getWaitingApprovalMessage(role: string) {
  const responsible = getApprovalResponsibleLabel(role);
  return `O seu registo foi submetido. A conta será ativada manualmente pelo ${responsible}.`;
}

export function getAccountStatusApprovalMessage(role: string) {
  const responsible = getApprovalResponsibleLabel(role);
  return `A sua conta está pendente de aprovação manual pelo ${responsible}.`;
}
