import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import type { AuditLogEntry, AuditAction, AuditEntityType } from "./types";

type WriteAuditParams = {
  schoolId: string;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel?: string;
  action: AuditAction;
  changedBy: string;
  summary?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(params: WriteAuditParams): Promise<string | null> {
  try {
    const db = getFirebaseAdminDb();
    const logRef = db
      .collection("schools")
      .doc(params.schoolId)
      .collection("auditLogs")
      .doc();

    const entry: AuditLogEntry = {
      schoolId: params.schoolId,
      entityType: params.entityType,
      entityId: params.entityId,
      entityLabel: params.entityLabel || undefined,
      action: params.action,
      changedBy: params.changedBy,
      timestamp: FieldValue.serverTimestamp(),
      summary: params.summary || undefined,
      metadata: params.metadata || undefined,
    };

    await logRef.set(entry);
    return logRef.id;
  } catch (err) {
    console.error("[audit] writeAuditLog failed:", err);
    return null;
  }
}
