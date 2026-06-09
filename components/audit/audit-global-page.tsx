"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, query, where, orderBy, limit as qLimit, getDocs, startAfter, type QueryDocumentSnapshot } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { AuditLogEntryRead, AuditEntityType, AuditAction } from "@/lib/audit/types";

const ENTITY_TYPES: { value: string; label: string }[] = [
  { value: "all", label: "Todas as entidades" },
  { value: "empresa", label: "Empresa" },
  { value: "estagio", label: "Estágio" },
  { value: "tutor", label: "Tutor" },
  { value: "schedule_change_request", label: "Pedido de alteração" },
  { value: "user", label: "Utilizador" },
  { value: "course", label: "Curso" },
  { value: "school", label: "Escola" },
];

const ACTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todas as ações" },
  { value: "create", label: "Criação" },
  { value: "update", label: "Atualização" },
  { value: "archive", label: "Arquivo" },
  { value: "restore", label: "Restauro" },
  { value: "delete", label: "Eliminação" },
  { value: "approve", label: "Aprovação" },
  { value: "reject", label: "Rejeição" },
  { value: "status_change", label: "Alteração de estado" },
  { value: "cancel", label: "Cancelamento" },
  { value: "associate", label: "Associação" },
  { value: "disassociate", label: "Desassociação" },
  { value: "permission_change", label: "Alteração de cargo" },
  { value: "update_settings", label: "Configurações" },
];

function badgeVariant(action: string): "default" | "secondary" | "outline" | "destructive" {
  switch (action) {
    case "create": return "default";
    case "update":
    case "update_settings": return "secondary";
    case "archive":
    case "delete": return "destructive";
    case "restore":
    case "approve": return "default";
    case "permission_change": return "secondary";
    case "reject":
    case "cancel": return "destructive";
    case "status_change": return "secondary";
    case "associate": return "default";
    case "disassociate": return "destructive";
    default: return "outline";
  }
}

function actionLabel(action: string): string {
  const found = ACTIONS.find((a) => a.value === action);
  return found?.label || action;
}

export function AuditGlobalPage() {
  const { schoolId } = useSchoolAdmin();
  const [logs, setLogs] = useState<AuditLogEntryRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [action, setAction] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [pageHistory, setPageHistory] = useState<(QueryDocumentSnapshot | null)[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const PAGE_SIZE = 20;

  const fetchLogs = useCallback(async (dir: "next" | "prev" | "reset" = "reset") => {
    setLoading(true);
    setError("");
    try {
      const db = await getDbRuntime();
      const col = collection(db, "schools", schoolId, "auditLogs");
      const constraints: import("firebase/firestore").QueryConstraint[] = [];

      if (entityType && entityType !== "all") {
        constraints.push(where("entityType", "==", entityType));
      }
      if (action && action !== "all") {
        constraints.push(where("action", "==", action));
      }

      constraints.push(orderBy("timestamp", "desc"));
      constraints.push(qLimit(PAGE_SIZE + 1));

      if (dir === "next" && lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(col, ...constraints);
      const snap = await getDocs(q);

      const newHasMore = snap.docs.length > PAGE_SIZE;
      const docs = newHasMore ? snap.docs.slice(0, PAGE_SIZE) : snap.docs;
      const newLastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

      const parsed: AuditLogEntryRead[] = docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          schoolId: data.schoolId as string,
          entityType: data.entityType as AuditEntityType,
          entityId: data.entityId as string,
          entityLabel: data.entityLabel as string | undefined,
          action: data.action as AuditAction,
          changedBy: data.changedBy as string,
          timestamp: (data.timestamp as { toDate?: () => Date })?.toDate?.() ?? null,
          summary: data.summary as string | undefined,
          metadata: data.metadata as Record<string, unknown> | undefined,
        };
      });

      const uniqueUids = [...new Set(parsed.map((l) => l.changedBy).filter(Boolean))];
      if (uniqueUids.length > 0) {
        try {
          const res = await fetch(`/api/audit/resolve-users?uids=${uniqueUids.join(",")}`);
          if (res.ok) {
            const map = await res.json() as Record<string, string>;
            setNameMap(map);
            parsed.forEach((l) => { l.changedByName = map[l.changedBy] || l.changedBy; });
          }
        } catch {
          // fallback — mostra UID
        }
      } else {
        setNameMap({});
      }

      setLogs(parsed);
      setHasMore(newHasMore);
      setLastDoc(newLastDoc as unknown as QueryDocumentSnapshot | null);

      if (dir === "next") {
        setPageHistory((prev) => [...prev, lastDoc]);
        setPage((prev) => prev + 1);
      } else if (dir === "prev") {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        setPage(1);
        setPageHistory([]);
      }
    } catch {
      setError("Não foi possível carregar o histórico.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId, entityType, action, lastDoc]);

  useEffect(() => {
    fetchLogs("reset");
  }, [entityType, action]);

  const handleSearch = () => {
    fetchLogs("reset");
  };

  const filteredLogs = searchQuery
    ? logs.filter(
        (l) =>
          l.entityLabel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.entityId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.changedBy?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.summary?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Histórico</h1>
        <p className="text-muted-foreground">Consulte ações críticas da plataforma.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de atividade</CardTitle>
          <CardDescription>
            Registo centralizado de empresas, estágios, tutores, utilizadores e escola.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Pesquisar utilizador, entidade ou ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Button variant="secondary" size="sm" onClick={handleSearch}>
              Pesquisar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Entidade" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(entityType !== "all" || action !== "all" || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEntityType("all");
                  setAction("all");
                  setSearchQuery("");
                }}
              >
                Limpar
              </Button>
            )}
          </div>

          {loading && <p className="text-sm text-muted-foreground">A carregar...</p>}
          {!loading && error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && filteredLogs.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum evento encontrado.</p>
          )}
          {!loading && !error && filteredLogs.length > 0 && (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {log.entityLabel || log.entityId || log.entityType}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.entityType} · {log.entityId}
                      </p>
                    </div>
                    <Badge variant={badgeVariant(log.action)} className="shrink-0">
                      {actionLabel(log.action)}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{log.summary || `${log.action} em ${log.entityType}`}</span>
                    <span>
                      {log.timestamp
                        ? new Date(log.timestamp).toLocaleString("pt-PT", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    por {log.changedByName || log.changedBy}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!loading && filteredLogs.length > 0 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  const prev = pageHistory[pageHistory.length - 2] || null;
                  setLastDoc(prev);
                  setPageHistory((p) => p.slice(0, -1));
                  setPage((p) => Math.max(1, p - 1));
                  fetchLogs("prev");
                }}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">Página {page}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore}
                onClick={() => fetchLogs("next")}
              >
                Seguinte
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
