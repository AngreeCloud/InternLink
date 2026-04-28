"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Loader2,
  NotebookPen,
  Save,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  formatIsoPt,
  groupWorkDaysByWeek,
  listWorkDays,
  normalizeDiasSemana,
  toIsoDate,
  weekdayLabel,
  type WorkWeek,
} from "@/lib/estagios/workdays";
import type { EstagioRole } from "@/lib/estagios/permissions";

type Props = {
  estagioId: string;
  estagio: Record<string, unknown>;
  currentUserId: string;
  currentUserRole: EstagioRole;
};

type SumarioDoc = {
  weekId: string;
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
  weekYear: number;
  content: string;
  updatedAt?: unknown;
  updatedBy?: string;
  updatedByRole?: string;
};

const MIN_LEN = 10;
const MAX_LEN = 4000;

export function SumariosTab({
  estagioId,
  estagio,
  currentUserId,
  currentUserRole,
}: Props) {
  const dataInicio = (estagio.dataInicio as string | undefined) ?? "";
  const dataFim =
    (estagio.dataFimEstimada as string | undefined) ??
    (estagio.dataFim as string | undefined) ??
    "";
  const dias = useMemo(() => normalizeDiasSemana(estagio.diasSemana), [estagio.diasSemana]);

  const workDays = useMemo(
    () => listWorkDays(dataInicio, dataFim, dias),
    [dataInicio, dataFim, dias]
  );
  const weeks = useMemo(() => groupWorkDaysByWeek(workDays), [workDays]);

  const [sumarios, setSumarios] = useState<Record<string, SumarioDoc>>({});
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const canEdit =
    currentUserRole === "aluno" ||
    currentUserRole === "tutor" ||
    currentUserRole === "diretor";

  const todayIso = toIsoDate(new Date());

  // Subscribe to all sumarios.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const db = await getDbRuntime();
      if (cancelled) return;
      const col = collection(db, "estagios", estagioId, "sumarios");
      unsub = onSnapshot(
        col,
        (snap) => {
          const out: Record<string, SumarioDoc> = {};
          snap.forEach((d) => {
            out[d.id] = d.data() as SumarioDoc;
          });
          setSumarios(out);
          setLoading(false);
        },
        (err) => {
          const code = (err as { code?: string }).code;
          if (code !== "permission-denied") {
            console.error("[v0] sumarios snapshot", err);
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

  // Auto-open the most recent past week on load.
  useEffect(() => {
    if (loading || weeks.length === 0) return;
    if (Object.keys(openWeeks).length > 0) return;
    const pastWeeks = weeks.filter((w) => w.weekStartIso <= todayIso);
    const target = pastWeeks.length > 0 ? pastWeeks[pastWeeks.length - 1] : weeks[0];
    setOpenWeeks({ [target.weekId]: true });
  }, [loading, weeks, openWeeks, todayIso]);

  function getDraft(week: WorkWeek): string {
    const persisted = sumarios[week.weekId]?.content ?? "";
    return drafts[week.weekId] ?? persisted;
  }

  function setDraft(weekId: string, value: string) {
    setDrafts((prev) => ({ ...prev, [weekId]: value }));
  }

  function isDirty(week: WorkWeek): boolean {
    if (drafts[week.weekId] === undefined) return false;
    const persisted = sumarios[week.weekId]?.content ?? "";
    return drafts[week.weekId] !== persisted;
  }

  function toggleWeek(weekId: string) {
    setOpenWeeks((prev) => ({ ...prev, [weekId]: !prev[weekId] }));
  }

  async function handleSave(week: WorkWeek) {
    setErrors((e) => {
      const next = { ...e };
      delete next[week.weekId];
      return next;
    });
    setSavedFlash(null);

    const content = getDraft(week).trim();
    if (content.length < MIN_LEN) {
      setErrors((e) => ({
        ...e,
        [week.weekId]: `O sumário deve ter pelo menos ${MIN_LEN} caracteres.`,
      }));
      return;
    }
    if (content.length > MAX_LEN) {
      setErrors((e) => ({
        ...e,
        [week.weekId]: `O sumário não pode exceder ${MAX_LEN} caracteres.`,
      }));
      return;
    }
    if (week.weekStartIso > todayIso) {
      setErrors((e) => ({
        ...e,
        [week.weekId]: "Não é possível escrever sumários para semanas futuras.",
      }));
      return;
    }

    setSaving(week.weekId);
    try {
      const db = await getDbRuntime();
      const ref = doc(db, "estagios", estagioId, "sumarios", week.weekId);
      const payload: SumarioDoc = {
        weekId: week.weekId,
        weekStart: week.weekStartIso,
        weekEnd: week.weekEndIso,
        weekNumber: week.weekNumber,
        weekYear: week.weekYear,
        content,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserId,
        updatedByRole: currentUserRole,
      };
      await setDoc(ref, payload, { merge: true });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[week.weekId];
        return next;
      });
      setSavedFlash(week.weekId);
      setTimeout(() => {
        setSavedFlash((s) => (s === week.weekId ? null : s));
      }, 2000);
    } catch (err) {
      console.error("[v0] save sumario", err);
      setErrors((e) => ({
        ...e,
        [week.weekId]: "Não foi possível guardar. Tenta novamente.",
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
          O estágio ainda não tem datas definidas. Os sumários ficarão disponíveis assim
          que o horário for configurado.
        </CardContent>
      </Card>
    );
  }

  if (weeks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          Não foram encontradas semanas com dias de trabalho.
        </CardContent>
      </Card>
    );
  }

  const totalPreenchidos = weeks.filter((w) => Boolean(sumarios[w.weekId]?.content))
    .length;
  const semanasPassadas = weeks.filter((w) => w.weekStartIso <= todayIso).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <NotebookPen className="h-4 w-4" />
            Sumários semanais
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Stat label="Semanas no estágio" value={String(weeks.length)} />
          <Stat
            label="Semanas decorridas"
            value={`${semanasPassadas}/${weeks.length}`}
          />
          <Stat
            label="Sumários preenchidos"
            value={`${totalPreenchidos}/${weeks.length}`}
          />
        </CardContent>
      </Card>

      {!canEdit && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Estás a ver os sumários em modo de consulta.
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar sumários...
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {weeks.map((week) => {
            const persisted = sumarios[week.weekId];
            const draft = getDraft(week);
            const dirty = isDirty(week);
            const isOpen = openWeeks[week.weekId] ?? false;
            const isSaving = saving === week.weekId;
            const isFuture = week.weekStartIso > todayIso;
            const error = errors[week.weekId];
            const isSavedFlash = savedFlash === week.weekId;
            const status = persisted?.content
              ? { label: "Preenchido", variant: "default" as const }
              : isFuture
                ? { label: "Por vir", variant: "outline" as const }
                : { label: "Por preencher", variant: "secondary" as const };

            const workDaysOfWeek = week.days
              .map((d) => `${weekdayLabel(d.date, true)} ${formatIsoPt(d.iso)}`)
              .join(" • ");

            return (
              <Card key={week.weekId}>
                <button
                  type="button"
                  onClick={() => toggleWeek(week.weekId)}
                  className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition-colors hover:bg-muted/40"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-semibold">
                        Semana {week.weekNumber} • {week.weekYear}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatIsoPt(week.weekStartIso)} – {formatIsoPt(week.weekEndIso)} •{" "}
                        {week.days.length} {week.days.length === 1 ? "dia" : "dias"} de trabalho
                      </p>
                    </div>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </button>

                {isOpen && (
                  <CardContent className="space-y-3 border-t pt-4">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Dias de trabalho: </span>
                      {workDaysOfWeek}
                    </p>

                    <div className="space-y-2">
                      <label
                        htmlFor={`sumario-${week.weekId}`}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Atividades realizadas durante a semana
                      </label>
                      <Textarea
                        id={`sumario-${week.weekId}`}
                        value={draft}
                        onChange={(e) => setDraft(week.weekId, e.target.value)}
                        placeholder="Descreve as atividades, aprendizagens e tarefas realizadas durante a semana..."
                        disabled={!canEdit || isFuture}
                        maxLength={MAX_LEN}
                        rows={6}
                        aria-invalid={Boolean(error)}
                        className="resize-y"
                      />
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {draft.length}/{MAX_LEN} caracteres
                          {draft.length > 0 && draft.length < MIN_LEN && (
                            <span className="ml-2 text-destructive">
                              (mín. {MIN_LEN})
                            </span>
                          )}
                        </span>
                        {persisted?.updatedByRole && (
                          <span>
                            Última edição por{" "}
                            <span className="font-medium text-foreground">
                              {labelForRole(persisted.updatedByRole)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {error && (
                      <p className="text-xs text-destructive">{error}</p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                      {isSavedFlash && !dirty && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Guardado
                        </span>
                      )}
                      {canEdit && !isFuture && (
                        <Button
                          type="button"
                          size="sm"
                          variant={dirty ? "default" : "outline"}
                          disabled={!dirty || isSaving}
                          onClick={() => handleSave(week)}
                        >
                          {isSaving ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="mr-1 h-3.5 w-3.5" />
                          )}
                          Guardar sumário
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function labelForRole(role: string): string {
  switch (role) {
    case "aluno":
      return "Aluno";
    case "tutor":
      return "Tutor";
    case "professor":
      return "Professor";
    case "diretor":
      return "Diretor de Curso";
    default:
      return role;
  }
}
