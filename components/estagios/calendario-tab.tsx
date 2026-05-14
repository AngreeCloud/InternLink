"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CalendarSearch } from "lucide-react";
import {
  formatIsoPt,
  listWorkDays,
  normalizeDiasSemana,
  toIsoDate,
  type WorkDay,
} from "@/lib/estagios/workdays";
import {
  canRequestEarlyTermination,
  labelForStatus,
  variantForStatus,
  type ScheduleChangeRequest,
} from "@/lib/estagios/schedule-change-requests";
import type { EstagioRole } from "@/lib/estagios/permissions";
import { ScheduleChangeRequestModal } from "./schedule-change-request-modal";
import { ScheduleChangeRequestThread } from "./schedule-change-request-thread";

type Props = {
  estagioId: string;
  estagio: Record<string, unknown>;
  currentUserId: string;
  currentUserRole: EstagioRole;
};

type PresencaDoc = {
  date: string;
  hoursWorked: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function classForDay(
  iso: string,
  workDaySet: Set<string>,
  presencaSet: Set<string>,
  requestsByDate: Map<string, ScheduleChangeRequest>
): string {
  const req = requestsByDate.get(iso);
  if (req) {
    if (req.status === "approved") return "rdp-day--approved";
    if (req.status === "rejected") return "rdp-day--rejected";
    return "rdp-day--pending";
  }
  if (presencaSet.has(iso)) return "rdp-day--worked";
  if (workDaySet.has(iso)) return "rdp-day--scheduled";
  return "";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CalendarioTab({ estagioId, estagio, currentUserId, currentUserRole }: Props) {
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

  // Subscriptions
  const [presencas, setPresencas] = useState<Record<string, PresencaDoc>>({});
  const [requests, setRequests] = useState<ScheduleChangeRequest[]>([]);
  const [loadingPresencas, setLoadingPresencas] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Subscribe presencas
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

  // Subscribe schedule_change_requests
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
          // Newest first
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

  // Calendar state
  const [month, setMonth] = useState<Date>(() => {
    if (dataInicio) {
      const [y, m] = dataInicio.split("-").map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string>("");

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
      // Only show the "most recent active" request per date
      const existing = map.get(r.targetDate);
      if (!existing || ["approved", "pending_tutor", "pending_professor"].includes(r.status)) {
        map.set(r.targetDate, r);
      }
    }
    return map;
  }, [requests]);

  const todayIso = toIsoDate(new Date());

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

  // Used to force re-fetch after updates (requests are realtime so just a noop ref trick)
  const refreshRef = useRef(0);
  const handleUpdated = useCallback(() => {
    refreshRef.current += 1;
  }, []);

  function handleDayClick(date: Date) {
    if (!isAluno) return;
    const iso = toIsoDate(date);
    // Only allow clicking scheduled workdays that are not in the future
    if (!workDaySet.has(iso) || iso > todayIso) return;
    // Don't reopen if there's already an active (non-rejected/cancelled) request
    const req = requestsByDate.get(iso);
    if (req && (req.status === "pending_professor" || req.status === "pending_tutor" || req.status === "approved")) {
      return;
    }
    setModalDate(iso);
    setModalOpen(true);
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
  const workedDates = [...presencaSet].map((iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  });
  const scheduledDates = [...workDaySet]
    .filter((iso) => !presencaSet.has(iso))
    .map((iso) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d);
    });
  const pendingDates = [...requestsByDate.entries()]
    .filter(([, r]) => r.status === "pending_professor" || r.status === "pending_tutor")
    .map(([iso]) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d);
    });
  const approvedReqDates = [...requestsByDate.entries()]
    .filter(([, r]) => r.status === "approved")
    .map(([iso]) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d);
    });
  const rejectedReqDates = [...requestsByDate.entries()]
    .filter(([, r]) => r.status === "rejected")
    .map(([iso]) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d);
    });

  const startDate = (() => {
    const [y, m, d] = dataInicio.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();
  const endDate = (() => {
    const [y, m, d] = dataFim.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();

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
          <div className="flex flex-wrap gap-3 text-xs">
            <LegendItem color="bg-emerald-500" label="Dia trabalhado" />
            <LegendItem color="bg-primary/20 border border-primary" label="Dia previsto" />
            <LegendItem color="bg-amber-400" label="Pedido pendente" />
            <LegendItem color="bg-emerald-200 border border-emerald-500" label="Pedido aprovado" />
            <LegendItem color="bg-red-200 border border-red-400" label="Pedido rejeitado" />
          </div>

          {isAluno && eligibleForEarlyTermination && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Tens horas restantes inferiores a um dia de trabalho — podes solicitar o
              término antecipado do estágio clicando num dia previsto.
            </div>
          )}

          {isAluno && (
            <p className="text-xs text-muted-foreground">
              Clica num dia previsto (passado) para submeter um pedido de falta justificada
              {eligibleForEarlyTermination ? " ou término antecipado" : ""}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Calendar */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar calendário...
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <style>{`
              .rdp-day--worked .rdp-day_button { background-color: rgb(16 185 129); color: white; border-radius: 9999px; }
              .rdp-day--scheduled .rdp-day_button { background-color: hsl(var(--primary) / 0.12); border: 1px solid hsl(var(--primary) / 0.5); border-radius: 9999px; }
              .rdp-day--pending .rdp-day_button { background-color: rgb(251 191 36); color: rgb(120 53 15); border-radius: 9999px; }
              .rdp-day--approved .rdp-day_button { background-color: rgb(167 243 208); border: 1.5px solid rgb(16 185 129); border-radius: 9999px; }
              .rdp-day--rejected .rdp-day_button { background-color: rgb(254 202 202); border: 1.5px solid rgb(239 68 68); border-radius: 9999px; }
              .rdp-day--scheduled.rdp-day--can-click .rdp-day_button:hover { cursor: pointer; opacity: 0.8; }
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
                pending: pendingDates,
                approved: approvedReqDates,
                rejected: rejectedReqDates,
              }}
              modifiersClassNames={{
                worked: "rdp-day--worked",
                scheduled: "rdp-day--scheduled",
                pending: "rdp-day--pending",
                approved: "rdp-day--approved",
                rejected: "rdp-day--rejected",
              }}
              onDayClick={isAluno ? handleDayClick : undefined}
              className="mx-auto w-fit"
              showOutsideDays={false}
            />
          </CardContent>
        </Card>
      )}

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
            />
          ))}
        </div>
      )}

      {requests.length === 0 && !loading && isAluno && (
        <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Ainda não tens pedidos de alteração. Clica num dia previsto (passado) no calendário
          para criar um pedido de falta justificada.
        </div>
      )}

      {/* Modal */}
      <ScheduleChangeRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        estagioId={estagioId}
        targetDate={modalDate}
        canRequestEarlyTermination={eligibleForEarlyTermination}
        onCreated={handleUpdated}
      />
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

// Re-export for type-checking sanity; unused but avoids TS dead-code warning
void classForDay;
