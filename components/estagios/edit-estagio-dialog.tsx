"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  calcularDataFimEstimada,
  DEFAULT_DIAS_SEMANA,
  formatIsoDatePt,
  type DiasSemana,
} from "@/lib/estagios/date-calc";

const DAY_LABEL: Record<keyof DiasSemana, string> = {
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
  dom: "Domingo",
};

const DAY_ORDER: (keyof DiasSemana)[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

export type EditableEstagio = {
  id: string;
  titulo?: string;
  empresa?: string;
  entidadeAcolhimento?: string;
  dataInicio?: string;
  totalHoras?: number;
  horasDiarias?: number;
  diasSemana?: Partial<DiasSemana>;
};

type Props = {
  estagio: EditableEstagio | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

function normalize(input?: Partial<DiasSemana>): DiasSemana {
  return {
    seg: Boolean(input?.seg),
    ter: Boolean(input?.ter),
    qua: Boolean(input?.qua),
    qui: Boolean(input?.qui),
    sex: Boolean(input?.sex),
    sab: Boolean(input?.sab),
    dom: Boolean(input?.dom),
  };
}

export function EditEstagioDialog({ estagio, open, onOpenChange, onSaved }: Props) {
  const [titulo, setTitulo] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [totalHoras, setTotalHoras] = useState<number>(600);
  const [horasDiarias, setHorasDiarias] = useState<number>(7);
  const [diasSemana, setDiasSemana] = useState<DiasSemana>(DEFAULT_DIAS_SEMANA);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset on open/close.
  useEffect(() => {
    if (!open || !estagio) return;
    setTitulo(estagio.titulo ?? "");
    setEmpresa(estagio.entidadeAcolhimento ?? estagio.empresa ?? "");
    setDataInicio(estagio.dataInicio ?? "");
    setTotalHoras(Number.isFinite(estagio.totalHoras) ? Number(estagio.totalHoras) : 600);
    setHorasDiarias(Number.isFinite(estagio.horasDiarias) ? Number(estagio.horasDiarias) : 7);
    setDiasSemana(normalize(estagio.diasSemana));
    setErrorMessage(null);
    setSubmitting(false);
  }, [open, estagio]);

  const dateResult = useMemo(() => {
    if (!dataInicio || !totalHoras || !horasDiarias) return null;
    return calcularDataFimEstimada({
      dataInicio,
      totalHoras: Number(totalHoras),
      horasDiarias: Number(horasDiarias),
      diasSemana,
    });
  }, [dataInicio, totalHoras, horasDiarias, diasSemana]);

  const toggleDay = (key: keyof DiasSemana) => {
    setDiasSemana((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!estagio) return;
    setErrorMessage(null);

    const tituloTrim = titulo.trim();
    if (!tituloTrim) {
      setErrorMessage("Indique o título do estágio.");
      return;
    }
    if (!dataInicio) {
      setErrorMessage("Indique a data de início.");
      return;
    }
    if (!Number.isFinite(totalHoras) || totalHoras <= 0) {
      setErrorMessage("Total de horas deve ser positivo.");
      return;
    }
    if (!Number.isFinite(horasDiarias) || horasDiarias <= 0 || horasDiarias > 24) {
      setErrorMessage("Horas por dia inválidas (1-24).");
      return;
    }
    if (!DAY_ORDER.some((k) => diasSemana[k])) {
      setErrorMessage("Selecione pelo menos um dia da semana.");
      return;
    }

    setSubmitting(true);
    try {
      const db = await getDbRuntime();
      const calc = calcularDataFimEstimada({
        dataInicio,
        totalHoras: Number(totalHoras),
        horasDiarias: Number(horasDiarias),
        diasSemana,
      });

      const empresaTrim = empresa.trim();
      await updateDoc(doc(db, "estagios", estagio.id), {
        titulo: tituloTrim,
        empresa: empresaTrim,
        entidadeAcolhimento: empresaTrim,
        dataInicio,
        totalHoras: Number(totalHoras),
        horasDiarias: Number(horasDiarias),
        diasSemana,
        dataFimEstimada: calc.dataFimEstimada,
        updatedAt: serverTimestamp(),
      });

      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado.";
      setErrorMessage(`Não foi possível guardar: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar estágio</DialogTitle>
          <DialogDescription>
            Atualize o título, empresa e horário do estágio. A data estimada de fim é recalculada
            automaticamente com base nas horas previstas, dias úteis e feriados nacionais portugueses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="edit-titulo">Título</Label>
            <Input
              id="edit-titulo"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Ex: Estágio em Desenvolvimento Web"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-empresa">Entidade de acolhimento / Empresa</Label>
            <Input
              id="edit-empresa"
              value={empresa}
              onChange={(event) => setEmpresa(event.target.value)}
              placeholder="Nome da entidade"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="edit-data-inicio">Data de início</Label>
              <Input
                id="edit-data-inicio"
                type="date"
                value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-total-horas">Total de horas</Label>
              <Input
                id="edit-total-horas"
                type="number"
                min={1}
                value={totalHoras}
                onChange={(event) => setTotalHoras(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-horas-diarias">Horas por dia</Label>
              <Input
                id="edit-horas-diarias"
                type="number"
                min={1}
                max={24}
                step={0.5}
                value={horasDiarias}
                onChange={(event) => setHorasDiarias(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias da semana ativos</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_ORDER.map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={diasSemana[key] ? "default" : "outline"}
                  onClick={() => toggleDay(key)}
                >
                  {DAY_LABEL[key]}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary">Pré-visualização</Badge>
              {dateResult && dateResult.diasUteis > 0 ? (
                <>
                  <span>
                    Data estimada de fim:{" "}
                    <strong>{formatIsoDatePt(dateResult.dataFimEstimada)}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    ({dateResult.diasUteis} dias úteis • feriados nacionais PT excluídos)
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Preencha data de início, total de horas e horário para ver a previsão.
                </span>
              )}
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={submitting}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={submitting}>
            {submitting ? "A guardar..." : "Guardar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
