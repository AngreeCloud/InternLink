"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Users } from "lucide-react";

type ApprovedStudent = {
  id: string;
  nome: string;
  email: string;
  curso: string;
  localidade: string;
  telefone: string;
  dataNascimento: string;
  createdAt: string;
};

export function ApprovedStudentsManager() {
  const [students, setStudents] = useState<ApprovedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [schoolName, setSchoolName] = useState("");

  const loadStudents = async () => {
    setLoading(true);

    try {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();
      const user = auth.currentUser;

      if (!user) {
        setStudents([]);
        return;
      }

      const { getDoc } = await import("firebase/firestore");
      const userSnap = await getDoc(doc(db, "users", user.uid));

      if (!userSnap.exists()) {
        setStudents([]);
        return;
      }

      const userData = userSnap.data() as { schoolId?: string; escola?: string };
      setSchoolName(userData.escola || "");

      if (!userData.schoolId) {
        setStudents([]);
        return;
      }

      const approvedSnap = await getDocs(
        query(
          collection(db, "users"),
          where("schoolId", "==", userData.schoolId),
          where("role", "==", "aluno"),
          where("estado", "==", "ativo")
        )
      );

      const list = approvedSnap.docs
        .map((docSnap) => {
          const data = docSnap.data() as {
            nome?: string;
            email?: string;
            curso?: string;
            localidade?: string;
            telefone?: string;
            dataNascimento?: string;
            createdAt?: { toDate: () => Date };
          };

          return {
            id: docSnap.id,
            nome: data.nome || "—",
            email: data.email || "—",
            curso: data.curso || "—",
            localidade: data.localidade || "—",
            telefone: data.telefone || "—",
            dataNascimento: data.dataNascimento || "—",
            createdAt: data.createdAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
          };
        })
        .sort((left, right) => left.nome.localeCompare(right.nome, "pt-PT"));

      setStudents(list);
    } catch (error) {
      console.error("Erro ao carregar alunos aprovados:", error);
      setStudents([]);
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
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar alunos...</p>
          ) : filteredStudents.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Não existem alunos aprovados para apresentar.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="hidden rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(180px,1.4fr)_minmax(220px,1.8fr)_minmax(140px,1.2fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(110px,0.9fr)] md:gap-4">
                <span>Nome</span>
                <span>Email</span>
                <span>Curso</span>
                <span>Localidade</span>
                <span>Telefone</span>
                <span>Nascimento</span>
                <span>Registo</span>
              </div>
              {filteredStudents.map((student) => (
                <div key={student.id} className="rounded-lg border border-border p-4">
                  <div className="space-y-3 md:hidden">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-foreground">{student.nome}</h4>
                        <Badge variant="secondary">Ativo</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                    </div>
                    <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>Curso: {student.curso}</p>
                      <p>Localidade: {student.localidade}</p>
                      <p>Telefone: {student.telefone}</p>
                      <p>Nascimento: {student.dataNascimento}</p>
                      <p>Registado em: {student.createdAt}</p>
                    </div>
                  </div>

                  <div className="hidden items-center gap-4 md:grid md:grid-cols-[minmax(180px,1.4fr)_minmax(220px,1.8fr)_minmax(140px,1.2fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(110px,0.9fr)]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{student.nome}</p>
                        <Badge variant="secondary">Ativo</Badge>
                      </div>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{student.email}</p>
                    <p className="truncate text-sm text-muted-foreground">{student.curso}</p>
                    <p className="truncate text-sm text-muted-foreground">{student.localidade}</p>
                    <p className="truncate text-sm text-muted-foreground">{student.telefone}</p>
                    <p className="truncate text-sm text-muted-foreground">{student.dataNascimento}</p>
                    <p className="truncate text-sm text-muted-foreground">{student.createdAt}</p>
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