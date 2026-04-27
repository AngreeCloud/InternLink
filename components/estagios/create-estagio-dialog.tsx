"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Plus } from "lucide-react";
import {
  calcularDataFimEstimada,
  DEFAULT_DIAS_SEMANA,
  formatIsoDatePt,
  type DiasSemana,
} from "@/lib/estagios/date-calc";

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
  const [empresa, setEmpresa] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [totalHoras, setTotalHoras] = useState(600);
  const [horasDiarias, setHorasDiarias] = useState(7);
  const [diasSemana, setDiasSemana] = useState<DiasSemana>(DEFAULT_DIAS_SEMANA);

  const [studentSearch, setStudentSearch] = useState("");
  const [tutorSearch, setTutorSearch] = useState("");

  useEffect(() => {
    if (!open) {
      setAlunoId("");
      setTutorId("");
      setTitulo("");
      setEmpresa("");
      setDataInicio("");
      setTotalHoras(600);
      setHorasDiarias(7);
      setDiasSemana(DEFAULT_DIAS_SEMANA);
      setStudentSearch("");
      setTutorSearch("");
      setErrorMessage(null);
      setSubmitting(false);
    }
  }, [open]);

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
      const res = await fetch("/api/estagios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alunoId,
          tutorId: tutorId || undefined,
          titulo: titulo.trim(),
          empresa: empresa.trim(),
          dataInicio,
          totalHoras,
          horasDiarias,
          diasSemana,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !data.ok || !data.id) {
        setErrorMessage(data.error || "Não foi possível criar o estágio.");
        return;
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

          <div className="space-y-2">
            <Label htmlFor="estagio-empresa">Entidade de Acolhimento / Empresa</Label>
            <Input
              id="estagio-empresa"
              placeholder="Nome da entidade"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
            />
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
