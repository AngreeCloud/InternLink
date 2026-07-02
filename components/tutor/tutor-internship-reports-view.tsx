"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText } from "lucide-react";

type ReportItem = {
  id: string;
  title: string;
  summary: string;
  updatedAtLabel: string;
  updatedAtSort: number;
  fileUrl: string;
  fileName: string;
  version: number;
  estado: string;
};

type ReportsState = {
  loading: boolean;
  allowed: boolean;
  stageTitle: string;
  studentName: string;
  reports: ReportItem[];
};

function toDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "object") {
    const obj = raw as { toDate?: () => Date };
    if (typeof obj.toDate === "function") return obj.toDate();
  }
  return null;
}

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

        const estagioSnap = await getDoc(doc(db, "estagios", estagioId));
        if (!estagioSnap.exists()) {
          setState((prev) => ({ ...prev, loading: false }));
          return;
        }

        const estagio = estagioSnap.data() as {
          schoolId?: string;
          tutorId?: string;
          alunoId?: string;
          alunoNome?: string;
          titulo?: string;
        };

        let allowed = false;
        let IsSchoolAdmin = false;

        if (estagio.schoolId === schoolId && estagio.tutorId === user.uid) {
          allowed = true;
        } else {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          const userData = userSnap.data() as { role?: string; schoolId?: string } | undefined;
          if (
            userData?.role === "admin_escolar" &&
            estagio.schoolId &&
            userData.schoolId === estagio.schoolId
          ) {
            allowed = true;
            IsSchoolAdmin = true;
          }
        }

        if (!allowed) {
          setState((prev) => ({ ...prev, loading: false, allowed: false }));
          return;
        }

        let reports: ReportItem[] = [];

        try {
          const docsCol = collection(db, "estagios", estagioId, "documentos");
          const q = query(docsCol, where("templateCode", "==", "RELATORIO_FINAL"));
          const snap = await getDocs(q);

          reports = snap.docs
            .map((docSnap) => {
              const data = docSnap.data() as {
                nome?: string;
                descricao?: string;
                currentFileUrl?: string;
                currentFilePath?: string;
                fileMimeType?: string;
                fileExtension?: string;
                currentVersion?: number;
                estado?: string;
                updatedAt?: unknown;
                submittedAt?: unknown;
                createdAt?: unknown;
              };

              const updatedAt =
                toDate(data.updatedAt) ||
                toDate(data.submittedAt) ||
                toDate(data.createdAt) ||
                null;

              const version = Number(data.currentVersion ?? 1);

              return {
                id: docSnap.id,
                title: data.nome || "Relatório final de estágio",
                summary: data.descricao || "",
                updatedAtLabel: updatedAt ? updatedAt.toLocaleString("pt-PT") : "\u2014",
                updatedAtSort: updatedAt?.getTime() || 0,
                fileUrl: data.currentFileUrl || "",
                fileName: data.currentFilePath?.split("/").pop() || `relatorio-final-v${version}.${data.fileExtension || "pdf"}`,
                version,
                estado: data.estado || "pendente",
              };
            })
            .sort((a, b) => b.updatedAtSort - a.updatedAtSort);
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
          <CardDescription>Relatórios submetidos pelo aluno.</CardDescription>
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
                <div key={report.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="text-sm font-medium text-foreground truncate">{report.title}</p>
                        <Badge variant="secondary">v{report.version}</Badge>
                        <Badge variant={report.estado === "assinado" ? "default" : "secondary"}>
                          {report.estado === "assinado" ? "Assinado" : "Submetido"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Última atualização: {report.updatedAtLabel}</p>
                    </div>
                    {report.fileUrl && (
                      <Button variant="outline" size="sm" onClick={() => window.open(report.fileUrl, "_blank")}>
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Descarregar
                      </Button>
                    )}
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
