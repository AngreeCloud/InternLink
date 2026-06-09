import type { AuditAction, AuditEntityType } from "./types";

export function buildSummary(
  entityType: AuditEntityType,
  action: AuditAction,
  entityLabel?: string
): string {
  const label = entityLabel || entityType;
  const summaries: Record<string, string> = {
    "empresa:create": `${label} criada.`,
    "empresa:update": `${label} atualizada.`,
    "empresa:archive": `${label} arquivada.`,
    "empresa:restore": `${label} restaurada.`,
    "empresa:delete": `${label} eliminada.`,
    "estagio:create": `Estágio criado: ${label}.`,
    "estagio:update": `Estágio atualizado: ${label}.`,
    "estagio:delete": `Estágio eliminado: ${label}.`,
    "estagio:status_change": `Estado do estágio alterado: ${label}.`,
    "tutor:associate": `Tutor associado: ${label}.`,
    "tutor:disassociate": `Tutor desassociado: ${label}.`,
    "tutor:update": `Dados do tutor atualizados: ${label}.`,
    "schedule_change_request:create": `Pedido de alteração criado: ${label}.`,
    "schedule_change_request:approve": `Pedido de alteração aprovado: ${label}.`,
    "schedule_change_request:reject": `Pedido de alteração rejeitado: ${label}.`,
    "schedule_change_request:cancel": `Pedido de alteração cancelado: ${label}.`,
    "user:permission_change": `Permissões de utilizador alteradas: ${label}.`,
    "school:update_settings": `Definições da escola atualizadas.`,
  };

  const key = `${entityType}:${action}`;
  return summaries[key] || `${action} em ${entityType}${label ? `: ${label}` : ""}.`;
}

export function buildEntityLabel(entityType: AuditEntityType, data: Record<string, unknown>): string {
  switch (entityType) {
    case "empresa":
      return (data.nome as string) || "";
    case "estagio":
      return (data.titulo as string) || (data.id as string) || "";
    case "tutor":
      return (data.nome as string) || (data.email as string) || "";
    case "user":
      return (data.nome as string) || (data.displayName as string) || (data.email as string) || "";
    case "school":
      return (data.name as string) || "";
    case "schedule_change_request":
      return `${(data.type as string) || ""} - ${(data.targetDate as string) || ""}`;
    default:
      return "";
  }
}
