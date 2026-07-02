"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, PenTool, Signature, AlertCircle, Trash2 } from "lucide-react";
import { SignaturePad, type SignaturePadHandle } from "@/components/estagios/signature-pad";
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

type SavedSignature = {
  exists: boolean;
  dataUrl?: string;
  source?: string;
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
  const [mode, setMode] = useState<"saved" | "draw">("saved");
  const [savedSignature, setSavedSignature] = useState<SavedSignature>({ exists: false });
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle | null>(null);

  const consentText = CONSENT_BY_ROLE[currentUserRole] ?? CONSENT_BY_ROLE.diretor;

  useEffect(() => {
    if (!open) {
      setError(null);
      setSubmitting(false);
      return;
    }
    setLoadingSaved(true);
    fetch("/api/users/me/signature")
      .then((res) => res.json())
      .then((data: { exists?: boolean; data?: { dataUrl?: string; source?: string } }) => {
        if (data.exists && data.data?.dataUrl) {
          setSavedSignature({ exists: true, dataUrl: data.data.dataUrl, source: data.data.source });
          setMode("saved");
        } else {
          setSavedSignature({ exists: false });
          setMode("draw");
        }
      })
      .catch(() => {
        setSavedSignature({ exists: false });
        setMode("draw");
      })
      .finally(() => setLoadingSaved(false));
  }, [open]);

  const handleSign = async () => {
    setError(null);

    let signatureDataUrl: string | null = null;
    if (mode === "saved") {
      signatureDataUrl = savedSignature.dataUrl ?? null;
    } else {
      signatureDataUrl = padRef.current?.toDataUrl() ?? null;
    }

    if (!signatureDataUrl) {
      setError("Assinatura em falta. Desenhe uma assinatura ou guarde uma no seu perfil.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/estagios/${estagioId}/documentos/${docId}/assinar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha ao registar a assinatura.");
        return;
      }
      onSigned();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Assinar relatório final</DialogTitle>
          <DialogDescription>{docNome}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 px-4 py-3 text-justify text-xs leading-relaxed text-muted-foreground">
            &ldquo;{consentText}&rdquo;
          </div>
          <p className="text-xs text-muted-foreground">
            Esta ação fica registada com a sua identidade e não pode ser revertida.
          </p>

          <div className="border-t pt-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "saved" ? "default" : "outline"}
                size="sm"
                disabled={!savedSignature.exists}
                onClick={() => setMode("saved")}
              >
                <Signature className="mr-2 h-4 w-4" />
                Usar assinatura guardada
              </Button>
              <Button
                type="button"
                variant={mode === "draw" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("draw")}
              >
                <PenTool className="mr-2 h-4 w-4" />
                Desenhar agora
              </Button>
            </div>

            {loadingSaved ? (
              <p className="text-sm text-muted-foreground">A carregar assinatura guardada...</p>
            ) : mode === "saved" ? (
              savedSignature.exists && savedSignature.dataUrl ? (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <Label className="mb-2 block text-xs">Assinatura guardada no perfil</Label>
                  <img
                    src={savedSignature.dataUrl}
                    alt="Assinatura guardada"
                    className="max-h-32 rounded bg-white"
                  />
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Ainda não configurou uma assinatura no perfil. Desenhe uma abaixo ou aceda ao Perfil
                    para configurar uma permanente.
                  </span>
                </div>
              )
            ) : (
              <div className="space-y-2">
                <Label>Desenhe a sua assinatura</Label>
                <SignaturePad ref={padRef} width={440} height={160} />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => padRef.current?.clear()}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpar
                </Button>
              </div>
            )}
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSign} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A registar...
              </>
            ) : (
              "Li e concordo — Assinar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
