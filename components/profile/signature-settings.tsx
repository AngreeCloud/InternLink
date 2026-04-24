"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PenTool, Trash2, Upload, Signature, Save, Loader2, Check } from "lucide-react";
import { SignaturePad, type SignaturePadHandle } from "@/components/estagios/signature-pad";

type SavedSignature = {
  exists: boolean;
  dataUrl?: string;
  source?: "drawn" | "uploaded";
};

export function SignatureSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState<SavedSignature>({ exists: false });
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [pendingDataUrl, setPendingDataUrl] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle | null>(null);

  const loadSaved = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users/me/signature", { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        exists?: boolean;
        data?: { dataUrl?: string; source?: "drawn" | "uploaded" };
      };
      if (data.exists && data.data?.dataUrl) {
        setSaved({
          exists: true,
          dataUrl: data.data.dataUrl,
          source: data.data.source,
        });
      } else {
        setSaved({ exists: false });
      }
    } catch (err) {
      console.error("[v0] signature GET failed", err);
      setSaved({ exists: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("O ficheiro tem de ser uma imagem.");
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 1,5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPendingDataUrl(result);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureDrawing = () => {
    const dataUrl = padRef.current?.toDataUrl();
    if (!dataUrl) {
      setError("Desenhe a sua assinatura antes de guardar.");
      return;
    }
    setPendingDataUrl(dataUrl);
    setError(null);
  };

  const handleSave = async () => {
    if (!pendingDataUrl) {
      if (mode === "draw") {
        const dataUrl = padRef.current?.toDataUrl();
        if (!dataUrl) {
          setError("Desenhe a sua assinatura antes de guardar.");
          return;
        }
        setPendingDataUrl(dataUrl);
        await persist(dataUrl);
        return;
      }
      setError("Escolha uma imagem antes de guardar.");
      return;
    }
    await persist(pendingDataUrl);
  };

  const persist = async (dataUrl: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/users/me/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl,
          source: mode === "upload" ? "uploaded" : "drawn",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Não foi possível guardar a assinatura.");
        return;
      }
      setPendingDataUrl("");
      padRef.current?.clear();
      await loadSaved();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/users/me/signature", { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Não foi possível apagar a assinatura.");
        return;
      }
      setSaved({ exists: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Signature className="h-5 w-5" />
          Assinatura digital
        </CardTitle>
        <CardDescription>
          Guarde a sua assinatura para assinar documentos dos estágios com um clique. Pode desenhar
          ou carregar uma imagem com fundo transparente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />A carregar...
          </div>
        ) : saved.exists && saved.dataUrl ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Assinatura atual
            </Label>
            <div className="flex items-center justify-center rounded-md bg-card p-3">
              <img
                src={saved.dataUrl || "/placeholder.svg"}
                alt="Assinatura guardada"
                className="max-h-28"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Origem: {saved.source === "uploaded" ? "Imagem carregada" : "Desenhada"}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleting ? "A apagar..." : "Apagar"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ainda não configurou uma assinatura. Crie uma abaixo.
          </p>
        )}

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "draw" ? "default" : "outline"}
              onClick={() => {
                setMode("draw");
                setPendingDataUrl("");
                setError(null);
              }}
            >
              <PenTool className="mr-2 h-4 w-4" />
              Desenhar
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "upload" ? "default" : "outline"}
              onClick={() => {
                setMode("upload");
                setPendingDataUrl("");
                setError(null);
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              Carregar imagem
            </Button>
          </div>

          {mode === "draw" ? (
            <div className="space-y-2">
              <Label>Desenhe a sua assinatura</Label>
              <SignaturePad ref={padRef} width={440} height={160} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    padRef.current?.clear();
                    setPendingDataUrl("");
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpar
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleCaptureDrawing}>
                  <Check className="mr-2 h-4 w-4" />
                  Pré-visualizar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="signature-upload">Imagem (PNG com fundo transparente)</Label>
              <Input
                id="signature-upload"
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleUpload}
              />
            </div>
          )}

          {pendingDataUrl ? (
            <div className="rounded-md border border-dashed border-border bg-card p-3">
              <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
                Pré-visualização
              </Label>
              <img
                src={pendingDataUrl || "/placeholder.svg"}
                alt="Pré-visualização da assinatura"
                className="max-h-28"
              />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Assinatura guardada com sucesso.
            </div>
          ) : null}

          <Button type="button" onClick={handleSave} disabled={saving} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "A guardar..." : "Guardar assinatura"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
