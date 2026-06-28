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

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === "object" && !(v instanceof Date) && !(v as any)?.toDate && !Array.isArray(v)) {
      out[k] = stripUndefined(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function writeAuditLog(params: WriteAuditParams): Promise<string | null> {
  try {
    const db = getFirebaseAdminDb();
    const logRef = db
      .collection("schools")
      .doc(params.schoolId)
      .collection("auditLogs")
      .doc();

    const raw: Record<string, unknown> = {
      schoolId: params.schoolId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      changedBy: params.changedBy,
      timestamp: FieldValue.serverTimestamp(),
    };

    if (params.entityLabel) raw.entityLabel = params.entityLabel;
    if (params.summary) raw.summary = params.summary;
    if (params.metadata) {
      const cleaned = stripUndefined(params.metadata);
      if (Object.keys(cleaned).length > 0) raw.metadata = cleaned;
    }

    const entry = stripUndefined(raw) as unknown as AuditLogEntry;

    await logRef.set(entry);
    return logRef.id;
  } catch (err) {
    console.error("[audit] writeAuditLog failed:", err);
    return null;
  }
}
