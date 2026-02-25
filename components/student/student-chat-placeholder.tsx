"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ChatData = {
  loading: boolean;
  professorName: string;
  tutorName: string;
};

export function StudentChatPlaceholder() {
  const [state, setState] = useState<ChatData>({
    loading: true,
    professorName: "",
    tutorName: "",
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
              teacherId?: string;
              professorId?: string;
              tutorId?: string;
            }
          | undefined;

        const professorId = internshipData?.teacherId || internshipData?.professorId || "";
        const tutorId = internshipData?.tutorId || "";

        let professorName = "";
        let tutorName = "";

        if (professorId) {
          const professorSnap = await getDoc(doc(db, "users", professorId));
          if (professorSnap.exists()) {
            const data = professorSnap.data() as { nome?: string };
            professorName = data.nome || "Professor responsável";
          }
        }

        if (tutorId) {
          const tutorSnap = await getDoc(doc(db, "users", tutorId));
          if (tutorSnap.exists()) {
            const data = tutorSnap.data() as { nome?: string };
            tutorName = data.nome || "Tutor";
          }
        }

        if (!active) return;

        setState({
          loading: false,
          professorName,
          tutorName,
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
        <h1 className="text-3xl font-bold text-foreground">Chat</h1>
        <p className="text-muted-foreground">Canais diretos de comunicação do estágio.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Canais disponíveis</CardTitle>
          <CardDescription>
            TODO: implementação futura da estrutura de estágio editável pelo professor e chat em tempo real.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.loading ? (
            <p className="text-sm text-muted-foreground">A carregar canais...</p>
          ) : (
            <>
              <div className="rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">Canal com Professor Responsável</p>
                <p className="text-xs text-muted-foreground">
                  {state.professorName || "Professor responsável ainda não associado ao estágio."}
                </p>
                <Badge variant="secondary" className="mt-2">Em breve</Badge>
              </div>

              <div className="rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">Canal com Tutor</p>
                <p className="text-xs text-muted-foreground">
                  {state.tutorName || "Tutor ainda não associado ao estágio."}
                </p>
                <Badge variant="secondary" className="mt-2">Em breve</Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
