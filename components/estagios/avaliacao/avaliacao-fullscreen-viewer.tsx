"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileDown, X, Loader2 } from "lucide-react";
import { PdfViewer } from "../pdf/pdf-viewer";

type Props = {
  open: boolean;
  onClose: () => void;
  estagioId: string;
  pdfType: "tutor" | "nota-final";
  title: string;
};

function buildPdfUrl(estagioId: string, pdfType: "tutor" | "nota-final", withSignatures: boolean): string {
  const sigs = withSignatures ? "" : "?assinaturas=false";
  return `/api/estagios/${estagioId}/avaliacao/pdf/${pdfType}${sigs}`;
}

async function triggerDownload(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) return;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export function AvaliacaoFullscreenViewer({
  open,
  onClose,
  estagioId,
  pdfType,
  title,
}: Props) {
  const [loading, setLoading] = useState(true);

  if (!open) return null;

  const pdfUrl = buildPdfUrl(estagioId, pdfType, true);

  const handleDownload = (withSignatures: boolean) => {
    const url = buildPdfUrl(estagioId, pdfType, withSignatures);
    const sigLabel = withSignatures ? "assinado" : "sem-assinaturas";
    triggerDownload(url, `avaliacao-${pdfType}-${estagioId}-${sigLabel}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h1 className="text-sm font-semibold truncate">{title}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload(true)}
          >
            <Download className="mr-2 h-4 w-4" />
            Com assinaturas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload(false)}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Sem assinaturas
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="mr-2 h-4 w-4" />
            Fechar
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <PdfViewer
          fileUrl={pdfUrl}
          onPagesReady={() => setLoading(false)}
          onError={() => setLoading(false)}
          className="h-full"
        />
      </div>
    </div>
  );
}
