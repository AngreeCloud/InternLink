"use client";

import { useEffect, useState } from "react";
import { collection, collectionGroup, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, FileText, School } from "lucide-react";

type OverviewData = {
  loading: boolean;
  tutorName: string;
  empresa: string;
  estagios: number;
  documentos: number;
  associatedSchools: number;
};

export function TutorDashboardOverview() {
  const [state, setState] = useState<OverviewData>({
    loading: true,
    tutorName: "",
    empresa: "",
    estagios: 0,
    documentos: 0,
    associatedSchools: 0,
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
        const userData = userSnap.exists()
          ? (userSnap.data() as { nome?: string; empresa?: string; email?: string })
          : {};

        const email = userData.email || user.email || "";

        let estagios = 0;
        let documentos = 0;
        let associatedSchools = 0;

        try {
          const estagiosSnap = await getDocs(query(collection(db, "estagios"), where("tutorEmail", "==", email)));
          estagios = estagiosSnap.size;

          for (const estagioDoc of estagiosSnap.docs) {
            try {
              const docsSnap = await getDocs(query(collection(db, "documentos"), where("estagioId", "==", estagioDoc.id)));
              documentos += docsSnap.size;
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }

        try {
          const schoolsSnap = await getDocs(query(collectionGroup(db, "tutors"), where("tutorId", "==", user.uid)));
          associatedSchools = schoolsSnap.size;
        } catch {
          // ignore
        }

        setState({
          loading: false,
          tutorName: userData.nome || user.displayName || "Tutor",
          empresa: userData.empresa || "—",
          estagios,
          documentos,
          associatedSchools,
        });
      });
    })();

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard do Tutor</h1>
        <p className="text-muted-foreground">
          A caixa de entrada está sempre disponível para novos convites de escolas e para abrir chat com professores.
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

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Escolas Associadas</CardTitle>
                <School className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{state.associatedSchools}</p>
                <p className="text-xs text-muted-foreground">Pode estar associado a várias escolas.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estágios Associados</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{state.estagios}</p>
                <p className="text-xs text-muted-foreground">Total de estágios em diferentes empresas.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Documentos</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{state.documentos}</p>
                <Badge variant={state.associatedSchools > 0 ? "default" : "secondary"}>
                  {state.associatedSchools > 0 ? "Chat desbloqueado" : "Aguardando associação"}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
