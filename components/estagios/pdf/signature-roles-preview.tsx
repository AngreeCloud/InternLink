"use client";

import React, { useState } from "react";
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
const ROLE_LABEL_PT: Record<EstagioRole, string> = {
  diretor: "Diretor de Curso",
  professor: "Orientador",
  tutor: "Tutor",
  aluno: "Aluno",
};

const MARGIN = 56;
const BRAND = "#1a3a5c";
const MUTED = "#737373";
const LINE = "#e0e0e0";

const S = (pt: number) => pt * PREVIEW_SCALE;

const CSS_W = 595.28 * PREVIEW_SCALE;
const CSS_H = 841.89 * PREVIEW_SCALE;

export function SignatureRolesPreview({
  fileBytes,
  signatureRoles,
}: SignatureRolesPreviewProps) {
  const [pdfPages, setPdfPages] = useState<PdfPageInfo[]>([]);

  const handlePagesReady = (pages: PdfPageInfo[]) => {
    setPdfPages(pages);
  };

  const topFrom = (pt: number) => S(pt);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          Documento original ({pdfPages.length} página
          {pdfPages.length !== 1 ? "s" : ""})
        </p>
        <div
          className="overflow-y-auto rounded-lg border border-border bg-muted/10"
          style={{ maxHeight: 420 }}
        >
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
              className="absolute"
              style={{
                left: S(MARGIN),
                top: topFrom(MARGIN + 14),
                fontSize: S(18),
                fontWeight: 700,
                color: BRAND,
              }}
            >
              InternLink
            </div>

            <div
              className="absolute"
              style={{
                left: S(MARGIN),
                right: S(MARGIN),
                top: topFrom(MARGIN + 30),
                height: S(0.75),
                backgroundColor: LINE,
              }}
            />

            <div
              className="absolute"
              style={{
                left: S(MARGIN),
                top: topFrom(MARGIN + 30 + 24),
                fontSize: S(13),
                fontWeight: 700,
                color: BRAND,
              }}
            >
              Página de Assinaturas
            </div>

            <div
              className="absolute"
              style={{
                left: S(MARGIN),
                top: topFrom(MARGIN + 30 + 24 + 10),
                fontSize: S(9),
                color: MUTED,
              }}
            >
              Documento: —
            </div>

            <div
              className="absolute"
              style={{
                left: S(MARGIN),
                top: topFrom(MARGIN + 30 + 24 + 10 + 14),
                fontSize: S(8),
                color: MUTED,
              }}
            >
              Gerado em: —
            </div>

            {signatureRoles.map((role, i) => {
              const blockTop = MARGIN + 30 + 24 + 10 + 14 + 22 + i * 90;
              return (
                <React.Fragment key={role}>
                  <div
                    className="absolute"
                    style={{
                      left: S(MARGIN),
                      right: S(MARGIN),
                      top: topFrom(blockTop),
                      height: S(0.5),
                      backgroundColor: LINE,
                    }}
                  />
                  <div
                    className="absolute"
                    style={{
                      left: S(MARGIN),
                      top: topFrom(blockTop + 14),
                      fontSize: S(11),
                      fontWeight: 700,
                      color: BRAND,
                    }}
                  >
                    {ROLE_LABEL_PT[role]}
                  </div>
                  <div
                    className="absolute"
                    style={{
                      left: S(MARGIN),
                      top: topFrom(blockTop + 14 + 14),
                      fontSize: S(9),
                      color: MUTED,
                    }}
                  >
                    {ROLE_LABEL[role]}
                  </div>
                  <div
                    className="absolute"
                    style={{
                      left: S(MARGIN),
                      top: topFrom(blockTop + 14 + 14 + 13),
                      fontSize: S(8),
                      color: MUTED,
                    }}
                  >
                    Assinado em: —
                  </div>
                  <div
                    className="rounded border-2 border-dashed flex items-center justify-center bg-white/60"
                    style={{
                      position: "absolute",
                      right: S(MARGIN),
                      top: topFrom(blockTop + 14),
                      width: S(160),
                      height: S(56),
                      borderColor: COLOR_BY_ROLE[role],
                      color: COLOR_BY_ROLE[role],
                      fontSize: S(9),
                    }}
                  >
                    A aguardar
                  </div>
                </React.Fragment>
              );
            })}

            <div
              className="absolute"
              style={{
                left: S(MARGIN),
                right: S(MARGIN),
                top: topFrom(841.89 - MARGIN - 20 - 12),
                height: S(0.5),
                backgroundColor: LINE,
              }}
            />
            <div
              className="absolute"
              style={{
                left: S(MARGIN),
                top: topFrom(841.89 - MARGIN - 20),
                fontSize: S(7),
                color: MUTED,
              }}
            >
              Este documento foi gerado e assinado digitalmente pela plataforma
              InternLink.
            </div>
            <div
              className="absolute"
              style={{
                left: S(MARGIN),
                top: topFrom(841.89 - MARGIN - 20 + 10),
                fontSize: S(7),
                color: MUTED,
              }}
            >
              internlink.app — —
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
