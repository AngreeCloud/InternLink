import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  EstagioAccessError,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

const TEAL = rgb(0.004, 0.412, 0.435);
const DARK = rgb(0.11, 0.106, 0.098);
const MUTED = rgb(0.478, 0.475, 0.455);
const BEGE = rgb(0.953, 0.941, 0.925);
const WHITE = rgb(1, 1, 1);
const GREEN_BG = rgb(0.91, 0.961, 0.941);
const BORDER = rgb(0.863, 0.851, 0.835);
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const FOOTER_Y = 40;

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril",
  "Maio", "Junho", "Julho", "Agosto",
  "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WINANSI_MAP: Record<string, string> = {
  "\n": " ", "✓": "[ok]", "•": "-", "–": "-", "—": "-",
  "…": "...", "\u201C": '"', "\u201D": '"', "\u2018": "'", "\u2019": "'",
};

function sanitze(s: string): string {
  let out = "";
  for (const ch of s) out += WINANSI_MAP[ch] ?? ch;
  return out;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${pad(d)}/${pad(m)}/${y}`;
}

function mesFromIso(iso: string): string {
  const m = Number(iso.split("-")[1]);
  return m >= 1 && m <= 12 ? MESES[m - 1] : "?";
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return new Uint8Array(0);
  return Uint8Array.from(Buffer.from(match[2], "base64"));
}

function drawRect(
  page: import("pdf-lib").PDFPage,
  x: number, y: number, w: number, h: number,
  fill: ReturnType<typeof rgb>
) {
  page.drawRectangle({ x, y, width: w, height: h, color: fill });
}

function drawLine(
  page: import("pdf-lib").PDFPage,
  x1: number, y1: number, x2: number, y2: number,
  thickness: number, color: ReturnType<typeof rgb> = BORDER
) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
}

function drawFooter(
  page: import("pdf-lib").PDFPage,
  font: PDFFont,
  alunoName: string,
  pageNum: number,
  totalPages: number
) {
  drawLine(page, MARGIN, FOOTER_Y + 12, PAGE_W - MARGIN, FOOTER_Y + 12, 0.5, BORDER);
  page.drawText(sanitze(`InternLink - Registo de Presencas - ${alunoName}`), {
    x: MARGIN, y: FOOTER_Y, size: 7, font, color: MUTED,
  });
  const rightText = sanitze(`Pagina ${pageNum} de ${totalPages}`);
  const rightTextWidth = font.widthOfTextAtSize(rightText, 7);
  page.drawText(rightText, {
    x: PAGE_W - MARGIN - rightTextWidth, y: FOOTER_Y, size: 7, font, color: MUTED,
  });
}

function drawTopBar(page: import("pdf-lib").PDFPage, font: PDFFont, bold: PDFFont) {
  drawRect(page, MARGIN, PAGE_H - MARGIN - 8, CONTENT_W, 40, TEAL);
  const logoX = MARGIN + 12;
  const logoY = PAGE_H - MARGIN + 18;
  page.drawSvgPath("M22 10L12 4 2 10l10 6 10-6Z", { x: logoX, y: logoY, scale: 0.8, borderColor: WHITE, borderWidth: 2 });
  page.drawSvgPath("M6 12v5c3 2 9 2 12 0v-5", { x: logoX, y: logoY, scale: 0.8, borderColor: WHITE, borderWidth: 2 });
  page.drawSvgPath("M22 10v6", { x: logoX, y: logoY, scale: 0.8, borderColor: WHITE, borderWidth: 2 });
  page.drawText("InternLink", {
    x: logoX + 28, y: PAGE_H - MARGIN + 4, size: 15, font: bold, color: WHITE,
  });
}

function drawInfoRow(
  page: import("pdf-lib").PDFPage,
  font: PDFFont,
  bold: PDFFont,
  label: string,
  value: string,
  x: number, y: number, w: number
): number {
  const rowH = 22;
  drawRect(page, x, y - rowH + 2, 90, rowH - 2, BEGE);
  page.drawText(sanitze(label), { x: x + 8, y: y - 12, size: 8, font: bold, color: DARK });
  drawRect(page, x + 90, y - rowH + 2, w - 90, rowH - 2, WHITE);
  drawLine(page, x + 90, y + 2, x + w, y + 2, 0.5, BORDER);
  page.drawText(sanitze(value), { x: x + 90 + 8, y: y - 12, size: 10, font, color: DARK });
  return y - rowH;
}

// ── Table constants ──────────────────────────────
const COL_DIA = 100;
const COL_MES = 200;
const COL_HORAS = 80;
const TABLE_W = COL_DIA + COL_MES + COL_HORAS;
const TABLE_X = MARGIN;
const ROW_H = 20;
const HEADER_H = 24;

type PresencaRow = { dia: string; mes: string; horas: number };

async function createCoverPage(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  data: {
    alunoName: string;
    tutorName: string;
    professorName: string;
    empresa: string;
    courseName: string;
    periodoInicio: string;
    periodofim: string;
    totalDias: number;
    totalHoras: number;
    generatedAt: string;
    schoolName?: string;
    schoolAddress?: string;
    schoolCodigoPostal?: string;
    schoolLocalidade?: string;
    schoolDistrito?: string;
    schoolPais?: string;
    schoolContacto?: string;
    companyNome?: string;
    companyMorada?: string;
    companyCodigoPostal?: string;
    companyLocalidade?: string;
    companyContacto?: string;
  },
  pageNum: number,
  totalPages: number
): Promise<void> {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  drawTopBar(page, font, bold);
  let cy = PAGE_H - MARGIN - 70;

  page.drawText("REGISTO DE PRESENCAS", { x: MARGIN, y: cy, size: 22, font: bold, color: TEAL });
  cy -= 22;
  page.drawText("DA FORMACAO EM CONTEXTO DE TRABALHO", { x: MARGIN, y: cy, size: 12, font: bold, color: TEAL });
  cy -= 16;
  drawLine(page, MARGIN, cy, MARGIN + 100, cy, 2, TEAL);
  cy -= 20;

  if (data.courseName && data.courseName !== "-") {
    page.drawText("CURSO", { x: MARGIN, y: cy, size: 7, font: bold, color: TEAL });
    cy -= 12;
    page.drawText(sanitze(data.courseName), { x: MARGIN, y: cy, size: 11, font: bold, color: DARK });
    cy -= 18;
  }

  cy -= 8;

  // ── Two-column block: School | Company ──────────────────────
  const colGap = 12;
  const colW = (CONTENT_W - colGap) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + colGap;

  const schoolLines: string[] = [];
  if (data.schoolAddress) schoolLines.push(data.schoolAddress);
  const schoolCpLoc = [data.schoolCodigoPostal, data.schoolLocalidade].filter(Boolean).join(" ");
  if (schoolCpLoc) schoolLines.push(schoolCpLoc);
  const schoolDistPais = [data.schoolDistrito, data.schoolPais].filter(Boolean).join(" · ");
  if (schoolDistPais) schoolLines.push(schoolDistPais);
  if (data.schoolContacto) schoolLines.push(data.schoolContacto);

  const companyLines: string[] = [];
  if (data.companyMorada) companyLines.push(data.companyMorada);
  const cpLoc = [data.companyCodigoPostal, data.companyLocalidade].filter(Boolean).join(" ");
  if (cpLoc) companyLines.push(cpLoc);
  if (data.companyContacto) companyLines.push(data.companyContacto);

  const labelRowH = 14;
  const nameRowH = 16;
  const addrRowH = 11;
  const pad = 10;

  const hasSchool = !!data.schoolName;
  const hasCompany = !!data.companyNome;
  const col1H = hasSchool ? labelRowH + nameRowH + schoolLines.length * addrRowH + pad : 0;
  const col2H = hasCompany ? labelRowH + nameRowH + companyLines.length * addrRowH + pad : 0;
  const boxH = Math.max(col1H, col2H, 40);

  // Left column — School
  drawRect(page, leftX, cy - boxH, colW, boxH, BEGE);
  if (hasSchool) {
    page.drawText("ESCOLA", { x: leftX + 8, y: cy - 11, size: 7, font: bold, color: TEAL });
    page.drawText(sanitze(data.schoolName!), { x: leftX + 8, y: cy - 28, size: 10, font: bold, color: DARK });
    let lc = cy - 46;
    for (const line of schoolLines) {
      page.drawText(sanitze(line), { x: leftX + 8, y: lc, size: 8, font, color: MUTED });
      lc -= addrRowH;
    }
  }

  // Right column — Company
  drawRect(page, rightX, cy - boxH, colW, boxH, BEGE);
  if (hasCompany) {
    page.drawText("EMPRESA DE ACOLHIMENTO", { x: rightX + 8, y: cy - 11, size: 7, font: bold, color: TEAL });
    page.drawText(sanitze(data.companyNome!), { x: rightX + 8, y: cy - 28, size: 10, font: bold, color: DARK });
    let lc = cy - 46;
    for (const line of companyLines) {
      page.drawText(sanitze(line), { x: rightX + 8, y: lc, size: 8, font, color: MUTED });
      lc -= addrRowH;
    }
  }

  cy = cy - boxH - 16;

  // ── Intervenients ───────────────────────────────────────────
  cy = drawInfoRow(page, font, bold, "Formando", data.alunoName, MARGIN, cy, CONTENT_W);
  cy = drawInfoRow(page, font, bold, "Tutor", data.tutorName, MARGIN, cy, CONTENT_W);
  cy = drawInfoRow(page, font, bold, "Orientador", data.professorName, MARGIN, cy, CONTENT_W);

  cy -= 18;

  drawRect(page, MARGIN, cy - 54, CONTENT_W, 54, BEGE);
  page.drawText("PERIODO", { x: MARGIN + 12, y: cy - 14, size: 7, font: bold, color: TEAL });
  page.drawText(sanitze(`${data.periodoInicio} - ${data.periodofim}`), {
    x: MARGIN + 80, y: cy - 14, size: 10, font, color: DARK,
  });
  drawLine(page, MARGIN + 12, cy - 28, MARGIN + CONTENT_W - 12, cy - 28, 0.5, BORDER);
  page.drawText("TOTAL DE HORAS", { x: MARGIN + 12, y: cy - 40, size: 7, font: bold, color: TEAL });
  page.drawText(sanitze(`${data.totalHoras}h em ${data.totalDias} dias de trabalho`), {
    x: MARGIN + 80, y: cy - 40, size: 10, font, color: DARK,
  });

  page.drawText(sanitze(`Gerado em: ${data.generatedAt}`), {
    x: MARGIN, y: 80, size: 8, font, color: MUTED,
  });

  drawFooter(page, font, data.alunoName, pageNum, totalPages);
}

function drawTableHeader(
  page: import("pdf-lib").PDFPage,
  font: PDFFont,
  bold: PDFFont,
  x: number, y: number
): number {
  const headerY = y;
  drawRect(page, x, headerY - HEADER_H, TABLE_W, HEADER_H, TEAL);
  page.drawText("Dia", { x: x + 10, y: headerY - 15, size: 9, font: bold, color: WHITE });
  page.drawText("Mes", { x: x + COL_DIA + 10, y: headerY - 15, size: 9, font: bold, color: WHITE });
  page.drawText("Horas", { x: x + COL_DIA + COL_MES + 10, y: headerY - 15, size: 9, font: bold, color: WHITE });
  return headerY - HEADER_H;
}

function drawTableRow(
  page: import("pdf-lib").PDFPage,
  font: PDFFont,
  x: number, y: number,
  dia: string, mes: string, horas: string,
  isTotal: boolean,
  fill?: ReturnType<typeof rgb>
): number {
  const ry = y - ROW_H;
  if (fill) drawRect(page, x, ry, TABLE_W, ROW_H, fill);
  drawLine(page, x, y, x + TABLE_W, y, 0.5, BORDER);

  const textY = y - 13;
  const fontToUse = isTotal ? font : font;
  const color = isTotal ? TEAL : DARK;
  const size = isTotal ? 9 : 8;

  page.drawText(sanitze(dia), { x: x + 10, y: textY, size, font: fontToUse, color });
  page.drawText(sanitze(mes), { x: x + COL_DIA + 10, y: textY, size, font: fontToUse, color });
  page.drawText(sanitze(horas), { x: x + COL_DIA + COL_MES + 10, y: textY, size, font: fontToUse, color });
  return ry;
}

async function createTablePages(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  rows: PresencaRow[],
  totalHoras: number,
  alunoName: string,
  pageStart: number,
  totalPages: number
): Promise<void> {
  const MAX_ROWS_PER_PAGE = 32;
  let batch = [...rows];
  let pageNum = pageStart;

  while (batch.length > 0 || pageNum === pageStart) {
    const chunk = batch.slice(0, MAX_ROWS_PER_PAGE);
    batch = batch.slice(MAX_ROWS_PER_PAGE);
    const isLastPage = batch.length === 0;

    const page = doc.addPage([PAGE_W, PAGE_H]);
    drawTopBar(page, font, bold);

    page.drawText("REGISTO DE PRESENCAS", {
      x: MARGIN, y: PAGE_H - MARGIN - 70, size: 16, font: bold, color: TEAL,
    });
    drawLine(page, MARGIN, PAGE_H - MARGIN - 78, MARGIN + 80, PAGE_H - MARGIN - 78, 2, TEAL);

    let cy = PAGE_H - MARGIN - 90;
    cy = drawTableHeader(page, font, bold, TABLE_X, cy);
    cy -= 4;

    for (const row of chunk) {
      const isEven = (rows.indexOf(row) % 2 === 0);
      cy = drawTableRow(
        page, font, TABLE_X, cy,
        formatIsoDate(row.dia), row.mes, `${row.horas.toFixed(2)}h`,
        false,
        isEven ? BEGE : undefined
      );
    }

    if (isLastPage) {
      cy = drawTableRow(
        page, bold, TABLE_X, cy,
        "", "TOTAL", `${totalHoras.toFixed(2)}h`,
        true, GREEN_BG
      );
    }

    // Info section below table
    cy -= 20;

    drawFooter(page, font, alunoName, pageNum, totalPages);
    pageNum++;
  }
}

async function createSignaturesPage(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  data: { alunoName: string; tutorName: string; empresa: string; tutorRole: string },
  includeSignatures: boolean,
  alunoSignatureBytes: Uint8Array | null,
  tutorSignatureBytes: Uint8Array | null,
  pageNum: number,
  totalPages: number,
  generatedAt: string
): Promise<void> {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  drawTopBar(page, font, bold);
  let cy = PAGE_H - MARGIN - 70;

  page.drawText("DECLARACAO DE CONFIRMACAO DE PRESENCAS", {
    x: MARGIN, y: cy, size: 16, font: bold, color: TEAL,
  });
  cy -= 16;
  drawLine(page, MARGIN, cy, MARGIN + 120, cy, 2, TEAL);
  cy -= 20;

  const declaration =
    "Os abaixo assinados declaram que as presencas registadas neste " +
    "documento sao fidedignas e representam o trabalho efetivamente realizado " +
    "durante o periodo de formacao em contexto de trabalho.";
  const lines = declaration.split(" ");
  let line = "";
  for (const word of lines) {
    const testLine = line ? `${line} ${word}` : word;
    const tw = font.widthOfTextAtSize(testLine, 10);
    if (tw > CONTENT_W && line) {
      page.drawText(sanitze(line), { x: MARGIN, y: cy, size: 10, font, color: DARK });
      cy -= 16;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    page.drawText(sanitze(line), { x: MARGIN, y: cy, size: 10, font, color: DARK });
    cy -= 24;
  }

  const blockW = 180;
  const leftX = PAGE_W / 2 - blockW - 20;
  const rightX = PAGE_W / 2 + 20;

  const drawSigBlock = async (
    bx: number, by: number,
    name: string, role: string, company: string | null,
    sigBytes: Uint8Array | null
  ) => {
    let sy = by;
    if (includeSignatures && sigBytes && sigBytes.length > 0) {
      try {
        const img = await doc.embedPng(sigBytes);
        const aspect = img.width / img.height;
        const imgH = 50;
        const imgW = Math.min(120, imgH * aspect);
        page.drawImage(img, { x: bx + (blockW - imgW) / 2, y: sy - imgH, width: imgW, height: imgH });
        sy -= imgH + 8;
      } catch {
        sy -= 50;
      }
    } else {
      sy -= 50;
    }
    drawLine(page, bx, sy, bx + blockW, sy, 1, TEAL);
    sy -= 16;
    page.drawText(sanitze(name), { x: bx, y: sy, size: 10, font: bold, color: DARK });
    sy -= 14;
    page.drawText(sanitze(role), { x: bx, y: sy, size: 8, font, color: MUTED });
    sy -= 12;
    if (company) page.drawText(sanitze(company), { x: bx, y: sy, size: 7, font, color: MUTED });
  };

  await drawSigBlock(leftX, cy, data.alunoName, "Formando", null, alunoSignatureBytes);
  await drawSigBlock(rightX, cy, data.tutorName, data.tutorRole, data.empresa, tutorSignatureBytes);

  cy -= 120;
  page.drawText(sanitze(`Documento gerado pela plataforma InternLink em ${generatedAt}`), {
    x: MARGIN, y: cy, size: 8, font, color: MUTED,
  });

  drawFooter(page, font, data.alunoName, pageNum, totalPages);
}

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

    const estagio = session.estagio;

    // Buscar presencas com horas > 0
    const presencasSnap = await db
      .collection("estagios")
      .doc(id)
      .collection("presencas")
      .orderBy("date", "asc")
      .get();

    const rows: PresencaRow[] = [];
    let totalHorasRealizadas = 0;
    presencasSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const horas = Number(data.hoursWorked ?? 0) || 0;
      if (horas <= 0) return;
      const date = (data.date as string) || d.id;
      if (!date) return;
      rows.push({ dia: date, mes: mesFromIso(date), horas });
      totalHorasRealizadas += horas;
    });

    if (rows.length === 0) {
      throw new EstagioAccessError(400, "no_presencas", "Nao existem presencas para exportar.");
    }

    // Se signed, verificar que tutor ja validou
    if (includeSignatures) {
      if (estagio.presencasValidatedByTutor !== true) {
        throw new EstagioAccessError(
          422, "presencas_not_validated",
          "O tutor ainda nao validou as presencas. Valide as presencas antes de exportar com assinaturas."
        );
      }
    }

    const alunoId = estagio.alunoId as string | undefined;
    const tutorId = estagio.tutorId as string | undefined;
    const professorId = estagio.professorId as string | undefined;

    const participantDocs = await Promise.all(
      [alunoId, tutorId, professorId].filter(Boolean).map(async (uid) => {
        if (!uid) return null;
        const snap = await db.collection("users").doc(uid).get();
        return { uid, data: snap.exists ? (snap.data() as Record<string, unknown>) : null };
      })
    );

    const getField = (uid: string | undefined, field: string): string => {
      if (!uid) return "-";
      const found = participantDocs.find((p) => p?.uid === uid);
      const val = found?.data?.[field];
      return typeof val === "string" ? val : "-";
    };

    const alunoName = getField(alunoId, "nome") || getField(alunoId, "displayName") || "Aluno";
    const tutorName = getField(tutorId, "nome") || getField(tutorId, "displayName") || "Tutor";
    const professorName = getField(professorId, "nome") || getField(professorId, "displayName") || "Professor";
    const empresa = (estagio.entidadeAcolhimento as string) || getField(tutorId, "empresa") || "-";

    const now = new Date();
    const generatedAt = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} as ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const periodoInicio = rows.length > 0 ? formatIsoDate(rows[0].dia) : "-";
    const periodofim = rows.length > 0 ? formatIsoDate(rows[rows.length - 1].dia) : "-";
    const courseName = getField(alunoId, "curso") || "-";

    const totalHorasPrevistas = Number(estagio.totalHoras ?? 0) || 0;

    // Signatures
    let alunoSignatureBytes: Uint8Array | null = null;
    let tutorSignatureBytes: Uint8Array | null = null;

    if (includeSignatures) {
      const [alunoSigSnap, tutorSigSnap] = await Promise.all([
        alunoId ? db.collection("users").doc(alunoId).collection("settings").doc("signature").get() : null,
        tutorId ? db.collection("users").doc(tutorId).collection("settings").doc("signature").get() : null,
      ]);
      const alunoDataUrl = alunoSigSnap?.data()?.dataUrl as string | undefined;
      const tutorDataUrl = tutorSigSnap?.data()?.dataUrl as string | undefined;
      if (alunoDataUrl) alunoSignatureBytes = dataUrlToBytes(alunoDataUrl);
      if (tutorDataUrl) tutorSignatureBytes = dataUrlToBytes(tutorDataUrl);
    }

    // School data for cover page
    let schoolName: string | undefined;
    let schoolAddress: string | undefined;
    let schoolCodigoPostal: string | undefined;
    let schoolLocalidade: string | undefined;
    let schoolDistrito: string | undefined;
    let schoolPais: string | undefined;
    let schoolContacto: string | undefined;
    if (estagio.schoolId) {
      try {
        const schoolSnap = await db.collection("schools").doc(estagio.schoolId as string).get();
        if (schoolSnap.exists) {
          const schoolRaw = schoolSnap.data() as Record<string, unknown>;
          schoolName = schoolRaw.name as string | undefined;
          schoolAddress = schoolRaw.address as string | undefined;
          schoolCodigoPostal = schoolRaw.codigoPostal as string | undefined;
          schoolLocalidade = schoolRaw.localidade as string | undefined;
          schoolDistrito = schoolRaw.distrito as string | undefined;
          schoolPais = schoolRaw.pais as string | undefined;
          const email = schoolRaw.emailGeral as string | undefined;
          const telefone = schoolRaw.telefone as string | undefined;
          schoolContacto = [email, telefone].filter(Boolean).join(" | ");
        }
      } catch { /* skip */ }
    }

    // Company data for cover page
    const empresaSnapshot = estagio.empresaSnapshot as
      | { nome?: string; morada?: string; codigoPostal?: string; localidade?: string; emailGeral?: string; telefone?: string }
      | undefined;

    let companyNome = empresaSnapshot?.nome;
    let companyMorada = empresaSnapshot?.morada;
    let companyCodigoPostal = empresaSnapshot?.codigoPostal;
    let companyLocalidade = empresaSnapshot?.localidade;
    let companyContacto: string | undefined;
    {
      const e = empresaSnapshot?.emailGeral;
      const t = empresaSnapshot?.telefone;
      companyContacto = [e, t].filter(Boolean).join(" | ");
    }

    // Tutor role + fallback company data from empresas collection
    let tutorRole = "Tutor de Estagio";
    if (tutorId) {
      const empresaId = estagio.empresaId as string | undefined;
      if (empresaId) {
        try {
          const empSnap = await db.collection("empresas").doc(empresaId).get();
          if (empSnap.exists) {
            const empData = empSnap.data() as Record<string, unknown>;
            if (!companyNome) companyNome = empData.nome as string | undefined;
            if (!companyMorada) companyMorada = empData.morada as string | undefined;
            if (!companyCodigoPostal) companyCodigoPostal = empData.codigoPostal as string | undefined;
            if (!companyLocalidade) companyLocalidade = empData.localidade as string | undefined;
            if (!companyContacto) {
              const e = empData.emailGeral as string | undefined;
              const t = empData.telefone as string | undefined;
              companyContacto = [e, t].filter(Boolean).join(" | ");
            }
          }
          const overrideSnap = await db
            .collection("empresas").doc(empresaId)
            .collection("tutores").doc(tutorId).get();
          if (overrideSnap.exists) {
            const overrideData = overrideSnap.data() as { funcaoEmpresaOverride?: string };
            if (overrideData.funcaoEmpresaOverride) tutorRole = overrideData.funcaoEmpresaOverride;
          }
        } catch { /* fallback */ }
      }
      if (tutorRole === "Tutor de Estagio") {
        const tutorFuncao = getField(tutorId, "funcaoEmpresa");
        tutorRole = tutorFuncao || "Tutor de Estagio";
      }
    }

    if (!companyNome && empresa !== "-") {
      companyNome = empresa;
    }

    // Generate PDF
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    // Calculate pages: cover (1) + table pages + signatures (1)
    const MAX_ROWS_PER_PAGE = 32;
    const tablePageCount = Math.max(1, Math.ceil(rows.length / MAX_ROWS_PER_PAGE));
    const totalPages = 1 + tablePageCount + 1;

    // Cover
    await createCoverPage(doc, font, bold, {
      alunoName, tutorName, professorName, empresa, courseName,
      periodoInicio, periodofim,
      totalDias: rows.length,
      totalHoras: totalHorasPrevistas,
      generatedAt,
      schoolName, schoolAddress, schoolCodigoPostal, schoolLocalidade,
      schoolDistrito, schoolPais, schoolContacto,
      companyNome, companyMorada, companyCodigoPostal,
      companyLocalidade, companyContacto,
    }, 1, totalPages);

    // Table pages
    await createTablePages(doc, font, bold, rows, totalHorasRealizadas, alunoName, 2, totalPages);

    // Signatures
    await createSignaturesPage(
      doc, font, bold,
      { alunoName, tutorName, empresa, tutorRole },
      includeSignatures,
      alunoSignatureBytes, tutorSignatureBytes,
      totalPages, totalPages, generatedAt
    );

    const pdfBytes = await doc.save();
    const filename = `Registo_Presencas_${alunoName.replace(/\s+/g, "_")}.pdf`;

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
