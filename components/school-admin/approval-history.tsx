"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ApprovalHistoryItem = {
  id: string;
  teacherName: string;
  teacherEmail: string;
  decision: "aprovado" | "recusado" | string;
  decidedByName: string;
  createdAt?: Date | null;
};

export function ApprovalHistorySection() {
  const { schoolId } = useSchoolAdmin();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ApprovalHistoryItem[]>([]);

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      setLoading(true);
      setError("");

      try {
        const db = await getDbRuntime();
        const snapshot = await getDocs(
          query(collection(db, "schools", schoolId, "approvalHistory"), orderBy("createdAt", "desc"))
        );

        if (!active) return;

        const data = snapshot.docs.map((docSnap) => {
          const docData = docSnap.data() as {
            teacherName?: string;
            teacherEmail?: string;
            decision?: "aprovado" | "recusado" | string;
            decidedByName?: string;
            createdAt?: { toDate?: () => Date };
          };

          return {
            id: docSnap.id,
            teacherName: docData.teacherName || "—",
            teacherEmail: docData.teacherEmail || "—",
            decision: docData.decision || "—",
            decidedByName: docData.decidedByName || "—",
            createdAt: docData.createdAt?.toDate ? docData.createdAt.toDate() : null,
          };
        });

        setItems(data);
      } catch (loadError) {
        console.error("Erro ao carregar histórico de aprovações:", loadError);
        if (!active) return;
        setError("Não foi possível carregar o histórico de aprovações.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    loadHistory();

    return () => {
      active = false;
    };
  }, [schoolId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de aprovações</CardTitle>
        <CardDescription>Registo das decisões tomadas sobre pedidos de professores.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">A carregar histórico...</p> : null}
        {!loading && error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não existem decisões registadas.</p>
        ) : null}
        {!loading && !error && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{item.teacherName}</p>
                    <p className="text-xs text-muted-foreground">{item.teacherEmail}</p>
                  </div>
                  <Badge variant={item.decision === "aprovado" ? "default" : "secondary"}>{item.decision}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Por: {item.decidedByName}</span>
                  <span>{item.createdAt ? item.createdAt.toLocaleString() : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
