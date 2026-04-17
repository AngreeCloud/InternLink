"use client";

import { useEffect, useState } from "react";
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
  hasActiveInternshipForStudent,
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

type CourseOption = {
  id: string;
  name: string;
};

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
  const [studentsWithActiveInternship, setStudentsWithActiveInternship] = useState<string[]>([]);
  const [changingStudentId, setChangingStudentId] = useState<string | null>(null);
  const [pendingCourseChange, setPendingCourseChange] = useState<{
    studentId: string;
    nextCourseId: string;
    nextCourseName: string;
  } | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

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
        setStudentsWithActiveInternship([]);
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));

      if (!userSnap.exists()) {
        setStudents([]);
        setCourses([]);
        setStudentsWithActiveInternship([]);
        return;
      }

      const userData = userSnap.data() as { schoolId?: string; escola?: string };
      setSchoolName(userData.escola || "");

      if (!userData.schoolId) {
        setStudents([]);
        setCourses([]);
        setStudentsWithActiveInternship([]);
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

      const lockedStudentIds = list
        .filter((student) => hasActiveInternshipForStudent(internships, student.id))
        .map((student) => student.id);
      setStudentsWithActiveInternship(lockedStudentIds);
    } catch (error) {
      console.error("Erro ao carregar alunos aprovados:", error);
      setStudents([]);
      setCourses([]);
      setStudentsWithActiveInternship([]);
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

  const handleCourseChange = async (studentId: string, nextCourseId: string) => {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;

    setActionError("");
    setActionSuccess("");

    if (studentsWithActiveInternship.includes(studentId)) {
      setActionError("Não é possível trocar a turma: o aluno já tem um estágio ativo. Elimine o estágio primeiro.");
      return;
    }

    if (!nextCourseId || nextCourseId === student.courseId) {
      return;
    }

    const nextCourse = courses.find((course) => course.id === nextCourseId);
    if (!nextCourse) {
      setActionError("Turma inválida.");
      return;
    }

    setPendingCourseChange({
      studentId,
      nextCourseId,
      nextCourseName: nextCourse.name,
    });
  };

  const confirmCourseChange = async () => {
    if (!pendingCourseChange) {
      return;
    }

    const { studentId, nextCourseId, nextCourseName } = pendingCourseChange;
    const student = students.find((item) => item.id === studentId);
    if (!student) return;

    setActionError("");
    setActionSuccess("");

    if (studentsWithActiveInternship.includes(studentId)) {
      setActionError("Não é possível trocar a turma: o aluno já tem um estágio ativo. Elimine o estágio primeiro.");
      return;
    }

    setChangingStudentId(studentId);
    try {
      const db = await getDbRuntime();
      await updateDoc(doc(db, "users", studentId), {
        courseId: nextCourseId,
        curso: nextCourseName,
        updatedAt: serverTimestamp(),
      });

      setStudents((prev) =>
        prev.map((item) =>
          item.id === studentId
            ? {
                ...item,
                courseId: nextCourseId,
                curso: nextCourseName,
              }
            : item
        )
      );

      setActionSuccess(`Turma de ${student.nome} atualizada para ${nextCourseName}.`);
      setPendingCourseChange(null);
    } catch (error) {
      console.error("Erro ao alterar turma do aluno:", error);
      setActionError("Não foi possível alterar a turma do aluno.");
    } finally {
      setChangingStudentId(null);
    }
  };

  const pendingStudent = pendingCourseChange
    ? students.find((student) => student.id === pendingCourseChange.studentId)
    : null;

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
        <CardHeader>
          <CardTitle>Alunos Aprovados</CardTitle>
          <CardDescription>
            {loading ? "A carregar..." : `${filteredStudents.length} aluno(s) ativo(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog
            open={Boolean(pendingCourseChange)}
            onOpenChange={(open) => {
              if (!open && changingStudentId === null) {
                setPendingCourseChange(null);
              }
            }}
          >
            <DialogContent showCloseButton={changingStudentId === null}>
              <DialogHeader>
                <DialogTitle>Confirmar troca de turma</DialogTitle>
                <DialogDescription>
                  Esta ação atualiza a turma do aluno e altera a contagem de inscritos entre turmas.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p>
                  <span className="font-medium">Aluno:</span> {pendingStudent?.nome || "—"}
                </p>
                <p>
                  <span className="font-medium">Turma atual:</span> {pendingStudent?.curso || "—"}
                </p>
                <p>
                  <span className="font-medium">Nova turma:</span> {pendingCourseChange?.nextCourseName || "—"}
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPendingCourseChange(null)}
                  disabled={changingStudentId !== null}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  data-testid="confirm-course-change"
                  onClick={() => {
                    void confirmCourseChange();
                  }}
                  disabled={changingStudentId !== null}
                >
                  {changingStudentId ? "A atualizar..." : "Confirmar troca"}
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
                      const hasActiveInternship = studentsWithActiveInternship.includes(student.id);
                      const changing = changingStudentId === student.id;
                      return (
                        <tr key={student.id} className="border-t border-border align-top">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <p className="max-w-[220px] truncate font-medium text-foreground">{student.nome}</p>
                              <Badge variant="secondary">Ativo</Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <p className="max-w-[260px] truncate">{student.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              data-testid={`course-select-desktop-${student.id}`}
                              className="h-9 w-full min-w-[190px] rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                              value={student.courseId}
                              onChange={(event) => {
                                handleCourseChange(student.id, event.target.value);
                              }}
                              disabled={hasActiveInternship || changing || courses.length === 0}
                            >
                              {courses.length === 0 ? <option value="">Sem turmas</option> : null}
                              {courses.map((course) => (
                                <option key={course.id} value={course.id}>
                                  {course.name}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-xs text-muted-foreground">Atual: {student.curso}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{student.localidade}</td>
                          <td className="px-4 py-3 text-muted-foreground">{student.telefone}</td>
                          <td className="px-4 py-3 text-muted-foreground">{student.dataNascimento}</td>
                          <td className="px-4 py-3 text-muted-foreground">{student.createdAt}</td>
                          <td className="px-4 py-3">
                            {hasActiveInternship ? (
                              <Badge variant="outline">Estágio ativo</Badge>
                            ) : (
                              <Badge variant="secondary">Pode trocar turma</Badge>
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
                  {(() => {
                    const hasActiveInternship = studentsWithActiveInternship.includes(student.id);
                    const changing = changingStudentId === student.id;

                    return (
                  <div className="space-y-3 md:hidden">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-foreground">{student.nome}</h4>
                        <Badge variant="secondary">Ativo</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Turma</label>
                      <select
                        data-testid={`course-select-mobile-${student.id}`}
                        className="h-9 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                        value={student.courseId}
                        onChange={(event) => {
                          handleCourseChange(student.id, event.target.value);
                        }}
                        disabled={hasActiveInternship || changing || courses.length === 0}
                      >
                        {courses.length === 0 ? <option value="">Sem turmas</option> : null}
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.name}
                          </option>
                        ))}
                      </select>
                      {hasActiveInternship ? (
                        <p className="text-xs text-amber-700">
                          Estágio ativo: elimine o estágio para trocar a turma.
                        </p>
                      ) : null}
                    </div>
                    <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>Turma atual: {student.curso}</p>
                      <p>Localidade: {student.localidade}</p>
                      <p>Telefone: {student.telefone}</p>
                      <p>Nascimento: {student.dataNascimento}</p>
                      <p>Registado em: {student.createdAt}</p>
                    </div>
                  </div>
                    );
                  })()}

                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}