"use client";

import { useEffect, useRef, useState } from "react";
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
import { ensureOrgMemberIndexByUserId } from "@/lib/chat/realtime-chat";
import { resolveStudentCourseId, resolveStudentCourseName } from "@/lib/course-enrollment";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserCheck, UserX, Search, ShieldCheck, Copy, Check, UserPlus } from "lucide-react";

type PendingStudent = {
  id: string;
  nome: string;
  email: string;
  curso: string;
  courseId: string;
  dataNascimento: string;
  createdAt: string;
};

type CourseAccess = {
  id: string;
  name: string;
  teacherIds: string[];
  supportingTeacherIds: string[];
  courseDirectorId: string | null;
};

type EECredentials = {
  uid: string;
  nome: string;
  email: string;
  password: string;
};

function calculateAge(dataNascimento: string): number {
  if (!dataNascimento || dataNascimento === "—") return 99;
  const birth = new Date(dataNascimento);
  if (isNaN(birth.getTime())) return 99;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function PendingStudentsManager() {
  const [students, setStudents] = useState<PendingStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [schoolCourses, setSchoolCourses] = useState<Array<{ id: string; name: string }>>([]);

  // EE creation dialog state
  const [eeDialogOpen, setEeDialogOpen] = useState(false);
  const [eeTargetStudentId, setEeTargetStudentId] = useState<string | null>(null);
  const [eeNome, setEeNome] = useState("");
  const [eeLoading, setEeLoading] = useState(false);
  const [eeCredentials, setEeCredentials] = useState<EECredentials | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const eeNomeRef = useRef<HTMLInputElement>(null);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();
      const user = auth.currentUser;
      if (!user) {
        setStudents([]);
        setSchoolCourses([]);
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (!userSnap.exists()) {
        setStudents([]);
        setSchoolCourses([]);
        return;
      }
      const userData = userSnap.data() as { schoolId?: string };
      if (!userData.schoolId) {
        setStudents([]);
        setSchoolCourses([]);
        return;
      }

      const coursesSnap = await getDocs(
        query(
          collection(db, "courses"),
          where("schoolId", "==", userData.schoolId)
        )
      );

      const allCourses = coursesSnap.docs.map((docSnap) => {
        const data = docSnap.data() as {
          name?: string;
          teacherIds?: string[];
          supportingTeacherIds?: string[];
          courseDirectorId?: string | null;
        };

        return {
          id: docSnap.id,
          name: data.name || "—",
          teacherIds: Array.isArray(data.teacherIds) ? data.teacherIds : [],
          supportingTeacherIds: Array.isArray(data.supportingTeacherIds) ? data.supportingTeacherIds : [],
          courseDirectorId:
            typeof data.courseDirectorId === "string" && data.courseDirectorId
              ? data.courseDirectorId
              : null,
        };
      });

      const allowedCourses = allCourses
        .filter((course) => {
          if (course.courseDirectorId === user.uid) {
            return true;
          }

          return (
            course.teacherIds.includes(user.uid)
            || course.supportingTeacherIds.includes(user.uid)
          );
        })
        .map((course) => ({ id: course.id, name: course.name }))
        .sort((left, right) => left.name.localeCompare(right.name, "pt-PT"));

      setSchoolCourses(allowedCourses);
      const allowedCourseIds = new Set(allowedCourses.map((course) => course.id));

      const pendingSnap = await getDocs(
        query(
          collection(db, "users"),
          where("schoolId", "==", userData.schoolId),
          where("role", "==", "aluno"),
          where("estado", "==", "pendente")
        )
      );

      const list: PendingStudent[] = pendingSnap.docs
        .map((docSnap) => {
        const data = docSnap.data() as {
          nome?: string;
          email?: string;
          curso?: string;
          courseId?: string;
          dataNascimento?: string;
          createdAt?: { toDate: () => Date };
        };

        const resolvedCourseId = resolveStudentCourseId(
          {
            courseId: data.courseId || "",
            curso: data.curso || "",
          },
          allCourses.map((course) => ({ id: course.id, name: course.name }))
        );

        if (!resolvedCourseId || !allowedCourseIds.has(resolvedCourseId)) {
          return null;
        }

        return {
          id: docSnap.id,
          nome: data.nome || "—",
          email: data.email || "—",
          curso: resolveStudentCourseName(
            resolvedCourseId,
            allCourses.map((course) => ({ id: course.id, name: course.name })),
            data.curso || ""
          ),
          courseId: resolvedCourseId,
          dataNascimento: data.dataNascimento || "—",
          createdAt: data.createdAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
        };
      })
        .filter((student): student is PendingStudent => Boolean(student));

      setStudents(list);
    } catch (error) {
      console.error("Erro ao carregar alunos pendentes:", error);
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

  const handleApprove = async (studentId: string) => {
    setActionLoading(studentId);
    try {
      const db = await getDbRuntime();
      const student = students.find((item) => item.id === studentId);
      const resolvedCourseId = resolveStudentCourseId(
        {
          courseId: student?.courseId || "",
          curso: student?.curso || "",
        },
        schoolCourses
      );
      const resolvedCourseName = resolveStudentCourseName(
        resolvedCourseId,
        schoolCourses,
        student?.curso || ""
      );

      const payload: Record<string, unknown> = {
        estado: "ativo",
        updatedAt: serverTimestamp(),
      };

      if (resolvedCourseId) {
        payload.courseId = resolvedCourseId;
      }
      if (resolvedCourseName !== "—") {
        payload.curso = resolvedCourseName;
      }

      await updateDoc(doc(db, "users", studentId), payload);
      try {
        await ensureOrgMemberIndexByUserId(studentId);
      } catch (syncError) {
        console.error("Falha ao sincronizar índice de chat do aluno aprovado:", syncError);
      }
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
    } catch (error) {
      console.error("Erro ao aprovar aluno:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (studentId: string) => {
    setActionLoading(studentId);
    try {
      const db = await getDbRuntime();
      await updateDoc(doc(db, "users", studentId), { estado: "rejeitado" });
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
    } catch (error) {
      console.error("Erro ao rejeitar aluno:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const openEeDialog = (studentId: string) => {
    setEeTargetStudentId(studentId);
    setEeNome("");
    setEeCredentials(null);
    setEeDialogOpen(true);
    setTimeout(() => eeNomeRef.current?.focus(), 100);
  };

  const handleCreateEe = async () => {
    if (!eeTargetStudentId || eeNome.trim().length < 2) return;
    setEeLoading(true);
    try {
      const res = await fetch("/api/encarregado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: eeTargetStudentId, nomeEE: eeNome.trim() }),
      });
      const data = (await res.json()) as EECredentials & { error?: string };
      if (!res.ok) {
        alert(data.error || "Erro ao criar conta de E.E.");
        return;
      }
      setEeCredentials(data);
    } catch {
      alert("Erro ao criar conta de E.E.");
    } finally {
      setEeLoading(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.curso.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Aprovações de Alunos</h1>
        <p className="text-muted-foreground">Aprovar ou rejeitar alunos com acesso pendente à plataforma.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome, email ou curso..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alunos Pendentes</CardTitle>
          <CardDescription>
            {loading ? "A carregar..." : `${filteredStudents.length} aluno(s) pendente(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar alunos...</p>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Não existem alunos pendentes de aprovação.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStudents.map((student) => {
                const age = calculateAge(student.dataNascimento);
                const canCreateEE = age < 18;

                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-medium text-foreground">{student.nome}</h4>
                        <Badge variant="secondary">Pendente</Badge>
                        {age < 18 && (
                          <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                            Menor de idade
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                      <p className="text-xs text-muted-foreground">Curso: {student.curso}</p>
                      {student.dataNascimento !== "—" && (
                        <p className="text-xs text-muted-foreground">
                          Data de nascimento: {student.dataNascimento} ({age} anos)
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">Registado em: {student.createdAt}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      {canCreateEE && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-600 border-blue-400 hover:bg-blue-50 bg-transparent"
                          onClick={() => openEeDialog(student.id)}
                          disabled={actionLoading === student.id}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Criar conta E.E.
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 border-green-600 hover:bg-green-50 bg-transparent"
                        onClick={() => handleApprove(student.id)}
                        disabled={actionLoading === student.id}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
                        onClick={() => handleReject(student.id)}
                        disabled={actionLoading === student.id}
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* EE Account Creation Dialog */}
      <Dialog open={eeDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEeDialogOpen(false);
          setEeCredentials(null);
          setEeNome("");
          setEeTargetStudentId(null);
        }
      }}>
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
                <Label htmlFor="ee-nome">Nome do Encarregado de Educação</Label>
                <Input
                  id="ee-nome"
                  ref={eeNomeRef}
                  placeholder="Ex: Maria da Silva"
                  value={eeNome}
                  onChange={(e) => setEeNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateEe();
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEeDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateEe}
                  disabled={eeLoading || eeNome.trim().length < 2}
                >
                  {eeLoading ? "A criar..." : "Criar conta"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 p-3">
                <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
                <p className="text-sm text-green-700 font-medium">
                  Conta criada com sucesso para <strong>{eeCredentials.nome}</strong>.
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                Partilhe estas credenciais com o Encarregado de Educação. A password não poderá ser recuperada após fechar este ecrã.
              </p>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                      {eeCredentials.email}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(eeCredentials.email, "email")}
                    >
                      {copiedField === "email" ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Password</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                      {eeCredentials.password}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(eeCredentials.password, "password")}
                    >
                      {copiedField === "password" ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => {
                  setEeDialogOpen(false);
                  setEeCredentials(null);
                  setEeNome("");
                  setEeTargetStudentId(null);
                }}>
                  Concluído
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
