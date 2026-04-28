"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Building2,
  User,
  GraduationCap,
  ShieldCheck,
  Clock,
} from "lucide-react";
import type { EstagioRole } from "@/lib/estagios/permissions";

type ParticipantInfo = { name: string; role: EstagioRole; email?: string };

type Props = {
  estagio: {
    id: string;
    title?: string;
    alunoId: string;
    professorId: string;
    tutorId: string;
    schoolId?: string;
    schoolName?: string;
    companyName?: string;
    courseName?: string;
    dataInicio?: string;
    dataFim?: string;
    horasPorDia?: number;
    diasSemana?: number[];
    totalHoras?: number;
    horasRealizadas?: number;
    status?: string;
  };
  participants: Record<string, ParticipantInfo>;
};

const DIAS_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function statusLabel(status?: string) {
  switch (status) {
    case "concluido":
      return { label: "Concluído", variant: "secondary" as const };
    case "suspenso":
      return { label: "Suspenso", variant: "outline" as const };
    case "em_curso":
    case "ativo":
    default:
      return { label: "Em curso", variant: "default" as const };
  }
}

export function OverviewTab({ estagio, participants }: Props) {
  const aluno = participants[estagio.alunoId];
  const professor = participants[estagio.professorId];
  const tutor = participants[estagio.tutorId];

  const [presencasSummary, setPresencasSummary] = useState<
    { total: number; count: number } | null
  >(null);

  useEffect(() => {
    if (!estagio.id) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const db = await getDbRuntime();
      if (cancelled) return;
      unsub = onSnapshot(
        collection(db, "estagios", estagio.id, "presencas"),
        (snap) => {
          let total = 0;
          let count = 0;
          snap.forEach((doc) => {
            const data = doc.data() as { hoursWorked?: number };
            if (typeof data.hoursWorked === "number") {
              total += data.hoursWorked;
              count += 1;
            }
          });
          setPresencasSummary({ total, count });
        },
        (err) => {
          const code = (err as { code?: string })?.code;
          if (code !== "permission-denied") {
            console.error("[v0] presencas overview snapshot", err);
          }
        }
      );
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [estagio.id]);

  const dias = (estagio.diasSemana ?? [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DIAS_LABEL[d])
    .join(", ");

  const total = Math.max(0, estagio.totalHoras ?? 0);
  const horasRegistadas = useMemo(() => {
    if (!presencasSummary) return null;
    return presencasSummary.count > 0 ? presencasSummary.total : 0;
  }, [presencasSummary]);
  const done = Math.max(
    0,
    Math.min(total, horasRegistadas ?? (estagio.horasRealizadas ?? 0))
  );
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const status = statusLabel(estagio.status);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-balance">
                {estagio.title || "Estágio FCT"}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                {estagio.courseName ? `${estagio.courseName} • ` : ""}
                {estagio.schoolName ?? ""}
              </p>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <Detail
            icon={<Calendar className="h-4 w-4" />}
            label="Início"
            value={formatDate(estagio.dataInicio)}
          />
          <Detail
            icon={<Calendar className="h-4 w-4" />}
            label="Fim previsto"
            value={formatDate(estagio.dataFim)}
          />
          <Detail
            icon={<Clock className="h-4 w-4" />}
            label="Horas por dia"
            value={estagio.horasPorDia ? `${estagio.horasPorDia}h` : "—"}
          />
          <Detail
            icon={<Clock className="h-4 w-4" />}
            label="Total"
            value={total > 0 ? `${total}h obrigatórias` : "—"}
          />
          <Detail
            icon={<Calendar className="h-4 w-4" />}
            label="Dias da semana"
            value={dias || "—"}
            className="sm:col-span-2"
          />

          <div className="sm:col-span-2 space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Progresso de horas
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                role="progressbar"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {done}h realizadas {total > 0 ? `• ${Math.max(0, total - done)}h restantes` : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Intervenientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Person
            icon={<GraduationCap className="h-4 w-4" />}
            label="Aluno"
            person={aluno}
          />
          <Person
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Professor Orientador"
            person={professor}
          />
          <Person
            icon={<User className="h-4 w-4" />}
            label="Tutor de Estágio"
            person={tutor}
          />
          <div className="flex items-start gap-3 rounded-md border bg-muted/20 px-3 py-2">
            <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Entidade de acolhimento
              </p>
              <p className="truncate text-sm font-medium">{estagio.companyName ?? "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function Person({
  icon,
  label,
  person,
}: {
  icon: React.ReactNode;
  label: string;
  person?: { name: string; email?: string };
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-muted/20 px-3 py-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{person?.name ?? "—"}</p>
        {person?.email && (
          <p className="truncate text-xs text-muted-foreground">{person.email}</p>
        )}
      </div>
    </div>
  );
}
