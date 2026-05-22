"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Users, UserPlus, UserMinus, Copy, Check, ShieldCheck, Trash2 } from "lucide-react";

function calculateAge(dataNascimento: string): number {
  if (!dataNascimento || dataNascimento === "—") return 99;
  const birth = new Date(dataNascimento);
  if (isNaN(birth.getTime())) return 99;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

const INTERNSHIP_STATUS_ACTIVE = "Estágio ativo";
const INTERNSHIP_STATUS_COMPLETED = "Estágio concluido";
const INTERNSHIP_STATUS_NONE = "Sem estágio associado";

type CourseOption = {
  id: string;
  name: string;
};

type InternshipStatusLabel =
  | typeof INTERNSHIP_STATUS_ACTIVE
  | typeof INTERNSHIP_STATUS_COMPLETED
  | typeof INTERNSHIP_STATUS_NONE;

type ApprovedStudent = {
  id: string;
  nome: string;
  email: string;
  courseId: string;
  curso: string;
  localidade: string;
  telefone: string;
  dataNascimento: string;
  createdAt: string;
  encarregadoId: string | null;
  encarregadoNome: string | null;
};

type EECredentials = {
  uid: string;
  nome: string;
  email: string;
  password: string;
};

type ApiStudent = ApprovedStudent & {
  internshipStatus?: InternshipStatusLabel;
  encarregadoId?: string | null;
  encarregadoNome?: string | null;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  schoolName?: string;
  courses?: CourseOption[];
  students?: ApiStudent[];
};

export function ApprovedStudentsManager() {
  const [students, setStudents] = useState<ApprovedStudent[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [studentInternshipStatus, setStudentInternshipStatus] = useState<Record<string, InternshipStatusLabel>>({});
  const [changingStudentId, setChangingStudentId] = useState<string | null>(null);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);

  // EE state
  const [eeDialogStudentId, setEeDialogStudentId] = useState<string | null>(null);
  const [eeNome, setEeNome] = useState("");
  const [eeLoading, setEeLoading] = useState(false);
  const [eeCredentials, setEeCredentials] = useState<EECredentials | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // EE search state
  const [eeSearchOpen, setEeSearchOpen] = useState(false);
  const [eeSearchStudentId, setEeSearchStudentId] = useState<string | null>(null);
  const [eeSearchTerm, setEeSearchTerm] = useState("");
  const [eeSearchResults, setEeSearchResults] = useState<{ uid: string; nome: string; email: string; educandosCount: number }[]>([]);
  const [eeSearchLoading, setEeSearchLoading] = useState(false);
  const [eeSearchError, setEeSearchError] = useState<string | null>(null);
  const [manageMode, setManageMode] = useState<"change-course" | "remove-student" | null>(null);
  const [dialogSearchTerm, setDialogSearchTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const loadStudents = async () => {
    setLoading(true);
    setActionError("");

    try {
      const auth = await getAuthRuntime();
      if (!auth.currentUser) {
        setStudents([]);
        setCourses([]);
        setSchoolName("");
        setStudentInternshipStatus({});
        return;
      }

      const response = await fetch("/api/professor/alunos", { cache: "no-store" });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Não foi possível carregar os alunos aprovados.");
      }

      const nextStudents = Array.isArray(data.students) ? data.students : [];
      setSchoolName(data.schoolName || "");
      setCourses(Array.isArray(data.courses) ? data.courses : []);
      setStudents(nextStudents.map(({ internshipStatus: _internshipStatus, ...student }) => ({
        ...student,
        encarregadoId: student.encarregadoId || null,
        encarregadoNome: student.encarregadoNome || null,
      })));
      setStudentInternshipStatus(
        Object.fromEntries(
          nextStudents.map((student) => [student.id, student.internshipStatus || INTERNSHIP_STATUS_NONE])
        )
      );
    } catch (error) {
      console.error("Erro ao carregar alunos aprovados:", error);
      setStudents([]);
      setCourses([]);
      setSchoolName("");
      setStudentInternshipStatus({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      unsubscribe = onAuthStateChanged(auth, () => {
        void loadStudents();
      });
    })();

    return () => unsubscribe();
  }, []);

  const openEeDialog = (studentId: string) => {
    setEeDialogStudentId(studentId);
    setEeNome("");
    setEeCredentials(null);
    setCopiedField(null);
  };

  const closeEeDialog = () => {
    setEeDialogStudentId(null);
    setEeCredentials(null);
    setEeNome("");
  };

  const handleCreateEe = async () => {
    if (!eeDialogStudentId || eeNome.trim().length < 2) return;
    setEeLoading(true);
    try {
      const res = await fetch("/api/encarregado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: eeDialogStudentId, nomeEE: eeNome.trim() }),
      });
      const data = (await res.json()) as EECredentials & { error?: string };
      if (!res.ok) {
        setActionError(data.error || "Erro ao criar conta de E.E.");
        closeEeDialog();
        return;
      }
      setEeCredentials(data);
      // Update local student state
      setStudents((prev) =>
        prev.map((s) => (s.id === eeDialogStudentId ? { ...s, encarregadoId: data.uid } : s))
      );
    } catch {
      setActionError("Erro ao criar conta de E.E.");
      closeEeDialog();
    } finally {
      setEeLoading(false);
    }
  };

  const handleDisassociateEe = async (studentId: string) => {
    try {
      const res = await fetch(`/api/encarregado?studentId=${studentId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setActionError(data.error || "Erro ao desassociar conta de E.E.");
        return;
      }
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, encarregadoId: null } : s))
      );
      setActionSuccess("Conta de E.E. desassociada com sucesso.");
    } catch {
      setActionError("Erro ao desassociar conta de E.E.");
    }
  };

  const handleDeleteEeAccount = async (studentId: string, eeUid: string) => {
    try {
      const res = await fetch(`/api/encarregado/delete-ee`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eeUid })
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setActionError(data.error || "Erro ao eliminar conta de E.E.");
        return;
      }
      setStudents((prev) =>
        prev.map((s) => (s.encarregadoId === eeUid ? { ...s, encarregadoId: null } : s))
      );
      setActionSuccess("Conta de E.E. eliminada com sucesso e desassociada de todos os educandos.");
    } catch {
      setActionError("Erro ao eliminar conta de E.E.");
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch { /* ignore */ }
  };

  const openEeSearch = (studentId: string) => {
    setEeSearchStudentId(studentId);
    setEeSearchTerm("");
    setEeSearchResults([]);
    setEeSearchError(null);
    setEeSearchOpen(true);
    fetchEeSearch("");
  };

  const closeEeSearch = () => {
    setEeSearchOpen(false);
    setEeSearchStudentId(null);
  };

  const fetchEeSearch = async (q: string) => {
    setEeSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/encarregado/search?${params.toString()}`);
      const json = (await res.json()) as { ok: boolean; ees: { uid: string; nome: string; email: string; educandosCount: number }[] };
      if (json.ok) {
        setEeSearchResults(json.ees);
      }
    } catch { /* ignore */ } finally {
      setEeSearchLoading(false);
    }
  };

  const handleAssociateEe = async (eeUid: string) => {
    if (!eeSearchStudentId) return;
    setEeSearchError(null);
    try {
      const res = await fetch("/api/encarregado/associate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: eeSearchStudentId, eeUid }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setEeSearchError(data.error || "Erro ao associar.");
        return;
      }
      setStudents((prev) =>
        prev.map((s) => (s.id === eeSearchStudentId ? { ...s, encarregadoId: eeUid } : s))
      );
      closeEeSearch();
    } catch {
      setEeSearchError("Erro de rede. Tenta novamente.");
    }
  };

  const openManageDialog = (mode: "change-course" | "remove-student") => {
    setManageMode(mode);
    setIsManageDialogOpen(true);
    setDialogSearchTerm("");
    setSelectedStudentId("");
    setSelectedCourseId("");
    setActionError("");
    setActionSuccess("");
  };

  const selectedStudent = students.find((item) => item.id === selectedStudentId) || null;
  const selectedStudentInternshipStatus = selectedStudent
    ? studentInternshipStatus[selectedStudent.id] || INTERNSHIP_STATUS_NONE
    : INTERNSHIP_STATUS_NONE;

  const filteredDialogStudents = useMemo(() => {
    const normalized = dialogSearchTerm.trim().toLowerCase();
    if (!normalized) {
      return students;
    }

    return students.filter(
      (student) =>
        student.nome.toLowerCase().includes(normalized) ||
        student.email.toLowerCase().includes(normalized) ||
        student.curso.toLowerCase().includes(normalized)
    );
  }, [dialogSearchTerm, students]);

  const confirmManageAction = async () => {
    if (!selectedStudent) {
      setActionError("Selecione um aluno.");
      return;
    }

    setActionError("");
    setActionSuccess("");

    if (manageMode === "change-course") {
      if (selectedStudentInternshipStatus === INTERNSHIP_STATUS_ACTIVE) {
        setActionError("Não é possível trocar a turma: o aluno tem um estágio ativo.");
        return;
      }

      if (!selectedCourseId) {
        setActionError("Selecione a nova turma.");
        return;
      }

      if (selectedCourseId === selectedStudent.courseId) {
        setActionError("A nova turma deve ser diferente da turma atual.");
        return;
      }

      const nextCourse = courses.find((course) => course.id === selectedCourseId);
      if (!nextCourse) {
        setActionError("Turma inválida.");
        return;
      }

      setChangingStudentId(selectedStudent.id);
      try {
        const db = await getDbRuntime();
        await updateDoc(doc(db, "users", selectedStudent.id), {
          courseId: selectedCourseId,
          curso: nextCourse.name,
          updatedAt: serverTimestamp(),
        });

        setStudents((prev) =>
          prev.map((item) =>
            item.id === selectedStudent.id
              ? {
                  ...item,
                  courseId: selectedCourseId,
                  curso: nextCourse.name,
                }
              : item
          )
        );

        setActionSuccess(`Turma de ${selectedStudent.nome} atualizada para ${nextCourse.name}.`);
        setIsManageDialogOpen(false);
      } catch (error) {
        console.error("Erro ao alterar turma do aluno:", error);
        setActionError("Não foi possível alterar a turma do aluno.");
      } finally {
        setChangingStudentId(null);
      }
      return;
    }

    if (manageMode === "remove-student") {
      if (selectedStudentInternshipStatus === INTERNSHIP_STATUS_ACTIVE) {
        setActionError("Não é possível remover o aluno enquanto houver estágio ativo.");
        return;
      }

      setChangingStudentId(selectedStudent.id);
      try {
        const db = await getDbRuntime();
        await updateDoc(doc(db, "users", selectedStudent.id), {
          estado: "inativo",
          updatedAt: serverTimestamp(),
        });

        setStudents((prev) => prev.filter((item) => item.id !== selectedStudent.id));
        setStudentInternshipStatus((prev) => {
          const next = { ...prev };
          delete next[selectedStudent.id];
          return next;
        });

        setActionSuccess(`Aluno ${selectedStudent.nome} marcado como inativo com sucesso.`);
        setIsManageDialogOpen(false);
      } catch (error) {
        console.error("Erro ao remover aluno:", error);
        setActionError("Não foi possível remover o aluno.");
      } finally {
        setChangingStudentId(null);
      }
    }
  };

  const getStatusBadgeVariant = (status: InternshipStatusLabel): "outline" | "secondary" => {
    return status === INTERNSHIP_STATUS_ACTIVE ? "outline" : "secondary";
  };

  const filteredStudents = students.filter(
    (student) =>
      student.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.curso.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.localidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.telefone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Alunos</h1>
        <p className="text-muted-foreground">
          Lista de alunos aprovados associados à sua escola{schoolName ? `, ${schoolName}` : ""}.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome, email, curso ou localidade..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Alunos Aprovados</CardTitle>
            <CardDescription>
              {loading ? "A carregar..." : `${filteredStudents.length} aluno(s) ativo(s)`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              data-testid="open-change-course-dialog"
              onClick={() => openManageDialog("change-course")}
              disabled={loading || students.length === 0}
            >
              Trocar turma de aluno
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="open-remove-student-dialog"
              onClick={() => openManageDialog("remove-student")}
              disabled={loading || students.length === 0}
            >
              Remover aluno
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Dialog
            open={isManageDialogOpen}
            onOpenChange={(open) => {
              if (!open && changingStudentId === null) {
                setIsManageDialogOpen(false);
                setManageMode(null);
              }
            }}
          >
            <DialogContent showCloseButton={changingStudentId === null}>
              <DialogHeader>
                <DialogTitle>
                  {manageMode === "change-course" ? "Trocar turma de aluno" : "Remover aluno"}
                </DialogTitle>
                <DialogDescription>
                  Pesquise e selecione o aluno para concluir a ação.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <Input
                  data-testid="manage-student-search"
                  placeholder="Pesquisar por nome, email ou turma..."
                  value={dialogSearchTerm}
                  onChange={(event) => setDialogSearchTerm(event.target.value)}
                />

                <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                  {filteredDialogStudents.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredDialogStudents.map((student) => {
                        const status = studentInternshipStatus[student.id] || INTERNSHIP_STATUS_NONE;
                        const selected = selectedStudentId === student.id;
                        return (
                          <button
                            key={student.id}
                            type="button"
                            data-testid={`select-student-${student.id}`}
                            className={`w-full px-3 py-2 text-left text-sm ${selected ? "bg-muted" : "hover:bg-muted/40"}`}
                            onClick={() => {
                              setSelectedStudentId(student.id);
                              setSelectedCourseId(student.courseId || "");
                            }}
                          >
                            <p className="font-medium text-foreground">{student.nome}</p>
                            <p className="text-xs text-muted-foreground">{student.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Turma: {student.curso} | {status}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {manageMode === "change-course" && selectedStudent ? (
                  <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-sm">
                      <span className="font-medium">Turma atual:</span> {selectedStudent.curso}
                    </p>
                    <select
                      data-testid="dialog-course-select"
                      className="h-9 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                      value={selectedCourseId}
                      onChange={(event) => setSelectedCourseId(event.target.value)}
                    >
                      <option value="">Selecionar nova turma</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {manageMode === "remove-student" && selectedStudent ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                    <p className="text-sm text-destructive">
                      O aluno selecionado será removido da lista de alunos aprovados desta escola.
                    </p>
                  </div>
                ) : null}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsManageDialogOpen(false)}
                  disabled={changingStudentId !== null}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  data-testid="manage-student-confirm"
                  onClick={() => {
                    void confirmManageAction();
                  }}
                  disabled={changingStudentId !== null}
                >
                  {changingStudentId
                    ? "A atualizar..."
                    : manageMode === "change-course"
                    ? "Confirmar troca"
                    : "Confirmar remoção"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {actionError ? (
            <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
            </p>
          ) : null}

          {actionSuccess ? (
            <p className="mb-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              {actionSuccess}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar alunos...</p>
          ) : filteredStudents.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Não existem alunos aprovados para apresentar.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
                <table className="w-full min-w-[1120px] border-collapse text-sm">
                  <thead className="bg-muted/40 text-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Nome</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Turma</th>
                      <th className="px-4 py-3 text-left">Localidade</th>
                      <th className="px-4 py-3 text-left">Telefone</th>
                      <th className="px-4 py-3 text-left">Nascimento</th>
                      <th className="px-4 py-3 text-left">Registo</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-left">E.E.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => {
                      const status = studentInternshipStatus[student.id] || INTERNSHIP_STATUS_NONE;
                      return (
                        <tr key={student.id} className="border-t border-border align-top">
                          <td className="px-4 py-3">
                            <p className="max-w-[220px] truncate font-medium text-foreground">{student.nome}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <p className="max-w-[260px] truncate">{student.email}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{student.curso}</td>
                          <td className="px-4 py-3 text-muted-foreground">{student.localidade}</td>
                          <td className="px-4 py-3 text-muted-foreground">{student.telefone}</td>
                          <td className="px-4 py-3 text-muted-foreground">{student.dataNascimento}</td>
                          <td className="px-4 py-3 text-muted-foreground">{student.createdAt}</td>
                          <td className="px-4 py-3">
                            <Badge variant={getStatusBadgeVariant(status)}>{status}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {student.encarregadoId ? (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-sm font-medium text-foreground">{student.encarregadoNome || "—"}</span>
                                <div className="flex flex-wrap items-center gap-1">
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700 h-6 px-1.5 text-xs">
                                        <UserMinus className="h-3 w-3 mr-1" />
                                        Desassociar
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Desassociar conta de E.E.</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          A conta de Encarregado de Educação deixará de estar associada a <strong>{student.nome}</strong>. O E.E. continuará a existir para outros educandos (caso tenha).
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => void handleDisassociateEe(student.id)}>
                                          Confirmar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-6 px-1.5 text-xs">
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Eliminar
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Eliminar conta de E.E.</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Vai eliminar permanentemente a conta de Encarregado de Educação associada a <strong>{student.nome}</strong>. O E.E. perderá o acesso e será desassociado de todos os seus educandos. Esta ação é irreversível.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => { if(student.encarregadoId) void handleDeleteEeAccount(student.id, student.encarregadoId); }}>
                                          Confirmar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            ) : calculateAge(student.dataNascimento) < 18 ? (
                              <div className="flex flex-col gap-1">
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-blue-600 hover:text-blue-700 justify-start" onClick={() => openEeDialog(student.id)}>
                                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                                  Criar E.E.
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground justify-start" onClick={() => openEeSearch(student.id)}>
                                  <Search className="h-3.5 w-3.5 mr-1" />
                                  Associar E.E.
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredStudents.map((student) => (
                <div key={student.id} className="rounded-lg border border-border p-4 md:hidden">
                  <div className="space-y-3 md:hidden">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-foreground">{student.nome}</h4>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                    </div>
                    <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>Turma atual: {student.curso}</p>
                      <p>Estado: {studentInternshipStatus[student.id] || INTERNSHIP_STATUS_NONE}</p>
                      <p>Localidade: {student.localidade}</p>
                      <p>Telefone: {student.telefone}</p>
                      <p>Nascimento: {student.dataNascimento}</p>
                      <p>Registado em: {student.createdAt}</p>
                      <p>E.E.: {student.encarregadoId ? student.encarregadoNome : "Não associado"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                      {student.encarregadoId ? (
                        <>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700 h-7 px-2">
                                <UserMinus className="h-3.5 w-3.5 mr-1" />
                                Desassociar E.E.
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Desassociar conta de E.E.</AlertDialogTitle>
                                <AlertDialogDescription>
                                  A conta de Encarregado de Educação deixará de estar associada a <strong>{student.nome}</strong>. O E.E. continuará a existir para outros educandos (caso tenha).
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void handleDisassociateEe(student.id)}>
                                  Confirmar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 px-2">
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Eliminar E.E.
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar conta de E.E.</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Vai eliminar permanentemente a conta de Encarregado de Educação associada a <strong>{student.nome}</strong>. O E.E. perderá o acesso e será desassociado de todos os seus educandos. Esta ação é irreversível.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => { if(student.encarregadoId) void handleDeleteEeAccount(student.id, student.encarregadoId); }}>
                                  Confirmar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : calculateAge(student.dataNascimento) < 18 ? (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-blue-600 hover:text-blue-700" onClick={() => openEeDialog(student.id)}>
                            <UserPlus className="h-3.5 w-3.5 mr-1" />
                            Criar E.E.
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => openEeSearch(student.id)}>
                            <Search className="h-3.5 w-3.5 mr-1" />
                            Associar E.E.
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground px-2">—</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* EE Account Creation Dialog */}
      <Dialog open={!!eeDialogStudentId} onOpenChange={(open) => { if (!open) closeEeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar conta de Encarregado de Educação</DialogTitle>
            <DialogDescription>
              Insira o nome completo do Encarregado de Educação. Serão geradas credenciais de acesso automaticamente.
            </DialogDescription>
          </DialogHeader>

          {!eeCredentials ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="ee-nome-approved">Nome do Encarregado de Educação</Label>
                <Input
                  id="ee-nome-approved"
                  placeholder="Ex: Maria da Silva"
                  value={eeNome}
                  onChange={(e) => setEeNome(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreateEe(); }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeEeDialog}>Cancelar</Button>
                <Button onClick={() => void handleCreateEe()} disabled={eeLoading || eeNome.trim().length < 2}>
                  {eeLoading ? "A criar..." : "Criar conta"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 p-3">
                <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
                <p className="text-sm text-green-700 font-medium">
                  Conta criada para <strong>{eeCredentials.nome}</strong>.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Partilhe estas credenciais com o E.E. A password não poderá ser recuperada após fechar.</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">{eeCredentials.email}</code>
                    <Button variant="ghost" size="sm" onClick={() => void copyToClipboard(eeCredentials!.email, "email")}>
                      {copiedField === "email" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Password</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">{eeCredentials.password}</code>
                    <Button variant="ghost" size="sm" onClick={() => void copyToClipboard(eeCredentials!.password, "password")}>
                      {copiedField === "password" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={closeEeDialog}>Concluído</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* EE Associate Search Dialog */}
      <Dialog open={eeSearchOpen} onOpenChange={(open) => { if (!open) closeEeSearch(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Associar Encarregado de Educação existente</DialogTitle>
            <DialogDescription>
              Pesquise um Encarregado de Educação já registado na escola para associar a este aluno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome ou email..."
                value={eeSearchTerm}
                onChange={(e) => {
                  setEeSearchTerm(e.target.value);
                  fetchEeSearch(e.target.value);
                }}
                className="pl-9"
              />
            </div>
            {eeSearchError ? (
              <p className="text-sm text-destructive">{eeSearchError}</p>
            ) : null}
            {eeSearchLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">A pesquisar...</p>
            ) : eeSearchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {eeSearchTerm ? "Nenhum EE encontrado." : "A pesquisar todos os EE da escola..."}
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {eeSearchResults.map((ee) => (
                  <div
                    key={ee.uid}
                    className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-medium truncate">{ee.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{ee.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {ee.educandosCount} educando{ee.educandosCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => handleAssociateEe(ee.uid)}
                    >
                      Associar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
