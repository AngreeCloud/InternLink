"use client";

import { useMemo, useState } from "react";
import {
  PdfViewer,
  type PdfPageInfo,
} from "@/components/estagios/pdf/pdf-viewer";
import type { EstagioRole } from "@/lib/estagios/permissions";

type SignatureRolesPreviewProps = {
  fileBytes: Uint8Array;
  signatureRoles: EstagioRole[];
};

const PREVIEW_SCALE = 0.6;

const COLOR_BY_ROLE: Record<EstagioRole, string> = {
  diretor: "#0ea5e9",
  professor: "#16a34a",
  tutor: "#ea580c",
  aluno: "#7c3aed",
};

const ROLE_LABEL: Record<EstagioRole, string> = {
  diretor: "Diretor",
  professor: "Orientador",
  tutor: "Tutor",
  aluno: "Aluno",
};

function generateBoxes(roles: EstagioRole[], pageNumber: number) {
  const boxW = 0.44;
  const boxH = 0.057;
  const x = (1 - boxW) / 2;
  const startY = 1 - (roles.length * (boxH + 0.015) + 0.05);
  return roles.map((role, i) => {
    const y = Math.max(startY + i * (boxH + 0.015), 0.025);
    return {
      id: `auto-${role}`,
      role,
      page: pageNumber,
      x,
      y,
      width: boxW,
      height: boxH,
      label: ROLE_LABEL[role],
    };
  });
}

export function SignatureRolesPreview({
  fileBytes,
  signatureRoles,
}: SignatureRolesPreviewProps) {
  const [pdfPages, setPdfPages] = useState<PdfPageInfo[]>([]);

  const handlePagesReady = (pages: PdfPageInfo[]) => {
    setPdfPages(pages);
  };

  const virtualPageNumber = pdfPages.length + 1;

  const boxes = useMemo(() => {
    if (signatureRoles.length === 0) return [];
    return generateBoxes(signatureRoles, virtualPageNumber);
  }, [signatureRoles, virtualPageNumber]);

  const CSS_W = 595.28 * PREVIEW_SCALE;
  const CSS_H = 841.89 * PREVIEW_SCALE;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          Documento original ({pdfPages.length} página{pdfPages.length !== 1 ? "s" : ""})
        </p>
        <div className="overflow-y-auto rounded-lg border border-border bg-muted/10" style={{ maxHeight: 420 }}>
          <PdfViewer
            fileBytes={fileBytes}
            scale={PREVIEW_SCALE}
            onPagesReady={handlePagesReady}
          />
        </div>
      </div>

      {signatureRoles.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Página de Assinaturas (gerada automaticamente)
          </p>
          <div
            className="relative mx-auto overflow-hidden rounded-lg border border-border bg-card shadow-sm"
            style={{ width: CSS_W, height: CSS_H }}
          >
            <div
              className="flex items-center justify-center border-b border-border px-6 py-4"
              style={{ height: 56 }}
            >
              <span className="text-sm font-bold tracking-wide text-foreground">
                InternLink
              </span>
            </div>

            <div
              className="absolute inset-x-0 mx-auto flex items-center justify-center font-semibold text-foreground"
              style={{ top: 72, height: 28 }}
            >
              Página de Assinaturas
            </div>

            {boxes.map((box) => (
              <div
                key={box.id}
                className="flex items-center justify-center rounded-md border-2 border-dashed bg-white/80 text-xs font-medium"
                style={{
                  position: "absolute",
                  left: `${box.x * CSS_W}px`,
                  top: `${box.y * CSS_H}px`,
                  width: `${box.width * CSS_W}px`,
                  height: `${box.height * CSS_H}px`,
                  borderColor: COLOR_BY_ROLE[box.role],
                  color: COLOR_BY_ROLE[box.role],
                }}
              >
                {ROLE_LABEL[box.role]}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
