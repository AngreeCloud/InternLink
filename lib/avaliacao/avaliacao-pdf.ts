import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { AvaliacaoConfig, SignatureData } from "./types";

const TEAL = rgb(0.004, 0.412, 0.435);
const DARK = rgb(0.11, 0.106, 0.098);
const MUTED = rgb(0.478, 0.475, 0.455);
const WHITE = rgb(1, 1, 1);
const BEGE = rgb(0.953, 0.941, 0.925);
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - 2 * MARGIN;

export type AvaliacaoPDFData = {
  alunoName: string;
  tutorName: string;
  professorName: string;
  empresa: string;
  courseName: string;
  config: AvaliacaoConfig;
  parametros: Record<string, number>;
  comentarios?: string;
  includeComentarios?: boolean;
  assinaturaTutor?: SignatureData;
  assinaturaProfessor?: SignatureData;
  notaFinal?: number;
  generatedAt: string;
};

function sanitize(s: string): string {
  return s
    .replace(/\n/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/…/g, "...");
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return new Uint8Array(0);
  return Uint8Array.from(Buffer.from(match[2], "base64"));
}

async function embedSignatureImage(
  pdfDoc: PDFDocument,
  signature?: SignatureData
): Promise<{ image: Awaited<ReturnType<PDFDocument["embedPng"]>>; w: number; h: number } | null> {
  if (!signature?.signatureDataUrl) return null;
  const bytes = dataUrlToBytes(signature.signatureDataUrl);
  if (bytes.length === 0) return null;
  try {
    const img = await pdfDoc.embedPng(bytes);
    const dims = img.scale(1);
    const targetH = 90;
    const ratio = targetH / dims.height;
    return { image: img, w: dims.width * ratio, h: targetH };
  } catch {
    return null;
  }
}

