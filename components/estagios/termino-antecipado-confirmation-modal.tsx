"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { formatIsoPt } from "@/lib/estagios/workdays";
import type { EligibilityResult } from "@/lib/estagios/termino-antecipado";

type Props = {
  open: boolean;
  onClose: () => void;
  estagioId: string;
  eligibility: EligibilityResult | null;
};

export function TerminoAntecipadoConfirmationModal({
  open,
  onClose,
  estagioId,
  eligibility,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowSuccess(false);
      setError(null);
    }
  }, [open]);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/estagios/${estagioId}/termino-antecipado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Erro ao submeter o pedido.");
        return;
      }
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
    } catch {
      setError("Erro de rede. Tenta novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!eligibility) return null;

  const diasParaCumprirStr = eligibility.diasParaCumprir.map(formatIsoPt).join("; ");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {showSuccess ? (
          <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-300">
            <div className="mb-4 rounded-full bg-emerald-100 p-3 dark:bg-emerald-900/40">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-lg font-semibold">Pedido enviado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aguarda a decisão do tutor.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Solicitar término antecipado do estágio</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                De acordo com as horas atualmente registadas, prevê-se que o total
                de horas da FCT possa ser integralmente cumprido antes do último dia
                previsto de estágio, caso sejam observados sem interrupção os dias
                remanescentes abaixo indicados.
              </p>

              <div className="rounded-md bg-muted/50 px-4 py-3 space-y-1 text-xs">
                <Row label="Horas previstas totais" value={`${eligibility.horasPrevistasTotais} h`} />
                <Row label="Horas realizadas" value={`${eligibility.horasRealizadas} h`} />
                <Row label="Horas ainda em falta" value={`${eligibility.horasRestantes} h`} />
                <Row
                  label="Dias que permanecem obrigatórios"
                  value={diasParaCumprirStr || "N/A"}
                />
                <Row
                  label="Dia de dispensa solicitado"
                  value={eligibility.diaDeDispensa ? formatIsoPt(eligibility.diaDeDispensa) : "N/A"}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  DECLARAÇÃO DO FORMANDO
                </p>
                <div className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                  <p>
                    Ao submeter a presente solicitação, o formando declara, para os devidos
                    efeitos, que toma conhecimento e aceita expressamente que:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>
                      A presente solicitação depende de aprovação expressa do tutor, não
                      produzindo quaisquer efeitos automáticos nem dispensando, por si só, a
                      obrigação de comparência enquanto não for validamente deferida;
                    </li>
                    <li>
                      O formando se compromete a cumprir integralmente o horário previsto
                      para todos os dias de estágio remanescentes até ao último dia útil
                      imediatamente anterior ao dia de dispensa ora solicitado;
                    </li>
                    <li>
                      O dia {eligibility.diaDeDispensa ? formatIsoPt(eligibility.diaDeDispensa) : "indicado"} apenas poderá ser considerado dispensado caso
                      no final do dia útil anterior não subsistam horas de estágio em falta
                      iguais ou superiores à carga horária prevista para esse dia;
                    </li>
                    <li>
                      A verificação superveniente de falta, incumprimento horário, saída
                      antecipada ou qualquer outro facto suscetível de comprometer o cálculo
                      subjacente ao pedido determina a caducidade automática da presente
                      solicitação ou da respetiva aprovação, sem necessidade de nova decisão;
                    </li>
                    <li>
                      Em caso de invalidação do pedido, mantém-se ou reativa-se a obrigação
                      de comparecer no dia inicialmente indicado como dispensável.
                    </li>
                  </ol>
                </div>
              </div>

              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Confirmar e submeter
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
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
