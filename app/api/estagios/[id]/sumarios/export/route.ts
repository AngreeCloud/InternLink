import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  EstagioAccessError,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import type { EstagioRole } from "@/lib/estagios/permissions";

export const runtime = "nodejs";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const FOOTER_Y = 40;

const COLORS = {
  primary: rgb(0.12, 0.23, 0.37),
  secondary: rgb(0.28, 0.32, 0.35),
  muted: rgb(0.58, 0.64, 0.72),
  border: rgb(0.79, 0.84, 0.88),
  text: rgb(0.12, 0.16, 0.23),
  green: rgb(0.09, 0.64, 0.29),
  white: rgb(1, 1, 1),
};

type SumarioData = {
  weekId: string;
  weekNumber: number;
  weekYear: number;
  weekStart: string;
  weekEnd: string;
  content: string;
  signedByTutor?: boolean;
  tutorSignedAt?: { toDate?: () => Date; seconds?: number; _seconds?: number };
  tutorSignedByName?: string;
  estado?: string;
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${pad(d)}/${pad(m)}/${y}`;
}

function formatTimestamp(ts: { toDate?: () => Date; seconds?: number; _seconds?: number } | undefined): string {
  if (!ts) return "";
  let d: Date | null = null;
  if (typeof ts.toDate === "function") d = ts.toDate();
  else if (typeof ts._seconds === "number") d = new Date(ts._seconds * 1000);
  else if (typeof ts.seconds === "number") d = new Date(ts.seconds * 1000);
  if (!d) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  fontSize: number,
  lineHeight: number
): number {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const tw = font.widthOfTextAtSize(testLine, fontSize);
    if (tw > maxWidth && line) {
      page.drawText(line, { x, y: cy, size: fontSize, font, color: COLORS.text });
      cy -= lineHeight;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cy, size: fontSize, font, color: COLORS.text });
    cy -= lineHeight;
  }
  return cy;
}

function getDescender(font: PDFFont, size: number): number {
  const raw = font as unknown as { getFont(): { descender: number } };
  return raw.getFont().descender * size;
}

function drawPageFooter(page: PDFPage, font: PDFFont, pageNum: number, totalPages: number, alunoName: string) {
  const footerText = `InternLink  •  Registo de Sumários – ${alunoName}  •  Página ${pageNum} de ${totalPages}`;
  page.drawText(footerText, {
    x: MARGIN,
    y: FOOTER_Y,
    size: 8,
    font,
    color: COLORS.muted,
  });
  page.drawLine({
    start: { x: MARGIN, y: FOOTER_Y + 8 },
    end: { x: PAGE_W - MARGIN, y: FOOTER_Y + 8 },
    thickness: 0.5,
    color: COLORS.border,
  });
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return new Uint8Array(0);
  const img = match[2];
  return Uint8Array.from(Buffer.from(img, "base64"));
}

// -------------------------------------------------------------------------
// Cover Page
// -------------------------------------------------------------------------
async function createCoverPage(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  coverData: {
    alunoName: string;
    tutorName: string;
    professorName: string;
    empresa: string;
    courseName: string;
    periodoInicio: string;
    periodofim: string;
    totalSemanas: number;
    generatedAt: string;
  },
  pageNum: number,
  totalPages: number,
  logoBytes?: Uint8Array
): Promise<void> {
  const page = doc.addPage([PAGE_W, PAGE_H]);

  // Logo
  if (logoBytes && logoBytes.length > 0) {
    try {
      const pngImage = await doc.embedPng(logoBytes);
      page.drawImage(pngImage, {
        x: PAGE_W / 2 - 30,
        y: PAGE_H - MARGIN - 70,
        width: 60,
        height: 60,
      });
    } catch {
      // try as SVG? pdf-lib doesn't support SVG. Skip.
    }
  }

  let cy = PAGE_H - MARGIN - 90;

  page.drawText("REGISTO DE SUMÁRIOS SEMANAIS DA FCT", {
    x: MARGIN,
    y: cy,
    size: 18,
    font: bold,
    color: COLORS.primary,
  });
  cy -= 30;

  if (coverData.courseName && coverData.courseName !== "—") {
    page.drawText(`Curso: ${coverData.courseName}`, {
      x: MARGIN,
      y: cy,
      size: 11,
      font,
      color: COLORS.secondary,
    });
    cy -= 18;
  }

  cy -= 10;
  page.drawLine({ start: { x: MARGIN, y: cy }, end: { x: PAGE_W - MARGIN, y: cy }, thickness: 1, color: COLORS.border });
  cy -= 20;

  const infoItems = [
    `Formando:   ${coverData.alunoName}`,
    `Tutor:      ${coverData.tutorName}`,
    `Orientador: ${coverData.professorName}`,
    `Empresa:    ${coverData.empresa}`,
  ];
  for (const item of infoItems) {
    page.drawText(item, { x: MARGIN, y: cy, size: 10, font, color: COLORS.text });
    cy -= 16;
  }

  cy -= 10;
  page.drawLine({ start: { x: MARGIN, y: cy }, end: { x: PAGE_W - MARGIN, y: cy }, thickness: 1, color: COLORS.border });
  cy -= 20;

  page.drawText(`Período: ${coverData.periodoInicio} – ${coverData.periodofim}`, {
    x: MARGIN, y: cy, size: 10, font, color: COLORS.text,
  });
  cy -= 16;
  page.drawText(`Total de semanas: ${coverData.totalSemanas}`, {
    x: MARGIN, y: cy, size: 10, font, color: COLORS.text,
  });
  cy -= 16;

  page.drawText(`Gerado em: ${coverData.generatedAt}`, {
    x: MARGIN, y: cy, size: 9, font, color: COLORS.muted,
  });

  drawPageFooter(page, font, pageNum, totalPages, coverData.alunoName);
}

// -------------------------------------------------------------------------
// Sumario Page
// -------------------------------------------------------------------------
async function createSumarioPage(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  sumario: SumarioData,
  alunoName: string,
  pageNum: number,
  totalPages: number
): Promise<void> {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let cy = PAGE_H - MARGIN;

  // Header
  page.drawText(`SEMANA ${sumario.weekNumber} • ${sumario.weekYear}`, {
    x: MARGIN, y: cy, size: 13, font: bold, color: COLORS.primary,
  });
  cy -= 18;

  // Line under header
  page.drawLine({
    start: { x: MARGIN, y: cy },
    end: { x: PAGE_W - MARGIN, y: cy },
    thickness: 0.5,
    color: COLORS.border,
  });
  cy -= 14;

  // Dates
  const dateStr = `${formatIsoDate(sumario.weekStart)} – ${formatIsoDate(sumario.weekEnd)}`;
  page.drawText(dateStr, { x: MARGIN, y: cy, size: 9, font, color: COLORS.secondary });
  cy -= 16;

  // Content label
  page.drawText("Atividades realizadas durante a semana:", {
    x: MARGIN, y: cy, size: 9, font, color: COLORS.secondary,
  });
  cy -= 14;

  // Content text with wrapping
  const contentText = sumario.content || "(sem conteúdo)";
  cy = drawWrappedText(page, contentText, MARGIN, cy, CONTENT_W, font, 9, 14);

  cy -= 14;

  // Validation line
  if (sumario.signedByTutor) {
    page.drawLine({
      start: { x: MARGIN, y: cy },
      end: { x: PAGE_W - MARGIN, y: cy },
      thickness: 0.5,
      color: COLORS.border,
    });
    cy -= 12;
    const valStr = `✓ Validado pelo tutor: ${sumario.tutorSignedByName || "Tutor"} • ${formatTimestamp(sumario.tutorSignedAt)}`;
    page.drawText(valStr, { x: MARGIN, y: cy, size: 8, font, color: COLORS.green });
  }

  drawPageFooter(page, font, pageNum, totalPages, alunoName);
}

// -------------------------------------------------------------------------
// Signatures Page
// -------------------------------------------------------------------------
async function createSignaturesPage(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  alunoName: string,
  tutorName: string,
  empresa: string,
  alunoSignatureBytes: Uint8Array | null,
  tutorSignatureBytes: Uint8Array | null,
  includeSignatures: boolean,
  pageNum: number,
  totalPages: number,
  generatedAt: string,
  logoBytes?: Uint8Array
): Promise<void> {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let cy = PAGE_H - MARGIN;

  // Logo
  if (logoBytes && logoBytes.length > 0) {
    try {
      const pngImage = await doc.embedPng(logoBytes);
      page.drawImage(pngImage, {
        x: PAGE_W / 2 - 24,
        y: cy - 10,
        width: 48,
        height: 48,
      });
      cy -= 60;
    } catch {
      // skip
    }
  }

  page.drawText("DECLARAÇÃO DE CONCLUSÃO DA FCT", {
    x: MARGIN, y: cy, size: 14, font: bold, color: COLORS.primary,
  });
  cy -= 24;

  const declaration =
    "Os abaixo assinados declaram que os sumários semanais registados neste documento " +
    "são fidedignos e representam o trabalho efetivamente realizado durante o período de " +
    "formação em contexto de trabalho.";
  cy = drawWrappedText(page, declaration, MARGIN, cy, CONTENT_W, font, 9, 14);
  cy -= 20;

  // Two signature blocks
  const blockW = 180;
  const leftX = PAGE_W / 2 - blockW - 20;
  const rightX = PAGE_W / 2 + 20;

  const drawSigBlock = async (
    bx: number,
    by: number,
    name: string,
    role: string,
    company: string | null,
    sigBytes: Uint8Array | null
  ) => {
    let cy2 = by;

    if (includeSignatures && sigBytes && sigBytes.length > 0) {
      try {
        const img = await doc.embedPng(sigBytes);
        const aspect = img.width / img.height;
        const imgH = 50;
        const imgW = Math.min(120, imgH * aspect);
        page.drawImage(img, {
          x: bx + (blockW - imgW) / 2,
          y: cy2 - imgH,
          width: imgW,
          height: imgH,
        });
        cy2 -= imgH + 8;
      } catch {
        cy2 -= 50;
      }
    } else {
      cy2 -= 50;
    }

    page.drawLine({
      start: { x: bx, y: cy2 },
      end: { x: bx + blockW, y: cy2 },
      thickness: 1,
      color: COLORS.text,
    });
    cy2 -= 16;

    page.drawText(name, { x: bx, y: cy2, size: 9, font: bold, color: COLORS.text });
    cy2 -= 14;
    page.drawText(role, { x: bx, y: cy2, size: 8, font, color: COLORS.secondary });
    cy2 -= 12;
    if (company) {
      page.drawText(company, { x: bx, y: cy2, size: 7, font, color: COLORS.muted });
    }
  };

  await drawSigBlock(leftX, cy, alunoName, "Formando", null, alunoSignatureBytes);
  await drawSigBlock(rightX, cy, tutorName, "Tutor de Estágio", empresa, tutorSignatureBytes);

  cy -= 120;

  page.drawText(`Documento gerado pela plataforma InternLink em ${generatedAt}`, {
    x: MARGIN, y: cy, size: 8, font, color: COLORS.muted,
  });

  drawPageFooter(page, font, pageNum, totalPages, alunoName);
}

// -------------------------------------------------------------------------
// API Route Handler
// -------------------------------------------------------------------------
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await assertEstagioAccess(id, "member");
    const db = getFirebaseAdminDb();

    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") || "unsigned";
    const includeSignatures = mode === "signed";

    const sumariosSnap = await db
      .collection("estagios")
      .doc(id)
      .collection("sumarios")
      .orderBy("weekStart", "asc")
      .get();

    const sumarios: SumarioData[] = [];
    sumariosSnap.forEach((d) => {
      const data = d.data() as SumarioData;
      sumarios.push({ ...data, weekId: d.id, content: data.content ?? "" });
    });

    if (sumarios.length === 0) {
      throw new EstagioAccessError(400, "no_sumarios", "Não existem sumários para exportar.");
    }

    if (includeSignatures) {
      const notArchived = sumarios.filter((s) => s.estado !== "arquivado");
      if (notArchived.length > 0) {
        throw new EstagioAccessError(
          422,
          "unarchived_sumarios",
          `Existem sumários por validar: ${notArchived.map((s) => `Semana ${s.weekNumber}`).join(", ")}`
        );
      }
    }

    const estagio = session.estagio;
    const alunoId = estagio.alunoId;
    const tutorId = estagio.tutorId;
    const professorId = estagio.professorId;

    const participantDocs = await Promise.all(
      [alunoId, tutorId, professorId]
        .filter(Boolean)
        .map(async (uid) => {
          if (!uid) return null;
          const snap = await db.collection("users").doc(uid).get();
          return { uid, data: snap.exists ? (snap.data() as Record<string, unknown>) : null };
        })
    );

    const getField = (uid: string | undefined, field: string): string => {
      if (!uid) return "—";
      const found = participantDocs.find((p) => p?.uid === uid);
      const val = found?.data?.[field];
      return typeof val === "string" ? val : "—";
    };

    const alunoName = getField(alunoId, "nome") || getField(alunoId, "displayName") || "Aluno";
    const tutorName = getField(tutorId, "nome") || getField(tutorId, "displayName") || "Tutor";
    const professorName = getField(professorId, "nome") || getField(professorId, "displayName") || "Professor";
    const empresa = getField(tutorId, "empresa") || "—";

    let alunoSignatureBytes: Uint8Array | null = null;
    let tutorSignatureBytes: Uint8Array | null = null;

    if (includeSignatures) {
      const [alunoSigSnap, tutorSigSnap] = await Promise.all([
        alunoId
          ? db.collection("users").doc(alunoId).collection("settings").doc("signature").get()
          : null,
        tutorId
          ? db.collection("users").doc(tutorId).collection("settings").doc("signature").get()
          : null,
      ]);

      const alunoDataUrl = alunoSigSnap?.data()?.dataUrl as string | undefined;
      const tutorDataUrl = tutorSigSnap?.data()?.dataUrl as string | undefined;
      if (alunoDataUrl) alunoSignatureBytes = dataUrlToBytes(alunoDataUrl);
      if (tutorDataUrl) tutorSignatureBytes = dataUrlToBytes(tutorDataUrl);
    }

    const now = new Date();
    const generatedAt = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} às ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const weekStartIso = sumarios[0]?.weekStart ?? "";
    const weekEndIso = sumarios[sumarios.length - 1]?.weekEnd ?? "";
    const periodoInicio = weekStartIso ? formatIsoDate(weekStartIso) : "—";
    const periodofim = weekEndIso ? formatIsoDate(weekEndIso) : "—";

    const courseName = getField(alunoId, "curso") || "—";

    // Embed logo from public/icon.svg
    let logoBytes: Uint8Array | undefined;
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const logoPath = path.join(process.cwd(), "public", "icon.svg");
      if (fs.existsSync(logoPath)) {
        logoBytes = fs.readFileSync(logoPath);
      }
    } catch {
      // ignore
    }

    // Generate PDF using pdf-lib
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    const totalPagesSumario = sumarios.length;
    const totalPages = 1 + totalPagesSumario + 1; // cover + sumarios + signatures

    // Page 1: Cover
    await createCoverPage(doc, font, bold, {
      alunoName,
      tutorName,
      professorName,
      empresa,
      courseName,
      periodoInicio,
      periodofim,
      totalSemanas: sumarios.length,
      generatedAt,
    }, 1, totalPages, logoBytes);

    // Pages 2..N: Sumario pages
    for (let i = 0; i < sumarios.length; i++) {
      await createSumarioPage(doc, font, bold, sumarios[i], alunoName, 2 + i, totalPages);
    }

    // Last page: Signatures
    await createSignaturesPage(
      doc, font, bold,
      alunoName, tutorName, empresa,
      alunoSignatureBytes, tutorSignatureBytes,
      includeSignatures,
      totalPages, totalPages,
      generatedAt,
      logoBytes
    );

    const pdfBytes = await doc.save();
    const filename = `Registo_Sumarios_${alunoName.replace(/\s+/g, "_")}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
