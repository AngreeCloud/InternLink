"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownUp,
  ArrowRight,
  Briefcase,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Filter,
  Pencil,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { formatIsoDatePt } from "@/lib/estagios/date-calc";
import type { EstagioListItem, StudentLite, TutorLite } from "./estagio-types";

type Props = {
  estagios: EstagioListItem[];
  students: StudentLite[];
  tutors: TutorLite[];
  loading: boolean;
  onOpenChangeTutor: (estagio: EstagioListItem) => void;
  onOpenEdit: (estagio: EstagioListItem) => void;
};

type SortMode = "recent" | "title" | "student" | "course";
type StatusFilter = "all" | "ativo" | "concluido" | "no_tutor";
const ALL_TURMAS = "__all_turmas__";

export function EstagiosSection({
  estagios,
  students,
  tutors,
  loading,
  onOpenChangeTutor,
  onOpenEdit,
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [turmaFilter, setTurmaFilter] = useState<string>(ALL_TURMAS);
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [collapsedTurmas, setCollapsedTurmas] = useState<Record<string, boolean>>({});

  const turmas = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of estagios) {
      const id = e.courseId || `__nome__:${e.courseNome || "Sem turma"}`;
      const name = e.courseNome || "Sem turma";
      if (!map.has(id)) map.set(id, name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
  }, [estagios]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return estagios.filter((e) => {
      if (statusFilter === "ativo" && e.estado !== "ativo") return false;
      if (statusFilter === "concluido") {
        const ok = e.estado === "concluido" || e.estado === "concluído";
        if (!ok) return false;
      }
      if (statusFilter === "no_tutor" && e.tutorId) return false;

      if (turmaFilter !== ALL_TURMAS) {
        const id = e.courseId || `__nome__:${e.courseNome || "Sem turma"}`;
        if (id !== turmaFilter) return false;
      }

      if (!term) return true;

      const hay = [
        e.titulo,
        e.alunoNome,
        e.alunoEmail,
        e.empresa,
        e.courseNome,
        e.tutorNome,
        e.tutorEmail,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
        .join(" ");
      return hay.includes(term);
    });
  }, [estagios, search, statusFilter, turmaFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    switch (sortMode) {
      case "title":
        copy.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-PT"));
        break;
      case "student":
        copy.sort((a, b) => a.alunoNome.localeCompare(b.alunoNome, "pt-PT"));
        break;
      case "course":
        copy.sort((a, b) => (a.courseNome || "").localeCompare(b.courseNome || "", "pt-PT"));
        break;
      case "recent":
      default:
        copy.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        break;
    }
    return copy;
  }, [filtered, sortMode]);

  const grouped = useMemo(() => {
    const map = new Map<string, { id: string; name: string; items: EstagioListItem[] }>();
    for (const e of sorted) {
      const id = e.courseId || `__nome__:${e.courseNome || "Sem turma"}`;
      const name = e.courseNome || "Sem turma";
      const existing = map.get(id);
      if (existing) {
        existing.items.push(e);
      } else {
        map.set(id, { id, name, items: [e] });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
  }, [sorted]);

  const toggleTurma = (id: string) => {
    setCollapsedTurmas((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const studentById = useMemo(() => {
    const m = new Map<string, StudentLite>();
    for (const s of students) m.set(s.id, s);
    return m;
  }, [students]);

  const tutorById = useMemo(() => {
    const m = new Map<string, TutorLite>();
    for (const t of tutors) m.set(t.id, t);
    return m;
  }, [tutors]);

  const totalCount = estagios.length;
  const filteredCount = sorted.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Estágios
        </CardTitle>
        <CardDescription>
          {loading
            ? "A carregar..."
            : totalCount === filteredCount
              ? `${totalCount} estágio(s) criado(s)`
              : `${filteredCount} de ${totalCount} estágio(s) após filtros`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar por aluno, tutor, empresa, título ou turma..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <Select value={turmaFilter} onValueChange={setTurmaFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Turma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TURMAS}>Todas as turmas</SelectItem>
                  {turmas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  <SelectItem value="ativo">Apenas ativos</SelectItem>
                  <SelectItem value="concluido">Concluídos</SelectItem>
                  <SelectItem value="no_tutor">Sem tutor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="title">Título A-Z</SelectItem>
                  <SelectItem value="student">Aluno A-Z</SelectItem>
                  <SelectItem value="course">Turma A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-sm text-muted-foreground">A carregar estágios...</p>
        ) : totalCount === 0 ? (
          <div className="py-8 text-center">
            <Briefcase className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium text-foreground">Nenhum estágio criado</h3>
            <p className="text-muted-foreground">
              Crie um novo estágio e associe o tutor quando quiser.
            </p>
          </div>
        ) : filteredCount === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum estágio corresponde aos filtros atuais.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((group) => {
              const collapsed = Boolean(collapsedTurmas[group.id]);
              return (
                <div key={group.id} className="rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => toggleTurma(group.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-t-lg bg-muted/40 px-4 py-2 text-left transition-colors hover:bg-muted/60"
                    aria-expanded={!collapsed}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {collapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="truncate text-sm font-medium">{group.name}</span>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {group.items.length}
                    </Badge>
                  </button>

                  {!collapsed && (
                    <div className="space-y-3 p-3">
                      {group.items.map((estagio) => {
                        const linkedStudent = studentById.get(estagio.alunoId) || null;
                        const linkedTutor = estagio.tutorId
                          ? tutorById.get(estagio.tutorId) || null
                          : null;

                        return (
                          <div
                            key={estagio.id}
                            className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 lg:flex-row lg:items-start lg:justify-between"
                          >
                            <div className="min-w-0 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-medium text-foreground">
                                  {estagio.titulo}
                                </h4>
                                <Badge
                                  variant={estagio.estado === "ativo" ? "default" : "secondary"}
                                >
                                  {estagio.estado}
                                </Badge>
                                {!estagio.tutorId && (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-500/40 text-amber-700 dark:text-amber-400"
                                  >
                                    Sem tutor
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage
                                    src={linkedStudent?.photoURL || undefined}
                                    alt={estagio.alunoNome}
                                  />
                                  <AvatarFallback>
                                    {(estagio.alunoNome || "?").charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="truncate">
                                  Aluno: {estagio.alunoNome}
                                  {estagio.alunoEmail && estagio.alunoEmail !== "—"
                                    ? ` (${estagio.alunoEmail})`
                                    : ""}
                                </span>
                              </div>

                              {estagio.tutorId ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage
                                      src={linkedTutor?.photoURL || undefined}
                                      alt={linkedTutor?.nome || "Tutor"}
                                    />
                                    <AvatarFallback>
                                      {(linkedTutor?.nome || "T").charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="truncate">
                                    Tutor:{" "}
                                    {linkedTutor
                                      ? `${linkedTutor.nome} (${linkedTutor.email})`
                                      : "Associado"}
                                  </span>
                                </div>
                              ) : null}

                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {estagio.empresa && estagio.empresa !== "—" && (
                                  <span>Empresa: {estagio.empresa}</span>
                                )}
                                {estagio.dataInicio ? (
                                  <span className="inline-flex items-center gap-1">
                                    <CalendarRange className="h-3 w-3" />
                                    {formatIsoDatePt(estagio.dataInicio)}
                                    {estagio.dataFimEstimada
                                      ? ` → ${formatIsoDatePt(estagio.dataFimEstimada)}`
                                      : ""}
                                  </span>
                                ) : null}
                                {Number.isFinite(estagio.totalHoras) && estagio.totalHoras! > 0 && (
                                  <span>{estagio.totalHoras}h totais</span>
                                )}
                                {estagio.createdAt && estagio.createdAt !== "—" && (
                                  <span>Criado: {estagio.createdAt}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenEdit(estagio)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenChangeTutor(estagio)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                {estagio.tutorId ? "Alterar tutor" : "Associar tutor"}
                              </Button>
                              <Button asChild size="sm">
                                <Link href={`/professor/estagios/${estagio.id}`}>
                                  Abrir
                                  <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
