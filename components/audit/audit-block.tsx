"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditLogEntryRead, AuditEntityType } from "@/lib/audit/types";

type Props = {
  schoolId: string;
  entityType: AuditEntityType;
  entityId: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string | null;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string | null;
  archivedBy?: string;
  archivedByName?: string;
  archivedAt?: string | null;
  maxRecent?: number;
};

export function AuditBlock({
  schoolId,
  entityType,
  entityId,
  createdBy,
  createdByName,
  createdAt,
  updatedBy,
  updatedByName,
  updatedAt,
  archivedBy,
  archivedByName,
  archivedAt,
  maxRecent = 5,
}: Props) {
  const [recentLogs, setRecentLogs] = useState<AuditLogEntryRead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const db = await getDbRuntime();
        const col = collection(db, "schools", schoolId, "auditLogs");
        const q = query(
          col,
          where("entityType", "==", entityType),
          where("entityId", "==", entityId),
          orderBy("timestamp", "desc"),
          limit(maxRecent)
        );
        const snap = await getDocs(q);
        if (!active) return;
        const logs: AuditLogEntryRead[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            schoolId: data.schoolId as string,
            entityType: data.entityType as AuditEntityType,
            entityId: data.entityId as string,
            entityLabel: data.entityLabel as string | undefined,
            action: data.action as import("@/lib/audit/types").AuditAction,
            changedBy: data.changedBy as string,
            timestamp: (data.timestamp as { toDate?: () => Date })?.toDate?.() ?? null,
            summary: data.summary as string | undefined,
            metadata: data.metadata as Record<string, unknown> | undefined,
          };
        });
        setRecentLogs(logs);
      } catch {
        if (!active) return;
        setRecentLogs([]);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [schoolId, entityType, entityId, maxRecent]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auditoria</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 text-sm">
          {createdAt && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Criado em:</span> {createdAt}
            </p>
          )}
          {createdByName && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Criado por:</span> {createdByName}
            </p>
          )}
          {updatedAt && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Atualizado em:</span> {updatedAt}
            </p>
          )}
          {updatedByName && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Atualizado por:</span> {updatedByName}
            </p>
          )}
          {archivedAt && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Arquivado em:</span> {archivedAt}
            </p>
          )}
          {archivedByName && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Arquivado por:</span> {archivedByName}
            </p>
          )}
        </div>

        {loading && <p className="text-sm text-muted-foreground mt-4">A carregar histórico...</p>}
        {!loading && recentLogs.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Histórico recente</p>
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-xs text-muted-foreground border-b border-border pb-1">
                <span>
                  {log.timestamp
                    ? new Date(log.timestamp).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—"}{" "}
                  <span className="text-foreground font-medium">{log.action}</span>
                </span>
                <span>por {log.changedBy}</span>
              </div>
            ))}
          </div>
        )}
        {!loading && recentLogs.length === 0 && (
          <p className="text-sm text-muted-foreground mt-4">Nenhum evento registado.</p>
        )}
      </CardContent>
    </Card>
  );
}
