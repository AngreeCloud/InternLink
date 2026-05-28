"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, CalendarX2, Trash2 } from "lucide-react";

type FechoDoc = {
  id: string;
  targetDate: string;
  reason?: string;
  scope?: string;
  createdBy?: string;
  createdAt?: unknown;
};

type Props = {
  empresaId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

function formatPtDate(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function TutorFechoEmpresaModal({ empresaId, open, onClose, onSuccess }: Props) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fechos, setFechos] = useState<FechoDoc[]>([]);
  const [loadingFechos, setLoadingFechos] = useState(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [confirmDeleteDate, setConfirmDeleteDate] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !empresaId) return;
    setLoadingFechos(true);
    fetch(`/api/empresas/${empresaId}/fechos`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setFechos(data.fechos ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingFechos(false));
  }, [open, empresaId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setError("Introduz uma data.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/empresas/${empresaId}/fechos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate: date, reason, scope }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao registar.");
        return;
      }

      onSuccess();
      onClose();
      setDate("");
      setReason("");
      setScope("all");
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(targetDate: string) {
    setDeletingDate(targetDate);
    setError(null);
    try {
      const res = await fetch(`/api/empresas/${empresaId}/fechos/${targetDate}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao remover.");
        return;
      }
      setFechos(prev => prev.filter(f => f.id !== targetDate));
      setConfirmDeleteDate(null);
      onSuccess();
    } catch {
      setError("Erro de rede.");
    } finally {
      setDeletingDate(null);
    }
  }

  const futureFechos = fechos.filter(f => f.id >= new Date().toISOString().slice(0, 10));
  const pastFechos = fechos.filter(f => f.id < new Date().toISOString().slice(0, 10));

  return (
    <Dialog open={open} onOpenChange={v => !v && !loading && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarX2 className="w-5 h-5" />
            Gerir Dias Sem Estágio
          </DialogTitle>
          <DialogDescription>
            Regista ou remove dias em que a empresa estará encerrada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing fechos list */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Comunicados ativos
            </h3>
            {loadingFechos ? (
              <p className="text-xs text-muted-foreground">A carregar...</p>
            ) : fechos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum dia sem estágio registado.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {futureFechos.map(f => (
                  <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{formatPtDate(f.id)}</p>
                      {f.reason && <p className="truncate text-xs text-muted-foreground">{f.reason}</p>}
                      <p className="text-[10px] text-muted-foreground">
                        {f.scope === "mine" ? "Meus formandos" : "Toda a empresa"}
                      </p>
                    </div>
                    {confirmDeleteDate === f.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="destructive" className="h-7 text-xs px-2" disabled={deletingDate === f.id} onClick={() => handleDelete(f.id)}>
                          {deletingDate === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirmar"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setConfirmDeleteDate(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteDate(f.id)} title="Remover">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {pastFechos.length > 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground pt-1">Passados</p>
                    {pastFechos.map(f => (
                      <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/10 px-3 py-2 opacity-60">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{formatPtDate(f.id)}</p>
                          {f.reason && <p className="truncate text-xs text-muted-foreground">{f.reason}</p>}
                        </div>
                        {confirmDeleteDate === f.id ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="destructive" className="h-7 text-xs px-2" disabled={deletingDate === f.id} onClick={() => handleDelete(f.id)}>
                              {deletingDate === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirmar"}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setConfirmDeleteDate(null)}>
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setConfirmDeleteDate(f.id)} title="Remover">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="border-t" />

          {/* Create new fecho */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Novo comunicado
            </h3>
            <div className="space-y-2">
              <Label>Data de encerramento</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label>Afeta</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 font-normal cursor-pointer text-sm">
                  <input type="radio" value="all" checked={scope === "all"} onChange={e => setScope(e.target.value as any)} className="w-4 h-4 text-primary" />
                  Toda a empresa
                </label>
                <label className="flex items-center gap-2 font-normal cursor-pointer text-sm">
                  <input type="radio" value="mine" checked={scope === "mine"} onChange={e => setScope(e.target.value as any)} className="w-4 h-4 text-primary" />
                  Apenas os meus formandos
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Tolerância de ponto de Natal" />
            </div>

            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              ℹ️ Os estágios afetados terão a data prevista de fim prolongada em um dia útil. Comunicados podem ser removidos, cancelando o efeito nos pedidos associados.
            </p>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Fechar</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar Fecho
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
