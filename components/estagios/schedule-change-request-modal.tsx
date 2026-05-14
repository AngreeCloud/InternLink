"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { formatIsoPt } from "@/lib/estagios/workdays";
import type { ScheduleChangeRequestType } from "@/lib/estagios/schedule-change-requests";

type Props = {
  open: boolean;
  onClose: () => void;
  estagioId: string;
  targetDate: string;
  canRequestEarlyTermination: boolean;
  onCreated: () => void;
};

const schema = z.object({
  type: z.enum(["absence", "early_termination"]),
  reason: z
    .string()
    .min(10, "O motivo deve ter pelo menos 10 caracteres.")
    .max(1000, "O motivo não pode exceder 1000 caracteres."),
});

type FormValues = z.infer<typeof schema>;

const TYPE_LABELS: Record<ScheduleChangeRequestType, string> = {
  absence: "Falta justificada",
  early_termination: "Término antecipado do estágio",
};

export function ScheduleChangeRequestModal({
  open,
  onClose,
  estagioId,
  targetDate,
  canRequestEarlyTermination,
  onCreated,
}: Props) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "absence",
      reason: "",
    },
  });

  const selectedType = watch("type");

  function handleClose() {
    reset();
    setServerError(null);
    onClose();
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const res = await fetch(`/api/estagios/${estagioId}/schedule-change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: values.type,
          targetDate,
          reason: values.reason,
          hoursAffected: 0, // server reads from estagio
        }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setServerError(data.error ?? "Não foi possível submeter o pedido. Tenta novamente.");
        return;
      }

      reset();
      onCreated();
      handleClose();
    } catch {
      setServerError("Erro de rede. Verifica a tua ligação e tenta novamente.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo pedido de alteração</DialogTitle>
          <DialogDescription>
            Data selecionada:{" "}
            <span className="font-medium text-foreground">{formatIsoPt(targetDate)}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="request-type">Tipo de pedido</Label>
            <Select
              value={selectedType}
              onValueChange={(v) =>
                setValue("type", v as ScheduleChangeRequestType, { shouldValidate: true })
              }
            >
              <SelectTrigger id="request-type">
                <SelectValue placeholder="Seleciona o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absence">{TYPE_LABELS.absence}</SelectItem>
                {canRequestEarlyTermination && (
                  <SelectItem value="early_termination">
                    {TYPE_LABELS.early_termination}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-xs text-destructive">{errors.type.message}</p>
            )}

            {selectedType === "early_termination" && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Este pedido solicita o encerramento antecipado do estágio. Requer aprovação
                do professor orientador e do tutor da empresa.
              </p>
            )}
            {selectedType === "absence" && (
              <p className="text-xs text-muted-foreground">
                A ausência justificada prolonga a data estimada de fim do estágio em um dia
                útil, após aprovação do professor e do tutor.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="request-reason">
              Motivo <span className="text-muted-foreground">(obrigatório)</span>
            </Label>
            <Textarea
              id="request-reason"
              {...register("reason")}
              placeholder="Descreve o motivo do pedido com o máximo de detalhe possível..."
              rows={5}
              maxLength={1000}
              aria-invalid={Boolean(errors.reason)}
              className="resize-y"
            />
            {errors.reason && (
              <p className="text-xs text-destructive">{errors.reason.message}</p>
            )}
          </div>

          {serverError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {serverError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Submeter pedido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
