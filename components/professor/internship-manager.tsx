"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Briefcase, DoorOpen, Mail, Pencil, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";

type Estagio = {
  id: string;
  titulo: string;
  alunoId: string;
  alunoNome: string;
  alunoEmail: string;
  alunoPhotoURL: string;
  tutorId: string;
  tutorNome: string;
  tutorEmail: string;
  tutorPhotoURL: string;
  empresa: string;
  estado: string;
  createdAt: string;
};

type SimpleUser = {
  id: string;
  nome: string;
  email: string;
  photoURL: string;
};

type SchoolTutor = {
  id: string;
  nome: string;
  email: string;
  photoURL: string;
  empresa: string;
  approvedByProfessorName: string;
  joinedAt: string;
};

type TutorInvite = {
  id: string;
  nome: string;
  email: string;
  estado: string;
  professorName: string;
  createdAt: string;
  createdAtMs: number;
};

export function InternshipManager() {
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [students, setStudents] = useState<SimpleUser[]>([]);
  const [schoolTutors, setSchoolTutors] = useState<SchoolTutor[]>([]);
  const [tutorInvites, setTutorInvites] = useState<TutorInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const [schoolId, setSchoolId] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolShortName, setSchoolShortName] = useState("");
  const [professorName, setProfessorName] = useState("Professor");
  const [professorPhotoURL, setProfessorPhotoURL] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [tutorDialogOpen, setTutorDialogOpen] = useState(false);
  const [editTutorDialogOpen, setEditTutorDialogOpen] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [tutorEmailManual, setTutorEmailManual] = useState("");

  const [inviteTutorEmail, setInviteTutorEmail] = useState("");
  const [inviteTutorName, setInviteTutorName] = useState("");

  const [studentSearch, setStudentSearch] = useState("");
  const [tutorSearch, setTutorSearch] = useState("");
  const [editTutorSearch, setEditTutorSearch] = useState("");

  const [studentListOpen, setStudentListOpen] = useState(false);
  const [tutorListOpen, setTutorListOpen] = useState(false);

  const [editingEstagio, setEditingEstagio] = useState<Estagio | null>(null);
  const [editTutorId, setEditTutorId] = useState("");
  const [editTutorEmailManual, setEditTutorEmailManual] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [updatingTutor, setUpdatingTutor] = useState(false);
  const [removingInviteId, setRemovingInviteId] = useState<string | null>(null);
  const [removingSchoolTutorId, setRemovingSchoolTutorId] = useState<string | null>(null);
  const [confirmRemoveTutor, setConfirmRemoveTutor] = useState<SchoolTutor | null>(null);

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (student) =>
        student.nome.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term)
    );
  }, [students, studentSearch]);

  const filteredTutors = useMemo(() => {
    const term = tutorSearch.trim().toLowerCase();
    if (!term) return schoolTutors;
    return schoolTutors.filter(
      (tutor) =>
        tutor.nome.toLowerCase().includes(term) ||
        tutor.email.toLowerCase().includes(term) ||
        tutor.empresa.toLowerCase().includes(term)
    );
  }, [schoolTutors, tutorSearch]);

  const filteredEditTutors = useMemo(() => {
    const term = editTutorSearch.trim().toLowerCase();
    if (!term) return schoolTutors;
    return schoolTutors.filter(
      (tutor) =>
        tutor.nome.toLowerCase().includes(term) ||
        tutor.email.toLowerCase().includes(term) ||
        tutor.empresa.toLowerCase().includes(term)
    );
  }, [schoolTutors, editTutorSearch]);

  const selectedStudent = students.find((student) => student.id === alunoId) || null;
  const selectedTutor = schoolTutors.find((tutor) => tutor.id === tutorId) || null;
  const selectedEditTutor = schoolTutors.find((tutor) => tutor.id === editTutorId) || null;
  const pendingInvites = tutorInvites.filter((invite) => invite.estado === "pendente");
  const pendingInvitesCount = pendingInvites.length;

  const loadData = async () => {
    setLoading(true);
    try {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();
      const user = auth.currentUser;
      if (!user) return;

      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (!userSnap.exists()) return;
      const userData = userSnap.data() as {
        schoolId?: string;
        nome?: string;
        photoURL?: string;
      };
      if (!userData.schoolId) return;

      setSchoolId(userData.schoolId);
      setProfessorName(userData.nome || user.displayName || "Professor");
      setProfessorPhotoURL(userData.photoURL || "");

      const schoolSnap = await getDoc(doc(db, "schools", userData.schoolId));
      if (schoolSnap.exists()) {
        const schoolData = schoolSnap.data() as { name?: string; shortName?: string };
        setSchoolName(schoolData.name || "");
        setSchoolShortName(schoolData.shortName || "");
      } else {
        setSchoolName("");
        setSchoolShortName("");
      }

      try {
        const estagiosSnap = await getDocs(
          query(
            collection(db, "estagios"),
            where("professorId", "==", user.uid),
            where("schoolId", "==", userData.schoolId)
          )
        );
        const list: Estagio[] = estagiosSnap.docs.map((docSnap) => {
          const data = docSnap.data() as {
            titulo?: string;
            alunoId?: string;
            alunoNome?: string;
            alunoEmail?: string;
            alunoPhotoURL?: string;
            tutorId?: string;
            tutorNome?: string;
            tutorEmail?: string;
            tutorPhotoURL?: string;
            empresa?: string;
            estado?: string;
            createdAt?: { toDate: () => Date };
          };
          return {
            id: docSnap.id,
            titulo: data.titulo || "—",
            alunoId: data.alunoId || "",
            alunoNome: data.alunoNome || "—",
            alunoEmail: data.alunoEmail || "—",
            alunoPhotoURL: data.alunoPhotoURL || "",
            tutorId: data.tutorId || "",
            tutorNome: data.tutorNome || "—",
            tutorEmail: data.tutorEmail || "",
            tutorPhotoURL: data.tutorPhotoURL || "",
            empresa: data.empresa || "—",
            estado: data.estado || "ativo",
            createdAt: data.createdAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
          };
        });
        setEstagios(list);
      } catch {
        // ignore
      }

      try {
        const studentsSnap = await getDocs(
          query(
            collection(db, "users"),
            where("schoolId", "==", userData.schoolId),
            where("role", "==", "aluno"),
            where("estado", "==", "ativo")
          )
        );
        const list: SimpleUser[] = studentsSnap.docs
          .map((docSnap) => {
            const data = docSnap.data() as { nome?: string; email?: string; photoURL?: string };
            return {
              id: docSnap.id,
              nome: data.nome || "—",
              email: data.email || "—",
              photoURL: data.photoURL || "",
            };
          })
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-PT"));
        setStudents(list);
      } catch {
        // ignore
      }

      try {
        const tutorsSnap = await getDocs(collection(db, "schools", userData.schoolId, "tutors"));
        const list: SchoolTutor[] = tutorsSnap.docs
          .map((docSnap) => {
            const data = docSnap.data() as {
              nome?: string;
              email?: string;
              photoURL?: string;
              empresa?: string;
              approvedByProfessorName?: string;
              joinedAt?: { toDate: () => Date };
            };
            return {
              id: docSnap.id,
              nome: data.nome || "Tutor",
              email: data.email || "—",
              photoURL: data.photoURL || "",
              empresa: data.empresa || "—",
              approvedByProfessorName: data.approvedByProfessorName || "—",
              joinedAt: data.joinedAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
            };
          })
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-PT"));

        setSchoolTutors(list);
      } catch {
        // ignore
      }

      try {
        const invitesSnap = await getDocs(
          query(
            collection(db, "tutorInvites"),
            where("schoolId", "==", userData.schoolId),
            where("professorId", "==", user.uid)
          )
        );

        const list: TutorInvite[] = invitesSnap.docs
          .map((docSnap) => {
            const data = docSnap.data() as {
              nome?: string;
              email?: string;
              estado?: string;
              professorName?: string;
              createdAt?: { toDate: () => Date };
            };
            const createdAtDate = data.createdAt?.toDate?.() || null;
            return {
              id: docSnap.id,
              nome: data.nome || "Tutor",
              email: data.email || "—",
              estado: data.estado || "pendente",
              professorName: data.professorName || "—",
              createdAt: createdAtDate?.toLocaleDateString("pt-PT") || "—",
              createdAtMs: createdAtDate?.getTime() || 0,
            };
          })
          .sort((a, b) => b.createdAtMs - a.createdAtMs);

        setTutorInvites(list);
      } catch {
        // ignore
      }
    } catch (error) {
      console.error("Erro ao carregar estágios:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      unsubscribe = onAuthStateChanged(auth, () => {
        loadData();
      });
    })();

    return () => unsubscribe();
  }, []);

  const resetCreateForm = () => {
    setTitulo("");
    setEmpresa("");
    setAlunoId("");
    setTutorId("");
    setTutorEmailManual("");
    setStudentSearch("");
    setTutorSearch("");
    setStudentListOpen(false);
    setTutorListOpen(false);
  };

  const handleCreateEstagio = async () => {
    if (!titulo.trim() || !alunoId) return;
    setSubmitting(true);
    try {
      const db = await getDbRuntime();
      const auth = await getAuthRuntime();
      const user = auth.currentUser;
      if (!user) return;

      const selectedTutorById = schoolTutors.find((tutor) => tutor.id === tutorId) || null;
      const resolvedTutorEmail = (selectedTutorById?.email || tutorEmailManual || "").trim();

      await addDoc(collection(db, "estagios"), {
        titulo: titulo.trim(),
        schoolId,
        professorId: user.uid,
        alunoId,
        alunoNome: selectedStudent?.nome || "",
        alunoEmail: selectedStudent?.email || "",
        alunoPhotoURL: selectedStudent?.photoURL || "",
        tutorId: selectedTutorById?.id || "",
        tutorNome: selectedTutorById?.nome || "",
        tutorEmail: resolvedTutorEmail,
        tutorPhotoURL: selectedTutorById?.photoURL || "",
        empresa: empresa.trim(),
        estado: "ativo",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      resetCreateForm();
      setDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error("Erro ao criar estágio:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInviteTutor = async () => {
    if (!inviteTutorEmail.trim()) return;
    setInviting(true);
    try {
      const db = await getDbRuntime();
      const auth = await getAuthRuntime();
      const user = auth.currentUser;
      if (!user) return;

      const normalizedInviteEmail = inviteTutorEmail.trim().toLowerCase();
      const defaultTutorName = normalizedInviteEmail.split("@")[0] || "Tutor";

      await addDoc(collection(db, "tutorInvites"), {
        email: normalizedInviteEmail,
        emailNormalized: normalizedInviteEmail,
        nome: inviteTutorName.trim() || defaultTutorName,
        schoolId,
        schoolName,
        schoolShortName,
        professorId: user.uid,
        professorName,
        professorPhotoURL,
        estado: "pendente",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setInviteTutorEmail("");
      setInviteTutorName("");
      setTutorDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error("Erro ao convidar tutor:", error);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveInvite = async (inviteId: string) => {
    setRemovingInviteId(inviteId);
    try {
      const db = await getDbRuntime();
      await deleteDoc(doc(db, "tutorInvites", inviteId));
      setTutorInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
    } catch (error) {
      console.error("Erro ao remover convite:", error);
    } finally {
      setRemovingInviteId(null);
    }
  };

  const handleRemoveSchoolTutor = async (schoolTutorId: string) => {
    if (!schoolId) return;

    setRemovingSchoolTutorId(schoolTutorId);
    try {
      const db = await getDbRuntime();
      await deleteDoc(doc(db, "schools", schoolId, "tutors", schoolTutorId));
      setSchoolTutors((prev) => prev.filter((tutor) => tutor.id !== schoolTutorId));
    } catch (error) {
      console.error("Erro ao remover tutor do sistema da escola:", error);
    } finally {
      setRemovingSchoolTutorId(null);
    }
  };

  const openEditTutorDialog = (estagio: Estagio) => {
    setEditingEstagio(estagio);
    setEditTutorId(estagio.tutorId || "");
    setEditTutorEmailManual(estagio.tutorEmail || "");
    setEditTutorSearch("");
    setEditTutorDialogOpen(true);
  };

  const handleSaveTutorAssignment = async () => {
    if (!editingEstagio) return;

    setUpdatingTutor(true);
    try {
      const db = await getDbRuntime();
      const selectedTutorById = schoolTutors.find((tutor) => tutor.id === editTutorId) || null;
      const resolvedTutorEmail = (selectedTutorById?.email || editTutorEmailManual || "").trim();

      await updateDoc(doc(db, "estagios", editingEstagio.id), {
        tutorId: selectedTutorById?.id || "",
        tutorNome: selectedTutorById?.nome || "",
        tutorEmail: resolvedTutorEmail,
        tutorPhotoURL: selectedTutorById?.photoURL || "",
        updatedAt: serverTimestamp(),
      });

      setEditTutorDialogOpen(false);
      setEditingEstagio(null);
      await loadData();
    } catch (error) {
      console.error("Erro ao atualizar tutor do estágio:", error);
    } finally {
      setUpdatingTutor(false);
    }
  };

  const schoolLabel = schoolShortName || schoolName || "Escola";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Estágios</h1>
          <p className="text-muted-foreground">
            Crie estágios, convide tutores por email e associe tutores mais tarde quando necessário.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={tutorDialogOpen} onOpenChange={setTutorDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Convidar Tutor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Tutor para {schoolLabel}</DialogTitle>
                <DialogDescription>
                  O tutor será convidado para o sistema de estágio da escola. Pode ser associado a um estágio depois.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tutorInviteName">Nome do Tutor (opcional)</Label>
                  <Input
                    id="tutorInviteName"
                    placeholder="Nome completo"
                    value={inviteTutorName}
                    onChange={(event) => setInviteTutorName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tutorInviteEmail">Email do Tutor</Label>
                  <Input
                    id="tutorInviteEmail"
                    type="email"
                    placeholder="tutor@empresa.com"
                    value={inviteTutorEmail}
                    onChange={(event) => setInviteTutorEmail(event.target.value)}
                  />
                </div>
                <Button onClick={handleInviteTutor} disabled={inviting} className="w-full">
                  {inviting ? "A convidar..." : "Enviar Convite"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Estágio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Criar Estágio</DialogTitle>
                <DialogDescription>
                  O tutor é opcional no momento da criação e pode ser associado depois.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="estagioTitulo">Título do Estágio</Label>
                  <Input
                    id="estagioTitulo"
                    placeholder="Ex: Estágio em Desenvolvimento Web"
                    value={titulo}
                    onChange={(event) => setTitulo(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Aluno</Label>
                  <Input
                    placeholder="Pesquisar aluno por nome ou email..."
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    onFocus={() => setStudentListOpen(true)}
                    onBlur={() => setTimeout(() => setStudentListOpen(false), 150)}
                  />
                  {(studentListOpen || studentSearch.trim()) && (
                    <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                      {filteredStudents.length === 0 ? (
                        <p className="px-2 py-1 text-sm text-muted-foreground">Nenhum aluno encontrado.</p>
                      ) : (
                        filteredStudents.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setAlunoId(student.id);
                              setStudentListOpen(false);
                            }}
                            className={[
                              "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                              alunoId === student.id ? "bg-primary/10" : "hover:bg-muted",
                            ].join(" ")}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={student.photoURL || "/placeholder.svg"} alt={student.nome} />
                              <AvatarFallback>{student.nome.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{student.nome}</p>
                              <p className="truncate text-xs text-muted-foreground">{student.email}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {selectedStudent && (
                    <p className="text-xs text-muted-foreground">
                      Selecionado: <strong>{selectedStudent.nome}</strong> ({selectedStudent.email})
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tutor (Opcional)</Label>
                  <Input
                    placeholder="Pesquisar tutor da escola por nome, email ou empresa..."
                    value={tutorSearch}
                    onChange={(event) => setTutorSearch(event.target.value)}
                    onFocus={() => setTutorListOpen(true)}
                    onBlur={() => setTimeout(() => setTutorListOpen(false), 150)}
                  />
                  {(tutorListOpen || tutorSearch.trim()) && (
                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                      {filteredTutors.length === 0 ? (
                        <p className="px-2 py-1 text-sm text-muted-foreground">Nenhum tutor associado ao sistema da escola.</p>
                      ) : (
                        filteredTutors.map((tutor) => (
                          <button
                            key={tutor.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setTutorId(tutor.id);
                              setTutorEmailManual(tutor.email);
                              setTutorListOpen(false);
                            }}
                            className={[
                              "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                              tutorId === tutor.id ? "bg-primary/10" : "hover:bg-muted",
                            ].join(" ")}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={tutor.photoURL || "/placeholder.svg"} alt={tutor.nome} />
                              <AvatarFallback>{tutor.nome.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{tutor.nome}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {tutor.email} • {tutor.empresa}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="estagioTutorEmail">Ou email direto do tutor (opcional)</Label>
                    <Input
                      id="estagioTutorEmail"
                      type="email"
                      placeholder="tutor@empresa.com"
                      value={tutorEmailManual}
                      onChange={(event) => {
                        setTutorEmailManual(event.target.value);
                        if (tutorId) setTutorId("");
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estagioEmpresa">Empresa</Label>
                  <Input
                    id="estagioEmpresa"
                    placeholder="Nome da empresa"
                    value={empresa}
                    onChange={(event) => setEmpresa(event.target.value)}
                  />
                </div>

                <Button onClick={handleCreateEstagio} disabled={submitting} className="w-full">
                  {submitting ? "A criar..." : "Criar Estágio"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Tutores Convidados
          </CardTitle>
          <CardDescription>
            Convites pendentes enviados para {schoolLabel} ({pendingInvitesCount}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingInvitesCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Não existem convites pendentes. Quando o tutor aceita, o convite desaparece desta lista.
            </p>
          ) : (
            <div className="space-y-3">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{invite.nome.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{invite.nome}</p>
                      <p className="text-xs text-muted-foreground">{invite.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">pendente</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Por: {invite.professorName} • {invite.createdAt}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveInvite(invite.id)}
                      disabled={removingInviteId === invite.id}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {removingInviteId === invite.id ? "A remover..." : "Remover"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Sistema de Estágios da Escola
          </CardTitle>
          <CardDescription>
            Tutores já associados ao sistema da escola ({schoolTutors.length}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schoolTutors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não existem tutores associados ao sistema. Use "Convidar Tutor" para começar.
            </p>
          ) : (
            <div className="space-y-3">
              {schoolTutors.map((tutor) => (
                <div key={tutor.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={tutor.photoURL || "/placeholder.svg"} alt={tutor.nome} />
                      <AvatarFallback>{tutor.nome.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{tutor.nome}</p>
                      <p className="text-xs text-muted-foreground">{tutor.email} • {tutor.empresa}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Convidado por: {tutor.approvedByProfessorName}</p>
                      <p>Entrada: {tutor.joinedAt}</p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setConfirmRemoveTutor(tutor)}
                    >
                      <DoorOpen className="mr-2 h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(confirmRemoveTutor)} onOpenChange={(open) => !open && setConfirmRemoveTutor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover tutor do sistema da escola?</DialogTitle>
            <DialogDescription>
              Esta ação remove <strong>{confirmRemoveTutor?.nome || "o tutor"}</strong> do "Sistema de Estágios da Escola".
              <br />
              <br />
              Aviso: isto pode impactar associações futuras. Use apenas se tiver certeza.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={!confirmRemoveTutor || removingSchoolTutorId === confirmRemoveTutor.id}
              onClick={async () => {
                if (!confirmRemoveTutor) return;
                await handleRemoveSchoolTutor(confirmRemoveTutor.id);
                setConfirmRemoveTutor(null);
              }}
            >
              {confirmRemoveTutor && removingSchoolTutorId === confirmRemoveTutor.id ? "A remover..." : "Confirmar remoção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editTutorDialogOpen} onOpenChange={setEditTutorDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Associar Tutor ao Estágio</DialogTitle>
            <DialogDescription>
              Escolha um tutor do sistema da escola ou introduza email manualmente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pesquisar tutor</Label>
              <Input
                placeholder="Pesquisar por nome, email ou empresa..."
                value={editTutorSearch}
                onChange={(event) => setEditTutorSearch(event.target.value)}
              />
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {filteredEditTutors.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-muted-foreground">Nenhum tutor encontrado.</p>
                ) : (
                  filteredEditTutors.map((tutor) => (
                    <button
                      key={tutor.id}
                      type="button"
                      onClick={() => {
                        setEditTutorId(tutor.id);
                        setEditTutorEmailManual(tutor.email);
                      }}
                      className={[
                        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                        editTutorId === tutor.id ? "bg-primary/10" : "hover:bg-muted",
                      ].join(" ")}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={tutor.photoURL || "/placeholder.svg"} alt={tutor.nome} />
                        <AvatarFallback>{tutor.nome.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{tutor.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">{tutor.email} • {tutor.empresa}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editTutorEmail">Ou email direto do tutor</Label>
              <Input
                id="editTutorEmail"
                type="email"
                placeholder="tutor@empresa.com"
                value={editTutorEmailManual}
                onChange={(event) => {
                  setEditTutorEmailManual(event.target.value);
                  if (editTutorId) setEditTutorId("");
                }}
              />
            </div>

            <Button onClick={handleSaveTutorAssignment} disabled={updatingTutor} className="w-full">
              {updatingTutor ? "A guardar..." : "Guardar associação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Estágios
          </CardTitle>
          <CardDescription>
            {loading ? "A carregar..." : `${estagios.length} estágio(s) criado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar estágios...</p>
          ) : estagios.length === 0 ? (
            <div className="py-8 text-center">
              <Briefcase className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium text-foreground">Nenhum estágio criado</h3>
              <p className="text-muted-foreground">
                Crie um novo estágio e associe o tutor quando quiser.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {estagios.map((estagio) => (
                <div key={estagio.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-foreground">{estagio.titulo}</h4>
                        <Badge variant={estagio.estado === "ativo" ? "default" : "secondary"}>
                          {estagio.estado}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={estagio.alunoPhotoURL || "/placeholder.svg"} alt={estagio.alunoNome} />
                          <AvatarFallback>{estagio.alunoNome.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>Aluno: {estagio.alunoNome} ({estagio.alunoEmail})</span>
                      </div>

                      {estagio.tutorEmail ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={estagio.tutorPhotoURL || "/placeholder.svg"} alt={estagio.tutorNome || estagio.tutorEmail} />
                            <AvatarFallback>{(estagio.tutorNome || estagio.tutorEmail).charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>
                            Tutor: {estagio.tutorNome && estagio.tutorNome !== "—" ? `${estagio.tutorNome} (${estagio.tutorEmail})` : estagio.tutorEmail}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700">Sem tutor associado.</p>
                      )}

                      {estagio.empresa !== "—" && (
                        <p className="text-xs text-muted-foreground">Empresa: {estagio.empresa}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Criado em: {estagio.createdAt}</p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditTutorDialog(estagio)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      {estagio.tutorEmail ? "Alterar tutor" : "Associar tutor"}
                    </Button>
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
