import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  EstagioAccessError,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

// ── Palette ─────────────────────────────────────────────
const TEAL = rgb(0.004, 0.412, 0.435);
const TEAL_LIGHTER = rgb(0.004, 0.412, 0.435);
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

// ── Text sanitizer for WinAnsi ──────────────────────────
const WINANSI_MAP: Record<string, string> = {
  "\n": " ", // replace newlines with spaces for single-line drawText
  "✓": "[ok]",
  "•": "-",
  "–": "-",
  "—": "-",
  "…": "...",
  "\u201C": '"',
  "\u201D": '"',
  "\u2018": "'",
  "\u2019": "'",
  "\u2028": " ",
  "\u2029": " ",
};

function sanitze(s: string): string {
  let out = "";
  for (const ch of s) {
    out += WINANSI_MAP[ch] ?? ch;
  }
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

function formatTimestamp(ts: { toDate?: () => Date; seconds?: number; _seconds?: number } | undefined): string {
  if (!ts) return "";
  let d: Date | null = null;
  if (typeof ts.toDate === "function") d = ts.toDate();
  else if (typeof ts._seconds === "number") d = new Date(ts._seconds * 1000);
  else if (typeof ts.seconds === "number") d = new Date(ts.seconds * 1000);
  if (!d) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} as ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return new Uint8Array(0);
  return Uint8Array.from(Buffer.from(match[2], "base64"));
}

function getDescender(font: PDFFont, size: number): number {
  const raw = font as unknown as { getFont(): { descender: number } };
  return raw.getFont().descender * size;
}

// ── Calculate wrapped text height (without drawing) ─────
function calculateWrappedTextHeight(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number,
  lineHeight: number
): number {
  let totalHeight = 0;
  const lines = text.split("\n");
  for (const paragraph of lines) {
    const words = paragraph.split(" ");
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const tw = font.widthOfTextAtSize(testLine, fontSize);
      if (tw > maxWidth && line) {
        totalHeight += lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      totalHeight += lineHeight;
    }
  }
  return totalHeight;
}

// ── Text wrapping (handles newlines) ────────────────────
function drawWrappedText(
  page: import("pdf-lib").PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  fontSize: number,
  lineHeight: number,
  color: ReturnType<typeof rgb> = DARK
): number {
  const lines = text.split("\n");
  let cy = y;
  for (const paragraph of lines) {
    const words = paragraph.split(" ");
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const tw = font.widthOfTextAtSize(testLine, fontSize);
      if (tw > maxWidth && line) {
        page.drawText(sanitze(line), { x, y: cy, size: fontSize, font, color });
        cy -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(sanitze(line), { x, y: cy, size: fontSize, font, color });
      cy -= lineHeight;
    }
  }
  return cy;
}

// ── Helpers ─────────────────────────────────────────────
function drawRect(
  page: import("pdf-lib").PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: ReturnType<typeof rgb>
) {
  page.drawRectangle({ x, y, width: w, height: h, color: fill });
}

function drawLine(
  page: import("pdf-lib").PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  color: ReturnType<typeof rgb> = BORDER
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
  page.drawText(sanitze(`InternLink - Registo de Sumários - ${alunoName}`), {
    x: MARGIN, y: FOOTER_Y, size: 7, font, color: MUTED,
  });
  
  const rightText = sanitze(`Pagina ${pageNum} de ${totalPages}`);
  const rightTextWidth = font.widthOfTextAtSize(rightText, 7);
  page.drawText(rightText, {
    x: PAGE_W - MARGIN - rightTextWidth, y: FOOTER_Y, size: 7, font, color: MUTED,
  });
}

