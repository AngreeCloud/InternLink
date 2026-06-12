"use client";

import { useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIsoPt } from "@/lib/estagios/workdays";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  estagioId: string;
  targetDate: string;
  isPast: boolean;
  horasDiarias: number;
  currentUserId: string;
  currentUserRole: string;
  onCreated: () => void;
};

export function HolidayWorkDialog({
  open,
  onClose,
  estagioId,
  targetDate,
  isPast,
  horasDiarias,
  currentUserId,
  currentUserRole,
  onCreated,
}: Props) {
  const [hours, setHours] = useState<string>(String(horasDiarias));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);

    if (isPast) {
      const v = Number(hours.replace(",", "."));
      if (!Number.isFinite(v) || v < 0 || v > 12) {
        setError("Indica um número de horas válido (0–12).");
        return;
      }
    }

    setSaving(true);
    try {
      const db = await getDbRuntime();
      const ref = doc(db, "estagios", estagioId, "presencas", targetDate);
      const payload: Record<string, unknown> = {
        date: targetDate,
        hoursWorked: isPast ? Math.round(Number(hours.replace(",", ".")) * 100) / 100 : 0,
        isHolidayWork: true,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserId,
        updatedByRole: currentUserRole,
      };
      if (!isPast) {
        payload.hoursScheduled = horasDiarias || undefined;
      }
      Object.keys(payload).forEach((k) => {
        if (payload[k] === undefined) delete payload[k];
      });
      await setDoc(ref, payload, { merge: true });

      // Side effects for past saves
      if (isPast) {
        fetch(`/api/estagios/${estagioId}/termino-antecipado/invalidar`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataPresenca: targetDate,
            horasTrabalhadas: Number(hours),
            horasPrevistasNoDia: horasDiarias || 0,
          }),
        }).catch(() => {});

        fetch(`/api/estagios/${estagioId}/recalcular-data-fim`, {
          method: "POST",
        }).catch(() => {});
      }

      onCreated();
      handleClose();
    } catch (err) {
      console.error("[holiday-work] save error", err);
      setError("Não foi possível guardar. Tenta novamente.");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setHours(String(horasDiarias));
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isPast ? "Trabalhaste neste feriado?" : "Vais trabalhar neste feriado?"}
          </DialogTitle>
          <DialogDescription>
            {formatIsoPt(targetDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isPast ? (
            <div className="space-y-2">
              <Label htmlFor="holiday-hours">Número de horas trabalhadas</Label>
              <Input
                id="holiday-hours"
                type="number"
                min={0}
                max={12}
                step={0.25}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="Ex: 8"
                disabled={saving}
              />
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              O dia será marcado como dia de trabalho e ficará disponível na aba
              Horário para registares as horas quando trabalhares.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isPast ? "Guardar" : "Sim, vou trabalhar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
