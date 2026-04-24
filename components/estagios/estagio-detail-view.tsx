"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  CheckSquare,
  NotebookPen,
  Star,
  Loader2,
} from "lucide-react";
import { OverviewTab } from "./overview-tab";
import { DocumentList } from "./documentos/document-list";
import { ComingSoonTab } from "./coming-soon-tab";
import {
  getUserRoleInEstagio,
  isDirectorRole,
  type EstagioRole,
  type EstagioDoc,
  type CourseDoc,
} from "@/lib/estagios/permissions";

type Props = {
  estagioId: string;
  currentUserId: string;
  currentUserRole: EstagioRole | "admin_escolar";
  backHref?: string;
  backLabel?: string;
};

type Participant = { name: string; role: EstagioRole; email?: string };

type EstagioData = EstagioDoc & Record<string, unknown>;

export function EstagioDetailView({
  estagioId,
  currentUserId,
  backHref,
  backLabel = "Voltar",
}: Props) {
  const [estagio, setEstagio] = useState<EstagioData | null>(null);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [course, setCourse] = useState<CourseDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Subscribe to estagio doc
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const db = await getDbRuntime();
      if (cancelled) return;
      unsub = onSnapshot(
        doc(db, "estagios", estagioId),
        (snap) => {
          if (!snap.exists()) {
            setNotFound(true);
            setLoading(false);
            return;
          }
          const data = snap.data() as Record<string, unknown>;
          setEstagio({ id: snap.id, ...data } as EstagioData);
          setLoading(false);
        },
        (err) => {
          // Ignora permission-denied que ocorre durante o logout quando o
          // listener ainda está vivo mas o utilizador já perdeu sessão.
          const code = (err as { code?: string })?.code;
          if (code === "permission-denied") {
            return;
          }
          console.error("[v0] estagio snapshot error", err);
          setNotFound(true);
          setLoading(false);
        }
      );
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [estagioId]);

  // Load participants via server API (bypasses rules for tutors from other schools).
  useEffect(() => {
    if (!estagio) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/estagios/${estagio.id}/participants`, {
          cache: "no-store",
        });
        if (!res.ok) {
          console.error("[v0] participants api failed", res.status);
          return;
        }
        const data = (await res.json()) as {
          ok?: boolean;
          participants?: Record<
            string,
            { name: string; email?: string; role: EstagioRole }
          >;
        };
        if (cancelled || !data.ok || !data.participants) return;
        const entries: Record<string, Participant> = {};
        for (const [uid, p] of Object.entries(data.participants)) {
          entries[uid] = { name: p.name, role: p.role, email: p.email };
        }
        setParticipants(entries);
      } catch (err) {
        console.error("[v0] load participants failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [estagio]);

  // Load course data (public) to determine director role.
  useEffect(() => {
    if (!estagio) return;
    let cancelled = false;
    (async () => {
      const rawCourseId =
        (estagio.alunoCourseId as string | undefined) ??
        (estagio.courseId as string | undefined);
      if (typeof rawCourseId !== "string" || rawCourseId.length === 0) return;
      try {
        const db = await getDbRuntime();
        const c = await getDoc(doc(db, "courses", rawCourseId));
        if (c.exists() && !cancelled) {
          const raw = c.data() as Record<string, unknown>;
          setCourse({
            id: c.id,
            schoolId: raw.schoolId as string | undefined,
            courseDirectorId: raw.courseDirectorId as string | undefined,
            teacherIds: raw.teacherIds as string[] | undefined,
            supportingTeacherIds: raw.supportingTeacherIds as string[] | undefined,
          });
        }
      } catch (err) {
        console.error("[v0] load course failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [estagio]);

  const effectiveRole = useMemo<EstagioRole | null>(() => {
    if (!estagio) return null;
    const role = getUserRoleInEstagio(currentUserId, estagio, course);
    if (role) return role;
    // admin_escolar da mesma escola é tratado como diretor.
    return null;
  }, [estagio, currentUserId, course]);

  // Diretor e Professor orientador podem gerir documentos do estágio.
  const canManage = effectiveRole === "diretor" || effectiveRole === "professor";
  void isDirectorRole;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A carregar estágio...
      </div>
    );
  }

  if (notFound || !estagio) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">Estágio não encontrado ou sem permissões.</p>
        {backHref && (
          <Button asChild variant="outline">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        )}
      </div>
    );
  }

  if (!effectiveRole) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">Não tem permissão para aceder a este estágio.</p>
        {backHref && (
          <Button asChild variant="outline">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        )}
      </div>
    );
  }

  const raw = estagio as Record<string, unknown>;
  const overviewData = {
    id: estagio.id,
    title: (raw.titulo as string | undefined) ?? (raw.title as string | undefined),
    alunoId: estagio.alunoId ?? "",
    professorId: estagio.professorId ?? "",
    tutorId: estagio.tutorId ?? "",
    schoolId: estagio.schoolId,
    schoolName: raw.schoolName as string | undefined,
    companyName:
      (raw.entidadeAcolhimento as string | undefined) ??
      (raw.empresa as string | undefined) ??
      (raw.companyName as string | undefined),
    courseName:
      (raw.courseNome as string | undefined) ?? (raw.courseName as string | undefined),
    dataInicio: raw.dataInicio as string | undefined,
    dataFim: (raw.dataFimEstimada as string | undefined) ?? (raw.dataFim as string | undefined),
    horasPorDia: raw.horasDiarias as number | undefined,
    totalHoras: raw.totalHoras as number | undefined,
    horasRealizadas: raw.horasRealizadas as number | undefined,
    diasSemana: normalizeDiasSemana(raw.diasSemana),
    status: (raw.estadoEstagio as string | undefined) ?? (raw.estado as string | undefined),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        {backHref ? (
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
        ) : (
          <div />
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="overview">
            <ClipboardList className="mr-2 h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="mr-2 h-4 w-4" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="presencas">
            <CheckSquare className="mr-2 h-4 w-4" />
            Presenças
          </TabsTrigger>
          <TabsTrigger value="sumarios">
            <NotebookPen className="mr-2 h-4 w-4" />
            Sumários
          </TabsTrigger>
          {effectiveRole !== "aluno" && (
            <TabsTrigger value="avaliacao">
              <Star className="mr-2 h-4 w-4" />
              Avaliação
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab estagio={overviewData} participants={participants} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentList
            estagioId={estagio.id}
            currentUserId={currentUserId}
            currentUserRole={effectiveRole}
            canManage={canManage}
            participants={participants}
          />
        </TabsContent>

        <TabsContent value="presencas">
          <ComingSoonTab
            title="Registo de presenças"
            description="Em breve poderás registar aqui as presenças diárias do aluno, com validação pelo tutor de estágio e visibilidade pelo Diretor de Curso."
            icon={CheckSquare}
          />
        </TabsContent>

        <TabsContent value="sumarios">
          <ComingSoonTab
            title="Sumários semanais"
            description="Espaço para o aluno descrever as atividades realizadas semanalmente, com validação pelo tutor e revisão pelo Diretor de Curso."
            icon={NotebookPen}
          />
        </TabsContent>

        {effectiveRole !== "aluno" && (
          <TabsContent value="avaliacao">
            <ComingSoonTab
              title="Avaliação final"
              description="Ficha de avaliação a preencher pelo tutor e pelo professor orientador no final do estágio, com cálculo automático da classificação FCT."
              icon={Star}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function normalizeDiasSemana(raw: unknown): number[] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const map = raw as Record<string, unknown>;
  const order: [string, number][] = [
    ["dom", 0],
    ["seg", 1],
    ["ter", 2],
    ["qua", 3],
    ["qui", 4],
    ["sex", 5],
    ["sab", 6],
  ];
  const result: number[] = [];
  for (const [key, idx] of order) {
    if (map[key] === true) result.push(idx);
  }
  return result;
}
