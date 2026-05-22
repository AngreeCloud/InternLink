"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { formatIsoPt } from "@/lib/estagios/workdays";
import {
  labelForTerminoStatus,
  variantForTerminoStatus,
  type TerminoAntecipado,
  type TerminoAntecipadoStatus,
} from "@/lib/estagios/termino-antecipado";
import type { EstagioMetaLite } from "@/components/estagios/schedule-change-requests-list";

const POLL_MS = 30_000;

function toMillis(raw: unknown): number {
  if (!raw) return 0;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "object") {
    const obj = raw as { seconds?: number; toDate?: () => Date };
    if (typeof obj.toDate === "function") return obj.toDate().getTime();
    if (typeof obj.seconds === "number") return obj.seconds * 1000;
  }
  return 0;
}

export function TutorTerminosAntecipadosCenter() {
  const [userId, setUserId] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [pedidos, setPedidos] = useState<TerminoAntecipado[]>([]);
  const [estagiosById, setEstagiosById] = useState<Record<string, EstagioMetaLite | undefined>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<TerminoAntecipado | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      const auth = await getAuthRuntime();
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setUserId(user?.uid || "");
        setLoadingUser(false);
      });
    })();
    return () => unsubscribe();
  }, []);

  const fetchPedidos = useCallback(async () => {
    try {
      const res = await fetch("/api/termino-antecipado?role=tutor");
      if (!res.ok) return;
      const json = (await res.json()) as { ok: boolean; pedidos: TerminoAntecipado[] };
      if (!json.ok) return;
      const out = json.pedidos.sort((a, b) => toMillis(b.submittedAt) - toMillis(a.submittedAt));
      setPedidos(out);
      setLoadingPedidos(false);
    } catch (err) {
      console.error("[v0] termino-antecipado tutor fetch", err);
      setLoadingPedidos(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) { setPedidos([]); setLoadingPedidos(false); return; }
    fetchPedidos();
    intervalRef.current = setInterval(fetchPedidos, POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [userId, fetchPedidos]);

  useEffect(() => {
    if (pedidos.length === 0) return;
    const needed = Array.from(new Set(pedidos.map((p) => p.estagioId))).filter(
      (id) => id && !estagiosById[id]
    );
    if (needed.length === 0) return;

    let cancelled = false;
    (async () => {
      const db = await getDbRuntime();
      const nextEntries: Record<string, EstagioMetaLite> = {};
      await Promise.all(
        needed.map(async (id) => {
          try {
            const snap = await getDoc(doc(db, "estagios", id));
            if (!snap.exists()) return;
            const raw = snap.data() as Record<string, unknown>;
            nextEntries[id] = {
              id,
              titulo: (raw.titulo as string | undefined) || (raw.title as string | undefined) || "Estágio",
              alunoNome: (raw.alunoNome as string | undefined) || "Aluno",
              empresa: (raw.empresa as string | undefined) || (raw.entidadeAcolhimento as string | undefined) || "",
              courseNome: (raw.courseNome as string | undefined) || "",
              schoolId: (raw.schoolId as string | undefined) || "",
            };
          } catch { /* skip */ }
        })
      );
      if (cancelled) return;
      setEstagiosById((prev) => ({ ...prev, ...nextEntries }));
    })();
    return () => { cancelled = true; };
  }, [estagiosById, pedidos]);

  async function handleApprove() {
    if (!selectedPedido) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/estagios/${selectedPedido.estagioId}/termino-antecipado/${selectedPedido.id}/aprovar`,
        { method: "PATCH" }
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setError(data.error ?? "Erro ao aprovar."); return; }
      setApproveOpen(false);
      setSelectedPedido(null);
      fetchPedidos();
    } catch {
      setError("Erro de rede.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    if (!selectedPedido || !rejectMotivo.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/estagios/${selectedPedido.estagioId}/termino-antecipado/${selectedPedido.id}/recusar`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivoRecusa: rejectMotivo.trim() }),
        }
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setError(data.error ?? "Erro ao recusar."); return; }
      setRejectOpen(false);
      setSelectedPedido(null);
      setRejectMotivo("");
      fetchPedidos();
    } catch {
      setError("Erro de rede.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingUser || loadingPedidos) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">A carregar pedidos...</CardContent>
      </Card>
    );
  }

  if (pedidos.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="space-y-2 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Sem solicitações de término antecipado</p>
          <p className="text-xs text-muted-foreground">
            Quando um aluno submeter um pedido de término antecipado, aparece aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pedidos.map((p) => {
        const estagio = estagiosById[p.estagioId];
        const diasParaCumprirStr = (p.diasParaCumprir || []).map(formatIsoPt).join("; ");

        return (
          <Card key={p.id} className="overflow-hidden">
            <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {p.alunoNome || estagio?.alunoNome || "Aluno"} · {estagio?.empresa || p.tutorNome || ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Solicitado em {typeof p.submittedAt === "object" && p.submittedAt && "seconds" in p.submittedAt
                    ? new Date((p.submittedAt as { seconds: number }).seconds * 1000).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={variantForTerminoStatus(p.estado)}>
                  {labelForTerminoStatus(p.estado)}
                </Badge>
              </div>
            </div>

            <CardContent className="space-y-3 border-t pt-4">
              <div className="grid gap-1.5 text-sm">
                <Row label="Horas em falta" value={`${p.horasRestantesNaSubmissao} h`} />
                <Row label="Dias a cumprir" value={diasParaCumprirStr || "—"} />
                <Row
                  label="Dia de dispensa pretendido"
                  value={p.diaDeDispensa ? formatIsoPt(p.diaDeDispensa) : "—"}
                />
                {p.motivoRecusa && <Row label="Motivo da recusa" value={p.motivoRecusa} />}
                {p.diaDeIncumprimento && (
                  <Row label="Incumprimento em" value={formatIsoPt(p.diaDeIncumprimento)} />
                )}
              </div>

              {p.estado === "pendente" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => { setSelectedPedido(p); setApproveOpen(true); setError(null); }}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { setSelectedPedido(p); setRejectOpen(true); setRejectMotivo(""); setError(null); }}
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Recusar
                  </Button>
                </div>
              )}

              {p.estado === "invalidado_por_incumprimento" && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  Pedido invalidado por incumprimento horário. O aluno pode submeter nova solicitação.
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={(v) => !v && setApproveOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Aprovar término antecipado — {selectedPedido?.alunoNome}</DialogTitle>
            <DialogDescription>Confirma a aprovação do pedido de término antecipado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-muted/50 px-4 py-3 space-y-1 text-xs">
              <Row label="Formando" value={selectedPedido?.alunoNome || "—"} />
              <Row label="Empresa" value={selectedPedido?.tutorNome || "—"} />
              <Row
                label="Dias ainda obrigatórios"
                value={selectedPedido ? selectedPedido.diasParaCumprir.map(formatIsoPt).join("; ") : "—"}
              />
              <Row
                label="Dia de dispensa solicitado"
                value={selectedPedido?.diaDeDispensa ? formatIsoPt(selectedPedido.diaDeDispensa) : "—"}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ao aprovar esta solicitação, o tutor declara que autoriza a ausência do formando no dia indicado,
              desde que se verifique o cumprimento integral dos dias obrigatórios. O incumprimento posterior
              determina a perda de eficácia da aprovação.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={submitting}>Cancelar</Button>
            <Button onClick={handleApprove} disabled={submitting}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Confirmar aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={(v) => !v && setRejectOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar solicitação — {selectedPedido?.alunoNome}</DialogTitle>
            <DialogDescription>O motivo será comunicado ao formando.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Escreve o motivo da recusa..."
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={submitting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={submitting || !rejectMotivo.trim()}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}
