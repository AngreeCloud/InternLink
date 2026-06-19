"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
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
  labelForStatus,
  variantForStatus,
  type ScheduleChangeRequest,
  type ScheduleChangeRequestType,
} from "@/lib/estagios/schedule-change-requests";
import {
  checkEligibility,
  type TerminoAntecipado,
  type EligibilityResult,
} from "@/lib/estagios/termino-antecipado";
import type { EstagioRole } from "@/lib/estagios/permissions";
import {
  calcularDataFimEstimada,
  type DiasSemana,
} from "@/lib/estagios/date-calc";
import { calcTooltipDayInfo } from "@/lib/estagios/calendar-tooltip";
import { getPortugueseHolidaysMap } from "@/lib/estagios/pt-holidays";
import { ScheduleChangeRequestModal } from "./schedule-change-request-modal";
import { ScheduleChangeRequestThread } from "./schedule-change-request-thread";
import { ComunicadoCard } from "./comunicado-card";
import { TerminoAntecipadoConfirmationModal } from "./termino-antecipado-confirmation-modal";
import { HolidayWorkDialog } from "./holiday-work-dialog";

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
  isHolidayWork?: boolean;
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
  const rawDiasSemana = (estagio.diasSemana as Record<string, boolean> | undefined) ?? {};

  const originalEnd = useMemo(() => {
    if (!dataInicio || totalHoras <= 0 || horasDiarias <= 0) return "";
    const ds: DiasSemana = {
      seg: rawDiasSemana.seg ?? false,
      ter: rawDiasSemana.ter ?? false,
      qua: rawDiasSemana.qua ?? false,
      qui: rawDiasSemana.qui ?? false,
      sex: rawDiasSemana.sex ?? false,
      sab: rawDiasSemana.sab ?? false,
      dom: rawDiasSemana.dom ?? false,
    };
    return calcularDataFimEstimada({
      dataInicio,
      totalHoras,
      horasDiarias,
      diasSemana: ds,
    }).dataFimEstimada;
  }, [dataInicio, totalHoras, horasDiarias, rawDiasSemana]);

  const effectiveDataFim =
    originalEnd && originalEnd > dataFim ? originalEnd : dataFim;

  const workDays = useMemo(
    () => listWorkDays(dataInicio, effectiveDataFim, dias),
    [dataInicio, effectiveDataFim, dias]
  );

  const workDaySet = useMemo(
    () => new Set(workDays.map((d: WorkDay) => d.iso)),
    [workDays]
  );

  const weeks = useMemo(() => groupWorkDaysByWeek(workDays), [workDays]);

  const isoToDate = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const holidayMap = useMemo(() => {
    if (!dataInicio || !effectiveDataFim) return new Map<string, string>();
    const startYear = Number(dataInicio.split("-")[0]);
    const endYear = Number(effectiveDataFim.split("-")[0]);
    return getPortugueseHolidaysMap(startYear, endYear);
  }, [dataInicio, effectiveDataFim]);

  const holidaySet = useMemo(() => new Set(holidayMap.keys()), [holidayMap]);

  const holidayDates = useMemo(
    () => [...holidaySet].map((iso) => isoToDate(iso)),
    [holidaySet]
  );

  // Tooltip state
  const [tooltipDay, setTooltipDay] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const dayPickerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredIsoRef = useRef<string | null>(null);

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

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const db = await getDbRuntime();
      if (cancelled) return;
      unsub = onSnapshot(
        collection(db, "estagios", estagioId, "termino_antecipado"),
        (snap) => {
          const docs: TerminoAntecipado[] = [];
          snap.forEach((d) => {
            docs.push({ id: d.id, ...d.data() } as TerminoAntecipado);
          });
          docs.sort((a, b) => {
            const at = (a.submittedAt as { seconds?: number })?.seconds ?? 0;
            const bt = (b.submittedAt as { seconds?: number })?.seconds ?? 0;
            return bt - at;
          });
          setTerminoAntecipado(docs[0] || null);
          setLoadingTermino(false);
        },
        (err) => {
          if ((err as { code?: string }).code !== "permission-denied") {
            console.error("[v0] termino_antecipado snapshot", err);
          }
          setLoadingTermino(false);
        }
      );
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [estagioId]);

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

  // TerminoAntecipado state
  const [terminoAntecipado, setTerminoAntecipado] = useState<TerminoAntecipado | null>(null);
  const [loadingTermino, setLoadingTermino] = useState(true);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);

  // Holiday work dialog
  const [holidayWorkDialogOpen, setHolidayWorkDialogOpen] = useState(false);
  const [holidayWorkDate, setHolidayWorkDate] = useState<string>("");

  const holidayWorkSet = useMemo(
    () => new Set(Object.values(presencas).filter((p) => p.isHolidayWork).map((p) => p.date)),
    [presencas]
  );

  const holidayDatesFiltered = useMemo(
    () => holidayDates.filter((d) => !holidayWorkSet.has(toIsoDate(d))),
    [holidayDates, holidayWorkSet]
  );

  const presencaSet = useMemo(
    () =>
      new Set(
        Object.values(presencas)
          .filter((p) => p.hoursWorked > 0)
          .map((p) => p.date)
      ),
    [presencas]
  );

  // Tutor não vê pedidos "Aguarda professor".
  const visibleRequests = useMemo(() => {
    if (currentUserRole === "tutor") {
      return requests.filter((r) => r.status !== "pending_professor");
    }
    return requests;
  }, [requests, currentUserRole]);

  const comunicados = useMemo(
    () => visibleRequests.filter((r) => r.type === "company_closure" && r.status === "approved"),
    [visibleRequests]
  );

  const regularRequests = useMemo(
    () => visibleRequests.filter((r) => r.type !== "company_closure"),
    [visibleRequests]
  );

  const requestsByDate = useMemo(() => {
    const map = new Map<string, ScheduleChangeRequest>();
    for (const r of visibleRequests) {
      const existing = map.get(r.targetDate);
      if (!existing || ["approved", "pending_tutor", "pending_professor", "expired"].includes(r.status)) {
        map.set(r.targetDate, r);
      }
    }
    return map;
  }, [visibleRequests]);

  const requestDateSet = useMemo(() => new Set(requestsByDate.keys()), [requestsByDate]);

  function effectiveHoursForDay(iso: string): number {
    const req = requestsByDate.get(iso);
    if (!req) return horasDiarias;
    const activeStatuses = ["pending_professor", "pending_tutor", "approved", "acknowledged", "expired"];
    if (!activeStatuses.includes(req.status)) return horasDiarias;
    if (req.absenceType === "total") return 0;
    if (req.absenceType === "partial" && typeof req.hoursAffected === "number") {
      return Math.max(0, horasDiarias - req.hoursAffected);
    }
    // Fallback for requests missing absenceType: infer from hoursAffected
    if (typeof req.hoursAffected === "number" && req.hoursAffected > 0) {
      return Math.max(0, horasDiarias - req.hoursAffected);
    }
    return 0;
  }

  const pendingRequestsMap = useMemo(() => {
    const map = new Map<string, ScheduleChangeRequest>();
    for (const r of visibleRequests) {
      if (r.status === "pending_professor" || r.status === "pending_tutor") {
        map.set(r.targetDate, r);
      }
    }
    return map;
  }, [visibleRequests]);

  function previewIfApproved(iso: string): number | null {
    const req = pendingRequestsMap.get(iso);
    if (!req) return null;
    if (req.absenceType === "total") return 0;
    if (req.absenceType === "partial" && typeof req.hoursAffected === "number") {
      return Math.max(0, horasDiarias - req.hoursAffected);
    }
    return horasDiarias;
  }

  // Days with hours within/above tolerance (green fill)
  const workedOkSet = useMemo(() => {
    const set = new Set<string>();
    for (const d of workDays) {
      if (holidaySet.has(d.iso)) continue;
      const p = presencas[d.iso];
      const hours = typeof p?.hoursWorked === "number" ? p.hoursWorked : 0;
      if (hours <= 0) continue;
      const expected = effectiveHoursForDay(d.iso);
      if (hours >= expected - 1) {
        set.add(d.iso);
      }
    }
    return set;
  }, [workDays, presencas, requestsByDate, horasDiarias, holidaySet]);

  // Past days below tolerance (yellow fill)
  const missingSet = useMemo(() => {
    const set = new Set<string>();
    for (const d of workDays) {
      if (d.iso >= todayIso) continue;
      if (holidaySet.has(d.iso)) continue;
      const p = presencas[d.iso];
      const hours = typeof p?.hoursWorked === "number" ? p.hoursWorked : 0;
      const expected = effectiveHoursForDay(d.iso);
      if (hours < expected - 1) {
        set.add(d.iso);
      }
    }
    return set;
  }, [workDays, todayIso, presencas, requestsByDate, horasDiarias, holidaySet]);

  // Remaining hours
  const totalRealizado = useMemo(() => {
    return Object.values(presencas).reduce(
      (sum, p) => sum + (typeof p.hoursWorked === "number" ? p.hoursWorked : 0),
      0
    );
  }, [presencas]);
  const horasRestantes = Math.max(0, totalHoras - totalRealizado);

  // Tooltip data
  const tooltipData = useMemo(() => {
    if (!tooltipDay) return null;
    const { hasRegistered, acumuladas, registadasDia, previstasDia } = calcTooltipDayInfo(
      tooltipDay,
      workDays,
      presencas,
      presencaSet,
      requestsByDate,
      horasDiarias,
    );
    const isHoliday = holidaySet.has(tooltipDay) && !holidayWorkSet.has(tooltipDay);
    const holidayName = holidayMap.get(tooltipDay) ?? "";
    const pendingPrev = previewIfApproved(tooltipDay);
    const pct = totalHoras > 0 ? ((acumuladas / totalHoras) * 100).toFixed(1) : "0.0";
    return {
      data: tooltipDay,
      isReal: hasRegistered,
      acumuladas,
      previstasDia,
      registadasDia: hasRegistered ? registadasDia : null,
      isHoliday,
      holidayName,
      pendingPreview: pendingPrev,
      percentagem: pct,
    };
  }, [tooltipDay, horasDiarias, totalHoras, workDays, presencas, presencaSet, requestsByDate, holidaySet, holidayWorkSet]);

  // New eligibility logic for terminoAntecipado
  const eligibilityResult = useMemo(() => {
    if (!dataInicio || !dataFim || totalHoras <= 0 || horasDiarias <= 0) {
      return null;
    }
    return checkEligibility(
      totalRealizado,
      totalHoras,
      horasDiarias,
      dataInicio,
      dataFim,
      dias
    );
  }, [totalRealizado, totalHoras, horasDiarias, dataInicio, dataFim, dias]);

  const eligibleForEarlyTermination = eligibilityResult?.elegivel ?? false;
  const hasActiveTermino = terminoAntecipado && (
    terminoAntecipado.estado === "pendente" || terminoAntecipado.estado === "aprovado"
  );

  const isAluno = currentUserRole === "aluno";

  function hasMissingHours(iso: string): boolean {
    if (iso > todayIso) return false;
    if (holidaySet.has(iso)) return false;
    const p = presencas[iso];
    const hours = typeof p?.hoursWorked === "number" ? p.hoursWorked : 0;
    return horasDiarias - hours > 1;
  }

  const refreshRef = useRef(0);
  const handleUpdated = useCallback(() => {
    refreshRef.current += 1;
  }, []);

  function handleDayClick(date: Date) {
    const iso = toIsoDate(date);

    // Handle holiday clicks — offer to work on the holiday (any user)
    if (holidaySet.has(iso)) {
      if (holidayWorkSet.has(iso)) return;
      setHolidayWorkDate(iso);
      setHolidayWorkDialogOpen(true);
      return;
    }

    if (!isAluno) return;

    if (!workDaySet.has(iso)) return;

    const req = requestsByDate.get(iso);
    if (
      req &&
      (req.status === "pending_professor" ||
        req.status === "pending_tutor" ||
        req.status === "approved" ||
        req.status === "expired")
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
    if (!eligibilityResult?.elegivel) return;
    setEligibility(eligibilityResult);
    setConfirmationModalOpen(true);
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
  const workedOkDates = [...workedOkSet].map(isoToDate);
  const scheduledDates = [...workDaySet]
    .filter((iso) => {
      if (iso <= todayIso) return false;
      if (presencaSet.has(iso)) return false;
      if (requestDateSet.has(iso)) return false;
      if (holidaySet.has(iso)) return false;
      return true;
    })
    .map(isoToDate);
  const missingDates = [...missingSet].map(isoToDate);
  const pendingDates = [...requestsByDate.entries()]
    .filter(([, r]) => r.status === "pending_professor" || r.status === "pending_tutor")
    .map(([iso]) => isoToDate(iso));
  const approvedReqDates = [...requestsByDate.entries()]
    .filter(([, r]) => r.status === "approved" || r.status === "acknowledged" || r.status === "expired")
    .map(([iso]) => isoToDate(iso));
  const rejectedReqDates = [...requestsByDate.entries()]
    .filter(([, r]) => r.status === "rejected")
    .map(([iso]) => isoToDate(iso));
  const todayDates = [isoToDate(todayIso)];

  // TerminoAntecipado date modifiers
  const terminoPendingDates = useMemo(() => {
    if (!terminoAntecipado || terminoAntecipado.estado !== "pendente") return [];
    if (!terminoAntecipado.diaDeDispensa) return [];
    return [isoToDate(terminoAntecipado.diaDeDispensa)];
  }, [terminoAntecipado]);

  const terminoApprovedDates = useMemo(() => {
    if (!terminoAntecipado || terminoAntecipado.estado !== "aprovado") return [];
    if (!terminoAntecipado.diaDeDispensa) return [];
    return [isoToDate(terminoAntecipado.diaDeDispensa)];
  }, [terminoAntecipado]);

  const terminoObrigatoriosSet = useMemo(() => {
    if (!terminoAntecipado || terminoAntecipado.estado !== "aprovado") return new Set<string>();
    return new Set(terminoAntecipado.diasParaCumprir || []);
  }, [terminoAntecipado]);

  const terminoObrigatorioDates = useMemo(() => {
    return [...terminoObrigatoriosSet].map(isoToDate);
  }, [terminoObrigatoriosSet]);

  const terminoInvalidatedDates = useMemo(() => {
    if (!terminoAntecipado || terminoAntecipado.estado !== "invalidado_por_incumprimento") return [];
    if (!terminoAntecipado.diaDeDispensa) return [];
    return [isoToDate(terminoAntecipado.diaDeDispensa)];
  }, [terminoAntecipado]);

  const startDate = (() => {
    const [y, m, d] = dataInicio.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();
  const endDate = (() => {
    const [y, m, d] = effectiveDataFim.split("-").map(Number);
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
              <LegendItem color="bg-emerald-500" label="Dia dentro do esperado" />
              <LegendItem color="bg-blue-500" label="Dia atual" />
              <LegendItem color="bg-yellow-200" label="Horas abaixo do esperado" />
            </div>
            <div className="flex flex-wrap gap-3">
              <LegendItem color="bg-card ring-2 ring-blue-400" label="Dia previsto" />
              <LegendItem color="bg-card ring-2 ring-amber-500" label="Pendente" />
              <LegendItem color="bg-card ring-2 ring-emerald-500" label="Aprovado/justificado" />
              <LegendItem color="bg-card ring-2 ring-red-500" label="Rejeitado" />
              <LegendItem color="bg-purple-200 border-2 border-purple-400" label="Feriado nacional" />
            </div>
            {terminoAntecipado && (
              <div className="flex flex-wrap gap-3 border-t pt-2">
                <LegendItem color="bg-card ring-2 ring-yellow-500" label="Dispensa pendente" />
                <LegendItem color="bg-card ring-2 ring-teal-500" label="Dispensa aprovada" />
                <LegendItem color="bg-card ring-2 ring-orange-500" label="Dia obrigatório (dispensa)" />
              </div>
            )}
          </div>

          {/* Banner: eligible with no active request */}
          {isAluno && eligibleForEarlyTermination && !hasActiveTermino && (
            <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 dark:border-teal-800 dark:bg-teal-950">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-teal-800 dark:text-teal-200">
                    Tens menos de {5} dias completos de horas restantes
                  </p>
                  <p className="text-xs text-teal-600 dark:text-teal-400">
                    Podes solicitar ao tutor o término antecipado do estágio.
                    {eligibilityResult?.diaDeDispensa && (
                      <> Se o pedido for aprovado e cumprires integralmente os dias remanescentes, poderás ficar dispensado no dia {formatIsoPt(eligibilityResult.diaDeDispensa)}.</>
                    )}
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={handleEarlyTerminationClick}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Solicitar término antecipado
                </Button>
              </div>
            </div>
          )}

          {/* Banner: active terminoAntecipado status */}
          {isAluno && terminoAntecipado && (
            <div className={`rounded-md border px-4 py-3 ${
              terminoAntecipado.estado === "pendente"
                ? "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
                : terminoAntecipado.estado === "aprovado"
                  ? "border-teal-300 bg-teal-50 dark:border-teal-800 dark:bg-teal-950"
                  : terminoAntecipado.estado === "recusado"
                    ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                    : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
            }`}>
              {terminoAntecipado.estado === "pendente" && (
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Pedido de término antecipado pendente
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Aguarda a decisão do tutor. Dispensa solicitada para {formatIsoPt(terminoAntecipado.diaDeDispensa)}.
                  </p>
                </div>
              )}
              {terminoAntecipado.estado === "aprovado" && (
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-teal-800 dark:text-teal-200">
                    Término antecipado aprovado
                  </p>
                  <p className="text-xs text-teal-600 dark:text-teal-400">
                    Dispensado no dia {formatIsoPt(terminoAntecipado.diaDeDispensa)} se cumprires integralmente os dias obrigatórios.
                  </p>
                </div>
              )}
              {terminoAntecipado.estado === "recusado" && (
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Término antecipado recusado
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {terminoAntecipado.motivoRecusa ? `Motivo: "${terminoAntecipado.motivoRecusa}"` : "O estágio mantém-se nos termos inicialmente previstos."}
                  </p>
                </div>
              )}
              {terminoAntecipado.estado === "invalidado_por_incumprimento" && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Solicitação invalidada por incumprimento
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Foi registado incumprimento horário{terminoAntecipado.diaDeIncumprimento ? ` no dia ${formatIsoPt(terminoAntecipado.diaDeIncumprimento)}` : ""}. A comparência no dia {formatIsoPt(terminoAntecipado.diaDeDispensa)} volta a ser obrigatória.
                  </p>
                  {eligibilityResult?.elegivel && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300"
                      onClick={handleEarlyTerminationClick}
                    >
                      <Send className="mr-2 h-3.5 w-3.5" />
                      Submeter nova solicitação
                    </Button>
                  )}
                </div>
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
          <CardContent className="pt-4" ref={dayPickerRef}
            onMouseLeave={() => {
              hoveredIsoRef.current = null;
              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
              hoverTimeoutRef.current = null;
              setTooltipDay(null);
              setTooltipPos(null);
            }}
          >
            <style>{`
              .rdp-day--scheduled .rdp-day_button { box-shadow: 0 0 0 2px rgb(96 165 250); border-radius: 9999px; }
              .rdp-day--status-pending .rdp-day_button { box-shadow: 0 0 0 2px rgb(245 158 11); }
              .rdp-day--status-approved .rdp-day_button { box-shadow: 0 0 0 2px rgb(16 185 129); }
              .rdp-day--status-rejected .rdp-day_button { box-shadow: 0 0 0 2px rgb(239 68 68); }
              .rdp-day--termino-pending .rdp-day_button { box-shadow: 0 0 0 2px rgb(234 179 8); border-radius: 9999px; }
              .rdp-day--termino-approved .rdp-day_button { box-shadow: 0 0 0 2px rgb(20 184 166); border-radius: 9999px; }
              .rdp-day--termino-obrigatorio .rdp-day_button { box-shadow: 0 0 0 2px rgb(249 115 22); border-radius: 9999px; }
              .rdp-day--termino-invalidated .rdp-day_button { box-shadow: 0 0 0 2px rgb(239 68 68); border-radius: 9999px; }
              .rdp-day--today .rdp-day_button { background-color: rgb(59 130 246); color: white; border-radius: 9999px; }
              .rdp-day--worked-ok .rdp-day_button { background-color: rgb(16 185 129); color: white; border-radius: 9999px; }
              .rdp-day--missing .rdp-day_button { background-color: rgb(254 240 138); color: rgb(113 63 18); border-radius: 9999px; }
              .rdp-day--holiday .rdp-day_button { background-color: rgb(243 232 255); border: 2px solid rgb(192 132 252); border-radius: 9999px; color: rgb(107 33 168); }
              .rdp-day--can-click .rdp-day_button:hover { cursor: pointer; opacity: 0.8; }
            `}</style>
            <DayPicker
              mode="single"
              month={month}
              onMonthChange={setMonth}
              startMonth={startDate}
              endMonth={endDate}
              modifiers={{
                today: todayDates,
                workedOk: workedOkDates,
                scheduled: scheduledDates,
                missing: missingDates,
                statusPending: pendingDates,
                statusApproved: approvedReqDates,
                statusRejected: rejectedReqDates,
                terminoPending: terminoPendingDates,
                terminoApproved: terminoApprovedDates,
                terminoObrigatorio: terminoObrigatorioDates,
                terminoInvalidated: terminoInvalidatedDates,
                holiday: holidayDatesFiltered,
              }}
              modifiersClassNames={{
                today: "rdp-day--today",
                workedOk: "rdp-day--worked-ok",
                scheduled: "rdp-day--scheduled",
                missing: "rdp-day--missing",
                statusPending: "rdp-day--status-pending",
                statusApproved: "rdp-day--status-approved",
                statusRejected: "rdp-day--status-rejected",
                terminoPending: "rdp-day--termino-pending",
                terminoApproved: "rdp-day--termino-approved",
                terminoObrigatorio: "rdp-day--termino-obrigatorio",
                terminoInvalidated: "rdp-day--termino-invalidated",
                holiday: "rdp-day--holiday",
              }}
              onDayClick={handleDayClick}
              onDayMouseEnter={(date: Date, _modifiers: unknown, e: React.MouseEvent) => {
                const iso = toIsoDate(date);
                if (!workDaySet.has(iso) && !holidaySet.has(iso)) return;
                if (hoveredIsoRef.current === iso) return;
                hoveredIsoRef.current = iso;
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = setTimeout(() => {
                  setTooltipDay(iso);
                  setTooltipPos({ x: e.clientX, y: e.clientY });
                }, 800);
              }}
              className="mx-auto w-fit"
              showOutsideDays={false}
            />
            {tooltipData && tooltipPos && (
              <div
                className="fixed z-50 rounded-md border bg-popover px-3 py-2 text-xs shadow-md pointer-events-none"
                style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 10 }}
              >
                {tooltipData.isHoliday ? (
                  <p className="text-purple-700 font-semibold">{formatIsoPt(tooltipData.data)} · {tooltipData.holidayName}</p>
                ) : (
                  <>
                    <p className="font-medium">{formatIsoPt(tooltipData.data)}</p>
                    <p>{tooltipData.isReal ? "Registadas acumuladas" : "Previstas acumuladas"}: {tooltipData.acumuladas}h</p>
                    {tooltipData.isReal ? (
                      <p>Registadas no dia: {tooltipData.registadasDia}h</p>
                    ) : tooltipData.previstasDia === 0 && !tooltipData.isHoliday ? (
                      <p>Registadas no dia: 0h</p>
                    ) : (
                      <p>Previstas do dia: {tooltipData.previstasDia}h
                        {tooltipData.pendingPreview !== null && tooltipData.pendingPreview !== tooltipData.previstasDia && (
                          <span className="text-muted-foreground"> (Se aprovado: {tooltipData.pendingPreview}h)</span>
                        )}
                      </p>
                    )}
                    <p>{tooltipData.isReal ? "Percentagem real" : "Percentagem prevista"}: {tooltipData.percentagem}%</p>
                  </>
                )}
              </div>
            )}
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
              const isMissing = missingSet.has(day.iso);
              const req = requestsByDate.get(day.iso);
              const hasNoHours = !isPast ? false : hours <= 0 && !req;

              return (
                <Card
                  key={day.iso}
                  className={`transition-colors ${hasNoHours ? "border-amber-400 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/30" : ""} ${req ? "border-l-4" : ""} ${
                    req?.status === "approved" || req?.status === "acknowledged" || req?.status === "expired"
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
                                : `${effectiveHoursForDay(day.iso)}h previstas${previewIfApproved(day.iso) !== null ? ` (Se aprovado: ${previewIfApproved(day.iso)}h)` : ""}`}
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
                      {holidaySet.has(day.iso) && (
                        <Badge variant="outline" className="border-purple-400 text-purple-700">
                          Feriado
                        </Badge>
                      )}
                      {terminoAntecipado?.estado === "pendente" && terminoAntecipado.diaDeDispensa === day.iso && (
                        <Badge variant="secondary" className="bg-yellow-200 text-yellow-800 border-yellow-500">
                          Dispensa pendente
                        </Badge>
                      )}
                      {terminoAntecipado?.estado === "aprovado" && terminoAntecipado.diaDeDispensa === day.iso && (
                        <Badge variant="default" className="bg-teal-200 text-teal-800 border-teal-500">
                          Dispensa aprovada
                        </Badge>
                      )}
                      {terminoAntecipado?.estado === "aprovado" && terminoAntecipado.diasParaCumprir?.includes(day.iso) && (
                        <Badge variant="outline" className="border-orange-500 text-orange-700">
                          Dia obrigatório
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

      {/* Comunicados */}
      {comunicados.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Comunicados
          </h3>
          {comunicados.map((c) => (
            <ComunicadoCard key={c.id} targetDate={c.targetDate} reason={c.reason} />
          ))}
        </div>
      )}

      {/* Requests list */}
      {regularRequests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Pedidos de alteração{" "}
              <span className="font-normal text-muted-foreground">
                ({regularRequests.length})
              </span>
            </h3>
            <div className="flex gap-2 text-xs text-muted-foreground">
              {regularRequests.filter((r) => r.status === "pending_professor" || r.status === "pending_tutor").length > 0 && (
                <Badge variant="secondary">
                  {regularRequests.filter((r) => r.status === "pending_professor" || r.status === "pending_tutor").length} pendente{regularRequests.filter((r) => r.status === "pending_professor" || r.status === "pending_tutor").length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>
          {regularRequests.map((req) => (
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

      {regularRequests.length === 0 && comunicados.length === 0 && !loading && isAluno && (
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

      {/* Holiday work dialog */}
      <HolidayWorkDialog
        open={holidayWorkDialogOpen}
        onClose={() => setHolidayWorkDialogOpen(false)}
        estagioId={estagioId}
        targetDate={holidayWorkDate}
        isPast={holidayWorkDate <= todayIso}
        horasDiarias={horasDiarias}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onCreated={handleUpdated}
      />

      {/* TerminoAntecipado confirmation modal */}
      <TerminoAntecipadoConfirmationModal
        open={confirmationModalOpen}
        onClose={() => {
          setConfirmationModalOpen(false);
          setEligibility(null);
        }}
        estagioId={estagioId}
        eligibility={eligibility}
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

