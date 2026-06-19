import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getFirebaseAdminDb, getFirebaseAdminStorage } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  EstagioAccessError,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import type { EstagioRole } from "@/lib/estagios/permissions";

export const runtime = "nodejs";

const ROLE_LABEL: Record<EstagioRole, string> = {
  diretor: "Diretor de Curso",
  professor: "Professor Orientador",
  tutor: "Tutor de Estágio",
  aluno: "Aluno em Estágio",
};

type SignatureRecord = {
  uid: string;
  role: EstagioRole;
  nome: string;
  signatureDataUrl: string;
  signedAt?: { toDate?: () => Date };
};

function extractPathFromDownloadUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("storage.googleapis.com")) return null;
    const match = parsed.pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

async function fetchPdfBuffer(path: string, fallbackUrl?: string): Promise<Uint8Array> {
  const tryDownload = async (p: string): Promise<Uint8Array | null> => {
    try {
      const bucket = getFirebaseAdminStorage().bucket();
      const [contents] = await bucket.file(p).download();
      const bytes = new Uint8Array(contents);
      return bytes.length > 0 ? bytes : null;
    } catch {
      return null;
    }
  };

  // 1) Usar currentFilePath diretamente
  if (path) {
    const result = await tryDownload(path);
    if (result) return result;
  }

  // 2) Extrair caminho do currentFileUrl (cobre documentos antigos sem path)
  if (fallbackUrl) {
    const extracted = extractPathFromDownloadUrl(fallbackUrl);
    if (extracted) {
      const result = await tryDownload(extracted);
      if (result) return result;
    }
  }

  // 3) Fallback: fetch direto à URL (último recurso)
  if (fallbackUrl) {
    const res = await fetch(fallbackUrl);
    if (!res.ok) {
      throw new EstagioAccessError(500, "fetch_pdf_failed", `Não foi possível obter o PDF (${res.status}).`);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0) {
      throw new EstagioAccessError(500, "fetch_pdf_failed", "PDF vazio.");
    }
    return bytes;
  }

  throw new EstagioAccessError(400, "no_file", "O documento ainda não tem PDF associado.");
}

function dataUrlToBuffer(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error("Imagem de assinatura inválida.");
  return {
    mime: match[1],
    bytes: Uint8Array.from(Buffer.from(match[2], "base64")),
  };
}

