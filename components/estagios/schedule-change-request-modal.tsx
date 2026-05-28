"use client";

import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
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
  defaultType?: ScheduleChangeRequestType;
};

const schema = z.object({
  type: z.enum(["future_absence", "past_absence_justification", "early_termination"]),
  absenceType: z.enum(["total", "partial"]).optional(),
  hoursAffected: z.number().min(1).max(24).optional(),
  reason: z
    .string()
    .min(10, "O motivo deve ter pelo menos 10 caracteres.")
    .max(1000, "O motivo não pode exceder 1000 caracteres."),
}).superRefine((data, ctx) => {
  if (data.type !== "early_termination") {
    if (!data.absenceType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Seleciona se a falta é de um dia inteiro ou parcial.",
        path: ["absenceType"],
      });
    }
    if (data.absenceType === "partial" && !data.hoursAffected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica o número de horas em falta.",
        path: ["hoursAffected"],
      });
    }
  }
});

type FormValues = z.infer<typeof schema>;

const TYPE_LABELS: Record<ScheduleChangeRequestType, string> = {
  future_absence: "Aviso de falta futura",
  past_absence_justification: "Justificação de falta",
  early_termination: "Término antecipado do estágio",
};

export function ScheduleChangeRequestModal({
  open,
  onClose,
  estagioId,
  targetDate,
  canRequestEarlyTermination,
  onCreated,
  defaultType,
}: Props) {
  const [serverError, setServerError] = useState<string | null>(null);

  // A date is "past or today" — treated as justification vs future for schedule change
  const isPastOrToday =
    !!targetDate &&
    new Date(targetDate + "T00:00:00").getTime() <= new Date(new Date().toDateString()).getTime();

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
      type: defaultType || (isPastOrToday ? "past_absence_justification" : "future_absence"),
      absenceType: "total",
      hoursAffected: undefined,
      reason: "",
    },
  });

  const selectedType = watch("type");
  const selectedAbsenceType = watch("absenceType");

  useEffect(() => {
    if (!open) return;
    reset({
      type: defaultType || (isPastOrToday ? "past_absence_justification" : "future_absence"),
      absenceType: "total",
      hoursAffected: undefined,
      reason: "",
    });

    setServerError(null);
  }, [open, isPastOrToday, reset, defaultType]);

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
          absenceType: values.type === "early_termination" ? undefined : values.absenceType,
          hoursAffected: values.type !== "early_termination" && values.absenceType === "partial" ? values.hoursAffected : 0,
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
              disabled={isPastOrToday}
            >
              <SelectTrigger id="request-type">
                <SelectValue placeholder="Seleciona o tipo" />
              </SelectTrigger>
              <SelectContent>
                {!isPastOrToday && (
                  <SelectItem value="future_absence">{TYPE_LABELS.future_absence}</SelectItem>
                )}
                {isPastOrToday && (
                  <SelectItem value="past_absence_justification">
                    {TYPE_LABELS.past_absence_justification}
                  </SelectItem>
                )}
                {canRequestEarlyTermination && !isPastOrToday && (
                  <SelectItem value="early_termination">
                    {TYPE_LABELS.early_termination}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-xs text-destructive">{errors.type.message}</p>
            )}

            {selectedType === "past_absence_justification" && (
              <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                O pedido será enviado ao professor orientador, que decidirá se a falta é
                justificada ou não. O tutor será notificado da decisão.
              </p>
            )}
            {selectedType === "future_absence" && (
              <p className="text-xs text-muted-foreground">
                Avisa o professor e o tutor de uma falta prevista. Requer aprovação de
                ambos. Se aprovada, prolonga a data estimada de fim em um dia útil.
              </p>
            )}
            {selectedType === "early_termination" && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Este pedido solicita o encerramento antecipado do estágio. Requer aprovação
                do professor orientador e do tutor da empresa.
              </p>
            )}
          </div>

          {selectedType !== "early_termination" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Detalhes da falta</Label>
                <div className="flex flex-col space-y-1">
                  <label className="flex items-center space-x-2 font-normal cursor-pointer text-sm">
                    <input 
                      type="radio" 
                      value="total" 
                      checked={selectedAbsenceType === "total"} 
                      onChange={() => setValue("absenceType", "total", { shouldValidate: true })} 
                      className="w-4 h-4 text-primary" 
                    />
                    <span>O dia todo (total)</span>
                  </label>
                  <label className="flex items-center space-x-2 font-normal cursor-pointer text-sm">
                    <input 
                      type="radio" 
                      value="partial" 
                      checked={selectedAbsenceType === "partial"} 
                      onChange={() => setValue("absenceType", "partial", { shouldValidate: true })} 
                      className="w-4 h-4 text-primary" 
                    />
                    <span>Apenas algumas horas (parcial)</span>
                  </label>
                </div>
                {errors.absenceType && (
                  <p className="text-xs text-destructive">{errors.absenceType.message}</p>
                )}
              </div>

              {selectedAbsenceType === "partial" && (
                <div className="space-y-2">
                  <Label htmlFor="hoursAffected">Número de horas em falta</Label>
                  <Input
                    id="hoursAffected"
                    type="number"
                    min={1}
                    max={24}
                    {...register("hoursAffected", { valueAsNumber: true })}
                    placeholder="Ex: 2"
                  />
                  {errors.hoursAffected && (
                    <p className="text-xs text-destructive">{errors.hoursAffected.message}</p>
                  )}
                </div>
              )}
            </div>
          )}

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
