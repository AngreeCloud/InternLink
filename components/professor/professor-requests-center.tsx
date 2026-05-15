"use client";

import { useEffect, useMemo, useState } from "react";
import { collectionGroup, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleChangeRequestsList, type EstagioMetaLite } from "@/components/estagios/schedule-change-requests-list";
import type { ScheduleChangeRequest, ScheduleChangeRequestType } from "@/lib/estagios/schedule-change-requests";

const JUSTIFICATION_TYPES: ScheduleChangeRequestType[] = ["past_absence_justification"];
const SCHEDULE_TYPES: ScheduleChangeRequestType[] = ["future_absence", "early_termination"];

function toMillis(raw: unknown): number {
  if (!raw) return 0;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "object") {
    const obj = raw as { seconds?: number; toDate?: () => Date };
    if (typeof obj.toDate === "function") return obj.toDate().getTime();
    if (typeof obj.seconds === "number") return obj.seconds * 1000;
  }
  return 0;
}

export function ProfessorRequestsCenter() {
  const [userId, setUserId] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requests, setRequests] = useState<ScheduleChangeRequest[]>([]);
  const [estagiosById, setEstagiosById] = useState<Record<string, EstagioMetaLite | undefined>>({});

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setUserId(user?.uid || "");
        setLoadingUser(false);
      });
    })();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setRequests([]);
      setLoadingRequests(false);
      return;
    }

    let unsubscribe = () => {};
    let cancelled = false;

    (async () => {
      const db = await getDbRuntime();
      const q = query(
        collectionGroup(db, "schedule_change_requests"),
        where("professorId", "==", userId)
      );

      unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (cancelled) return;
          const out: ScheduleChangeRequest[] = [];
          snap.forEach((docSnap) => {
            out.push({ id: docSnap.id, ...(docSnap.data() as ScheduleChangeRequest) });
          });
          out.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
          setRequests(out);
          setLoadingRequests(false);
        },
        () => {
          if (cancelled) return;
          setRequests([]);
          setLoadingRequests(false);
        }
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    if (requests.length === 0) return;

    const needed = Array.from(new Set(requests.map((r) => r.estagioId))).filter(
      (id) => id && !estagiosById[id]
    );

    if (needed.length === 0) return;

    let cancelled = false;

    (async () => {
      const db = await getDbRuntime();
      const nextEntries: Record<string, EstagioMetaLite> = {};

      await Promise.all(
        needed.map(async (id) => {
          try {
            const snap = await getDoc(doc(db, "estagios", id));
            if (!snap.exists()) return;
            const raw = snap.data() as Record<string, unknown>;
            nextEntries[id] = {
              id,
              titulo: (raw.titulo as string | undefined) || (raw.title as string | undefined) || "Estagio",
              alunoNome: (raw.alunoNome as string | undefined) || "Aluno",
              empresa:
                (raw.empresa as string | undefined) ||
                (raw.entidadeAcolhimento as string | undefined) ||
                (raw.companyName as string | undefined) ||
                "",
              courseNome: (raw.courseNome as string | undefined) || (raw.courseName as string | undefined) || "",
              schoolId: (raw.schoolId as string | undefined) || "",
            };
          } catch {
            // ignore
          }
        })
      );

      if (cancelled || Object.keys(nextEntries).length === 0) return;
      setEstagiosById((prev) => ({ ...prev, ...nextEntries }));
    })();

    return () => {
      cancelled = true;
    };
  }, [estagiosById, requests]);

  const justificationRequests = useMemo(
    () => requests.filter((r) => JUSTIFICATION_TYPES.includes(r.type)),
    [requests]
  );

  const scheduleRequests = useMemo(
    () => requests.filter((r) => SCHEDULE_TYPES.includes(r.type)),
    [requests]
  );

  if (loadingUser || loadingRequests) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">A carregar pedidos...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Justificacoes e pedidos</h1>
        <p className="text-muted-foreground">
          Acompanhe justificacoes de faltas e mudancas de horario em todos os estagios.
        </p>
      </div>

      <Tabs defaultValue="justificacoes" className="space-y-4">
        <TabsList className="flex w-full flex-wrap gap-2">
          <TabsTrigger value="justificacoes">Justificacao de faltas</TabsTrigger>
          <TabsTrigger value="mudancas">Solicitacoes de mudanca de horario</TabsTrigger>
        </TabsList>

        <TabsContent value="justificacoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Justificacoes de faltas</CardTitle>
            </CardHeader>
          </Card>
          <ScheduleChangeRequestsList
            requests={justificationRequests}
            estagiosById={estagiosById}
            currentUserId={userId}
            currentUserRole="professor"
            basePath="professor"
            emptyTitle="Sem justificacoes pendentes"
            emptyDescription="Quando um aluno submeter uma justificacao, ela aparece aqui."
          />
        </TabsContent>

        <TabsContent value="mudancas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Solicitacoes de mudanca de horario</CardTitle>
            </CardHeader>
          </Card>
          <ScheduleChangeRequestsList
            requests={scheduleRequests}
            estagiosById={estagiosById}
            currentUserId={userId}
            currentUserRole="professor"
            basePath="professor"
            emptyTitle="Sem solicitacoes de mudanca"
            emptyDescription="Pedidos de faltas futuras ou termino antecipado aparecem aqui."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
