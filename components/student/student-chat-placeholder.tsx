"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { MessageSquare } from "lucide-react";

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
          if (active) setState((prev) => ({ ...prev, loading: false }));
          return;
        }

        const internshipSnap = await getDocs(
          query(collection(db, "internships"), where("studentId", "==", user.uid))
        );
        const internshipData = internshipSnap.docs[0]?.data() as
          | { teacherId?: string; professorId?: string; tutorId?: string }
          | undefined;

        const professorId = internshipData?.teacherId || internshipData?.professorId || "";
        const tutorId = internshipData?.tutorId || "";
        let professorName = "";
        let tutorName = "";

        if (professorId) {
          const snap = await getDoc(doc(db, "users", professorId));
          if (snap.exists()) professorName = (snap.data() as { nome?: string }).nome || "Professor";
        }
        if (tutorId) {
          const snap = await getDoc(doc(db, "users", tutorId));
          if (snap.exists()) tutorName = (snap.data() as { nome?: string }).nome || "Tutor";
        }

        if (!active) return;
        setState({ loading: false, professorName, tutorName });
      });
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className="flex flex-col -mt-10 -mb-10 -mx-4 sm:-mx-6 lg:-mx-8 h-[calc(100svh-4rem)]">
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:flex w-72 shrink-0 flex-col border-r border-border bg-card">
          <div className="shrink-0 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Conversas</p>
            <p className="text-xs text-muted-foreground">Em breve</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {!state.loading && state.professorName && (
              <div className="rounded-lg p-3 bg-muted/40">
                <p className="truncate text-sm font-medium">{state.professorName}</p>
                <p className="text-xs text-muted-foreground">Professor</p>
              </div>
            )}
            {!state.loading && state.tutorName && (
              <div className="rounded-lg p-3 bg-muted/40">
                <p className="truncate text-sm font-medium">{state.tutorName}</p>
                <p className="text-xs text-muted-foreground">Tutor</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <MessageSquare className="h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">Chat em breve</p>
          <p className="text-xs max-w-xs text-center">
            O chat em tempo real será disponibilizado numa próxima versão.
          </p>
        </div>
      </div>
    </div>
  );
}
