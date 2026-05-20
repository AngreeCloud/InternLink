"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatIsoPt } from "@/lib/estagios/workdays";

type PendingSummary = {
  estagioId: string;
  studentName: string;
  courseName: string;
  schoolId: string;
  weekId: string;
  weekNumber: number;
  weekYear: number;
  weekStart: string;
  weekEnd: string;
  content: string;
  changeRequested: boolean;
};

export function TutorSummariesValidation() {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<PendingSummary[]>([]);

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setSummaries([]);
          setLoading(false);
          return;
        }

        try {
          const estagiosSnap = await getDocs(
            query(collection(db, "estagios"), where("tutorId", "==", user.uid))
          );

          const list: PendingSummary[] = [];

          for (const estagioDoc of estagiosSnap.docs) {
            const estagioData = estagioDoc.data();
            const schoolId = estagioData.schoolId || "";
            const studentId = estagioData.alunoId || "";
            
            let studentName = "Aluno";
            let courseName = "Curso";

            if (studentId) {
              const studentSnap = await getDoc(doc(db, "users", studentId));
              if (studentSnap.exists()) {
                const sData = studentSnap.data();
                studentName = sData.nome || studentName;
                courseName = sData.curso || courseName;
              }
            }

            const sumariosSnap = await getDocs(
              query(collection(db, "estagios", estagioDoc.id, "sumarios"), where("estado", "==", "preenchido"))
            );

            for (const sumarioDoc of sumariosSnap.docs) {
              const sumarioData = sumarioDoc.data();
              if (sumarioData.signedByTutor) continue;

              list.push({
                estagioId: estagioDoc.id,
                studentName,
                courseName,
                schoolId,
                weekId: sumarioData.weekId || sumarioDoc.id,
                weekNumber: sumarioData.weekNumber || 0,
                weekYear: sumarioData.weekYear || 0,
                weekStart: sumarioData.weekStart || "",
                weekEnd: sumarioData.weekEnd || "",
                content: sumarioData.content || "",
                changeRequested: !!sumarioData.changeRequested,
              });
            }
          }

          list.sort((a, b) => {
            if (a.weekYear !== b.weekYear) return b.weekYear - a.weekYear;
            return b.weekNumber - a.weekNumber;
          });

          setSummaries(list);
        } catch (error) {
          console.error("Erro ao carregar sumários:", error);
        } finally {
          setLoading(false);
        }
      });
    })();

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Validação de Sumários</h1>
        <p className="text-muted-foreground">
          Reveja e valide os sumários preenchidos pelos seus formandos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sumários Pendentes</CardTitle>
          <CardDescription>
            {loading ? "A carregar..." : `${summaries.length} sumário(s) a aguardar validação`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : summaries.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Não tem sumários pendentes de validação.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {summaries.map((summary) => (
                <div
                  key={`${summary.estagioId}-${summary.weekId}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border rounded-lg gap-4 bg-card"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-medium text-foreground">{summary.studentName}</h4>
                      {summary.changeRequested ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          Alteração Solicitada
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pendente</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{summary.courseName}</p>
                    <p className="text-xs text-muted-foreground">
                      Semana {summary.weekNumber} • {summary.weekYear} ({summary.weekStart} a {summary.weekEnd})
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2 italic">
                      "{summary.content}"
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/tutor/estagios/${summary.schoolId}/${summary.estagioId}?tab=sumarios`}>
                        Ver Sumário
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
