"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type DashboardData = {
  loading: boolean;
  studentName: string;
  courseName: string;
  schoolName: string;
  reportMinHours: number;
  reportWaitDays: number;
  completedHours: number;
  reportsCount: number;
};

const DEFAULT_MIN_HOURS = 80;

export function StudentDashboardOverview() {
  const [state, setState] = useState<DashboardData>({
    loading: true,
    studentName: "",
    courseName: "",
    schoolName: "",
    reportMinHours: DEFAULT_MIN_HOURS,
    reportWaitDays: 0,
    completedHours: 0,
    reportsCount: 0,
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

        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = userSnap.exists()
          ? (userSnap.data() as {
              nome?: string;
              escola?: string;
              curso?: string;
              courseId?: string;
            })
          : {};

        let reportMinHours = DEFAULT_MIN_HOURS;
        let reportWaitDays = 0;

        if (userData.courseId) {
          const courseSnap = await getDoc(doc(db, "courses", userData.courseId));
          if (courseSnap.exists()) {
            const courseData = courseSnap.data() as {
              reportMinHours?: number;
              reportWaitDays?: number;
            };
            reportMinHours = courseData.reportMinHours ?? DEFAULT_MIN_HOURS;
            reportWaitDays = courseData.reportWaitDays ?? 0;
          }
        }

        const internshipSnap = await getDocs(query(collection(db, "internships"), where("studentId", "==", user.uid)));
        const internshipData = internshipSnap.docs[0]?.data() as
          | {
              serviceHoursCompleted?: number;
              completedHours?: number;
            }
          | undefined;

        const reportsSnap = await getDocs(query(collection(db, "internshipReports"), where("studentId", "==", user.uid)));

        if (!active) return;

        setState({
          loading: false,
          studentName: userData.nome || user.displayName || "Aluno",
          schoolName: userData.escola || "—",
          courseName: userData.curso || "—",
          reportMinHours,
          reportWaitDays,
          completedHours: internshipData?.serviceHoursCompleted ?? internshipData?.completedHours ?? 0,
          reportsCount: reportsSnap.size,
        });
      });
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const reportEligible = useMemo(() => state.completedHours >= state.reportMinHours, [state.completedHours, state.reportMinHours]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard do Aluno</h1>
        <p className="text-muted-foreground">Acompanhe protocolo, relatório e comunicação do estágio.</p>
      </div>

      {state.loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">A carregar dados do estágio...</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{state.studentName}</CardTitle>
              <CardDescription>
                {state.schoolName} • {state.courseName}
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Horas de estágio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{state.completedHours}h</p>
                <p className="text-xs text-muted-foreground">Mínimo para relatório: {state.reportMinHours}h</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Período de espera</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{state.reportWaitDays} dias</p>
                <p className="text-xs text-muted-foreground">Configurado no curso pela escola.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Relatórios</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{state.reportsCount}</p>
                <Badge variant={reportEligible ? "default" : "secondary"}>
                  {reportEligible ? "Envio disponível" : "Aguardando elegibilidade"}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
