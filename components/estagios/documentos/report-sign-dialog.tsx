"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SignDialog } from "@/components/estagios/documentos/sign-dialog";
import type { EstagioRole } from "@/lib/estagios/permissions";

type ReportSignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estagioId: string;
  docId: string;
  docNome: string;
  currentUserRole: EstagioRole;
  onSigned: () => void;
};

const CONSENT_BY_ROLE: Record<EstagioRole, string> = {
  aluno:
    "Declaro que o presente relatório final de estágio é da minha autoria, que o conteúdo é verdadeiro e reflete fielmente o trabalho por mim realizado durante o período de estágio.",
  professor:
    "Declaro que revi o relatório final de estágio apresentado pelo aluno e confirmo que o mesmo cumpre os requisitos académicos estabelecidos, refletindo o trabalho desenvolvido durante o estágio curricular.",
  tutor:
    "Declaro que tomei conhecimento do relatório final de estágio apresentado pelo formando e confirmo que as atividades e resultados descritos são compatíveis com o plano de formação em contexto de trabalho em vigor na empresa.",
  diretor:
    "Declaro que tomei conhecimento do relatório final de estágio e confirmo a sua conformidade com os requisitos do curso.",
};

export function ReportSignDialog({
  open,
  onOpenChange,
  estagioId,
  docId,
  docNome,
  currentUserRole,
  onSigned,
}: ReportSignDialogProps) {
  const [stage, setStage] = useState<"consent" | "sign">("consent");

  const consentText = CONSENT_BY_ROLE[currentUserRole] ?? CONSENT_BY_ROLE.diretor;

  const handleClose = () => {
    setStage("consent");
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStage("consent");
    }
    onOpenChange(open);
  };

  const handleConsent = () => {
    setStage("sign");
  };

  const handleSigned = () => {
    setStage("consent");
    onSigned();
  };

  return (
    <>
      <AlertDialog
        open={open && stage === "consent"}
        onOpenChange={(o) => {
          if (!o) handleClose();
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Assinar relatório final</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {docNome}
            </p>
            <div className="rounded-md border bg-muted/30 px-4 py-3 text-justify text-xs leading-relaxed text-muted-foreground">
              &ldquo;{consentText}&rdquo;
            </div>
            <p className="text-xs text-muted-foreground">
              Esta ação fica registada com a sua identidade e não pode ser revertida.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConsent}>
              Li e concordo — Prosseguir para assinatura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SignDialog
        open={open && stage === "sign"}
        onOpenChange={(o) => {
          if (!o) {
            setStage("consent");
            onOpenChange(false);
          }
        }}
        estagioId={estagioId}
        docId={docId}
        docNome={docNome}
        onSigned={handleSigned}
      />
    </>
  );
}