// ── Draw top bar ────────────────────────────────────────
function drawTopBar(page: import("pdf-lib").PDFPage, font: PDFFont, bold: PDFFont) {
  drawRect(page, MARGIN, PAGE_H - MARGIN - 8, CONTENT_W, 40, TEAL);
  
  // Draw simplified graduation cap icon in WHITE for high contrast
  const scale = 0.8;
  const logoX = MARGIN + 12;
  // Offset Y taking into account SVG coordinate system starts from bottom-left or top-left?
  // pdf-lib's drawSvgPath draws with y-axis pointing up, so we need to adjust properly, or we can just draw paths
  const logoY = PAGE_H - MARGIN + 18;
  
  page.drawSvgPath("M22 10L12 4 2 10l10 6 10-6Z", { x: logoX, y: logoY, scale, borderColor: WHITE, borderWidth: 2 });
  page.drawSvgPath("M6 12v5c3 2 9 2 12 0v-5", { x: logoX, y: logoY, scale, borderColor: WHITE, borderWidth: 2 });
  page.drawSvgPath("M22 10v6", { x: logoX, y: logoY, scale, borderColor: WHITE, borderWidth: 2 });

  page.drawText("InternLink", {
    x: logoX + 28, y: PAGE_H - MARGIN + 4, size: 15, font: bold, color: WHITE,
  });
}

// ── Draw info table row ─────────────────────────────────
function drawInfoRow(
  page: import("pdf-lib").PDFPage,
  font: PDFFont,
  bold: PDFFont,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number
): number {
  const rowH = 22;
  drawRect(page, x, y - rowH + 2, 90, rowH - 2, BEGE);
  page.drawText(sanitze(label), { x: x + 8, y: y - 12, size: 8, font: bold, color: DARK });
  drawRect(page, x + 90, y - rowH + 2, w - 90, rowH - 2, WHITE);
  drawLine(page, x + 90, y + 2, x + w, y + 2, 0.5, BORDER);
  page.drawText(sanitze(value), { x: x + 90 + 8, y: y - 12, size: 10, font, color: DARK });
  return y - rowH;
}

// ── Cover Page ──────────────────────────────────────────
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
    totalSemanas: number;
    generatedAt: string;
    schoolName?: string;
    schoolAddress?: string;
    schoolCodigoPostal?: string;
    schoolLocalidade?: string;
    schoolDistrito?: string;
    schoolPais?: string;
    companyNome?: string;
    companyMorada?: string;
    companyCodigoPostal?: string;
    companyLocalidade?: string;
  },
  pageNum: number,
  totalPages: number
): Promise<void> {
  const page = doc.addPage([PAGE_W, PAGE_H]);

  // Top bar
  drawTopBar(page, font, bold);
  let cy = PAGE_H - MARGIN - 70;

  // Title
  page.drawText("REGISTO DE SUMÁRIOS", { x: MARGIN, y: cy, size: 22, font: bold, color: TEAL });
  cy -= 22;
  page.drawText("SEMANAIS DA FCT", { x: MARGIN, y: cy, size: 22, font: bold, color: TEAL });
  cy -= 16;
  drawLine(page, MARGIN, cy, MARGIN + 100, cy, 2, TEAL);
  cy -= 20;

  // Course
  if (data.courseName && data.courseName !== "-") {
    page.drawText("CURSO", { x: MARGIN, y: cy, size: 7, font: bold, color: TEAL });
    cy -= 12;
    page.drawText(sanitze(data.courseName), { x: MARGIN, y: cy, size: 11, font: bold, color: DARK });
    cy -= 18;
  }

  cy -= 8;

  // ── Two-column block: School | Company ────────────────
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

  const companyLines: string[] = [];
  if (data.companyMorada) companyLines.push(data.companyMorada);
  const cpLoc = [data.companyCodigoPostal, data.companyLocalidade].filter(Boolean).join(" ");
  if (cpLoc) companyLines.push(cpLoc);

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

  // ── Intervenients ─────────────────────────────────────
  cy = drawInfoRow(page, font, bold, "Formando", data.alunoName, MARGIN, cy, CONTENT_W);
  cy = drawInfoRow(page, font, bold, "Tutor", data.tutorName, MARGIN, cy, CONTENT_W);
  cy = drawInfoRow(page, font, bold, "Orientador", data.professorName, MARGIN, cy, CONTENT_W);

  cy -= 18;

  // ── Period box ────────────────────────────────────────
  drawRect(page, MARGIN, cy - 54, CONTENT_W, 54, BEGE);
  page.drawText("PERÍODO", { x: MARGIN + 12, y: cy - 14, size: 7, font: bold, color: TEAL });
  page.drawText(sanitze(`${data.periodoInicio} - ${data.periodofim}`), {
    x: MARGIN + 80, y: cy - 14, size: 10, font, color: DARK,
  });
  drawLine(page, MARGIN + 12, cy - 28, MARGIN + CONTENT_W - 12, cy - 28, 0.5, BORDER);
  page.drawText("SEMANAS", { x: MARGIN + 12, y: cy - 40, size: 7, font: bold, color: TEAL });
  page.drawText(sanitze(`${data.totalSemanas} semana${data.totalSemanas !== 1 ? "s" : ""} de trabalho`), {
    x: MARGIN + 80, y: cy - 40, size: 10, font, color: DARK,
  });

  // Generated at
  page.drawText(sanitze(`Gerado em: ${data.generatedAt}`), {
    x: MARGIN, y: 80, size: 8, font, color: MUTED,
  });

  drawFooter(page, font, data.alunoName, pageNum, totalPages);
}

