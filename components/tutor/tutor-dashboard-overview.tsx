"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, FileText } from "lucide-react";

type OverviewData = {
  loading: boolean;
  tutorName: string;
  empresa: string;
  estagios: number;
  documentos: number;
};

export function TutorDashboardOverview() {
  const [state, setState] = useState<OverviewData>({
    loading: true,
    tutorName: "",
    empresa: "",
    estagios: 0,
    documentos: 0,
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
          ? (userSnap.data() as { nome?: string; empresa?: string; email?: string })
          : {};

        let estagiosCount = 0;
        let documentosCount = 0;

        try {
          const estagiosSnap = await getDocs(
            query(collection(db, "estagios"), where("tutorEmail", "==", userData.email || user.email))
          );
          estagiosCount = estagiosSnap.size;

          // Count documents visible to tutor
          for (const estagioDoc of estagiosSnap.docs) {
            try {
              const docsSnap = await getDocs(
                query(collection(db, "documentos"), where("estagioId", "==", estagioDoc.id))
              );
              documentosCount += docsSnap.size;
            } catch { /* ignore */ }
          }
        } catch { /* ignore permission errors */ }

        if (!active) return;

        setState({
          loading: false,
          tutorName: userData.nome || user.displayName || "Tutor",
          empresa: userData.empresa || "—",
          estagios: estagiosCount,
          documentos: documentosCount,
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
        <h1 className="text-3xl font-bold text-foreground">Dashboard do Tutor</h1>
        <p className="text-muted-foreground">
          Acompanhe os estágios e documentos associados.
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
              <CardTitle>{state.tutorName}</CardTitle>
              <CardDescription>{state.empresa}</CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estágios Associados</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{state.estagios}</p>
                <p className="text-xs text-muted-foreground">Total de estágios</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Documentos</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{state.documentos}</p>
                <p className="text-xs text-muted-foreground">Total de documentos disponíveis</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
