"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarX2 } from "lucide-react";
import { ScheduleChangeRequestsList, type EstagioMetaLite } from "@/components/estagios/schedule-change-requests-list";
import type { ScheduleChangeRequest, ScheduleChangeRequestType } from "@/lib/estagios/schedule-change-requests";
import { TutorFechoEmpresaModal } from "./tutor-fecho-empresa-modal";

const SCHEDULE_TYPES: ScheduleChangeRequestType[] = ["future_absence", "early_termination"];

const POLL_MS = 30_000;

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

export function TutorRequestsCenter() {
  const [userId, setUserId] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requests, setRequests] = useState<ScheduleChangeRequest[]>([]);
  const [estagiosById, setEstagiosById] = useState<Record<string, EstagioMetaLite | undefined>>({});
  const [showFechoModal, setShowFechoModal] = useState(false);
  const [empresaId, setEmpresaId] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const fetchRequests = useCallback(async (uid: string) => {
    try {
      const res = await fetch("/api/schedule-change-requests?role=tutor");
      if (!res.ok) {
        console.error("[v0] schedule-change-requests tutor fetch", res.status);
        return;
      }
      const json = (await res.json()) as {
        ok: boolean;
        requests: ScheduleChangeRequest[];
      };
      if (!json.ok) return;
      setRequests(json.requests);
      setLoadingRequests(false);
    } catch (err) {
      console.error("[v0] schedule-change-requests tutor fetch error", err);
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setRequests([]);
      setLoadingRequests(false);
      return;
    }

    fetchRequests(userId);
    intervalRef.current = setInterval(() => fetchRequests(userId), POLL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, fetchRequests]);

  // Fetch tutor's empresa via server API (bypasses Firestore rules)
  useEffect(() => {
    if (!userId) {
      setEmpresaId("");
      return;
    }
    let cancelled = false;
    fetch("/api/tutor/empresa")
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data.ok) {
          setEmpresaId(data.empresaId || "");
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
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
              titulo: (raw.titulo as string | undefined) || (raw.title as string | undefined) || "Estágio",
              alunoNome: (raw.alunoNome as string | undefined) || "Aluno",
              empresa:
                (raw.empresa as string | undefined) ||
                (raw.entidadeAcolhimento as string | undefined) ||
                (raw.companyName as string | undefined) ||
                "",
              empresaId: raw.empresaId as string | undefined,
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

  const scheduleRequests = useMemo(
    () => requests
      .filter((r) => SCHEDULE_TYPES.includes(r.type) && r.status !== "pending_professor")
      .sort((a, b) => {
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const group = (r: ScheduleChangeRequest): number => {
          if (r.status === "pending_tutor" && r.targetDate >= todayStr) return 0;
          if (r.targetDate >= todayStr) return 1;
          return 2;
        };
        const ga = group(a), gb = group(b);
        if (ga !== gb) return ga - gb;
        const diff = toMillis(a.targetDate) - toMillis(b.targetDate);
        return ga === 2 ? -diff : diff;
      }),
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Solicitações de mudança de horário</h1>
          <p className="text-muted-foreground">
            Pedidos de faltas futuras e término antecipado dos seus formandos.
          </p>
        </div>
        <Button onClick={() => setShowFechoModal(true)}>
          <CalendarX2 className="w-4 h-4 mr-2" />
          Dia sem Estágio
        </Button>
      </div>

      <ScheduleChangeRequestsList
        requests={scheduleRequests}
        estagiosById={estagiosById}
        currentUserId={userId}
        currentUserRole="tutor"
        basePath="tutor"
        emptyTitle="Sem solicitações de mudança"
        emptyDescription="Quando um aluno pedir uma falta futura, aparece aqui."
      />

      {empresaId && (
        <TutorFechoEmpresaModal
          empresaId={empresaId}
          open={showFechoModal}
          onClose={() => setShowFechoModal(false)}
          onSuccess={() => fetchRequests(userId)}
        />
      )}
    </div>
  );
}
