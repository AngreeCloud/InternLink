"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, MapPin } from "lucide-react";
import {
  calcularDataFimEstimada,
  DEFAULT_DIAS_SEMANA,
  formatIsoDatePt,
  type DiasSemana,
} from "@/lib/estagios/date-calc";
import { getAuthRuntime } from "@/lib/firebase-runtime";
import { ensureUserTutorsIndex, ensureAutoConversationForTutorAssignment } from "@/lib/chat/realtime-chat";

type StudentOption = {
  id: string;
  nome: string;
  email: string;
  photoURL: string;
  courseId?: string;
  curso?: string;
};

type TutorOption = {
  id: string;
  nome: string;
  email: string;
  photoURL: string;
  empresa: string;
};

type EmpresaOption = {
  id: string;
  nome: string;
  morada?: string;
  codigoPostal?: string;
  localidade?: string;
  nif?: string;
  setor?: string;
};

export type CreateEstagioDialogProps = {
  students: StudentOption[];
  tutors: TutorOption[];
  canCreateForStudent: (student: StudentOption) => boolean;
  onCreated: (estagioId: string) => void;
  trigger?: React.ReactNode;
};

const DAY_LABEL: Record<keyof DiasSemana, string> = {
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
  dom: "Domingo",
};

export function CreateEstagioDialog({
  students,
  tutors,
  canCreateForStudent,
  onCreated,
  trigger,
}: CreateEstagioDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [alunoId, setAlunoId] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [totalHoras, setTotalHoras] = useState(600);
  const [horasDiarias, setHorasDiarias] = useState(7);
  const [diasSemana, setDiasSemana] = useState<DiasSemana>(DEFAULT_DIAS_SEMANA);

  const [studentSearch, setStudentSearch] = useState("");
  const [tutorSearch, setTutorSearch] = useState("");

  const [empresaSearch, setEmpresaSearch] = useState("");
  const [empresaOptions, setEmpresaOptions] = useState<EmpresaOption[]>([]);
  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [empresaHighlight, setEmpresaHighlight] = useState(0);
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaOption | null>(null);
  const empresaRootRef = useRef<HTMLDivElement | null>(null);
  const empresaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchEmpresas = useCallback(async (query: string) => {
    try {
      const res = await fetch(`/api/empresas/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { empresas?: EmpresaOption[] };
      setEmpresaOptions(data.empresas ?? []);
    } catch {
      setEmpresaOptions([]);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setAlunoId("");
      setTutorId("");
      setTitulo("");
      setDataInicio("");
      setTotalHoras(600);
      setHorasDiarias(7);
      setDiasSemana(DEFAULT_DIAS_SEMANA);
      setStudentSearch("");
      setTutorSearch("");
      setEmpresaSearch("");
      setEmpresaOptions([]);
      setEmpresaOpen(false);
      setSelectedEmpresa(null);
      setErrorMessage(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (empresaRootRef.current && !empresaRootRef.current.contains(event.target as Node)) {
        setEmpresaOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setEmpresaHighlight(0);
  }, [empresaOptions]);

  const handleEmpresaInput = (value: string) => {
    setEmpresaSearch(value);
    setSelectedEmpresa(null);
    if (empresaDebounceRef.current) clearTimeout(empresaDebounceRef.current);
    const q = value.trim();
    if (!q) {
      setEmpresaOptions([]);
      setEmpresaOpen(false);
      return;
    }
    setEmpresaOpen(true);
    empresaDebounceRef.current = setTimeout(() => fetchEmpresas(q), 250);
  };

  const selectEmpresa = (opt: EmpresaOption) => {
    setSelectedEmpresa(opt);
    setEmpresaSearch(opt.nome);
    setEmpresaOpen(false);
    setEmpresaOptions([]);
  };

  const clearEmpresa = () => {
    setSelectedEmpresa(null);
    setEmpresaSearch("");
    setEmpresaOpen(false);
  };

  const eligibleStudents = useMemo(() => students.filter(canCreateForStudent), [students, canCreateForStudent]);

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return eligibleStudents;
    return eligibleStudents.filter(
      (s) => s.nome.toLowerCase().includes(term) || s.email.toLowerCase().includes(term)
    );
  }, [eligibleStudents, studentSearch]);

  const filteredTutors = useMemo(() => {
    const term = tutorSearch.trim().toLowerCase();
    if (!term) return tutors;
    return tutors.filter(
      (t) =>
        t.nome.toLowerCase().includes(term) ||
        t.email.toLowerCase().includes(term) ||
        (t.empresa || "").toLowerCase().includes(term)
    );
  }, [tutors, tutorSearch]);

  const selectedStudent = students.find((s) => s.id === alunoId) || null;

  const dateResult = useMemo(() => {
    if (!dataInicio || !totalHoras || !horasDiarias) return null;
    return calcularDataFimEstimada({ dataInicio, totalHoras, horasDiarias, diasSemana });
  }, [dataInicio, totalHoras, horasDiarias, diasSemana]);

  const toggleDay = (key: keyof DiasSemana) => {
    setDiasSemana((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEmpresaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!empresaOpen || empresaOptions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setEmpresaHighlight((prev) => Math.min(prev + 1, empresaOptions.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setEmpresaHighlight((prev) => Math.max(prev - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = empresaOptions[empresaHighlight];
      if (opt) selectEmpresa(opt);
    }
    if (e.key === "Escape") {
      setEmpresaOpen(false);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!alunoId) {
      setErrorMessage("Selecione um aluno.");
      return;
    }
    if (!titulo.trim()) {
      setErrorMessage("Indique o título do estágio.");
      return;
    }
    if (!dataInicio) {
      setErrorMessage("Indique a data de início.");
      return;
    }
    if (!(totalHoras > 0) || !(horasDiarias > 0)) {
      setErrorMessage("Total de horas e horas diárias devem ser positivos.");
      return;
    }

    setSubmitting(true);
    try {
      const empresaNome = selectedEmpresa?.nome ?? empresaSearch.trim();

      const body: Record<string, unknown> = {
        alunoId,
        tutorId: tutorId || undefined,
        titulo: titulo.trim(),
        empresa: empresaNome,
        dataInicio,
        totalHoras,
        horasDiarias,
        diasSemana,
      };

      if (selectedEmpresa) {
        body.empresaId = selectedEmpresa.id;
        body.empresaSnapshot = {
          nome: selectedEmpresa.nome,
          morada: selectedEmpresa.morada,
          codigoPostal: selectedEmpresa.codigoPostal,
          localidade: selectedEmpresa.localidade,
          nif: selectedEmpresa.nif,
        };
      }

      const res = await fetch("/api/estagios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !data.ok || !data.id) {
        setErrorMessage(data.error || "Não foi possível criar o estágio.");
        return;
      }

      if (tutorId && alunoId) {
        const auth = await getAuthRuntime();
        const professorId = auth.currentUser?.uid;
        if (professorId) {
          void ensureUserTutorsIndex(alunoId, tutorId);
          void ensureAutoConversationForTutorAssignment(alunoId, professorId, tutorId);
        }
      }

      setOpen(false);
      onCreated(data.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Estágio
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Estágio</DialogTitle>
          <DialogDescription>
            Apenas o Diretor do curso do aluno pode criar um estágio. A data de fim estimada é calculada em tempo real com base nas horas previstas, horário semanal e feriados nacionais portugueses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="estagio-titulo">Título</Label>
            <Input
              id="estagio-titulo"
              placeholder="Ex.: Estágio em Desenvolvimento Web"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Aluno</Label>
              <Input
                placeholder="Pesquisar aluno..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {filteredStudents.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-muted-foreground">
                    Nenhum aluno elegível. Apenas alunos dos cursos de que é Diretor aparecem aqui.
                  </p>
                ) : (
                  filteredStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => setAlunoId(student.id)}
                      className={[
                        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                        alunoId === student.id ? "bg-primary/10" : "hover:bg-muted",
                      ].join(" ")}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={student.photoURL || undefined} alt={student.nome} />
                        <AvatarFallback>{student.nome.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{student.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {student.email}
                          {student.curso ? ` • ${student.curso}` : ""}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
              {selectedStudent ? (
                <p className="text-xs text-muted-foreground">
                  Selecionado: <strong>{selectedStudent.nome}</strong>
                  {selectedStudent.curso ? ` (${selectedStudent.curso})` : ""}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Tutor (opcional)</Label>
              <Input
                placeholder="Pesquisar tutor..."
                value={tutorSearch}
                onChange={(e) => setTutorSearch(e.target.value)}
              />
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {filteredTutors.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-muted-foreground">Nenhum tutor no sistema.</p>
                ) : (
                  filteredTutors.map((tutor) => (
                    <button
                      key={tutor.id}
                      type="button"
                      onClick={() => setTutorId(tutorId === tutor.id ? "" : tutor.id)}
                      className={[
                        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                        tutorId === tutor.id ? "bg-primary/10" : "hover:bg-muted",
                      ].join(" ")}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={tutor.photoURL || undefined} alt={tutor.nome} />
                        <AvatarFallback>{tutor.nome.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{tutor.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {tutor.email} {tutor.empresa ? `• ${tutor.empresa}` : ""}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2" ref={empresaRootRef}>
            <Label htmlFor="estagio-empresa">Entidade de Acolhimento / Empresa</Label>
            {selectedEmpresa ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{selectedEmpresa.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {[selectedEmpresa.localidade, selectedEmpresa.codigoPostal].filter(Boolean).join(" · ")}
                    {selectedEmpresa.nif ? ` · NIF ${selectedEmpresa.nif}` : ""}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={clearEmpresa}>
                  Alterar
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="estagio-empresa"
                  placeholder="Pesquisar empresa ou escrever livremente..."
                  value={empresaSearch}
                  onChange={(e) => handleEmpresaInput(e.target.value)}
                  onFocus={() => {
                    if (empresaSearch.trim()) setEmpresaOpen(true);
                  }}
                  onKeyDown={handleEmpresaKeyDown}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={empresaOpen}
                />
                {empresaOpen && empresaOptions.length > 0 && (
                  <div className="absolute z-40 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-md">
                    {empresaOptions.map((opt, i) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={[
                          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                          i === empresaHighlight ? "bg-muted" : "hover:bg-muted",
                        ].join(" ")}
                        onClick={() => selectEmpresa(opt)}
                        onMouseEnter={() => setEmpresaHighlight(i)}
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{opt.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[opt.localidade, opt.setor].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        {opt.localidade && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <MapPin className="h-3 w-3" />
                            {opt.localidade}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {empresaSearch.trim() && !selectedEmpresa && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Se a empresa não aparecer na lista, podes escrever o nome manualmente.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="estagio-dataInicio">Data de Início</Label>
              <Input
                id="estagio-dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estagio-totalHoras">Total de Horas</Label>
              <Input
                id="estagio-totalHoras"
                type="number"
                min={1}
                value={totalHoras}
                onChange={(e) => setTotalHoras(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estagio-horasDiarias">Horas por Dia</Label>
              <Input
                id="estagio-horasDiarias"
                type="number"
                min={1}
                max={24}
                step={0.5}
                value={horasDiarias}
                onChange={(e) => setHorasDiarias(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias da Semana Ativos</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DAY_LABEL) as (keyof DiasSemana)[]).map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={diasSemana[key] ? "default" : "outline"}
                  onClick={() => toggleDay(key)}
                >
                  {DAY_LABEL[key]}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary">Pré-visualização</Badge>
              {dateResult && dateResult.diasUteis > 0 ? (
                <>
                  <span>
                    Data estimada de fim: <strong>{formatIsoDatePt(dateResult.dataFimEstimada)}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    ({dateResult.diasUteis} dias úteis • feriados nacionais PT excluídos)
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Preencha data de início, total de horas e horário para ver a previsão.
                </span>
              )}
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? "A criar..." : "Criar Estágio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
