"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserCheck, UserX, Search } from "lucide-react";

type PendingStudent = {
  id: string;
  nome: string;
  email: string;
  curso: string;
  dataNascimento: string;
  createdAt: string;
};

export function PendingStudentsManager() {
  const [students, setStudents] = useState<PendingStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();
      const user = auth.currentUser;
      if (!user) return;

      const { getDoc } = await import("firebase/firestore");
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (!userSnap.exists()) return;
      const userData = userSnap.data() as { schoolId?: string };
      if (!userData.schoolId) return;

      const pendingSnap = await getDocs(
        query(
          collection(db, "users"),
          where("schoolId", "==", userData.schoolId),
          where("role", "==", "aluno"),
          where("estado", "==", "pendente")
        )
      );

      const list: PendingStudent[] = pendingSnap.docs.map((docSnap) => {
        const data = docSnap.data() as {
          nome?: string;
          email?: string;
          curso?: string;
          dataNascimento?: string;
          createdAt?: { toDate: () => Date };
        };
        return {
          id: docSnap.id,
          nome: data.nome || "—",
          email: data.email || "—",
          curso: data.curso || "—",
          dataNascimento: data.dataNascimento || "—",
          createdAt: data.createdAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
        };
      });

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
      await updateDoc(doc(db, "users", studentId), { estado: "ativo" });
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
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground">{student.nome}</h4>
                      <Badge variant="secondary">Pendente</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                    <p className="text-xs text-muted-foreground">Curso: {student.curso}</p>
                    <p className="text-xs text-muted-foreground">Registado em: {student.createdAt}</p>
                  </div>
                  <div className="flex items-center space-x-2">
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
