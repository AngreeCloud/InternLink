"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Download, FileDown, Maximize2, ChevronDown } from "lucide-react";
import { PdfViewer } from "../pdf/pdf-viewer";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estagioId: string;
  pdfType: "tutor" | "nota-final";
  title: string;
  onOpenFullscreen?: () => void;
};

function buildPdfUrl(estagioId: string, pdfType: "tutor" | "nota-final"): string {
  return `/api/estagios/${estagioId}/avaliacao/pdf/${pdfType}`;
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

export function AvaliacaoPreviewDialog({
  open,
  onOpenChange,
  estagioId,
  pdfType,
  title,
  onOpenFullscreen,
}: Props) {
  const pdfUrl = buildPdfUrl(estagioId, pdfType);

  const handleDownload = (withSignatures: boolean, withComentarios = true) => {
    const params = new URLSearchParams();
    if (!withSignatures) params.set("assinaturas", "false");
    if (!withComentarios) params.set("comentarios", "false");
    const qs = params.toString();
    const url = `${pdfUrl}${qs ? "?" + qs : ""}`;
    let label = "";
    if (withSignatures && withComentarios) label = "completo";
    else if (withSignatures) label = "assinado-sem-comentarios";
    else if (withComentarios) label = "sem-assinaturas-com-comentarios";
    else label = "limpo";
    triggerDownload(url, `avaliacao-${pdfType}-${estagioId}-${label}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[98vw] max-h-[96vh] sm:max-w-[60rem] flex-col overflow-hidden p-0">
        <div className="shrink-0 px-6 pt-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Pré-visualização do documento PDF.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="shrink-0 flex items-center gap-2 px-6 pt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Descarregar
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {pdfType === "tutor" && (
                <>
                  <DropdownMenuItem onClick={() => handleDownload(true, true)}>
                    Com assinaturas e comentários
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownload(true, false)}>
                    Com assinaturas, sem comentários
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownload(false, true)}>
                    Sem assinaturas, com comentários
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownload(false, false)}>
                    Sem assinaturas, sem comentários
                  </DropdownMenuItem>
                </>
              )}
              {pdfType !== "tutor" && (
                <>
                  <DropdownMenuItem onClick={() => handleDownload(true, true)}>
                    Com assinaturas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownload(false, true)}>
                    Sem assinaturas
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {onOpenFullscreen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenFullscreen}
              className="ml-auto"
            >
              <Maximize2 className="mr-2 h-4 w-4" />
              Ecrã inteiro
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 pb-6 pt-4">
          {open && (
            <PdfViewer
              fileUrl={pdfUrl}
              className="w-full"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