// ── Sumario Page ────────────────────────────────────────
async function createSumarioPage(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  sumario: {
    weekNumber: number;
    weekYear: number;
    weekStart: string;
    weekEnd: string;
    content: string;
    signedByTutor?: boolean;
    tutorSignedByName?: string;
    tutorSignedAt?: string;
  },
  alunoName: string,
  pageNum: number,
  totalPages: number
): Promise<void> {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let cy = PAGE_H - MARGIN;

  // Week header bar
  const headerH = 28;
  drawRect(page, MARGIN, cy - headerH, CONTENT_W, headerH, TEAL);
  page.drawText(sanitze(`SEMANA ${sumario.weekNumber} - ${sumario.weekYear}`), {
    x: MARGIN + 12, y: cy - 18, size: 11, font: bold, color: WHITE,
  });
  
  const weekDatesStr = sanitze(`${sumario.weekStart} - ${sumario.weekEnd}`);
  const weekDatesWidth = font.widthOfTextAtSize(weekDatesStr, 9);
  page.drawText(weekDatesStr, {
    x: PAGE_W - MARGIN - 12 - weekDatesWidth, y: cy - 18, size: 9, font, color: WHITE,
  });
  cy -= headerH + 12;

  // Content label
  page.drawText("ATIVIDADES REALIZADAS DURANTE A SEMANA", {
    x: MARGIN, y: cy, size: 7, font: bold, color: TEAL,
  });
  cy -= 14;

  // Content block (beige bg with teal left border)
  // Calculate exact height based on actual wrapped text
  const blockPad = 10;
  const contentText = sumario.content || "(sem conteúdo)";
  const textHeight = calculateWrappedTextHeight(
    contentText,
    CONTENT_W - blockPad * 2,
    font,
    9,
    14
  );
  const blockH = textHeight + blockPad * 2;
  
  drawRect(page, MARGIN, cy - blockH, CONTENT_W, blockH, BEGE);
  drawRect(page, MARGIN, cy - blockH, 3, blockH, TEAL);
  const textCy = drawWrappedText(
    page, contentText,
    MARGIN + blockPad, cy - blockPad,
    CONTENT_W - blockPad * 2, font, 9, 14, DARK
  );
  cy = textCy - 10;

  // Validation badge
  if (sumario.signedByTutor) {
    const badgeH = 22;
    drawRect(page, MARGIN, cy - badgeH, CONTENT_W, badgeH, GREEN_BG);
    page.drawText(sanitze(`> Validado pelo tutor: ${sumario.tutorSignedByName || "Tutor"} - ${sumario.tutorSignedAt || ""}`), {
      x: MARGIN + 10, y: cy - 14, size: 8, font, color: TEAL,
    });
    cy -= badgeH + 10;
  }

  drawFooter(page, font, alunoName, pageNum, totalPages);
}

