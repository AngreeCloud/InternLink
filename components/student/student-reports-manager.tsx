"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Report = {
  id: string;
  title: string;
  summary: string;
  updatedAtLabel: string;
};

type ReportState = {
  loading: boolean;
  saving: boolean;
  studentId: string;
  courseId: string;
  completedHours: number;
  reportMinHours: number;
  reportWaitDays: number;
  internshipStartDate: string;
  reports: Report[];
  title: string;
  summary: string;
  editingReportId: string;
};

const DEFAULT_MIN_HOURS = 80;

const parseDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function StudentReportsManager() {
  const [state, setState] = useState<ReportState>({
    loading: true,
    saving: false,
    studentId: "",
    courseId: "",
    completedHours: 0,
    reportMinHours: DEFAULT_MIN_HOURS,
    reportWaitDays: 0,
    internshipStartDate: "",
    reports: [],
    title: "",
    summary: "",
    editingReportId: "",
  });

  const loadData = async (studentId: string) => {
    const db = await getDbRuntime();

    const userSnap = await getDoc(doc(db, "users", studentId));
    const userData = userSnap.exists()
      ? (userSnap.data() as {
          courseId?: string;
        })
      : {};

    const internshipSnap = await getDocs(query(collection(db, "internships"), where("studentId", "==", studentId)));
    const internshipData = internshipSnap.docs[0]?.data() as
      | {
          serviceHoursCompleted?: number;
          completedHours?: number;
          internshipStartDate?: string;
          startDate?: string;
        }
      | undefined;

    let reportMinHours = DEFAULT_MIN_HOURS;
    let reportWaitDays = 0;
    let internshipStartDate = internshipData?.internshipStartDate || internshipData?.startDate || "";

    if (userData.courseId) {
      const courseSnap = await getDoc(doc(db, "courses", userData.courseId));
      if (courseSnap.exists()) {
        const courseData = courseSnap.data() as {
          reportMinHours?: number;
          reportWaitDays?: number;
          internshipStartDate?: string;
        };
        reportMinHours = courseData.reportMinHours ?? DEFAULT_MIN_HOURS;
        reportWaitDays = courseData.reportWaitDays ?? 0;
        internshipStartDate = internshipStartDate || courseData.internshipStartDate || "";
      }
    }

    const reportsSnap = await getDocs(query(collection(db, "internshipReports"), where("studentId", "==", studentId)));
    const reports = reportsSnap.docs
      .map((docSnap) => {
        const data = docSnap.data() as {
          title?: string;
          summary?: string;
          updatedAt?: { toDate?: () => Date };
          createdAt?: { toDate?: () => Date };
        };
        const updatedAt = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || null;
        return {
          id: docSnap.id,
          title: data.title || "Relatório",
          summary: data.summary || "",
          updatedAtLabel: updatedAt ? updatedAt.toLocaleString("pt-PT") : "—",
          updatedAtSort: updatedAt?.getTime() || 0,
        };
      })
      .sort((a, b) => b.updatedAtSort - a.updatedAtSort)
      .map(({ updatedAtSort, ...report }) => report);

    setState((prev) => ({
      ...prev,
      loading: false,
      studentId,
      courseId: userData.courseId || "",
      completedHours: internshipData?.serviceHoursCompleted ?? internshipData?.completedHours ?? 0,
      reportMinHours,
      reportWaitDays,
      internshipStartDate,
      reports,
    }));
  };

  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;

    (async () => {
      const auth = await getAuthRuntime();
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user || !active) {
          if (active) {
            setState((prev) => ({ ...prev, loading: false }));
          }
          return;
        }

        await loadData(user.uid);
      });
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const waitDate = useMemo(() => {
    const start = parseDate(state.internshipStartDate);
    if (!start) return null;
    const availableDate = new Date(start);
    availableDate.setDate(availableDate.getDate() + state.reportWaitDays);
    return availableDate;
  }, [state.internshipStartDate, state.reportWaitDays]);

  const waitPeriodPassed = useMemo(() => {
    if (!waitDate) return true;
    return waitDate.getTime() <= Date.now();
  }, [waitDate]);

  const hoursPassed = state.completedHours >= state.reportMinHours;
  const canManageReports = hoursPassed && waitPeriodPassed;

  const lockReason = useMemo(() => {
    if (canManageReports) return "";
    if (!hoursPassed) {
      return `Necessita de ${state.reportMinHours}h mínimas. Horas atuais: ${state.completedHours}h.`;
    }
    if (!waitPeriodPassed && waitDate) {
      return `Envio disponível a partir de ${waitDate.toLocaleDateString("pt-PT")}.`;
    }
    return "Aguardando elegibilidade para relatório.";
  }, [canManageReports, hoursPassed, state.completedHours, state.reportMinHours, waitPeriodPassed, waitDate]);

  const resetForm = () => {
    setState((prev) => ({ ...prev, title: "", summary: "", editingReportId: "" }));
  };

  const handleSave = async () => {
    if (!state.studentId || !state.title.trim() || !canManageReports) return;

    setState((prev) => ({ ...prev, saving: true }));
    try {
      const db = await getDbRuntime();
      if (state.editingReportId) {
        await updateDoc(doc(db, "internshipReports", state.editingReportId), {
          title: state.title.trim(),
          summary: state.summary.trim(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "internshipReports"), {
          studentId: state.studentId,
          courseId: state.courseId || null,
          title: state.title.trim(),
          summary: state.summary.trim(),
          status: "submetido",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // TODO: Associar ficheiro do relatório (upload/storage) numa iteração futura.
        });
      }

      resetForm();
      await loadData(state.studentId);
    } finally {
      setState((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleEdit = (report: Report) => {
    if (!canManageReports) return;
    setState((prev) => ({
      ...prev,
      editingReportId: report.id,
      title: report.title,
      summary: report.summary,
    }));
  };

  const handleDelete = async (reportId: string) => {
    if (!canManageReports) return;
    if (!window.confirm("Eliminar este relatório?")) return;

    const db = await getDbRuntime();
    await deleteDoc(doc(db, "internshipReports", reportId));
    await loadData(state.studentId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatório de Estágio</h1>
        <p className="text-muted-foreground">Envie, atualize e elimine relatórios quando as regras do curso permitirem.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regras do curso</CardTitle>
          <CardDescription>
            Horas mínimas: {state.reportMinHours}h • Período de espera: {state.reportWaitDays} dia(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">Horas de estágio registadas: {state.completedHours}h</p>
          <Badge variant={canManageReports ? "default" : "secondary"}>
            {canManageReports ? "Envio de relatório disponível" : "Envio bloqueado"}
          </Badge>
          {!canManageReports && <p className="text-xs text-muted-foreground">{lockReason}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{state.editingReportId ? "Atualizar relatório" : "Enviar relatório"}</CardTitle>
          <CardDescription>
            TODO: upload de ficheiro para Storage e versão final do fluxo de submissão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={state.title}
              onChange={(event) => setState((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Ex: Relatório final de estágio"
            />
          </div>
          <div className="space-y-2">
            <Label>Resumo</Label>
            <Textarea
              value={state.summary}
              onChange={(event) => setState((prev) => ({ ...prev, summary: event.target.value }))}
              placeholder="Descreva atividades, resultados e aprendizagens."
              className="min-h-[120px]"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!canManageReports || state.saving || !state.title.trim()}>
              {state.saving ? "A guardar..." : state.editingReportId ? "Atualizar" : "Enviar"}
            </Button>
            {state.editingReportId && (
              <Button variant="outline" onClick={resetForm}>
                Cancelar edição
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relatórios enviados</CardTitle>
          <CardDescription>Histórico de submissões do seu estágio.</CardDescription>
        </CardHeader>
        <CardContent>
          {state.loading ? (
            <p className="text-sm text-muted-foreground">A carregar relatórios...</p>
          ) : state.reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não existem relatórios enviados.</p>
          ) : (
            <div className="space-y-3">
              {state.reports.map((report) => (
                <div key={report.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{report.title}</p>
                      <p className="text-xs text-muted-foreground">Última atualização: {report.updatedAtLabel}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(report)} disabled={!canManageReports}>
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(report.id)} disabled={!canManageReports}>
                        Eliminar
                      </Button>
                    </div>
                  </div>
                  {report.summary && <p className="mt-2 text-sm text-muted-foreground">{report.summary}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
