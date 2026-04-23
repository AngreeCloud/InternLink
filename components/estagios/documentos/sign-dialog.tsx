"use client";

import { useEffect, useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getStorageRuntime } from "@/lib/firebase-runtime";
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
import { Loader2, PenTool, Signature, Trash2 } from "lucide-react";
import { SignaturePad, type SignaturePadHandle } from "@/components/estagios/signature-pad";

export type SignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estagioId: string;
  docId: string;
  docNome: string;
  onSigned: () => void;
};

type SavedSignature = {
  exists: boolean;
  dataUrl?: string;
  source?: string;
};

export function SignDialog({ open, onOpenChange, estagioId, docId, docNome, onSigned }: SignDialogProps) {
  const [mode, setMode] = useState<"saved" | "draw">("saved");
  const [savedSignature, setSavedSignature] = useState<SavedSignature>({ exists: false });
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle | null>(null);

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

  const handleConfirm = async () => {
    setError(null);
    let signatureDataUrl: string | null = null;
    if (mode === "saved") {
      signatureDataUrl = savedSignature.dataUrl ?? null;
    } else {
      signatureDataUrl = padRef.current?.toDataUrl() ?? null;
    }
    if (!signatureDataUrl) {
      setError("Assinatura em falta. Desenhe ou guarde uma assinatura no perfil.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/estagios/${estagioId}/documentos/${docId}/assinar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        pdfBase64?: string;
        newVersion?: number;
        allSigned?: boolean;
      };
      if (!res.ok || !data.ok || !data.pdfBase64 || !data.newVersion) {
        setError(data.error || "Falha a aplicar a assinatura.");
        return;
      }

      // Upload do PDF assinado ao Storage
      const signedBytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
      const storage = await getStorageRuntime();
      const newPath = `estagios/${estagioId}/documentos/${docId}/v${data.newVersion}-signed.pdf`;
      const sRef = ref(storage, newPath);
      await uploadBytes(sRef, signedBytes, { contentType: "application/pdf" });
      const downloadUrl = await getDownloadURL(sRef);

      // PATCH: update currentFileUrl, bumpVersion=false (já subimos), mas registar manualmente o arquivo.
      const patch = await fetch(`/api/estagios/${estagioId}/documentos/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentFileUrl: downloadUrl,
          currentFilePath: newPath,
          bumpVersion: true,
          estado: data.allSigned ? "assinado" : "aguarda_assinatura",
          versionNotes: data.allSigned ? "Assinado por todos os signatários." : "Assinatura aplicada.",
        }),
      });
      const patchData = (await patch.json()) as { ok?: boolean; error?: string };
      if (!patch.ok || !patchData.ok) {
        setError(patchData.error || "Falha a registar a versão assinada.");
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assinar: {docNome}</DialogTitle>
          <DialogDescription>
            A sua assinatura será aplicada ao documento e arquivada como nova versão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "saved" ? "default" : "outline"}
              size="sm"
              disabled={!savedSignature.exists}
              onClick={() => setMode("saved")}
            >
              <Signature className="mr-2 h-4 w-4" />
              Usar guardada
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
                <Label className="mb-2 block text-xs">Assinatura guardada</Label>
                <img
                  src={savedSignature.dataUrl || "/placeholder.svg"}
                  alt="Assinatura guardada"
                  className="max-h-32 rounded bg-white"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ainda não guardou uma assinatura no perfil. Desenhe abaixo ou aceda ao Perfil para configurar.
              </p>
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
          <Button type="button" onClick={handleConfirm} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A assinar...
              </>
            ) : (
              "Confirmar assinatura"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
