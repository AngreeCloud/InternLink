"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  addDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Briefcase, Plus, Users, Mail } from "lucide-react";

type Estagio = {
  id: string;
  titulo: string;
  alunoNome: string;
  alunoEmail: string;
  tutorNome: string;
  tutorEmail: string;
  empresa: string;
  estado: string;
  createdAt: string;
};

type SimpleUser = {
  id: string;
  nome: string;
  email: string;
};

export function InternshipManager() {
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tutorDialogOpen, setTutorDialogOpen] = useState(false);

  // Form state for creating a new Estágio
  const [titulo, setTitulo] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [tutorEmail, setTutorEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // State for inviting tutors
  const [inviteTutorEmail, setInviteTutorEmail] = useState("");
  const [inviteTutorName, setInviteTutorName] = useState("");
  const [inviting, setInviting] = useState(false);

  // Available students for selection
  const [students, setStudents] = useState<SimpleUser[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();
      const user = auth.currentUser;
      if (!user) return;

      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (!userSnap.exists()) return;
      const userData = userSnap.data() as { schoolId?: string };
      if (!userData.schoolId) return;
      setSchoolId(userData.schoolId);

      // Load estágios
      try {
        const estagiosSnap = await getDocs(
          query(collection(db, "estagios"), where("schoolId", "==", userData.schoolId))
        );
        const list: Estagio[] = estagiosSnap.docs.map((docSnap) => {
          const data = docSnap.data() as {
            titulo?: string;
            alunoNome?: string;
            alunoEmail?: string;
            tutorNome?: string;
            tutorEmail?: string;
            empresa?: string;
            estado?: string;
            createdAt?: { toDate: () => Date };
          };
          return {
            id: docSnap.id,
            titulo: data.titulo || "—",
            alunoNome: data.alunoNome || "—",
            alunoEmail: data.alunoEmail || "—",
            tutorNome: data.tutorNome || "—",
            tutorEmail: data.tutorEmail || "—",
            empresa: data.empresa || "—",
            estado: data.estado || "ativo",
            createdAt: data.createdAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
          };
        });
        setEstagios(list);
      } catch { /* ignore */ }

      // Load active students
      try {
        const studentsSnap = await getDocs(
          query(
            collection(db, "users"),
            where("schoolId", "==", userData.schoolId),
            where("role", "==", "aluno"),
            where("estado", "==", "ativo")
          )
        );
        setStudents(
          studentsSnap.docs.map((d) => {
            const data = d.data() as { nome?: string; email?: string };
            return { id: d.id, nome: data.nome || "—", email: data.email || "—" };
          })
        );
      } catch { /* ignore */ }
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

  const handleCreateEstagio = async () => {
    if (!titulo.trim() || !alunoId || !tutorEmail.trim()) return;
    setSubmitting(true);
    try {
      const db = await getDbRuntime();
      const auth = await getAuthRuntime();
      const user = auth.currentUser;
      if (!user) return;

      const selectedStudent = students.find((s) => s.id === alunoId);

      await addDoc(collection(db, "estagios"), {
        titulo: titulo.trim(),
        schoolId,
        professorId: user.uid,
        alunoId,
        alunoNome: selectedStudent?.nome || "",
        alunoEmail: selectedStudent?.email || "",
        tutorEmail: tutorEmail.trim(),
        tutorNome: "",
        empresa: empresa.trim(),
        estado: "ativo",
        createdAt: serverTimestamp(),
      });

      setTitulo("");
      setAlunoId("");
      setTutorEmail("");
      setEmpresa("");
      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Erro ao criar estágio:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInviteTutor = async () => {
    if (!inviteTutorEmail.trim() || !inviteTutorName.trim()) return;
    setInviting(true);
    try {
      const db = await getDbRuntime();
      const auth = await getAuthRuntime();
      const user = auth.currentUser;
      if (!user) return;

      await addDoc(collection(db, "tutorInvites"), {
        email: inviteTutorEmail.trim(),
        nome: inviteTutorName.trim(),
        schoolId,
        professorId: user.uid,
        estado: "pendente",
        createdAt: serverTimestamp(),
      });

      setInviteTutorEmail("");
      setInviteTutorName("");
      setTutorDialogOpen(false);
    } catch (error) {
      console.error("Erro ao convidar tutor:", error);
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Estágios</h1>
          <p className="text-muted-foreground">
            Criar estágios associando alunos e tutores. Gerir documentos e visibilidade.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={tutorDialogOpen} onOpenChange={setTutorDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                Convidar Tutor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Tutor</DialogTitle>
                <DialogDescription>
                  Adicione um tutor por email para associá-lo a estágios.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tutorInviteName">Nome do Tutor</Label>
                  <Input
                    id="tutorInviteName"
                    placeholder="Nome completo"
                    value={inviteTutorName}
                    onChange={(e) => setInviteTutorName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tutorInviteEmail">Email do Tutor</Label>
                  <Input
                    id="tutorInviteEmail"
                    type="email"
                    placeholder="tutor@empresa.com"
                    value={inviteTutorEmail}
                    onChange={(e) => setInviteTutorEmail(e.target.value)}
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Estágio</DialogTitle>
                <DialogDescription>
                  Associe um aluno e um tutor a um novo estágio.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="estagioTitulo">Título do Estágio</Label>
                  <Input
                    id="estagioTitulo"
                    placeholder="Ex: Estágio em Desenvolvimento Web"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estagioAluno">Aluno</Label>
                  <select
                    id="estagioAluno"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={alunoId}
                    onChange={(e) => setAlunoId(e.target.value)}
                  >
                    <option value="">Selecione um aluno</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estagioTutorEmail">Email do Tutor</Label>
                  <Input
                    id="estagioTutorEmail"
                    type="email"
                    placeholder="tutor@empresa.com"
                    value={tutorEmail}
                    onChange={(e) => setTutorEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estagioEmpresa">Empresa</Label>
                  <Input
                    id="estagioEmpresa"
                    placeholder="Nome da empresa"
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
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
            <div className="text-center py-8">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum estágio criado</h3>
              <p className="text-muted-foreground">
                Crie um novo estágio associando um aluno e um tutor.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {estagios.map((estagio) => (
                <div
                  key={estagio.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground">{estagio.titulo}</h4>
                      <Badge
                        variant={estagio.estado === "ativo" ? "default" : "secondary"}
                      >
                        {estagio.estado}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>Aluno: {estagio.alunoNome} ({estagio.alunoEmail})</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>Tutor: {estagio.tutorEmail}</span>
                    </div>
                    {estagio.empresa !== "—" && (
                      <p className="text-xs text-muted-foreground">Empresa: {estagio.empresa}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Criado em: {estagio.createdAt}</p>
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
