"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileDown, Loader2, CheckCircle2, XCircle, AlertCircle, Eye } from "lucide-react";
import { FullscreenDocumentViewer } from "@/components/estagios/documentos/fullscreen-document-viewer";

type PreflightResult = {
  hasAnyPresenca: boolean;
  totalPresencas: number;
  presencasValidated: boolean;
  alunoHasSignature: boolean;
  tutorHasSignature: boolean;
  canExportSigned: boolean;
  schoolHasAddress: boolean;
};

type Props = {
  estagioId: string;
  currentUserRole: string;
  alunoId?: string;
  tutorId?: string;
};

export function PresencasExportPanel({ estagioId, currentUserRole, alunoId, tutorId }: Props) {
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<"signed" | "unsigned" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"signed" | "unsigned" | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [lastGeneratedMode, setLastGeneratedMode] = useState<"signed" | "unsigned" | null>(null);
  const normalizedRole = currentUserRole.toLowerCase();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/estagios/${estagioId}/presencas/export/preflight`);
        const data = await res.json() as { ok?: boolean } & PreflightResult;
        if (!cancelled && data.ok) {
          setPreflight(data);
        }
      } catch (err) {
        console.error("[v0] presencas export preflight", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [estagioId]);

  const generatePdfBlob = async (mode: "signed" | "unsigned"): Promise<Blob | null> => {
    if (lastGeneratedMode === mode && previewBlobUrl) {
      const res = await fetch(previewBlobUrl);
      return res.blob();
    }
    const res = await fetch(`/api/estagios/${estagioId}/presencas/export?mode=${mode}`);
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      setError(data.error || "Erro ao gerar PDF.");
      return null;
    }
    return res.blob();
  };

  const handleDownload = async (mode: "signed" | "unsigned") => {
    setDownloading(mode);
    setError(null);
    try {
      const blob = await generatePdfBlob(mode);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Registo_Presencas.${mode === "signed" ? "assinado" : "sem_assinaturas"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = async (mode: "signed" | "unsigned") => {
    setError(null);
    try {
      if (lastGeneratedMode === mode && previewBlobUrl) {
        setPreviewMode(mode);
        return;
      }
      const blob = await generatePdfBlob(mode);
      if (!blob) return;
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      setLastGeneratedMode(mode);
      setPreviewMode(mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          A verificar requisitos...
        </CardContent>
      </Card>
    );
  }

  if (!preflight || !preflight.hasAnyPresenca) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileDown className="h-4 w-4" />
          Exportar Registo de Presenças
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Verificação de requisitos
        </p>

        <div className="space-y-2">
          <RequirementItem
            ok={preflight.presencasValidated}
            label="Presenças validadas pelo tutor"
          />

          <RequirementItem
            ok={preflight.alunoHasSignature}
            label="Assinatura do aluno configurada"
          />

          <RequirementItem
            ok={preflight.tutorHasSignature}
            label="Assinatura do tutor configurada"
          />
        </div>

        {!preflight.schoolHasAddress && ["admin_escolar", "professor", "diretor"].includes(normalizedRole) && (
          <div className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertCircle className="mr-1.5 inline h-3.5 w-3.5" />
            A morada da escola ainda n&atilde;o est&aacute; configurada.
          </div>
        )}

        <div className="border-t pt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={downloading !== null}
            onClick={() => handleDownload("unsigned")}
          >
            {downloading === "unsigned" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Descarregar sem assinaturas
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!preflight.canExportSigned || downloading !== null}
            onClick={() => handleDownload("signed")}
          >
            {downloading === "signed" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Descarregar com assinaturas
          </Button>

          <div className="w-full flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={downloading !== null}
              onClick={() => handlePreview("unsigned")}
            >
              <Eye className="mr-2 h-4 w-4" />
              Pré-visualizar PDF
            </Button>
            {preflight.canExportSigned && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={downloading !== null}
                onClick={() => handlePreview("signed")}
              >
                <Eye className="mr-2 h-4 w-4" />
                Pré-visualizar (c/ assinaturas)
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </CardContent>

      {previewMode && previewBlobUrl && (
        <FullscreenDocumentViewer
          fileUrl={previewBlobUrl}
          fileName={`Registo_Presencas.${previewMode === "signed" ? "assinado" : "sem_assinaturas"}.pdf`}
          fileType="pdf"
          onClose={() => setPreviewMode(null)}
        />
      )}
    </Card>
  );
}

function RequirementItem({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      )}
      <span className={ok ? "text-foreground" : "text-destructive"}>{label}</span>
    </div>
  );
}
