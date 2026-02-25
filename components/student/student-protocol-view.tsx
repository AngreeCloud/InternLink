"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ProtocolData = {
  loading: boolean;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
};

export function StudentProtocolView() {
  const [state, setState] = useState<ProtocolData>({
    loading: true,
    fileName: "",
    fileUrl: "",
    uploadedAt: "",
  });

  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user || !active) {
          if (active) {
            setState((prev) => ({ ...prev, loading: false }));
          }
          return;
        }

        const internshipSnap = await getDocs(query(collection(db, "internships"), where("studentId", "==", user.uid)));
        const internshipData = internshipSnap.docs[0]?.data() as
          | {
              protocolFileName?: string;
              protocolFileUrl?: string;
              protocolUploadedAt?: { toDate?: () => Date };
              protocol?: {
                fileName?: string;
                url?: string;
                uploadedAt?: { toDate?: () => Date };
              };
            }
          | undefined;

        const protocolName = internshipData?.protocol?.fileName || internshipData?.protocolFileName || "";
        const protocolUrl = internshipData?.protocol?.url || internshipData?.protocolFileUrl || "";
        const uploadedAtRaw = internshipData?.protocol?.uploadedAt || internshipData?.protocolUploadedAt;
        const uploadedAt =
          uploadedAtRaw && typeof uploadedAtRaw === "object" && "toDate" in uploadedAtRaw && uploadedAtRaw.toDate
            ? uploadedAtRaw.toDate().toLocaleString("pt-PT")
            : "";

        if (!active) return;

        setState({
          loading: false,
          fileName: protocolName,
          fileUrl: protocolUrl,
          uploadedAt,
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
        <h1 className="text-3xl font-bold text-foreground">Protocolo de Estágio</h1>
        <p className="text-muted-foreground">Visualize e descarregue o protocolo associado ao seu estágio.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documento do protocolo</CardTitle>
          <CardDescription>
            TODO: o carregamento do protocolo pela dashboard do professor será implementado futuramente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.loading ? (
            <p className="text-sm text-muted-foreground">A carregar protocolo...</p>
          ) : state.fileUrl ? (
            <>
              <div className="rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">{state.fileName || "Protocolo"}</p>
                <p className="text-xs text-muted-foreground">Carregado em: {state.uploadedAt || "—"}</p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={state.fileUrl} target="_blank" rel="noreferrer">
                    Visualizar
                  </a>
                </Button>
                <Button asChild size="sm">
                  <a href={state.fileUrl} download>
                    Descarregar
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda não existe protocolo disponível para este estágio.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