// ── Signatures Page ─────────────────────────────────────
async function createSignaturesPage(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  data: {
    alunoName: string;
    tutorName: string;
    empresa: string;
    tutorRole: string;
  },
  includeSignatures: boolean,
  alunoSignatureBytes: Uint8Array | null,
  tutorSignatureBytes: Uint8Array | null,
  pageNum: number,
  totalPages: number,
  generatedAt: string
): Promise<void> {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let cy = PAGE_H - MARGIN;

  // Top bar
  drawTopBar(page, font, bold);
  cy = PAGE_H - MARGIN - 70;

  // Title
  page.drawText("DECLARAÇÃO DE CONCLUSÃO DA FCT", {
    x: MARGIN, y: cy, size: 18, font: bold, color: TEAL,
  });
  cy -= 16;
  drawLine(page, MARGIN, cy, MARGIN + 100, cy, 2, TEAL);
  cy -= 20;

  // Declaration text
  const declaration =
    "Os abaixo assinados declaram que os sumários semanais registados neste " +
    "documento são fidedignos e representam o trabalho efetivamente realizado " +
    "durante o período de formação em contexto de trabalho.";
  cy = drawWrappedText(page, declaration, MARGIN, cy, CONTENT_W, font, 10, 16, DARK);
  cy -= 24;

  // Signature blocks
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
    let sy = by;

    // Signature image
    if (includeSignatures && sigBytes && sigBytes.length > 0) {
      try {
        const img = await doc.embedPng(sigBytes);
        const aspect = img.width / img.height;
        const imgH = 50;
        const imgW = Math.min(120, imgH * aspect);
        page.drawImage(img, {
          x: bx + (blockW - imgW) / 2,
          y: sy - imgH,
          width: imgW,
          height: imgH,
        });
        sy -= imgH + 8;
      } catch {
        sy -= 50;
      }
    } else {
      sy -= 50;
    }

    // Signature line
    drawLine(page, bx, sy, bx + blockW, sy, 1, TEAL);
    sy -= 16;

    // Name and role
    page.drawText(sanitze(name), { x: bx, y: sy, size: 10, font: bold, color: DARK });
    sy -= 14;
    page.drawText(sanitze(role), { x: bx, y: sy, size: 8, font, color: MUTED });
    sy -= 12;
    if (company) {
      page.drawText(sanitze(company), { x: bx, y: sy, size: 7, font, color: MUTED });
    }
  };

  await drawSigBlock(leftX, cy, data.alunoName, "Formando", null, alunoSignatureBytes);
  await drawSigBlock(rightX, cy, data.tutorName, data.tutorRole, data.empresa, tutorSignatureBytes);

  cy -= 120;
  page.drawText(sanitze(`Documento gerado pela plataforma InternLink em ${generatedAt}`), {
    x: MARGIN, y: cy, size: 8, font, color: MUTED,
  });

  drawFooter(page, font, data.alunoName, pageNum, totalPages);
}

