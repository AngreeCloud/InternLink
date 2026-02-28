"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Briefcase, FileText, Clock } from "lucide-react";

type OverviewData = {
  loading: boolean;
  professorName: string;
  schoolName: string;
  pendingStudents: number;
  activeInternships: number;
  totalDocuments: number;
};

export function ProfessorDashboardOverview() {
  const [state, setState] = useState<OverviewData>({
    loading: true,
    professorName: "",
    schoolName: "",
    pendingStudents: 0,
    activeInternships: 0,
    totalDocuments: 0,
  });

  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user || !active) {
          if (active) setState((prev) => ({ ...prev, loading: false }));
          return;
        }

        const { doc, getDoc } = await import("firebase/firestore");
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = userSnap.exists()
          ? (userSnap.data() as { nome?: string; escola?: string; schoolId?: string })
          : {};

        let pendingStudents = 0;
        let activeInternships = 0;
        let totalDocuments = 0;

        if (userData.schoolId) {
          try {
            const pendingSnap = await getDocs(
              query(collection(db, "users"), where("schoolId", "==", userData.schoolId), where("role", "==", "aluno"), where("estado", "==", "pendente"))
            );
            pendingStudents = pendingSnap.size;
          } catch { /* ignore permission errors */ }

          try {
            const internshipsSnap = await getDocs(
              query(collection(db, "estagios"), where("schoolId", "==", userData.schoolId))
            );
            activeInternships = internshipsSnap.size;
          } catch { /* ignore */ }

          try {
            const docsSnap = await getDocs(
              query(collection(db, "documentos"), where("schoolId", "==", userData.schoolId))
            );
            totalDocuments = docsSnap.size;
          } catch { /* ignore */ }
        }

        if (!active) return;

        setState({
          loading: false,
          professorName: userData.nome || user.displayName || "Professor",
          schoolName: userData.escola || "—",
          pendingStudents,
          activeInternships,
          totalDocuments,
        });
      });
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard do Professor</h1>
        <p className="text-muted-foreground">
          Gerir alunos, estágios e documentos da sua escola.
        </p>
      </div>

      {state.loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">A carregar dados...</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{state.professorName}</CardTitle>
              <CardDescription>{state.schoolName}</CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Alunos Pendentes</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-500">{state.pendingStudents}</p>
                <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estágios</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{state.activeInternships}</p>
                <p className="text-xs text-muted-foreground">Total de estágios criados</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Documentos</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{state.totalDocuments}</p>
                <p className="text-xs text-muted-foreground">Total de documentos carregados</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
