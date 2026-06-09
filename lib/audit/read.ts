import { collection, query, where, orderBy, limit as queryLimit, getDocs, startAfter, type Timestamp } from "firebase/firestore";
import type { AuditLogEntryRead, AuditFilters, AuditEntityType, AuditAction } from "./types";

export async function readAuditLogs(
  db: FirebaseFirestore.Firestore | import("firebase/firestore").Firestore,
  schoolId: string,
  filters?: AuditFilters
): Promise<{ logs: AuditLogEntryRead[]; hasMore: boolean; lastDoc: unknown }> {
  const col = collection(db as import("firebase/firestore").Firestore, "schools", schoolId, "auditLogs");
  const constraints: import("firebase/firestore").QueryConstraint[] = [];

  if (filters?.entityType) {
    constraints.push(where("entityType", "==", filters.entityType));
  }
  if (filters?.action) {
    constraints.push(where("action", "==", filters.action));
  }
  if (filters?.changedBy) {
    constraints.push(where("changedBy", "==", filters.changedBy));
  }

  constraints.push(orderBy("timestamp", "desc"));
  constraints.push(queryLimit((filters?.limit ?? 20) + 1));

  if (filters?.startAfter) {
    constraints.push(startAfter(filters.startAfter));
  }

  const q = query(col, ...constraints);
  const snap = await getDocs(q);

  const hasMore = snap.docs.length > (filters?.limit ?? 20);
  const docs = hasMore ? snap.docs.slice(0, filters?.limit ?? 20) : snap.docs;
  const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

  const logs: AuditLogEntryRead[] = docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      schoolId: data.schoolId as string,
      entityType: data.entityType as AuditEntityType,
      entityId: data.entityId as string,
      entityLabel: data.entityLabel as string | undefined,
      action: data.action as AuditAction,
      changedBy: data.changedBy as string,
      timestamp: (data.timestamp as Timestamp)?.toDate?.() ?? null,
      summary: data.summary as string | undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
    };
  });

  return { logs, hasMore, lastDoc };
}
