"use client";

import type { EstagioRole } from "@/lib/estagios/permissions";

export type SignatureBoxModel = {
  id: string;
  role?: EstagioRole;
  userId?: string;
  page: number;
  x: number; // 0..1 normalized, top-left origin
  y: number;
  width: number;
  height: number;
  color?: string;
  label?: string;
};

export type SignatureBoxesOverlayProps = {
  boxes: SignatureBoxModel[];
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  signedBoxIds?: string[];
  pendingBoxIds?: string[];
  currentUserBoxIds?: string[];
};

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

export function SignatureBoxesOverlay({
  boxes,
  pageNumber,
  pageWidth,
  pageHeight,
  signedBoxIds = [],
  pendingBoxIds = [],
  currentUserBoxIds = [],
}: SignatureBoxesOverlayProps) {
  const pageBoxes = boxes.filter((b) => b.page === pageNumber);

  return (
    <>
      {pageBoxes.map((box) => {
        const color = box.color || (box.role ? COLOR_BY_ROLE[box.role] : "#64748b");
        const signed = signedBoxIds.includes(box.id);
        const pending = pendingBoxIds.includes(box.id);
        const mine = currentUserBoxIds.includes(box.id);
        const label =
          box.label ||
          (box.role ? ROLE_LABEL[box.role] : box.userId ? "Utilizador" : "Assinatura");

        return (
          <div
            key={box.id}
            style={{
              position: "absolute",
              left: `${box.x * pageWidth}px`,
              top: `${box.y * pageHeight}px`,
              width: `${box.width * pageWidth}px`,
              height: `${box.height * pageHeight}px`,
              border: `2px ${signed ? "solid" : "dashed"} ${color}`,
              background: signed ? `${color}15` : pending ? `${color}10` : `${color}0a`,
              borderRadius: 4,
              pointerEvents: "none",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              padding: "2px 4px",
              fontSize: 10,
              color: color,
              fontWeight: 500,
              textShadow: "0 0 2px rgba(255,255,255,0.7)",
            }}
          >
            {signed ? `Assinado: ${label}` : mine ? `Aguarda-te: ${label}` : `Aguarda: ${label}`}
          </div>
        );
      })}
    </>
  );
}
