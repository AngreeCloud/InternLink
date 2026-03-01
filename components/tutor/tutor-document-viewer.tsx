"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Eye, PenTool } from "lucide-react";

type Documento = {
  id: string;
  nome: string;
  estagioTitulo: string;
  visibilidade: string;
  requerAssinatura: boolean;
  assinantes: string[];
  tipo: string;
  createdAt: string;
};

export function TutorDocumentViewer() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user || !active) {
          if (active) setLoading(false);
          return;
        }

        const { doc, getDoc } = await import("firebase/firestore");
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = userSnap.exists()
          ? (userSnap.data() as { email?: string })
          : {};

        const email = userData.email || user.email || "";
        const allDocs: Documento[] = [];

        try {
          // Find estágios associated with this tutor
          const estagiosSnap = await getDocs(
            query(collection(db, "estagios"), where("tutorEmail", "==", email))
          );

          for (const estagioDoc of estagiosSnap.docs) {
            try {
              const docsSnap = await getDocs(
                query(collection(db, "documentos"), where("estagioId", "==", estagioDoc.id))
              );
              for (const docSnap of docsSnap.docs) {
                const data = docSnap.data() as {
                  nome?: string;
                  estagioTitulo?: string;
                  visibilidade?: string;
                  requerAssinatura?: boolean;
                  assinantes?: string[];
                  tipo?: string;
                  createdAt?: { toDate: () => Date };
                };
                allDocs.push({
                  id: docSnap.id,
                  nome: data.nome || "—",
                  estagioTitulo: data.estagioTitulo || "—",
                  visibilidade: data.visibilidade || "todos",
                  requerAssinatura: data.requerAssinatura || false,
                  assinantes: data.assinantes || [],
                  tipo: data.tipo || "outro",
                  createdAt: data.createdAt?.toDate?.()?.toLocaleDateString("pt-PT") || "—",
                });
              }
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }

        if (!active) return;
        setDocumentos(allDocs);
        setLoading(false);
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
        <h1 className="text-3xl font-bold text-foreground">Documentos</h1>
        <p className="text-muted-foreground">
          Documentos associados aos seus estágios.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos Disponíveis
          </CardTitle>
          <CardDescription>
            {loading ? "A carregar..." : `${documentos.length} documento(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar documentos...</p>
          ) : documentos.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum documento</h3>
              <p className="text-muted-foreground">
                Ainda não existem documentos associados aos seus estágios.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {documentos.map((documento) => (
                <div
                  key={documento.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground">{documento.nome}</h4>
                      <Badge variant="outline" className="text-xs">
                        {documento.tipo.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Estágio: {documento.estagioTitulo}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        <span>
                          {documento.visibilidade === "todos"
                            ? "Alunos e Tutores"
                            : "Apenas Tutores"}
                        </span>
                      </div>
                      {documento.requerAssinatura &&
                        documento.assinantes.includes("tutor") && (
                          <div className="flex items-center gap-1 text-xs text-primary">
                            <PenTool className="h-3 w-3" />
                            <span>Requer a sua assinatura</span>
                          </div>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Carregado em: {documento.createdAt}
                    </p>
                  </div>
                  {documento.requerAssinatura &&
                    documento.assinantes.includes("tutor") && (
                      <Button variant="outline" size="sm">
                        <PenTool className="mr-2 h-4 w-4" />
                        Assinar
                      </Button>
                    )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


