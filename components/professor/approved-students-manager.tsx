"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import {
  normalizeInternshipState,
  resolveStudentCourseId,
  resolveStudentCourseName,
} from "@/lib/course-enrollment";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Users } from "lucide-react";

const INTERNSHIP_STATUS_ACTIVE = "Estágio ativo";
const INTERNSHIP_STATUS_COMPLETED = "Estágio concluido";
const INTERNSHIP_STATUS_NONE = "Sem estágio associado";

const ACTIVE_INTERNSHIP_STATES = new Set(["ativo", "em curso", "em_curso", "iniciado", "aberto"]);
const COMPLETED_INTERNSHIP_STATES = new Set(["concluido", "concluído", "finalizado", "terminado", "encerrado"]);

type CourseOption = {
  id: string;
  name: string;
};

type InternshipRef = {
  alunoId: string;
  estado: string;
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
  const [manageMode, setManageMode] = useState<"change-course" | "remove-student" | null>(null);
  const [dialogSearchTerm, setDialogSearchTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const resolveInternshipStatusForStudent = (
    internships: InternshipRef[],
    studentId: string
  ): InternshipStatusLabel => {
    let hasCompletedInternship = false;

    for (const internship of internships) {
      if (internship.alunoId !== studentId) {
        continue;
      }

      const normalizedState = normalizeInternshipState(internship.estado);
      if (ACTIVE_INTERNSHIP_STATES.has(normalizedState)) {
        return INTERNSHIP_STATUS_ACTIVE;
      }

      if (COMPLETED_INTERNSHIP_STATES.has(normalizedState)) {
        hasCompletedInternship = true;
      }
    }

    return hasCompletedInternship ? INTERNSHIP_STATUS_COMPLETED : INTERNSHIP_STATUS_NONE;
  };

  const loadStudents = async () => {
    setLoading(true);
    setActionError("");

    try {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();
      const user = auth.currentUser;

      if (!user) {
        setStudents([]);
        setCourses([]);
        setStudentInternshipStatus({});
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));

      if (!userSnap.exists()) {
        setStudents([]);
        setCourses([]);
        setStudentInternshipStatus({});
        return;
      }

      const userData = userSnap.data() as { schoolId?: string; escola?: string };
      setSchoolName(userData.escola || "");

      if (!userData.schoolId) {
        setStudents([]);
        setCourses([]);
        setStudentInternshipStatus({});
        return;
      }

      const coursesSnap = await getDocs(
        query(
          collection(db, "courses"),
          where("schoolId", "==", userData.schoolId)
        )
      );

      const availableCourses: CourseOption[] = coursesSnap.docs.map((docSnap) => {
        const data = docSnap.data() as { name?: string };
        return {
          id: docSnap.id,
          name: data.name || "—",
        };
      }).sort((left, right) => left.name.localeCompare(right.name, "pt-PT"));

      setCourses(availableCourses);

      const approvedSnap = await getDocs(
        query(
          collection(db, "users"),
          where("schoolId", "==", userData.schoolId),
          where("role", "==", "aluno"),
          where("estado", "==", "ativo")
        )
      );

      const internshipsSnap = await getDocs(
        query(
          collection(db, "estagios"),
          where("professorId", "==", user.uid),
          where("schoolId", "==", userData.schoolId)
        )
      );

      const internships = internshipsSnap.docs.map((docSnap) => {
        const data = docSnap.data() as { alunoId?: string; estado?: string };
        return {
          alunoId: data.alunoId || "",
          estado: data.estado || "ativo",
        };
      });

      const list = approvedSnap.docs
        .map((docSnap) => {
          const data = docSnap.data() as {
            nome?: string;
            email?: string;
            courseId?: string;
            curso?: string;
            localidade?: string;
            telefone?: string;
            dataNascimento?: string;
            createdAt?: { toDate: () => Date };
          };

          const resolvedCourseId = resolveStudentCourseId(
            {
              courseId: data.courseId || "",
              curso: data.curso || "",
            },
            availableCourses
          );

          return {
            id: docSnap.id,
            nome: data.nome || "—",
            email: data.email || "—",
            courseId: resolvedCourseId || "",
            curso: resolveStudentCourseName(resolvedCourseId, availableCourses, data.curso || ""),
            localidade: data.localidade || "—",
            telefone: data.telefone || "—",
            dataNascimento: data.dataNascimento || "—",
            createdAt: data.createdAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
          };
        })
        .sort((left, right) => left.nome.localeCompare(right.nome, "pt-PT"));

      setStudents(list);

      const statusByStudent: Record<string, InternshipStatusLabel> = {};
      for (const student of list) {
        statusByStudent[student.id] = resolveInternshipStatusForStudent(internships, student.id);
      }
      setStudentInternshipStatus(statusByStudent);
    } catch (error) {
      console.error("Erro ao carregar alunos aprovados:", error);
      setStudents([]);
      setCourses([]);
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
        loadStudents();
      });
    })();

    return () => unsubscribe();
  }, []);

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
    if (status === INTERNSHIP_STATUS_ACTIVE) {
      return "outline";
    }

    return "secondary";
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
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                    <p>
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
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}