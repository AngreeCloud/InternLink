"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, ExternalLink, FileText } from "lucide-react";

type ProtocolState = {
  loading: boolean;
  allowed: boolean;
  stageTitle: string;
  studentName: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
};

export function TutorInternshipProtocolView({ schoolId, estagioId }: { schoolId: string; estagioId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ProtocolState>({
    loading: true,
    allowed: false,
    stageTitle: "",
    studentName: "",
    fileName: "",
    fileUrl: "",
    uploadedAt: "",
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

        let fileName = "";
        let fileUrl = "";
        let uploadedAt = "";

        try {
          const docsSnap = await getDocs(query(collection(db, "documentos"), where("estagioId", "==", estagioId)));
          const docsList = docsSnap.docs.map((docSnap) => {
            const data = docSnap.data() as {
              nome?: string;
              visibilidade?: string;
              fileUrl?: string;
              createdAt?: { toDate?: () => Date };
            };
            return {
              nome: data.nome || "",
              visibilidade: data.visibilidade || "",
              fileUrl: data.fileUrl || "",
              createdAtLabel: data.createdAt?.toDate?.()?.toLocaleString("pt-PT") || "",
            };
          });

          const protocolDoc =
            docsList.find((item) => item.nome.toLowerCase().includes("protocolo")) || docsList[0];

          if (protocolDoc) {
            fileName = protocolDoc.nome || "Protocolo";
            fileUrl = protocolDoc.fileUrl || "";
            uploadedAt = protocolDoc.createdAtLabel || "";
          }
        } catch {
          // ignore
        }

        setState({
          loading: false,
          allowed: true,
          stageTitle: estagio.titulo || "Estágio",
          studentName: estagio.alunoNome || "Aluno",
          fileName,
          fileUrl,
          uploadedAt,
        });
      });
    })();

    return () => unsubscribe();
  }, [schoolId, estagioId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Protocolo</h1>
          <p className="text-muted-foreground">Visualização interna do estágio de {state.studentName || "aluno"}.</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/tutor/estagios/${schoolId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar aos estágios
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{state.stageTitle || "Estágio"}</CardTitle>
          <CardDescription>Página interna semelhante ao fluxo do aluno, adaptada para tutor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.loading ? (
            <p className="text-sm text-muted-foreground">A carregar protocolo...</p>
          ) : !state.allowed ? (
            <p className="text-sm text-muted-foreground">Não tem acesso a este estágio.</p>
          ) : state.fileUrl ? (
            <>
              <div className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">{state.fileName}</p>
                  <Badge variant="secondary">Disponível</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Carregado em: {state.uploadedAt || "—"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={state.fileUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Visualizar
                  </a>
                </Button>
                <Button asChild size="sm">
                  <a href={state.fileUrl} download>
                    <Download className="mr-2 h-4 w-4" />
                    Descarregar
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ainda não existe protocolo com ficheiro disponível para este estágio.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
