"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertCircle,
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  StickyNote,
  Send,
} from "lucide-react";
import {
  formatIsoPt,
  groupWorkDaysByWeek,
  listWorkDays,
  normalizeDiasSemana,
  toIsoDate,
  weekdayLabel,
  type WorkDay,
  type WorkWeek,
} from "@/lib/estagios/workdays";
import {
  canRequestEarlyTermination,
  labelForStatus,
  variantForStatus,
  type ScheduleChangeRequest,
  type ScheduleChangeRequestType,
} from "@/lib/estagios/schedule-change-requests";
import type { EstagioRole } from "@/lib/estagios/permissions";
import { ScheduleChangeRequestModal } from "./schedule-change-request-modal";
import { ScheduleChangeRequestThread } from "./schedule-change-request-thread";

type Props = {
  estagioId: string;
  estagio: Record<string, unknown>;
  currentUserId: string;
  currentUserRole: EstagioRole;
  focusRequestId?: string;
};

type PresencaDoc = {
  date: string;
  hoursWorked: number;
  notes?: string;
};

type ViewMode = "month" | "week";

export function CalendarioTab({
  estagioId,
  estagio,
  currentUserId,
  currentUserRole,
  focusRequestId,
}: Props) {
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

  const workDaySet = useMemo(
    () => new Set(workDays.map((d: WorkDay) => d.iso)),
    [workDays]
  );

  const weeks = useMemo(() => groupWorkDaysByWeek(workDays), [workDays]);

  // Subscriptions
  const [presencas, setPresencas] = useState<Record<string, PresencaDoc>>({});
  const [requests, setRequests] = useState<ScheduleChangeRequest[]>([]);
  const [loadingPresencas, setLoadingPresencas] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const db = await getDbRuntime();
      if (cancelled) return;
      unsub = onSnapshot(
        collection(db, "estagios", estagioId, "presencas"),
        (snap) => {
          const out: Record<string, PresencaDoc> = {};
          snap.forEach((d) => {
            out[d.id] = d.data() as PresencaDoc;
          });
          setPresencas(out);
          setLoadingPresencas(false);
        },
        (err) => {
          if ((err as { code?: string }).code !== "permission-denied") {
            console.error("[v0] calendario presencas snapshot", err);
          }
          setLoadingPresencas(false);
        }
      );
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [estagioId]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const db = await getDbRuntime();
      if (cancelled) return;
      unsub = onSnapshot(
        collection(db, "estagios", estagioId, "schedule_change_requests"),
        (snap) => {
          const out: ScheduleChangeRequest[] = [];
          snap.forEach((d) => {
            out.push({ id: d.id, ...d.data() } as ScheduleChangeRequest);
          });
          out.sort((a, b) => {
            const at = (a.createdAt as { seconds?: number })?.seconds ?? 0;
            const bt = (b.createdAt as { seconds?: number })?.seconds ?? 0;
            return bt - at;
          });
          setRequests(out);
          setLoadingRequests(false);
        },
        (err) => {
          if ((err as { code?: string }).code !== "permission-denied") {
            console.error("[v0] calendario requests snapshot", err);
          }
          setLoadingRequests(false);
        }
      );
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [estagioId]);

  const todayIso = toIsoDate(new Date());

  // Calendar starts at current month
  const [month, setMonth] = useState<Date>(() => new Date());

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  // Week index
  const todayWeekIdx = useMemo(() => {
    const idx = weeks.findIndex(
      (w) => w.weekStartIso <= todayIso && w.weekEndIso >= todayIso
    );
    return idx >= 0 ? idx : 0;
  }, [weeks, todayIso]);

  const [currentWeekIdx, setCurrentWeekIdx] = useState<number>(0);

  useEffect(() => {
    setCurrentWeekIdx(todayWeekIdx);
  }, [todayWeekIdx]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string>("");
  const [modalDefaultType, setModalDefaultType] = useState<ScheduleChangeRequestType | undefined>();
  const [earlyTerminationLoading, setEarlyTerminationLoading] = useState(false);
  const [earlyTerminationError, setEarlyTerminationError] = useState<string | null>(null);

  const presencaSet = useMemo(
    () =>
      new Set(
        Object.values(presencas)
          .filter((p) => p.hoursWorked > 0)
          .map((p) => p.date)
      ),
    [presencas]
  );

  const requestsByDate = useMemo(() => {
    const map = new Map<string, ScheduleChangeRequest>();
    for (const r of requests) {
      const existing = map.get(r.targetDate);
      if (!existing || ["approved", "pending_tutor", "pending_professor"].includes(r.status)) {
        map.set(r.targetDate, r);
      }
    }
    return map;
  }, [requests]);

  const requestDateSet = useMemo(() => new Set(requestsByDate.keys()), [requestsByDate]);

  // Missing hours days (past workdays without registered hours or below expected)
  const missingHoursSet = useMemo(() => {
    const set = new Set<string>();
    for (const d of workDays) {
      if (d.iso >= todayIso) continue;
      const p = presencas[d.iso];
      const hours = typeof p?.hoursWorked === "number" ? p.hoursWorked : 0;
      if (hours < horasDiarias && !requestsByDate.has(d.iso)) {
        set.add(d.iso);
      }
    }
    return set;
  }, [workDays, todayIso, presencas, horasDiarias, requestsByDate]);

  // Remaining hours
  const totalRealizado = useMemo(() => {
    return Object.values(presencas).reduce(
      (sum, p) => sum + (typeof p.hoursWorked === "number" ? p.hoursWorked : 0),
      0
    );
  }, [presencas]);
  const horasRestantes = Math.max(0, totalHoras - totalRealizado);
  const eligibleForEarlyTermination = canRequestEarlyTermination(horasRestantes, horasDiarias);

  const isAluno = currentUserRole === "aluno";

  function hasMissingHours(iso: string): boolean {
    if (iso > todayIso) return false;
    const p = presencas[iso];
    const hours = typeof p?.hoursWorked === "number" ? p.hoursWorked : 0;
    return hours < horasDiarias;
  }

  const refreshRef = useRef(0);
  const handleUpdated = useCallback(() => {
    refreshRef.current += 1;
  }, []);

  function handleDayClick(date: Date) {
    if (!isAluno) return;
    const iso = toIsoDate(date);
    if (!workDaySet.has(iso)) return;

    const req = requestsByDate.get(iso);
    if (
      req &&
      (req.status === "pending_professor" ||
        req.status === "pending_tutor" ||
        req.status === "approved")
    ) {
      return;
    }

    // Past/today: only allow if hours < expected
    if (iso <= todayIso && !hasMissingHours(iso)) return;

    setModalDate(iso);
    setModalDefaultType(undefined);
    setModalOpen(true);
  }

  async function handleEarlyTerminationClick() {
    setEarlyTerminationLoading(true);
    setEarlyTerminationError(null);
    try {
      const db = await getDbRuntime();
      const sumariosSnap = await getDocs(query(collection(db, "estagios", estagioId, "sumarios")));
      const allSubmitted = sumariosSnap.docs.every((d) => {
        const s = d.data();
        return s.estado === "preenchido" || s.estado === "arquivado";
      });

      if (!allSubmitted) {
        const pending = sumariosSnap.docs.filter(
          (d) => d.data().estado !== "preenchido" && d.data().estado !== "arquivado"
        ).length;
        setEarlyTerminationError(
          `Ainda tens ${pending} sumário(s) por preencher. Submete todos os sumários antes de solicitar o término antecipado.`
        );
        return;
      }

      // Find next future workday
      const nextFuture = workDays.find((d: WorkDay) => d.iso > todayIso);
      if (!nextFuture) {
        setEarlyTerminationError("Não foi encontrado um dia futuro para associar ao pedido.");
        return;
      }

      setModalDate(nextFuture.iso);
      setModalDefaultType("early_termination");
      setModalOpen(true);
    } catch (err) {
      console.error("Erro ao verificar sumários:", err);
      setEarlyTerminationError("Erro ao verificar sumários. Tenta novamente.");
    } finally {
      setEarlyTerminationLoading(false);
    }
  }

  function handleWeekPrev() {
    setCurrentWeekIdx((prev) => Math.max(0, prev - 1));
  }

  function handleWeekNext() {
    setCurrentWeekIdx((prev) => Math.min(weeks.length - 1, prev + 1));
  }

  const loading = loadingPresencas || loadingRequests;

  if (!dataInicio || !dataFim) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          O estágio ainda não tem datas definidas.
        </CardContent>
      </Card>
    );
  }

  if (workDays.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          Não foram encontrados dias de trabalho. Confirma os dias da semana no estágio.
        </CardContent>
      </Card>
    );
  }

  // Build modifiers for DayPicker
  const isoToDate = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const workedDates = [...presencaSet].map((iso) => {
    if (requestDateSet.has(iso)) return null;
    return isoToDate(iso);
  }).filter(Boolean) as Date[];
  const scheduledDates = [...workDaySet]
    .filter((iso) => !presencaSet.has(iso) && !missingHoursSet.has(iso) && !requestDateSet.has(iso))
    .map((iso) => {
      return isoToDate(iso);
    });
  const missingDates = [...missingHoursSet].map((iso) => {
    return isoToDate(iso);
  });
  const requestTypeDates = (() => {
    const justification: Date[] = [];
    const futureAbsence: Date[] = [];
    const earlyTermination: Date[] = [];
    for (const [iso, req] of requestsByDate.entries()) {
      const date = isoToDate(iso);
      if (req.type === "past_absence_justification") {
        justification.push(date);
      } else if (req.type === "future_absence") {
        futureAbsence.push(date);
      } else if (req.type === "early_termination") {
        earlyTermination.push(date);
      }
    }
    return { justification, futureAbsence, earlyTermination };
  })();
  const pendingDates = [...requestsByDate.entries()]
    .filter(([, r]) => r.status === "pending_professor" || r.status === "pending_tutor")
    .map(([iso]) => {
      return isoToDate(iso);
    });
  const approvedReqDates = [...requestsByDate.entries()]
    .filter(([, r]) => r.status === "approved" || r.status === "acknowledged")
    .map(([iso]) => {
      return isoToDate(iso);
    });
  const rejectedReqDates = [...requestsByDate.entries()]
    .filter(([, r]) => r.status === "rejected")
    .map(([iso]) => {
      return isoToDate(iso);
    });

  const startDate = (() => {
    const [y, m, d] = dataInicio.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();
  const endDate = (() => {
    const [y, m, d] = dataFim.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();

  const currentWeek: WorkWeek | undefined = weeks[currentWeekIdx];

  return (
    <div className="space-y-6">
      {/* Legend + summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarSearch className="h-4 w-4" />
            Calendário do estágio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Legend */}
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-3">
              <LegendItem color="bg-emerald-500" label="Dia trabalhado" />
              <LegendItem color="bg-primary/20 border border-primary" label="Dia previsto" />
              <LegendItem color="bg-amber-100 border-2 border-amber-400" label="Horas em falta" />
            </div>
            <div className="flex flex-wrap gap-3">
              <LegendItem color="bg-sky-100 border border-sky-400" label="Justificação de falta" />
              <LegendItem color="bg-orange-100 border border-orange-400" label="Falta futura" />
              <LegendItem color="bg-teal-100 border border-teal-400" label="Término antecipado" />
              <LegendItem color="bg-card ring-2 ring-amber-500" label="Pendente" />
              <LegendItem color="bg-card ring-2 ring-emerald-500" label="Aprovado/justificado" />
              <LegendItem color="bg-card ring-2 ring-red-500" label="Rejeitado" />
            </div>
          </div>

          {isAluno && eligibleForEarlyTermination && (
            <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 dark:border-teal-800 dark:bg-teal-950">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-teal-800 dark:text-teal-200">
                    Tens horas restantes inferiores a um dia de trabalho
                  </p>
                  <p className="text-xs text-teal-600 dark:text-teal-400">
                    Podes solicitar o término antecipado do estágio.
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={handleEarlyTerminationClick}
                  disabled={earlyTerminationLoading}
                >
                  {earlyTerminationLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Solicitar término antecipado
                </Button>
              </div>
              {earlyTerminationError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {earlyTerminationError}
                </p>
              )}
            </div>
          )}

          {isAluno && (
            <p className="text-xs text-muted-foreground">
              Dias passados com horas abaixo do previsto: clica para justificar a falta.
              Dias futuros: clica para solicitar alteração de horário.
            </p>
          )}
        </CardContent>
      </Card>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === "month" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("month")}
        >
          Mês
        </Button>
        <Button
          variant={viewMode === "week" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("week")}
        >
          Semana
        </Button>
      </div>

      {/* Calendar views */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar calendário...
          </CardContent>
        </Card>
      ) : viewMode === "month" ? (
        <Card>
          <CardContent className="pt-4">
            <style>{`
              .rdp-day--worked .rdp-day_button { background-color: rgb(16 185 129); color: white; border-radius: 9999px; }
              .rdp-day--scheduled .rdp-day_button { background-color: hsl(var(--primary) / 0.12); border: 1px solid hsl(var(--primary) / 0.5); border-radius: 9999px; }
              .rdp-day--missing .rdp-day_button { background-color: rgb(254 243 199); border: 2px solid rgb(251 191 36); border-radius: 9999px; color: rgb(146 64 14); }
              .rdp-day--req-justification .rdp-day_button { background-color: rgb(224 242 254); color: rgb(30 64 175); border-radius: 9999px; }
              .rdp-day--req-future .rdp-day_button { background-color: rgb(255 237 213); color: rgb(154 52 18); border-radius: 9999px; }
              .rdp-day--req-termination .rdp-day_button { background-color: rgb(204 251 241); color: rgb(15 118 110); border-radius: 9999px; }
              .rdp-day--status-pending .rdp-day_button { box-shadow: 0 0 0 2px rgb(245 158 11); }
              .rdp-day--status-approved .rdp-day_button { box-shadow: 0 0 0 2px rgb(16 185 129); }
              .rdp-day--status-rejected .rdp-day_button { box-shadow: 0 0 0 2px rgb(239 68 68); }
              .rdp-day--can-click .rdp-day_button:hover { cursor: pointer; opacity: 0.8; }
            `}</style>
            <DayPicker
              mode="single"
              month={month}
              onMonthChange={setMonth}
              startMonth={startDate}
              endMonth={endDate}
              modifiers={{
                worked: workedDates,
                scheduled: scheduledDates,
                missing: missingDates,
                requestJustification: requestTypeDates.justification,
                requestFutureAbsence: requestTypeDates.futureAbsence,
                requestEarlyTermination: requestTypeDates.earlyTermination,
                statusPending: pendingDates,
                statusApproved: approvedReqDates,
                statusRejected: rejectedReqDates,
              }}
              modifiersClassNames={{
                worked: "rdp-day--worked",
                scheduled: "rdp-day--scheduled",
                missing: "rdp-day--missing",
                requestJustification: "rdp-day--req-justification",
                requestFutureAbsence: "rdp-day--req-future",
                requestEarlyTermination: "rdp-day--req-termination",
                statusPending: "rdp-day--status-pending",
                statusApproved: "rdp-day--status-approved",
                statusRejected: "rdp-day--status-rejected",
              }}
              onDayClick={isAluno ? handleDayClick : undefined}
              className="mx-auto w-fit"
              showOutsideDays={false}
            />
          </CardContent>
        </Card>
      ) : currentWeek ? (
        <div className="space-y-4">
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleWeekPrev}
              disabled={currentWeekIdx <= 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Semana anterior
            </Button>
            <div className="text-center">
              <p className="text-sm font-semibold">
                Semana {currentWeek.weekNumber} &bull; {currentWeek.weekYear}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatIsoPt(currentWeek.weekStartIso)} – {formatIsoPt(currentWeek.weekEndIso)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleWeekNext}
              disabled={currentWeekIdx >= weeks.length - 1}
            >
              Semana seguinte
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {/* Week days */}
          <div className="space-y-2">
            {currentWeek.days.map((day) => {
              const presenca = presencas[day.iso];
              const hours = typeof presenca?.hoursWorked === "number" ? presenca.hoursWorked : 0;
              const notes = presenca?.notes ?? "";
              const isPast = day.iso <= todayIso;
              const isMissing = missingHoursSet.has(day.iso);
              const req = requestsByDate.get(day.iso);
              const hasNoHours = !isPast ? false : hours <= 0 && !req;

              return (
                <Card
                  key={day.iso}
                  className={`transition-colors ${hasNoHours ? "border-amber-400 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/30" : ""} ${req ? "border-l-4" : ""} ${
                    req?.status === "approved" || req?.status === "acknowledged"
                      ? "border-l-emerald-500"
                      : req?.status === "rejected"
                        ? "border-l-red-400"
                        : req
                          ? "border-l-amber-400"
                          : ""
                  } ${isAluno ? "cursor-pointer hover:bg-muted/40" : ""}`}
                  onClick={() => {
                    if (!isAluno) return;
                    if (req && ["pending_professor", "pending_tutor", "approved"].includes(req.status)) return;
                    if (day.iso <= todayIso && !hasMissingHours(day.iso)) return;
                    setModalDate(day.iso);
                    setModalOpen(true);
                  }}
                >
                  <CardContent className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {weekdayLabel(day.date, true)}, {formatIsoPt(day.iso)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {hours > 0
                              ? `${hours}h registadas`
                              : isPast
                                ? "Sem horas registadas"
                                : `${horasDiarias}h previstas`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isMissing && !req && (
                        <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Horas em falta
                        </Badge>
                      )}
                      {req && (
                        <Badge variant={variantForStatus(req.status)}>
                          {labelForStatus(req.status, req.type)}
                        </Badge>
                      )}
                      {hours > 0 && !req && (
                        <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500">
                          Trabalhado
                        </Badge>
                      )}
                    </div>

                    {notes && (
                      <ExpandableNotes notes={notes} />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* No workdays this week */}
          {currentWeek.days.length === 0 && (
            <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum dia de trabalho esta semana.
            </div>
          )}
        </div>
      ) : null}

      {/* Requests list */}
      {requests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Pedidos de alteração{" "}
              <span className="font-normal text-muted-foreground">
                ({requests.length})
              </span>
            </h3>
            <div className="flex gap-2 text-xs text-muted-foreground">
              {requests.filter((r) => r.status === "pending_professor" || r.status === "pending_tutor").length > 0 && (
                <Badge variant="secondary">
                  {requests.filter((r) => r.status === "pending_professor" || r.status === "pending_tutor").length} pendente{requests.filter((r) => r.status === "pending_professor" || r.status === "pending_tutor").length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>
          {requests.map((req) => (
            <ScheduleChangeRequestThread
              key={req.id}
              request={req}
              estagioId={estagioId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onUpdated={handleUpdated}
              initialOpen={Boolean(focusRequestId && req.id === focusRequestId)}
            />
          ))}
        </div>
      )}

      {requests.length === 0 && !loading && isAluno && (
        <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum pedido submetido. Clica num dia com horas em falta (passado) ou
          num dia futuro para justificar ou alterar o horário.
        </div>
      )}

      {/* Modal */}
      <ScheduleChangeRequestModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalDefaultType(undefined);
          setEarlyTerminationError(null);
        }}
        estagioId={estagioId}
        targetDate={modalDate}
        canRequestEarlyTermination={eligibleForEarlyTermination}
        onCreated={handleUpdated}
        defaultType={modalDefaultType}
      />
    </div>
  );
}

function ExpandableNotes({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = notes.length > 80;
  const display = expanded || !isLong ? notes : notes.slice(0, 80) + "...";

  return (
    <div className="mt-1 w-full">
      <div className="flex items-start gap-1 text-xs text-muted-foreground">
        <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
        <span className="whitespace-pre-wrap">{display}</span>
        {isLong && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="ml-1 shrink-0 text-primary hover:underline"
          >
            {expanded ? "ver menos" : "ver mais"}
          </button>
        )}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

