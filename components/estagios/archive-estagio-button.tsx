"use client";

import { useEffect, useState } from "react";
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
import { Archive, ArchiveX } from "lucide-react";

type Props = {
  estagioId: string;
  schoolId: string;
  estado: string;
  dataFimEstimada?: string;
  onArchived?: () => void;
};

export function ArchiveEstagioButton({ estagioId, schoolId, estado, dataFimEstimada, onArchived }: Props) {
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/estagios/${estagioId}/relatorio-final`);
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { report?: unknown };
          setReportSubmitted(Boolean(data.report));
        }
      } catch {
        // assume report not submitted
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [estagioId]);

  const pastEndDate = dataFimEstimada ? new Date(dataFimEstimada) < new Date() : false;
  const canArchive = !checking && reportSubmitted && pastEndDate && estado !== "arquivado";

  const disabledReasons: string[] = [];
  if (!reportSubmitted) disabledReasons.push("Relatório final ainda não foi submetido");
  if (!pastEndDate) disabledReasons.push("Estágio ainda não passou da data prevista de término");
  if (estado === "arquivado") disabledReasons.push("Estágio já arquivado");

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const db = await getDbRuntime();
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

  if (estado === "arquivado") return null;

  return (
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canArchive}
          title={disabledReasons.length > 0 ? disabledReasons.join(". ") : "Arquivar estágio"}
          className={canArchive ? "border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-400" : ""}
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
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={archiving}>Cancelar</Button>
          </DialogClose>
          <Button type="button" variant="default" onClick={handleArchive} disabled={archiving}>
            {archiving ? "A arquivar..." : "Confirmar arquivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
