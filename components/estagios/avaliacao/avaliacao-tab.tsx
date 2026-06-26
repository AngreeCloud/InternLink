"use client";

import { useEffect, useRef, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Lock, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { EstagioRole } from "@/lib/estagios/permissions";
import type {
  AvaliacaoConfig,
  NotasTutor,
  NotaFinalProfessor,
  CursoDatasAvaliacao,
} from "@/lib/avaliacao/types";
import { TutorEvaluationForm } from "./tutor-evaluation-form";
import { ProfessorEvaluationView } from "./professor-evaluation-view";
import { AlunoEvaluationView } from "./aluno-evaluation-view";
import { calculateNotaFinal } from "@/lib/avaliacao/validations";

type Props = {
  estagioId: string;
  schoolId: string;
  courseId?: string;
  currentUserId: string;
  currentUserRole: EstagioRole;
};

export function AvaliacaoTab({
  estagioId,
  schoolId,
  courseId,
  currentUserId,
  currentUserRole,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AvaliacaoConfig | null>(null);
  const [datas, setDatas] = useState<CursoDatasAvaliacao | null>(null);
  const [tutorData, setTutorData] = useState<NotasTutor | null>(null);
  const [professorData, setProfessorData] =
    useState<NotaFinalProfessor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubs: (() => void)[] = [];

    (async () => {
      const db = await getDbRuntime();
      if (cancelled) return;

      // Load school config
      try {
        const schoolSnap = await getDoc(doc(db, "schools", schoolId));
        if (!cancelled && schoolSnap.exists()) {
          const schoolData = schoolSnap.data() as Record<string, unknown>;
          const cfg = schoolData.avaliacaoConfig as
            | AvaliacaoConfig
            | undefined;
          if (cfg && cfg.parametros && cfg.parametros.length > 0) {
            setConfig(cfg);
          }
        }
      } catch {
        // ignore
      }

      // Load course dates
      if (courseId) {
        try {
          const datasSnap = await getDoc(
            doc(db, "courses", courseId, "settings", "avaliacaoDatas")
          );
          if (!cancelled && datasSnap.exists()) {
            setDatas(datasSnap.data() as CursoDatasAvaliacao);
          }
        } catch {
          // ignore
        }
      }

      // Subscribe to tutor evaluation
      const unsubTutor = onSnapshot(
        doc(db, "estagios", estagioId, "avaliacao", "tutor"),
        (snap) => {
          if (cancelled) return;
          if (snap.exists()) {
            setTutorData(snap.data() as NotasTutor);
          } else {
            setTutorData(null);
          }
        },
        () => {
          // permission-denied silently ignored
        }
      );
      unsubs.push(unsubTutor);

      // Subscribe to professor evaluation
      const unsubProf = onSnapshot(
        doc(db, "estagios", estagioId, "avaliacao", "professor"),
        (snap) => {
          if (cancelled) return;
          if (snap.exists()) {
            setProfessorData(snap.data() as NotaFinalProfessor);
          } else {
            setProfessorData(null);
          }
        },
        () => {
          // permission-denied silently ignored
        }
      );
      unsubs.push(unsubProf);

      setLoading(false);
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [estagioId, schoolId, courseId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-start gap-3 py-8">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Erro</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No config = show message
  if (!config) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-muted p-3 text-muted-foreground">
            <Star className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-balance">
            Sistema de avaliação não configurado
          </h3>
          <p className="max-w-md text-sm text-muted-foreground text-pretty">
            O administrador escolar ainda não configurou o sistema de avaliação.
            Sem esta configuração, não é possível preencher ou visualizar
            avaliações.
          </p>
        </CardContent>
      </Card>
    );
  }

  const notaFinalCalculada =
    tutorData?.parametros
      ? calculateNotaFinal(tutorData.parametros, config)
      : null;

  return (
    <div className="space-y-6">
      {currentUserRole === "tutor" && (
        <TutorEvaluationForm
          estagioId={estagioId}
          config={config}
          tutorData={tutorData}
          datas={datas}
        />
      )}

      {(currentUserRole === "professor" || currentUserRole === "diretor") && (
        <ProfessorEvaluationView
          estagioId={estagioId}
          config={config}
          tutorData={tutorData}
          professorData={professorData}
          notaFinalCalculada={notaFinalCalculada}
          datas={datas}
          courseId={courseId}
          isDirector={currentUserRole === "diretor"}
        />
      )}

      {currentUserRole === "aluno" && (
        <AlunoEvaluationView
          config={config}
          tutorData={tutorData}
          professorData={professorData}
          notaFinalCalculada={notaFinalCalculada}
          datas={datas}
        />
      )}
    </div>
  );
}
