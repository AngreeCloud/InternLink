"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Save,
  AlertCircle,
} from "lucide-react";
import {
  formatIsoPt,
  groupWorkDaysByWeek,
  listWorkDays,
  normalizeDiasSemana,
  toIsoDate,
  weekdayLabel,
  type WorkDay,
} from "@/lib/estagios/workdays";
import type { EstagioRole } from "@/lib/estagios/permissions";

type Props = {
  estagioId: string;
  estagio: Record<string, unknown>;
  currentUserId: string;
  currentUserRole: EstagioRole;
};

type PresencaDoc = {
  date: string;
  hoursWorked: number;
  hoursScheduled?: number;
  notes?: string;
  updatedAt?: unknown;
  updatedBy?: string;
  updatedByRole?: string;
};

const MAX_HOURS_PER_DAY = 12;
const MIN_HOURS_PER_DAY = 0;

export function HorarioTab({ estagioId, estagio, currentUserId, currentUserRole }: Props) {
  const dataInicio = (estagio.dataInicio as string | undefined) ?? "";
  const dataFim =
    (estagio.dataFimEstimada as string | undefined) ??
    (estagio.dataFim as string | undefined) ??
    "";
  const horasDiarias = Number(estagio.horasDiarias ?? estagio.horasPorDia ?? 0) || 0;
  const totalHoras = Number(estagio.totalHoras ?? 0) || 0;
  const dias = useMemo(() => normalizeDiasSemana(estagio.diasSemana), [estagio.diasSemana]);

  const workDays = useMemo(
    () => listWorkDays(dataInicio, dataFim, dias),
    [dataInicio, dataFim, dias]
  );
  const weeks = useMemo(() => groupWorkDaysByWeek(workDays), [workDays]);

  const [presencas, setPresencas] = useState<Record<string, PresencaDoc>>({});
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { hours: string; notes: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  // Subscribe to all presencas of this estagio.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const db = await getDbRuntime();
      if (cancelled) return;
      const col = collection(db, "estagios", estagioId, "presencas");
      unsub = onSnapshot(
        col,
        (snap) => {
          const out: Record<string, PresencaDoc> = {};
          snap.forEach((d) => {
            const data = d.data() as PresencaDoc;
            out[d.id] = data;
          });
          setPresencas(out);
          setLoading(false);
        },
        (err) => {
          const code = (err as { code?: string }).code;
          if (code !== "permission-denied") {
            console.error("[v0] presencas snapshot", err);
          }
          setLoading(false);
        }
      );
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [estagioId]);

  const canEdit = currentUserRole === "aluno";

  const todayIso = toIsoDate(new Date());

  const totalRealizado = useMemo(() => {
    let sum = 0;
    for (const p of Object.values(presencas)) {
      if (typeof p.hoursWorked === "number") sum += p.hoursWorked;
    }
    return sum;
  }, [presencas]);

  const restante = Math.max(0, totalHoras - totalRealizado);
  const pct = totalHoras > 0 ? Math.round((totalRealizado / totalHoras) * 100) : 0;

  const diasRegistados = Object.values(presencas).filter(
    (p) => typeof p.hoursWorked === "number" && p.hoursWorked > 0
  ).length;

  function getDraft(day: WorkDay) {
    const persisted = presencas[day.iso];
    const draft = drafts[day.iso];
    return {
      hours:
        draft?.hours ??
        (persisted && typeof persisted.hoursWorked === "number"
          ? String(persisted.hoursWorked)
          : ""),
      notes: draft?.notes ?? persisted?.notes ?? "",
    };
  }

  function setDraft(iso: string, patch: Partial<{ hours: string; notes: string }>) {
    setDrafts((prev) => ({
      ...prev,
      [iso]: {
        hours: patch.hours ?? prev[iso]?.hours ?? "",
        notes: patch.notes ?? prev[iso]?.notes ?? "",
      },
    }));
  }

  function validate(day: WorkDay, hoursStr: string): { ok: boolean; value: number; error?: string } {
    if (hoursStr.trim() === "") {
      return { ok: false, value: 0, error: "Indica as horas trabalhadas." };
    }
    const v = Number(hoursStr.replace(",", "."));
    if (!Number.isFinite(v)) {
      return { ok: false, value: 0, error: "Valor inválido." };
    }
    if (v < MIN_HOURS_PER_DAY) {
      return { ok: false, value: v, error: "As horas não podem ser negativas." };
    }
    if (v > MAX_HOURS_PER_DAY) {
      return { ok: false, value: v, error: `Máximo ${MAX_HOURS_PER_DAY}h por dia.` };
    }
    if (day.iso > todayIso) {
      return { ok: false, value: v, error: "Data futura — só podes registar dias passados." };
    }
    return { ok: true, value: Math.round(v * 100) / 100 };
  }

  async function handleSave(day: WorkDay) {
    setErrors((e) => {
      const next = { ...e };
      delete next[day.iso];
      return next;
    });
    setSavedFlash(null);

    const { hours, notes } = getDraft(day);
    const v = validate(day, hours);
    if (!v.ok) {
      setErrors((e) => ({ ...e, [day.iso]: v.error || "Erro de validação" }));
      return;
    }
    if (notes.length > 500) {
      setErrors((e) => ({ ...e, [day.iso]: "Notas demasiado longas (máx. 500 caracteres)." }));
      return;
    }

    setSaving(day.iso);
    try {
      const db = await getDbRuntime();
      const ref = doc(db, "estagios", estagioId, "presencas", day.iso);
      const payload: PresencaDoc = {
        date: day.iso,
        hoursWorked: v.value,
        hoursScheduled: horasDiarias || undefined,
        notes: notes.trim() || undefined,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserId,
        updatedByRole: currentUserRole,
      };
      // Strip undefined.
      Object.keys(payload).forEach((k) => {
        const key = k as keyof PresencaDoc;
        if (payload[key] === undefined) delete payload[key];
      });
      await setDoc(ref, payload, { merge: true });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[day.iso];
        return next;
      });
      setSavedFlash(day.iso);
      setTimeout(() => {
        setSavedFlash((s) => (s === day.iso ? null : s));
      }, 2000);
    } catch (err) {
      console.error("[v0] save presenca", err);
      setErrors((e) => ({
        ...e,
        [day.iso]: "Não foi possível guardar. Tenta novamente.",
      }));
    } finally {
      setSaving(null);
    }
  }

  if (!dataInicio || !dataFim) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          O estágio ainda não tem datas definidas. Pede ao Diretor de Curso para configurar
          o horário antes de registares presenças.
        </CardContent>
      </Card>
    );
  }

  if (workDays.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          Não foram encontrados dias de trabalho. Confirma os dias da semana definidos no
          estágio.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Resumo do horário
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <Stat label="Dias previstos" value={String(workDays.length)} />
          <Stat
            label="Dias registados"
            value={`${diasRegistados}/${workDays.length}`}
          />
          <Stat
            label="Horas realizadas"
            value={`${formatHours(totalRealizado)}h`}
            sub={totalHoras > 0 ? `de ${totalHoras}h` : undefined}
          />
          <Stat
            label="Restantes"
            value={totalHoras > 0 ? `${formatHours(restante)}h` : "—"}
            sub={totalHoras > 0 ? `${pct}% concluído` : undefined}
          />
          {totalHoras > 0 && (
            <div className="sm:col-span-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!canEdit && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Estás a ver o horário em modo de consulta. Apenas o aluno do estágio pode
          registar as horas trabalhadas.
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar registos...
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {weeks.map((week) => {
            const weekHoras = week.days.reduce((sum, d) => {
              const p = presencas[d.iso];
              return sum + (typeof p?.hoursWorked === "number" ? p.hoursWorked : 0);
            }, 0);
            const weekDoneCount = week.days.filter(
              (d) => typeof presencas[d.iso]?.hoursWorked === "number"
            ).length;

            return (
              <Card key={week.weekId}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm">
                        Semana {week.weekNumber} • {week.weekYear}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {formatIsoPt(week.weekStartIso)} – {formatIsoPt(week.weekEndIso)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">
                        {weekDoneCount}/{week.days.length} dias
                      </Badge>
                      <Badge variant="secondary">{formatHours(weekHoras)}h</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {week.days.map((day) => {
                    const draft = getDraft(day);
                    const persisted = presencas[day.iso];
                    const isFuture = day.iso > todayIso;
                    const error = errors[day.iso];
                    const isSaving = saving === day.iso;
                    const isSavedFlash = savedFlash === day.iso;
                    const dirty =
                      drafts[day.iso] !== undefined &&
                      (draft.hours !==
                        (persisted && typeof persisted.hoursWorked === "number"
                          ? String(persisted.hoursWorked)
                          : "") ||
                        draft.notes !== (persisted?.notes ?? ""));

                    return (
                      <div
                        key={day.iso}
                        className="grid grid-cols-1 gap-2 rounded-md border bg-card px-3 py-3 sm:grid-cols-[180px_1fr_1fr_auto] sm:items-center"
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {weekdayLabel(day.date, true)}, {formatIsoPt(day.iso)}
                            </p>
                            {isFuture ? (
                              <p className="text-[11px] text-muted-foreground">Dia futuro</p>
                            ) : horasDiarias > 0 ? (
                              <p className="text-[11px] text-muted-foreground">
                                Previstas: {horasDiarias}h
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="sr-only" htmlFor={`hours-${day.iso}`}>
                            Horas trabalhadas
                          </label>
                          <Input
                            id={`hours-${day.iso}`}
                            type="number"
                            inputMode="decimal"
                            min={MIN_HOURS_PER_DAY}
                            max={MAX_HOURS_PER_DAY}
                            step={0.25}
                            placeholder="Horas"
                            disabled={!canEdit || isFuture}
                            value={draft.hours}
                            aria-invalid={Boolean(error)}
                            onChange={(e) =>
                              setDraft(day.iso, { hours: e.target.value })
                            }
                            className="h-9 max-w-[130px]"
                          />
                          <span className="text-xs text-muted-foreground">h</span>
                        </div>

                        <Input
                          type="text"
                          placeholder="Nota (opcional)"
                          maxLength={500}
                          disabled={!canEdit || isFuture}
                          value={draft.notes}
                          onChange={(e) => setDraft(day.iso, { notes: e.target.value })}
                          className="h-9"
                        />

                        <div className="flex items-center justify-end gap-2">
                          {isSavedFlash && !dirty ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Guardado
                            </span>
                          ) : persisted && !dirty ? (
                            <Badge variant="outline" className="text-[10px]">
                              Registado
                            </Badge>
                          ) : null}
                          {canEdit && !isFuture && (
                            <Button
                              type="button"
                              size="sm"
                              variant={dirty ? "default" : "outline"}
                              disabled={!dirty || isSaving}
                              onClick={() => handleSave(day)}
                            >
                              {isSaving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                              <span className="ml-1">Guardar</span>
                            </Button>
                          )}
                        </div>

                        {error && (
                          <p className="col-span-full text-xs text-destructive">{error}</p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function formatHours(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return (Math.round(n * 100) / 100).toString();
}