/**
 * GET /api/estagios/[id]/documentos/[docId]/download?raw=true|false
 *
 * raw=true  → devolve o PDF original sem página de assinaturas
 * raw=false → acrescenta uma página final com as assinaturas recolhidas
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await context.params;
    const session = await assertEstagioAccess(id, "member");
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get("raw") === "true";
    // inline=true → sem Content-Disposition: attachment (para iframes de pré-visualização)
    const inline = searchParams.get("inline") === "true";

    const db = getFirebaseAdminDb();
    const docRef = db.collection("estagios").doc(id).collection("documentos").doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new EstagioAccessError(404, "doc_not_found", "Documento não encontrado.");
    }

    const docData = docSnap.data() as {
      nome?: string;
      currentFileUrl?: string;
      currentFilePath?: string;
      signatureRoles?: EstagioRole[];
      signatureUserIds?: string[];
    };

    if (!docData.currentFileUrl && !docData.currentFilePath) {
      throw new EstagioAccessError(400, "no_file", "O documento ainda não tem PDF associado.");
    }

    const fileName = (docData.nome ?? "documento").replace(/[^\w\s-]/g, "").trim() || "documento";
    const pdfBytes = await fetchPdfBuffer(docData.currentFilePath ?? "", docData.currentFileUrl);

    // Modo raw: devolver diretamente sem assinaturas.
    if (raw) {
      return new NextResponse(new Blob([Buffer.from(pdfBytes)], { type: "application/pdf" }), {
        headers: {
          "Content-Disposition": inline
            ? `inline; filename="${fileName}.pdf"`
            : `attachment; filename="${fileName}.pdf"`,
        },
      });
    }

    // Modo assinado: recolher assinaturas da subcoleção.
    const sigsSnap = await docRef.collection("assinaturas").get();
    const signatures: SignatureRecord[] = sigsSnap.docs.map((d) => d.data() as SignatureRecord);

    // Carregar logo SVG como png embebido — usamos um fallback de texto caso falhe.
    // (pdf-lib não suporta SVG, por isso criamos uma representação textual do logotipo.)

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // ── Página de assinaturas ──────────────────────────────────────────────
    const sigPage = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = sigPage.getSize();
    const margin = 56;
    const contentWidth = width - margin * 2;

    // Cor de destaque: azul escuro (#1a2b4a)
    const brandColor = rgb(0.102, 0.169, 0.290);
    const mutedColor = rgb(0.45, 0.45, 0.45);
    const lineColor = rgb(0.878, 0.878, 0.878);

    // ── Cabeçalho ─────────────────────────────────────────────────────────
    // Bloco de logotipo (wordmark textual)
    sigPage.drawText("InternLink", {
      x: margin,
      y: height - margin - 14,
      size: 18,
      font: fontBold,
      color: brandColor,
    });

    // Linha separadora abaixo do cabeçalho
    const headerLineY = height - margin - 30;
    sigPage.drawLine({
      start: { x: margin, y: headerLineY },
      end: { x: width - margin, y: headerLineY },
      thickness: 0.75,
      color: lineColor,
    });

    // ── Título da secção ──────────────────────────────────────────────────
    let cursorY = headerLineY - 24;
    sigPage.drawText("Página de Assinaturas", {
      x: margin,
      y: cursorY,
      size: 13,
      font: fontBold,
      color: brandColor,
    });

    cursorY -= 10;
    sigPage.drawText(`Documento: ${docData.nome ?? "-"}`, {
      x: margin,
      y: cursorY,
      size: 9,
      font,
      color: mutedColor,
    });

    cursorY -= 14;
    const nowStr = new Date().toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    sigPage.drawText(`Gerado em: ${nowStr}`, {
      x: margin,
      y: cursorY,
      size: 8,
      font,
      color: mutedColor,
    });

    cursorY -= 22;

    // ── Bloco por signatário ───────────────────────────────────────────────
    const sigBlockHeight = 90;
    const sigImgWidth = 160;
    const sigImgHeight = 56;

    if (signatures.length === 0) {
      sigPage.drawText("Este documento não possui assinaturas registadas.", {
        x: margin,
        y: cursorY,
        size: 10,
        font,
        color: mutedColor,
      });
    }

    for (const sig of signatures) {
      if (cursorY - sigBlockHeight < margin + 40) {
        // Adicionar nova página se não houver espaço.
        const overflow = pdfDoc.addPage([595.28, 841.89]);
        cursorY = overflow.getSize().height - margin;
        // Referência mínima de cabeçalho na página de transbordo.
        overflow.drawText("InternLink - continuacao de assinaturas", {
          x: margin,
          y: cursorY,
          size: 9,
          font,
          color: mutedColor,
        });
        cursorY -= 16;
      }

      // Linha superior do bloco.
      sigPage.drawLine({
        start: { x: margin, y: cursorY },
        end: { x: width - margin, y: cursorY },
        thickness: 0.5,
        color: lineColor,
      });
      cursorY -= 14;

      // Nome e cargo.
      sigPage.drawText(sig.nome || "Utilizador desconhecido", {
        x: margin,
        y: cursorY,
        size: 11,
        font: fontBold,
        color: brandColor,
      });
      cursorY -= 14;
      sigPage.drawText(ROLE_LABEL[sig.role] ?? sig.role, {
        x: margin,
        y: cursorY,
        size: 9,
        font,
        color: mutedColor,
      });

      // Data de assinatura.
      if (sig.signedAt?.toDate) {
        const dateStr = sig.signedAt.toDate().toLocaleString("pt-PT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        sigPage.drawText(`Assinado em: ${dateStr}`, {
          x: margin,
          y: cursorY - 13,
          size: 8,
          font,
          color: mutedColor,
        });
      }

      // Imagem da assinatura, à direita do bloco.
      if (sig.signatureDataUrl) {
        try {
          const { bytes, mime } = dataUrlToBuffer(sig.signatureDataUrl);
          const sigImg = mime.includes("png")
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes);

          // Ajuste de aspect ratio dentro da caixa definida.
          const imgAspect = sigImg.width / sigImg.height;
          const boxAspect = sigImgWidth / sigImgHeight;
          let drawW = sigImgWidth;
          let drawH = sigImgHeight;
          if (imgAspect > boxAspect) {
            drawH = sigImgWidth / imgAspect;
          } else {
            drawW = sigImgHeight * imgAspect;
          }

          const imgX = width - margin - sigImgWidth + (sigImgWidth - drawW) / 2;
          // Centrar verticalmente em relação ao bloco.
          const blockTopY = cursorY + 14 + 14; // subir de volta ao topo
          const imgY = blockTopY - sigImgHeight / 2 - drawH / 2;

          sigPage.drawImage(sigImg, { x: imgX, y: imgY, width: drawW, height: drawH });
        } catch {
          // Se a imagem falhar, colocar placeholder textual.
          sigPage.drawText("[assinatura]", {
            x: width - margin - 80,
            y: cursorY,
            size: 9,
            font,
            color: mutedColor,
          });
        }
      }

      cursorY -= sigBlockHeight - 28;
    }

    // ── Rodapé ────────────────────────────────────────────────────────────
    const footerY = margin + 20;
    sigPage.drawLine({
      start: { x: margin, y: footerY + 12 },
      end: { x: width - margin, y: footerY + 12 },
      thickness: 0.5,
      color: lineColor,
    });
    sigPage.drawText(
      "Este documento foi gerado e assinado digitalmente pela plataforma InternLink.",
      {
        x: margin,
        y: footerY,
        size: 7,
        font,
        color: mutedColor,
      }
    );
    sigPage.drawText(`internlink.app  -  ${session.estagio.schoolId ?? ""}`, {
      x: margin,
      y: footerY - 10,
      size: 7,
      font,
      color: mutedColor,
    });

    const signedPdfBytes = await pdfDoc.save();

    return new NextResponse(new Blob([Buffer.from(signedPdfBytes)], { type: "application/pdf" }), {
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}-assinado.pdf"`,
      },
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
