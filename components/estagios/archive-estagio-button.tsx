"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Archive, AlertCircle } from "lucide-react";
import { checkCanArchive, checkForceArchive, isPastEndDate } from "@/lib/estagios/archive-validations";
import type { ArchiveCheckInput } from "@/lib/estagios/archive-validations";

type Props = {
  estagioId: string;
  schoolId: string;
  estado: string;
  dataFimEstimada?: string;
  isSchoolAdmin?: boolean;
  onArchived?: () => void;
};

type ReportInfo = {
  submitted: boolean;
  allSigned: boolean;
};

export function ArchiveEstagioButton({ estagioId, schoolId, estado, dataFimEstimada, isSchoolAdmin, onArchived }: Props) {
  const [report, setReport] = useState<ReportInfo>({ submitted: false, allSigned: false });
  const [allSumariosOk, setAllSumariosOk] = useState(false);
  const [avaliacaoOk, setAvaliacaoOk] = useState(false);
  const [checking, setChecking] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [forceArchiving, setForceArchiving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await getDbRuntime();

        // Check report
        try {
          const res = await fetch(`/api/estagios/${estagioId}/relatorio-final`);
          if (res.ok) {
            const data = (await res.json()) as {
              ok?: boolean;
              report?: { submitted: boolean; allSigned: boolean } | null;
            };
            if (data.report) {
              setReport({
                submitted: data.report.submitted,
                allSigned: data.report.allSigned,
              });
            }
          }
        } catch { /* ignore */ }

        // Check sumários
        try {
          const sumariosSnap = await getDoc(doc(db, "estagios", estagioId, "sumarios", "_state"));
          if (!cancelled && sumariosSnap.exists()) {
            const sData = sumariosSnap.data() as {
              allPreenchidos?: boolean;
              allAssinados?: boolean;
            };
            setAllSumariosOk(
              sData.allPreenchidos === true && sData.allAssinados === true
            );
          }
        } catch { /* ignore */ }

        // Check avaliação
        try {
          const [tutorSnap, profSnap] = await Promise.all([
            getDoc(doc(db, "estagios", estagioId, "avaliacao", "tutor")),
            getDoc(doc(db, "estagios", estagioId, "avaliacao", "professor")),
          ]);
          if (!cancelled) {
            const tutorSigned = tutorSnap.exists()
              ? (tutorSnap.data() as { estado?: string }).estado === "assinado"
              : false;
            const profSigned = profSnap.exists()
              ? (profSnap.data() as { estado?: string }).estado === "assinado"
              : false;
            setAvaliacaoOk(tutorSigned && profSigned);
          }
        } catch { /* ignore */ }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [estagioId]);

  const archiveCheck = checkCanArchive({
    estado,
    dataFimEstimada,
    reportSubmitted: report.submitted,
    reportAllSigned: report.allSigned,
    allSumariosPreenchidos: allSumariosOk,
    allSumariosAssinados: allSumariosOk,
    avaliacaoTutorAssinada: avaliacaoOk,
    avaliacaoProfessorAssinada: avaliacaoOk,
  });

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/estagios/${estagioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estadoEstagio: "arquivado" }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        console.error("Erro ao arquivar estágio:", err.error);
        return;
      }
      setConfirmOpen(false);
      onArchived?.();
    } catch (error) {
      console.error("Erro ao arquivar estágio:", error);
    } finally {
      setArchiving(false);
    }
  };

  const handleForceArchive = async () => {
    setForceArchiving(true);
    try {
      const res = await fetch(`/api/estagios/${estagioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estadoEstagio: "arquivado", forceArchive: true }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        console.error("Erro ao forçar arquivo:", err.error);
        return;
      }
      setForceOpen(false);
      onArchived?.();
    } catch (error) {
      console.error("Erro ao forçar arquivo:", error);
    } finally {
      setForceArchiving(false);
    }
  };

  if (estado === "arquivado" || estado === "eliminado") return null;

  const forceCheck = checkForceArchive({ estado });
  const canForceArchive = isSchoolAdmin && !archiveCheck.canArchive && forceCheck.canArchive;

  return (
    <div className="flex items-center gap-2">
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!archiveCheck.canArchive || checking}
          title={archiveCheck.reasons.length > 0 ? archiveCheck.reasons.join(". ") : "Arquivar estágio"}
          className={archiveCheck.canArchive ? "border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-400" : ""}
        >
          <Archive className="mr-2 h-4 w-4" />
          Arquivar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arquivar estágio?</DialogTitle>
          <DialogDescription>
            O estágio será marcado como arquivado. Esta ação é registada no histórico da escola.
          </DialogDescription>
        </DialogHeader>
        {archiveCheck.reasons.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-700">Condições em falta:</p>
            <ul className="space-y-1">
              {archiveCheck.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={archiving}>Cancelar</Button>
          </DialogClose>
          <Button type="button" variant="default" onClick={handleArchive} disabled={archiving || !archiveCheck.canArchive}>
            {archiving ? "A arquivar..." : "Confirmar arquivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {canForceArchive && (
      <Dialog open={forceOpen} onOpenChange={setForceOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-red-500/40 text-red-700 hover:bg-red-50 dark:text-red-400"
            title="Forçar arquivamento (admin)"
          >
            <Archive className="mr-2 h-4 w-4" />
            Forçar arquivo
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forçar arquivamento?</DialogTitle>
            <DialogDescription>
              Como administrador escolar, pode forçar o arquivamento ignorando as condições em falta (relatório não assinado, sumários pendentes, avaliações incompletas). Esta ação é irreversível e fica registada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={forceArchiving}>Cancelar</Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={handleForceArchive} disabled={forceArchiving}>
              {forceArchiving ? "A arquivar..." : "Forçar arquivamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    </div>
  );
}
