"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

type DeleteRequest = {
  id: string;
  estagioId: string;
  estagioTitulo: string;
  alunoNome: string | null;
  professorName: string;
  motivo: string;
  estado: "pendente" | "aprovado" | "recusado";
  createdAt: Timestamp | null;
};

export function DeleteEstagioRequestsSection() {
  const { schoolId } = useSchoolAdmin();
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!schoolId) return;
    try {
      const db = await getDbRuntime();
      const q = query(
        collection(db, "schools", schoolId, "deleteEstagioRequests"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list: DeleteRequest[] = snap.docs.map((d) => {
        const data = d.data() as DeleteRequest;
        return { ...data, id: d.id, createdAt: data.createdAt || null };
      });
      setRequests(list);
    } catch (err) {
      console.error("Erro ao carregar pedidos de eliminação:", err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    refresh();
    let unsub: (() => void) | undefined;
    (async () => {
      const db = await getDbRuntime();
      const q = query(
        collection(db, "schools", schoolId, "deleteEstagioRequests"),
        orderBy("createdAt", "desc")
      );
      unsub = onSnapshot(
        q,
        () => { refresh(); },
        () => { /* ignore permission-denied during logout */ }
      );
    })();
    return () => { unsub?.(); };
  }, [schoolId, refresh]);

  const handleDecision = async (requestId: string, estagioId: string, decisao: "aprovado" | "recusado") => {
    setProcessing(requestId);
    try {
      const res = await fetch(`/api/estagios/${estagioId}/delete-request`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, decisao }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        console.error("Erro ao processar pedido:", err.error);
        return;
      }
      await refresh();
    } catch (err) {
      console.error("Erro ao processar pedido:", err);
    } finally {
      setProcessing(null);
    }
  };

  const pendentes = requests.filter((r) => r.estado === "pendente");
  const historico = requests.filter((r) => r.estado !== "pendente");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos de eliminação de estágios</CardTitle>
        <CardDescription>
          Professores solicitam eliminação de estágios. Aprovar elimina permanentemente o estágio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> A carregar...
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido de eliminação.</p>
        ) : (
          <>
            {pendentes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-amber-600">Pendentes ({pendentes.length})</h3>
                {pendentes.map((req) => (
                  <div key={req.id} className="rounded-lg border border-border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{req.estagioTitulo}</p>
                        <p className="text-xs text-muted-foreground">
                          Aluno: {req.alunoNome || "—"} | Professor: {req.professorName}
                        </p>
                        {req.motivo && (
                          <p className="text-xs text-muted-foreground mt-1">Motivo: {req.motivo}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0">Pendente</Badge>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={processing === req.id}
                        onClick={() => handleDecision(req.id, req.estagioId, "aprovado")}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {processing === req.id ? "A processar..." : "Aprovar eliminação"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processing === req.id}
                        onClick={() => handleDecision(req.id, req.estagioId, "recusado")}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Recusar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {historico.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-border">
                <h3 className="text-xs font-semibold text-muted-foreground">Histórico</h3>
                {historico.map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
                    <span className="font-medium">{req.estagioTitulo}</span>
                    <Badge variant={req.estado === "aprovado" ? "default" : "secondary"}>
                      {req.estado === "aprovado" ? "Aprovado" : "Recusado"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
