"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, CalendarX2 } from "lucide-react";

type Props = {
  empresaId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function TutorFechoEmpresaModal({ empresaId, open, onClose, onSuccess }: Props) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setError("Introduz uma data válida.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/empresas/${empresaId}/fechos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDate: date,
          reason,
          scope,
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao registar o dia sem estágio.");
        return;
      }

      onSuccess();
      onClose();
      setDate("");
      setReason("");
      setScope("all");
    } catch {
      setError("Erro de rede. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && !loading && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarX2 className="w-5 h-5" />
            Novo Dia Sem Estágio
          </DialogTitle>
          <DialogDescription>
            Regista um dia em que a empresa estará encerrada ou em tolerância de ponto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Textarea 
              value={reason} 
              onChange={e => setReason(e.target.value)} 
              placeholder="Ex: Tolerância de ponto de Natal" 
            />
          </div>
          
          <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            ℹ️ Os estágios afetados terão a sua data prevista de fim prolongada em um dia útil automaticamente.
          </p>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Fecho
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
