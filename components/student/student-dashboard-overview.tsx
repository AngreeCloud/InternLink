"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SchoolProfileCard } from "@/components/school/school-profile-card";
import { ArrowRight, Briefcase, Loader2 } from "lucide-react";

type DashboardData = {
  loading: boolean;
  reportLoading: boolean;
  studentName: string;
  courseName: string;
  schoolName: string;
  reportMinHours: number;
  reportWaitDays: number;
  completedHours: number;
  reportsCount: number;
  schoolId: string;
  hasInternship: boolean;
  estagioId: string;
  estagioTitulo: string;
  estagioEmpresa: string;
  reportSubmitted: boolean;
  reportPages: number | null;
  reportAvailableAt: string | null;
  reportSubmittedAt: string | null;
};

const DEFAULT_MIN_HOURS = 80;

export function StudentDashboardOverview() {
  const [state, setState] = useState<DashboardData>({
    loading: true,
    reportLoading: false,
    studentName: "",
    courseName: "",
    schoolName: "",
    reportMinHours: DEFAULT_MIN_HOURS,
    reportWaitDays: 0,
    completedHours: 0,
    reportsCount: 0,
    schoolId: "",
    hasInternship: false,
    estagioId: "",
    estagioTitulo: "",
    estagioEmpresa: "",
    reportSubmitted: false,
    reportPages: null,
    reportAvailableAt: null,
    reportSubmittedAt: null,
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

        // Estágio canónico (Gestão de Estágios FCT).
        let estagioId = "";
        let estagioTitulo = "";
        let estagioEmpresa = "";
        let estagioSchoolId = "";
        let estagioHoursDone = 0;
        try {
          const estagiosSnap = await getDocs(
            query(collection(db, "estagios"), where("alunoId", "==", user.uid))
          );
          const estagioDoc = estagiosSnap.docs[0];
          if (estagioDoc) {
            const data = estagioDoc.data() as {
              titulo?: string;
              entidadeAcolhimento?: string;
              empresa?: string;
              schoolId?: string;
              horasRealizadas?: number;
            };
            estagioId = estagioDoc.id;
            estagioTitulo = data.titulo || "Estágio FCT";
            estagioEmpresa = data.entidadeAcolhimento || data.empresa || "";
            estagioSchoolId = data.schoolId || "";
            
            // Load presencas from subcollection to get actual worked hours
            let presencasTotal = 0;
            try {
              const presencasSnap = await getDocs(
                collection(db, "estagios", estagioId, "presencas")
              );
              presencasSnap.forEach((doc) => {
                const pdata = doc.data() as { hoursWorked?: number };
                if (typeof pdata.hoursWorked === "number") {
                  presencasTotal += pdata.hoursWorked;
                }
              });
            } catch {
              // permissions denied or collection doesn't exist
            }
            
            estagioHoursDone = presencasTotal > 0 ? presencasTotal : Number(data.horasRealizadas ?? 0);
          }
        } catch (err) {
          console.error("[v0] load estagio failed", err);
        }

        if (!active) return;

        const hasInternship = estagioId !== "" || internshipSnap.size > 0;
        const legacySchoolId =
          (internshipSnap.docs[0]?.data() as { schoolId?: string } | undefined)?.schoolId || "";

        setState({
          loading: false,
          reportLoading: false,
          studentName: userData.nome || user.displayName || "Aluno",
          schoolName: userData.escola || "—",
          courseName: userData.curso || "—",
          reportMinHours,
          reportWaitDays,
          completedHours:
            estagioHoursDone > 0
              ? estagioHoursDone
              : internshipData?.serviceHoursCompleted ?? internshipData?.completedHours ?? 0,
          reportsCount: reportsSnap.size,
          schoolId: estagioSchoolId || legacySchoolId,
          hasInternship,
          estagioId,
          estagioTitulo,
          estagioEmpresa,
          reportSubmitted: false,
          reportPages: null,
          reportAvailableAt: null,
          reportSubmittedAt: null,
        });
      });
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const reportEligible = useMemo(() => state.completedHours >= state.reportMinHours, [state.completedHours, state.reportMinHours]);

  // Load report metadata (status + page count)
  useEffect(() => {
    if (!state.estagioId) return;
    let cancelled = false;
    setState((prev) => ({
      ...prev,
      reportLoading: true,
      reportSubmitted: false,
      reportPages: null,
      reportAvailableAt: null,
      reportSubmittedAt: null,
    }));
    (async () => {
      try {
        const res = await fetch(`/api/estagios/${state.estagioId}/relatorio-final`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          report: { currentFileUrl?: string; fileExtension?: string; pageCount?: number; submittedAt?: string | null } | null;
          availableAt?: string | null;
        };
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          reportSubmitted: !!data.report,
          reportPages: data.report ? (data.report.pageCount as number | null) ?? null : null,
          reportAvailableAt: data.availableAt ?? null,
          reportSubmittedAt: data.report ? (data.report.submittedAt as string | null) ?? null : null,
          reportLoading: false,
        }));
      } catch (err) {
        console.error("[v0] fetch report metadata failed", err);
        setState((prev) => ({
          ...prev,
          reportLoading: false,
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.estagioId]);

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

          {state.estagioId ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    {state.estagioTitulo}
                  </CardTitle>
                  <CardDescription>
                    {state.estagioEmpresa
                      ? `Entidade: ${state.estagioEmpresa}`
                      : "Aceda às abas do seu estágio ativo."}
                  </CardDescription>
                </div>
                <Button asChild>
                  <Link href={`/dashboard/estagio/${state.estagioId}`}>
                    Abrir estágio
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
            </Card>
          ) : null}

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
                <CardTitle className="text-sm">Relatório</CardTitle>
              </CardHeader>
              <CardContent>
                {state.reportLoading ? (
                  <div className="flex min-h-24 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : state.reportSubmitted ? (
                  <div>
                    <div className="flex items-center gap-3">
                      <Badge variant="default">Enviado</Badge>
                      {state.reportSubmittedAt ? (
                        <p className="text-sm text-muted-foreground">
                          Submetido em {new Date(state.reportSubmittedAt).toLocaleDateString("pt-PT")}
                        </p>
                      ) : null}
                    </div>
                    {state.reportPages !== null ? (
                      <p className="mt-2 text-xs text-muted-foreground">Páginas: {state.reportPages}</p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <p className="text-2xl font-semibold">{state.reportsCount}</p>
                    {state.reportAvailableAt ? (
                      (() => {
                        const available = new Date(state.reportAvailableAt);
                        const diffMs = available.getTime() - Date.now();
                        if (diffMs > 0) {
                          const hours = Math.ceil(diffMs / (1000 * 60 * 60));
                          return <Badge variant="secondary">Envio desbloqueado em {hours}h</Badge>;
                        }
                        return <Badge variant={reportEligible ? "default" : "secondary"}>{reportEligible ? "Envio disponível" : "Aguardando elegibilidade"}</Badge>;
                      })()
                    ) : (
                      <Badge variant={reportEligible ? "default" : "secondary"}>
                        {reportEligible ? "Envio disponível" : "Aguardando elegibilidade"}
                      </Badge>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {state.hasInternship && state.schoolId ? (
            <SchoolProfileCard
              schoolId={state.schoolId}
              title="Informação da Escola"
              description="Disponível porque já existe estágio criado."
            />
          ) : null}
        </>
      )}
    </div>
  );
}
