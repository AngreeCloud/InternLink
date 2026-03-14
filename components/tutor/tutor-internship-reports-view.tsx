"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileUp } from "lucide-react";

type ReportItem = {
  id: string;
  title: string;
  summary: string;
  updatedAtLabel: string;
};

type ReportsState = {
  loading: boolean;
  allowed: boolean;
  stageTitle: string;
  studentName: string;
  reports: ReportItem[];
};

export function TutorInternshipReportsView({ schoolId, estagioId }: { schoolId: string; estagioId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ReportsState>({
    loading: true,
    allowed: false,
    stageTitle: "",
    studentName: "",
    reports: [],
  });

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setState((prev) => ({ ...prev, loading: false }));
          return;
        }

        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = userSnap.exists() ? (userSnap.data() as { email?: string }) : {};
        const resolvedEmail = (userData.email || user.email || "").trim();

        const estagioSnap = await getDoc(doc(db, "estagios", estagioId));
        if (!estagioSnap.exists()) {
          setState((prev) => ({ ...prev, loading: false }));
          return;
        }

        const estagio = estagioSnap.data() as {
          schoolId?: string;
          tutorId?: string;
          tutorEmail?: string;
          alunoId?: string;
          alunoNome?: string;
          titulo?: string;
        };

        const allowed =
          estagio.schoolId === schoolId &&
          (estagio.tutorId === user.uid || (!!resolvedEmail && estagio.tutorEmail === resolvedEmail));

        if (!allowed) {
          setState((prev) => ({ ...prev, loading: false, allowed: false }));
          return;
        }

        let reports: ReportItem[] = [];

        try {
          const byTutorId = await getDocs(query(collection(db, "internshipReports"), where("tutorId", "==", user.uid)));
          reports = byTutorId.docs
            .map((docSnap) => {
              const data = docSnap.data() as {
                studentId?: string;
                title?: string;
                summary?: string;
                updatedAt?: { toDate?: () => Date };
                createdAt?: { toDate?: () => Date };
              };

              if ((data.studentId || "") !== (estagio.alunoId || "")) {
                return null;
              }

              const updatedAt = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || null;
              return {
                id: docSnap.id,
                title: data.title || "Relatório",
                summary: data.summary || "",
                updatedAtLabel: updatedAt ? updatedAt.toLocaleString("pt-PT") : "—",
                updatedAtSort: updatedAt?.getTime() || 0,
              };
            })
            .filter((item): item is ReportItem & { updatedAtSort: number } => Boolean(item))
            .sort((a, b) => b.updatedAtSort - a.updatedAtSort)
            .map(({ updatedAtSort, ...item }) => item);
        } catch {
          reports = [];
        }

        setState({
          loading: false,
          allowed: true,
          stageTitle: estagio.titulo || "Estágio",
          studentName: estagio.alunoNome || "Aluno",
          reports,
        });
      });
    })();

    return () => unsubscribe();
  }, [schoolId, estagioId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Relatórios do estágio de {state.studentName || "aluno"}.</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/tutor/estagios/${schoolId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar aos estágios
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{state.stageTitle || "Estágio"}</CardTitle>
          <CardDescription>Área interna semelhante ao dashboard do aluno para leitura de relatórios.</CardDescription>
        </CardHeader>
        <CardContent>
          {state.loading ? (
            <p className="text-sm text-muted-foreground">A carregar relatórios...</p>
          ) : !state.allowed ? (
            <p className="text-sm text-muted-foreground">Não tem acesso a este estágio.</p>
          ) : state.reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não existem relatórios disponíveis para este estágio.</p>
          ) : (
            <div className="space-y-3">
              {state.reports.map((report) => (
                <div key={report.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileUp className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">{report.title}</p>
                        <Badge variant="secondary">Submetido</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Última atualização: {report.updatedAtLabel}</p>
                    </div>
                  </div>
                  {report.summary ? <p className="mt-2 text-sm text-muted-foreground">{report.summary}</p> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