// ── Route Handler ───────────────────────────────────────
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

    const sumarios: any[] = [];
    sumariosSnap.forEach((d) => {
      const data = d.data();
      sumarios.push({ ...data, weekId: d.id, content: data.content ?? "" });
    });

    if (sumarios.length === 0) {
      throw new EstagioAccessError(400, "no_sumarios", "Não existem sumários para exportar.");
    }

    if (includeSignatures) {
      const notArchived = sumarios.filter((s: any) => s.estado !== "arquivado" && s.signedByTutor !== true);
      if (notArchived.length > 0) {
        throw new EstagioAccessError(
          422,
          "unarchived_sumarios",
          `Existem sumários por validar: ${notArchived.map((s: any) => `Semana ${s.weekNumber}`).join(", ")}`
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
      if (!uid) return "-";
      const found = participantDocs.find((p) => p?.uid === uid);
      const val = found?.data?.[field];
      return typeof val === "string" ? val : "-";
    };

    const alunoName = getField(alunoId, "nome") || getField(alunoId, "displayName") || "Aluno";
    const tutorName = getField(tutorId, "nome") || getField(tutorId, "displayName") || "Tutor";
    const professorName = getField(professorId, "nome") || getField(professorId, "displayName") || "Professor";
    const empresa = (estagio.entidadeAcolhimento as string) || getField(tutorId, "empresa") || "-";

    // School data for cover page
    let schoolName: string | undefined;
    let schoolAddress: string | undefined;
    let schoolCodigoPostal: string | undefined;
    let schoolLocalidade: string | undefined;
    let schoolDistrito: string | undefined;
    let schoolPais: string | undefined;
    if (estagio.schoolId) {
      try {
        const schoolSnap = await db.collection("schools").doc(estagio.schoolId).get();
        if (schoolSnap.exists) {
          const schoolRaw = schoolSnap.data() as Record<string, unknown>;
          schoolName = schoolRaw.name as string | undefined;
          schoolAddress = schoolRaw.address as string | undefined;
          schoolCodigoPostal = schoolRaw.codigoPostal as string | undefined;
          schoolLocalidade = schoolRaw.localidade as string | undefined;
          schoolDistrito = schoolRaw.distrito as string | undefined;
          schoolPais = schoolRaw.pais as string | undefined;
        }
      } catch {
        // skip
      }
    }

    // Company snapshot for cover page
    const empresaSnapshot = estagio.empresaSnapshot as
      | { nome?: string; morada?: string; codigoPostal?: string; localidade?: string }
      | undefined;
      
    let companyNome = empresaSnapshot?.nome;
    let companyMorada = empresaSnapshot?.morada;
    let companyCodigoPostal = empresaSnapshot?.codigoPostal;
    let companyLocalidade = empresaSnapshot?.localidade;

    // Resolve tutor role: override > profile > fallback
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
          }

          const overrideSnap = await db
            .collection("empresas")
            .doc(empresaId)
            .collection("tutores")
            .doc(tutorId)
            .get();
          if (overrideSnap.exists) {
            const overrideData = overrideSnap.data() as { funcaoEmpresaOverride?: string };
            if (overrideData.funcaoEmpresaOverride) {
              tutorRole = overrideData.funcaoEmpresaOverride;
            }
          }
        } catch {
          // fallback
        }
      }
      if (tutorRole === "Tutor de Estagio") {
        const tutorFuncao = getField(tutorId, "funcaoEmpresa");
        tutorRole = tutorFuncao || "Tutor de Estagio";
      }
    }
    
    if (!companyNome && empresa !== "-") {
      companyNome = empresa;
    }

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
    const generatedAt = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} as ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const weekStartIso = sumarios[0]?.weekStart ?? "";
    const weekEndIso = sumarios[sumarios.length - 1]?.weekEnd ?? "";
    const periodoInicio = weekStartIso ? formatIsoDate(weekStartIso) : "-";
    const periodofim = weekEndIso ? formatIsoDate(weekEndIso) : "-";
    const courseName = getField(alunoId, "curso") || "-";

    // Format sumarios
    const formattedSumarios = sumarios.map((s: any) => ({
      weekId: s.weekId,
      weekNumber: s.weekNumber,
      weekYear: s.weekYear,
      weekStart: formatIsoDate(s.weekStart ?? ""),
      weekEnd: formatIsoDate(s.weekEnd ?? ""),
      content: s.content ?? "",
      signedByTutor: !!s.signedByTutor,
      tutorSignedByName: s.tutorSignedByName,
      tutorSignedAt: formatTimestamp(s.tutorSignedAt),
    }));

    // Generate PDF
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    const totalPages = 1 + formattedSumarios.length + 1;

    // Page 1: Cover
    await createCoverPage(doc, font, bold, {
      alunoName, tutorName, professorName, empresa, courseName,
      periodoInicio, periodofim,
      totalSemanas: formattedSumarios.length, generatedAt,
      schoolName, schoolAddress, schoolCodigoPostal, schoolLocalidade,
      schoolDistrito, schoolPais,
      companyNome,
      companyMorada,
      companyCodigoPostal,
      companyLocalidade,
    }, 1, totalPages);

    // Pages 2..N: Sumario pages
    for (let i = 0; i < formattedSumarios.length; i++) {
      await createSumarioPage(
        doc, font, bold, formattedSumarios[i], alunoName,
        2 + i, totalPages
      );
    }

    // Last page: Signatures
    await createSignaturesPage(
      doc, font, bold,
      { alunoName, tutorName, empresa, tutorRole },
      includeSignatures,
      alunoSignatureBytes, tutorSignatureBytes,
      totalPages, totalPages, generatedAt
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
