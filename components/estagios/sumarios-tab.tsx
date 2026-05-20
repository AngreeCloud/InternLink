"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  NotebookPen,
  Pen,
  Save,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  formatIsoPt,
  groupWorkDaysByWeek,
  listWorkDays,
  normalizeDiasSemana,
  sortWeeksSumarios,
  toIsoDate,
  weekdayLabel,
  type WorkWeek,
} from "@/lib/estagios/workdays";
import type { EstagioRole } from "@/lib/estagios/permissions";
import { SumariosExportPanel } from "@/components/estagios/sumarios-export-panel";

type Participant = { name: string; role: EstagioRole; email?: string };

type Props = {
  estagioId: string;
  estagio: Record<string, unknown>;
  currentUserId: string;
  currentUserRole: EstagioRole;
  participants?: Record<string, Participant>;
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
  signedByTutor?: boolean;
  tutorSignedAt?: Timestamp;
  tutorSignedById?: string;
  tutorSignedByName?: string;
  estado?: "por_preencher" | "preenchido" | "arquivado";
  changeRequested?: boolean;
  changeRequestedReason?: string;
};

const MIN_LEN = 10;
const MAX_LEN = 4000;

export function SumariosTab({
  estagioId,
  estagio,
  currentUserId,
  currentUserRole,
  participants,
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
  const [signingWeek, setSigningWeek] = useState<WorkWeek | null>(null);
  const [signingSubmitting, setSigningSubmitting] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const [rejectingWeek, setRejectingWeek] = useState<WorkWeek | null>(null);
  const [rejectingReason, setRejectingReason] = useState("");
  const [rejectingSubmitting, setRejectingSubmitting] = useState(false);
  const [rejectingError, setRejectingError] = useState<string | null>(null);

  const canEdit = currentUserRole === "aluno";
  const isTutor = currentUserRole === "tutor";

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

  // Sorted weeks: uncompleted past first, current, future, completed last
  const sortedWeeks = useMemo(
    () =>
      sortWeeksSumarios(weeks, todayIso, (w) => Boolean(sumarios[w.weekId]?.content)),
    [weeks, todayIso, sumarios]
  );

  // Auto-open first uncompleted past week, or current week on load.
  useEffect(() => {
    if (loading || sortedWeeks.length === 0) return;
    if (Object.keys(openWeeks).length > 0) return;
    const firstUncompleted = sortedWeeks.find(
      (w) => !sumarios[w.weekId]?.content && w.weekEndIso <= todayIso
    );
    const target = firstUncompleted ?? sortedWeeks.find(
      (w) => w.weekStartIso <= todayIso && w.weekEndIso >= todayIso
    ) ?? sortedWeeks[0];
    setOpenWeeks({ [target.weekId]: true });
  }, [loading, sortedWeeks, openWeeks, todayIso, sumarios]);

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

    const persisted = sumarios[week.weekId];
    if (persisted?.estado === "arquivado") {
      setErrors((e) => ({
        ...e,
        [week.weekId]: "Sumário arquivado. Não é possível editar.",
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
        estado: "preenchido",
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

  async function handleTutorSign(week: WorkWeek, tutorName: string) {
    setSigningError(null);
    setSigningSubmitting(true);
    try {
      const db = await getDbRuntime();
      const ref = doc(db, "estagios", estagioId, "sumarios", week.weekId);
      await setDoc(ref, {
        signedByTutor: true,
        tutorSignedAt: serverTimestamp(),
        tutorSignedById: currentUserId,
        tutorSignedByName: tutorName,
        estado: "arquivado",
      }, { merge: true });
      setSigningWeek(null);
    } catch (err) {
      console.error("[v0] tutor sign", err);
      setSigningError("Não foi possível assinar. Tenta novamente.");
    } finally {
      setSigningSubmitting(false);
    }
  }

  function formatTimestamp(ts: Timestamp | undefined): string {
    if (!ts) return "";
    const d = ts.toDate();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const hasAnySumario = Object.values(sumarios).some((s) => Boolean(s.content));

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
          {sortedWeeks.map((week) => {
            const persisted = sumarios[week.weekId];
            const draft = getDraft(week);
            const dirty = isDirty(week);
            const isOpen = openWeeks[week.weekId] ?? false;
            const isSaving = saving === week.weekId;
            const isFuture = week.weekStartIso > todayIso;
            const error = errors[week.weekId];
            const isSavedFlash = savedFlash === week.weekId;
            const isArchived = persisted?.estado === "arquivado";
            const status = isArchived
              ? { label: "Arquivado", variant: "default" as const }
              : persisted?.content
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
                        disabled={!canEdit || isFuture || isArchived}
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
                      {isArchived ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3.5 w-3.5" />
                          Validado pelo tutor — edição bloqueada
                        </span>
                      ) : canEdit && !isFuture ? (
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
                      ) : null}
                    </div>

                    {/* Signature footer */}
                    {isTutor ? (
                      <div className="border-t pt-3">
                        {persisted?.signedByTutor ? (
                          <div className="flex items-center gap-2 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              Sumário validado por si •{" "}
                              {formatTimestamp(persisted.tutorSignedAt)}
                            </span>
                          </div>
                        ) : persisted?.content ? (
                          <div className="flex gap-2 w-full">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => setRejectingWeek(week)}
                            >
                              Solicitar alteração
                            </Button>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="flex-1"
                              onClick={() => setSigningWeek(week)}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Validar sumário
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>Sumário ainda não preenchido pelo formando</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border-t pt-3">
                        {persisted?.signedByTutor ? (
                          <div className="flex items-center gap-2 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              Validado pelo tutor{" "}
                              <span className="font-medium">
                                {persisted.tutorSignedByName}
                              </span>{" "}
                              • {formatTimestamp(persisted.tutorSignedAt)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>Aguarda validação do tutor</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={signingWeek !== null}
        onOpenChange={(open) => {
          if (!open) setSigningWeek(null);
          setSigningError(null);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Validar sumário semanal</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Semana {signingWeek?.weekNumber} • {signingWeek?.weekYear} —{" "}
              {signingWeek ? formatIsoPt(signingWeek.weekStartIso) : ""} a{" "}
              {signingWeek ? formatIsoPt(signingWeek.weekEndIso) : ""}
            </p>
            {(() => {
              const studentId = estagio.alunoId as string | undefined;
              const studentName = studentId ? participants?.[studentId]?.name : undefined;
              return studentName ? (
                <p className="text-muted-foreground">Formando: {studentName}</p>
              ) : null;
            })()}
            <div className="rounded-md border bg-muted/30 px-4 py-3 text-justify text-xs leading-relaxed text-muted-foreground">
              &ldquo;Declaro que tomei conhecimento das atividades descritas pelo formando
              para esta semana de trabalho e confirmo que as mesmas são compatíveis com o
              plano de formação em contexto de trabalho em vigor.&rdquo;
            </div>
            <p className="text-xs text-muted-foreground">
              Esta ação fica registada com a sua identidade e não pode ser revertida.
            </p>
            {signingError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {signingError}
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingSubmitting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={signingSubmitting}
              onClick={(e) => {
                e.preventDefault();
                if (!signingWeek) return;
                const tutorName =
                  participants?.[currentUserId]?.name ?? "Tutor";
                handleTutorSign(signingWeek, tutorName);
              }}
            >
              {signingSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A assinar...
                </>
              ) : (
                "Confirmar validação"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={rejectingWeek !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingWeek(null);
            setRejectingReason("");
            setRejectingError(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Solicitar alteração</AlertDialogTitle>
            <AlertDialogDescription>
              Indique o que precisa ser corrigido ou complementado neste sumário.
              O aluno receberá uma notificação no chat com as suas indicações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <Textarea
              value={rejectingReason}
              onChange={(e) => setRejectingReason(e.target.value)}
              placeholder="Ex: Por favor, detalhe mais as atividades realizadas na terça-feira..."
              disabled={rejectingSubmitting}
              rows={4}
            />
            {rejectingError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {rejectingError}
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejectingSubmitting}>
              Cancelar
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={rejectingSubmitting || !rejectingReason.trim()}
              onClick={async (e) => {
                e.preventDefault();
                if (!rejectingWeek || !rejectingReason.trim()) return;
                setRejectingSubmitting(true);
                setRejectingError(null);
                try {
                  const db = await getDbRuntime();
                  const ref = doc(db, "estagios", estagioId, "sumarios", rejectingWeek.weekId);
                  await setDoc(
                    ref,
                    {
                      changeRequested: true,
                      changeRequestedReason: rejectingReason,
                      updatedAt: serverTimestamp(),
                      updatedBy: currentUserId,
                      updatedByRole: currentUserRole,
                    },
                    { merge: true }
                  );
                  
                  const studentId = estagio.alunoId as string | undefined;
                  if (studentId) {
                    await fetch("/api/chat/system-message", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        userIds: [currentUserId, studentId],
                        text: `O tutor solicitou alterações no sumário da Semana ${rejectingWeek.weekNumber}:\n\n"${rejectingReason}"`,
                      }),
                    });
                  }

                  setRejectingWeek(null);
                  setRejectingReason("");
                } catch (err) {
                  setRejectingError("Erro ao solicitar alteração.");
                } finally {
                  setRejectingSubmitting(false);
                }
              }}
            >
              {rejectingSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A enviar...
                </>
              ) : (
                "Enviar pedido"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {hasAnySumario && (
        <SumariosExportPanel
          estagioId={estagioId}
          currentUserRole={currentUserRole}
          alunoId={estagio.alunoId as string | undefined}
          tutorId={estagio.tutorId as string | undefined}
        />
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