function formatDate(iso: string): string {
  try {
    const [y, m, d] = new Date(iso).toISOString().split("T")[0]!.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
}

async function buildBasePDF(data: AvaliacaoPDFData, includeSignatures: boolean): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  let y = PAGE_H - MARGIN;

  // Top bar
  page.drawRectangle({ x: 0, y: y - 24, width: PAGE_W, height: 24, color: TEAL });
  page.drawText("InternLink", {
    x: MARGIN, y: y - 18, size: 13, font: fontBold, color: WHITE,
  });
  y -= 40;

  // Title
  y -= 16;
  page.drawText(data.notaFinal !== undefined ? "NOTA FINAL DO ESTÁGIO" : "FICHA DE AVALIAÇÃO DO ESTÁGIO", {
    x: MARGIN, y, size: 16, font: fontBold, color: TEAL,
  });
  y -= 10;
  page.drawText(data.notaFinal !== undefined ? "Avaliação final com nota atribuída pelo professor orientador" : "Preenchida pelo tutor da entidade de acolhimento", {
    x: MARGIN, y, size: 9, font, color: MUTED,
  });
  y -= 20;

  // Teal line
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 80, y }, thickness: 1.5, color: TEAL });
  y -= 16;

  // Info
  const info: [string, string][] = [
    ["Formando", data.alunoName],
    ["Tutor", data.tutorName],
    ["Orientador", data.professorName],
    ["Empresa", data.empresa],
    ["Curso", data.courseName],
  ];

  for (const [label, value] of info) {
    page.drawRectangle({ x: MARGIN, y: y - 16, width: 80, height: 16, color: BEGE });
    page.drawText(label, { x: MARGIN + 4, y: y - 12, size: 7, font: fontBold, color: DARK });
    page.drawText(sanitize(value || "—"), { x: MARGIN + 86, y: y - 12, size: 8, font, color: DARK });
    page.drawLine({ start: { x: MARGIN, y: y - 16 }, end: { x: PAGE_W - MARGIN, y: y - 16 }, thickness: 0.3, color: rgb(0.86, 0.85, 0.84) });
    y -= 18;
  }
  y -= 8;

  // Final grade box (if applicable)
  if (data.notaFinal !== undefined) {
    page.drawRectangle({ x: MARGIN, y: y - 30, width: CONTENT_W, height: 30, color: BEGE });
    page.drawText("Nota Final", { x: MARGIN + 8, y: y - 20, size: 10, font: fontBold, color: TEAL });
    const grade = `${data.notaFinal} / ${data.config.notaFinalEsperada.max} valores`;
    const gradeW = fontBold.widthOfTextAtSize(grade, 14);
    page.drawText(grade, { x: PAGE_W - MARGIN - gradeW - 8, y: y - 22, size: 14, font: fontBold, color: DARK });
    y -= 38;
  }

  // Parameters header
  y -= 8;
  page.drawText("Parâmetros de Avaliação", {
    x: MARGIN, y, size: 10, font: fontBold, color: TEAL,
  });
  y -= 12;
  const scale = `(escala ${data.config.escala.min}-${data.config.escala.max})`;
  page.drawText(scale, {
    x: MARGIN, y, size: 7, font, color: MUTED,
  });
  y -= 16;

  // Table header
  page.drawRectangle({ x: MARGIN, y: y - 16, width: CONTENT_W, height: 16, color: TEAL });
  page.drawText("Parâmetro", { x: MARGIN + 4, y: y - 12, size: 8, font: fontBold, color: WHITE });
  page.drawText("Nota", { x: PAGE_W - MARGIN - 44, y: y - 12, size: 8, font: fontBold, color: WHITE });
  y -= 18;

  // Table rows
  for (let i = 0; i < data.config.parametros.length; i++) {
    const param = data.config.parametros[i]!;
    if (i % 2 === 0) {
      page.drawRectangle({ x: MARGIN, y: y - 14, width: CONTENT_W, height: 14, color: BEGE });
    }
    page.drawText(sanitize(param.nome), { x: MARGIN + 4, y: y - 11, size: 8, font, color: DARK });
    const score = data.parametros[param.nome];
    page.drawText(score !== undefined ? String(score) : "-", {
      x: PAGE_W - MARGIN - 44, y: y - 11, size: 8, font: fontBold, color: DARK,
    });
    page.drawLine({
      start: { x: MARGIN, y: y - 14 },
      end: { x: PAGE_W - MARGIN, y: y - 14 },
      thickness: 0.3,
      color: rgb(0.86, 0.85, 0.84),
    });
    y -= 16;
  }
  y -= 12;

  // Comments (tutor only)
  if (data.comentarios && data.includeComentarios !== false) {
    y -= 4;
    page.drawText("Comentários do Tutor", { x: MARGIN, y, size: 10, font: fontBold, color: TEAL });
    y -= 14;
    const commentText = sanitize(data.comentarios);
    const maxCharsPerLine = 90;
    const lines: string[] = [];
    for (let i = 0; i < commentText.length; i += maxCharsPerLine) {
      lines.push(commentText.slice(i, i + maxCharsPerLine));
    }
    if (lines.length === 0) lines.push("(sem comentários)");
    page.drawRectangle({ x: MARGIN, y: y - lines.length * 14 - 4, width: CONTENT_W, height: lines.length * 14 + 8, color: BEGE });
    for (const line of lines) {
      page.drawText(line, { x: MARGIN + 6, y: y - 3, size: 8, font, color: DARK });
      y -= 14;
    }
    y -= 8;
  }

  // Signatures
  page.drawText("Assinaturas", { x: MARGIN, y, size: 10, font: fontBold, color: TEAL });
  y -= 24;

  const sigTutor = await embedSignatureImage(pdfDoc, data.assinaturaTutor);
  const sigProf = await embedSignatureImage(pdfDoc, data.assinaturaProfessor);

  // Tutor signature block
  const sigW = CONTENT_W / 2 - 10;
  const profX = PAGE_W - MARGIN - sigW;

  // Track y for both columns
  let yTutor = y;
  let yProf = y;

  if (includeSignatures && sigTutor) {
    const dims = sigTutor.image.scale(1);
    const maxW = sigW - 8;
    const s = Math.min(maxW / dims.width, 60 / dims.height, 1);
    page.drawImage(sigTutor.image, {
      x: MARGIN, y: yTutor - sigTutor.h * s, width: sigTutor.w * s, height: sigTutor.h * s,
    });
    yTutor -= sigTutor.h * s + 4;
  } else {
    yTutor -= 20;
  }
  page.drawLine({ start: { x: MARGIN, y: yTutor }, end: { x: MARGIN + sigW, y: yTutor }, thickness: 1, color: TEAL });
  page.drawText(sanitize(data.tutorName), { x: MARGIN, y: yTutor - 12, size: 8, font: fontBold, color: DARK });
  page.drawText("Tutor de Estágio", { x: MARGIN, y: yTutor - 22, size: 7, font, color: MUTED });

  // Professor signature block
  if (includeSignatures && sigProf) {
    const dims = sigProf.image.scale(1);
    const maxW = sigW - 8;
    const s = Math.min(maxW / dims.width, 60 / dims.height, 1);
    page.drawImage(sigProf.image, {
      x: profX, y: yProf - sigProf.h * s, width: sigProf.w * s, height: sigProf.h * s,
    });
    yProf -= sigProf.h * s + 4;
  } else {
    yProf -= 20;
  }
  page.drawLine({ start: { x: profX, y: yProf }, end: { x: profX + sigW, y: yProf }, thickness: 1, color: TEAL });
  page.drawText(sanitize(data.professorName), { x: profX, y: yProf - 12, size: 8, font: fontBold, color: DARK });
  page.drawText("Professor Orientador", { x: profX, y: yProf - 22, size: 7, font, color: MUTED });

  // Footer
  page.drawText(`InternLink - Documento gerado em ${data.generatedAt}`, {
    x: MARGIN, y: 30, size: 7, font, color: MUTED,
  });

  return Buffer.from(await pdfDoc.save());
}

export async function renderAvaliacaoTutorPDF(
  data: AvaliacaoPDFData,
  includeSignatures: boolean
): Promise<Uint8Array> {
  return buildBasePDF({ ...data, notaFinal: undefined }, includeSignatures);
}

export async function renderNotaFinalPDF(
  data: AvaliacaoPDFData,
  includeSignatures: boolean
): Promise<Uint8Array> {
  return buildBasePDF(data, includeSignatures);
}
