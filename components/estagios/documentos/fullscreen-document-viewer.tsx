"use client";

import { useState, useCallback } from "react";
import { ArrowLeft, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/components/estagios/pdf/pdf-viewer";
import { DocxPreview } from "./docx-preview";

type DocumentType = "pdf" | "docx";

type FullscreenDocumentViewerProps = {
  fileUrl?: string;
  fileBytes?: Uint8Array;
  fileName: string;
  fileType: DocumentType;
  onClose: () => void;
};

export function FullscreenDocumentViewer({
  fileUrl,
  fileBytes,
  fileName,
  fileType,
  onClose,
}: FullscreenDocumentViewerProps) {
  const [pdfScale, setPdfScale] = useState(1.5);
  const MAX_SCALE = 2.5;
  const MIN_SCALE = 0.8;

  const handleZoomIn = useCallback(() => {
    setPdfScale((prev) => Math.min(prev + 0.3, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPdfScale((prev) => Math.max(prev - 0.3, MIN_SCALE));
  }, []);

  const handleResetZoom = useCallback(() => {
    setPdfScale(1.5);
  }, []);

  const zoomPercent = Math.round((pdfScale / 1.5) * 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3 flex-shrink-0">
        <div className="flex flex-1 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-foreground">{fileName}</h2>
            <p className="text-xs text-muted-foreground">
              {fileType === "pdf" ? "Documento PDF" : "Documento DOCX"}
            </p>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={pdfScale <= MIN_SCALE}
            title="Reduzir"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetZoom}
            className="min-w-[60px] text-xs"
            title="Repor zoom"
          >
            {zoomPercent}%
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={pdfScale >= MAX_SCALE}
            title="Aumentar"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-muted/10 p-3">
        <div className="mx-auto">
          {fileType === "pdf" && fileUrl ? (
            <PdfViewer 
              fileUrl={fileUrl} 
              scale={pdfScale} 
              className="w-full max-w-4xl mx-auto"
            />
          ) : fileType === "docx" && fileBytes ? (
            <div className="mx-auto max-w-4xl rounded-md border bg-white p-6 shadow-sm select-text">
              <DocxPreview fileBytes={fileBytes} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
