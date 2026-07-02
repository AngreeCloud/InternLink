import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
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
    if (
      !parsed.hostname.endsWith("storage.googleapis.com") &&
      !parsed.hostname.endsWith("firebasestorage.app")
    ) return null;
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

  if (path) {
    const result = await tryDownload(path);
    if (result) return result;
  }

  if (fallbackUrl) {
    const extracted = extractPathFromDownloadUrl(fallbackUrl);
    if (extracted) {
      const result = await tryDownload(extracted);
      if (result) return result;
    }
  }

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

function assertManagerRole(role: EstagioRole) {
  if (role !== "diretor" && role !== "professor") {
    throw new EstagioAccessError(
      403,
      "not_manager",
      "Apenas o Diretor de Curso ou o Professor orientador podem gerir este documento."
    );
  }
}

type SignatureBox = {
  id: string;
  role?: EstagioRole;
  userId?: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  label?: string;
};

type PatchDocBody = {
  nome?: string;
  descricao?: string;
  categoria?: string;
  pinned?: boolean;
  estado?: string;
  prazoAssinatura?: string | null;
  accessRoles?: EstagioRole[];
  accessUserIds?: string[];
  signatureRoles?: EstagioRole[];
  signatureUserIds?: string[];
  signatureBoxes?: SignatureBox[];
  currentFileUrl?: string;
  currentFilePath?: string;
  fileMimeType?: string;
  fileExtension?: string;
  bumpVersion?: boolean;
  versionNotes?: string;
};

const ALLOWED_ROLES: EstagioRole[] = ["diretor", "professor", "tutor", "aluno"];

function sanitizeRoles(roles?: EstagioRole[]): EstagioRole[] | undefined {
  if (!Array.isArray(roles)) return undefined;
  return roles.filter((r) => ALLOWED_ROLES.includes(r));
}

function sanitizeBoxes(boxes?: SignatureBox[]): SignatureBox[] | undefined {
  if (!Array.isArray(boxes)) return undefined;
  return boxes
    .filter((box) => {
      if (!box || typeof box !== "object") return false;
      if (!Number.isFinite(box.page) || box.page < 1) return false;
      if (!Number.isFinite(box.x) || !Number.isFinite(box.y)) return false;
      if (!Number.isFinite(box.width) || !Number.isFinite(box.height)) return false;
      return true;
    })
    .map((box) => {
      const r: Record<string, unknown> = {
        id: String(box.id ?? ""),
        page: Math.floor(box.page),
        x: Math.max(0, Math.min(1, box.x)),
        y: Math.max(0, Math.min(1, box.y)),
        width: Math.max(0, Math.min(1, box.width)),
        height: Math.max(0, Math.min(1, box.height)),
      };
      if (box.role && ALLOWED_ROLES.includes(box.role)) r.role = box.role;
      if (typeof box.userId === "string") r.userId = box.userId;
      if (typeof box.color === "string") r.color = box.color;
      if (typeof box.label === "string") r.label = box.label;
      return r as unknown as SignatureBox;
    });
  }

