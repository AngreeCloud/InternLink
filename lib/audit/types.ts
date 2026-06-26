export type AuditAction =
  | "create"
  | "update"
  | "archive"
  | "restore"
  | "delete"
  | "approve"
  | "reject"
  | "status_change"
  | "permission_change"
  | "cancel"
  | "associate"
  | "disassociate"
  | "update_settings"
  | "delete_request"
  | "delete_approved"
  | "delete_rejected"
  | "sign_avaliacao"
  | "reset_avaliacao";

export type AuditEntityType =
  | "empresa"
  | "estagio"
  | "tutor"
  | "schedule_change_request"
  | "user"
  | "school"
  | "course"
  | "avaliacao";

export interface AuditLogEntry {
  schoolId: string;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel?: string;
  action: AuditAction;
  changedBy: string;
  timestamp: FirebaseFirestore.FieldValue;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogEntryRead {
  id: string;
  schoolId: string;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel?: string;
  action: AuditAction;
  changedBy: string;
  changedByName?: string;
  timestamp: Date | null;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditFilters {
  entityType?: AuditEntityType;
  action?: AuditAction;
  changedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  startAfter?: unknown;
}