/**
 * GET /api/estagios/[id]/documentos/[docId]?raw=true|false&inline=true|false
 *
 * raw=true  → devolve o PDF original sem página de assinaturas
 * raw=false → acrescenta uma página final com as assinaturas recolhidas
 * inline=true → Content-Disposition inline (para pré-visualização)
 *
 * Nota: o GET handler foi consolidado aqui porque o ficheiro separado
 * download/route.ts (com 2 segmentos dinâmicos + literal) não era
 * reconhecido pelo Next.js 16 com Turbopack, retornando 404.
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

    if (raw) {
      return new NextResponse(new Blob([Buffer.from(pdfBytes)], { type: "application/pdf" }), {
        headers: {
          "Content-Disposition": inline
            ? `inline; filename="${fileName}.pdf"`
            : `attachment; filename="${fileName}.pdf"`,
        },
      });
    }

    const sigsSnap = await docRef.collection("assinaturas").get();
    const signatures: SignatureRecord[] = sigsSnap.docs.map((d) => d.data() as SignatureRecord);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const sigPage = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = sigPage.getSize();
    const margin = 56;

    const brandColor = rgb(0.102, 0.169, 0.290);
    const mutedColor = rgb(0.45, 0.45, 0.45);
    const lineColor = rgb(0.878, 0.878, 0.878);

    sigPage.drawText("InternLink", {
      x: margin,
      y: height - margin - 14,
      size: 18,
      font: fontBold,
      color: brandColor,
    });

    const headerLineY = height - margin - 30;
    sigPage.drawLine({
      start: { x: margin, y: headerLineY },
      end: { x: width - margin, y: headerLineY },
      thickness: 0.75,
      color: lineColor,
    });

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
        const overflow = pdfDoc.addPage([595.28, 841.89]);
        cursorY = overflow.getSize().height - margin;
        overflow.drawText("InternLink - continuacao de assinaturas", {
          x: margin,
          y: cursorY,
          size: 9,
          font,
          color: mutedColor,
        });
        cursorY -= 16;
      }

      sigPage.drawLine({
        start: { x: margin, y: cursorY },
        end: { x: width - margin, y: cursorY },
        thickness: 0.5,
        color: lineColor,
      });
      cursorY -= 14;

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

      if (sig.signatureDataUrl) {
        try {
          const { bytes, mime } = dataUrlToBuffer(sig.signatureDataUrl);
          const sigImg = mime.includes("png")
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes);

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
          const blockTopY = cursorY + 14 + 14;
          const imgY = blockTopY - sigImgHeight / 2 - drawH / 2;

          sigPage.drawImage(sigImg, { x: imgX, y: imgY, width: drawW, height: drawH });
        } catch {
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await context.params;
    const session = await assertEstagioAccess(id, "member");
    assertManagerRole(session.role);

    const body = (await request.json()) as PatchDocBody;
    const db = getFirebaseAdminDb();
    const docRef = db.collection("estagios").doc(id).collection("documentos").doc(docId);

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (typeof body.nome === "string") updates.nome = body.nome.trim();
    if (typeof body.descricao === "string") updates.descricao = body.descricao;
    if (typeof body.categoria === "string") updates.categoria = body.categoria;
    if (typeof body.estado === "string") updates.estado = body.estado;
    if (body.prazoAssinatura === null) updates.prazoAssinatura = null;
    else if (typeof body.prazoAssinatura === "string") updates.prazoAssinatura = body.prazoAssinatura;

    if (typeof body.pinned === "boolean") {
      updates.pinned = body.pinned;
      updates.pinnedAt = body.pinned ? FieldValue.serverTimestamp() : null;
    }

    const accessRoles = sanitizeRoles(body.accessRoles);
    if (accessRoles) updates.accessRoles = accessRoles;
    if (Array.isArray(body.accessUserIds)) updates.accessUserIds = body.accessUserIds;
    const signatureRoles = sanitizeRoles(body.signatureRoles);
    if (signatureRoles) updates.signatureRoles = signatureRoles;
    if (Array.isArray(body.signatureUserIds)) updates.signatureUserIds = body.signatureUserIds;
    const boxes = sanitizeBoxes(body.signatureBoxes);
    if (boxes) updates.signatureBoxes = boxes;

    if (typeof body.currentFileUrl === "string") updates.currentFileUrl = body.currentFileUrl;
    if (typeof body.currentFilePath === "string") updates.currentFilePath = body.currentFilePath;
    if (typeof body.fileMimeType === "string") updates.fileMimeType = body.fileMimeType;
    if (typeof body.fileExtension === "string") {
      updates.fileExtension = body.fileExtension.toLowerCase();
    }

    let newVersion: number | null = null;
    if (body.bumpVersion) {
      const snap = await docRef.get();
      const data = snap.exists ? snap.data() : null;
      const estado = (data as { estado?: string })?.estado ?? "";
      if (estado === "assinado") {
        throw new EstagioAccessError(
          400,
          "doc_archived",
          "Documento assinado por todas as partes. Não pode ser alterado.",
        );
      }
      const currentVersion = Number((data as { currentVersion?: number })?.currentVersion ?? 0);
      newVersion = currentVersion + 1;
      updates.currentVersion = newVersion;
      updates.estado = body.estado ?? "aguarda_assinatura";
    }

    await docRef.update(updates);

    if (body.bumpVersion && newVersion !== null) {
      const versionRef = docRef.collection("versoes").doc(`v${newVersion}`);
      await versionRef.set({
        version: newVersion,
        fileUrl: updates.currentFileUrl ?? "",
        filePath: updates.currentFilePath ?? "",
        uploadedAt: FieldValue.serverTimestamp(),
        notes: body.versionNotes ?? "",
      });
    }

    return NextResponse.json({ ok: true, newVersion });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await context.params;
    const session = await assertEstagioAccess(id, "member");
    assertManagerRole(session.role);

    const db = getFirebaseAdminDb();
    const docRef = db.collection("estagios").doc(id).collection("documentos").doc(docId);
    await docRef.delete();

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
