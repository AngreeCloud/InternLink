import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { PDFDocument } from "pdf-lib";
import crypto from "node:crypto";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  EstagioAccessError,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import { canSignDoc, type EstagioRole } from "@/lib/estagios/permissions";

export const runtime = "nodejs";

type SignBody = {
  signatureDataUrl?: string; // PNG data URL com a imagem da assinatura
  boxId?: string;
  signedFileUrl?: string; // URL do ficheiro já assinado (upload prévio feito pelo cliente)
  signedFilePath?: string; // path Storage do ficheiro já assinado
};

type SignatureBox = {
  id: string;
  role?: EstagioRole;
  userId?: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "";
  const xrealip = request.headers.get("x-real-ip");
  if (xrealip) return xrealip.trim();
  return "";
}

async function fetchPdfBuffer(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new EstagioAccessError(500, "fetch_pdf_failed", `Não foi possível obter PDF (${res.status}).`);
  }
  const arr = new Uint8Array(await res.arrayBuffer());
  return arr;
}

function dataUrlToBuffer(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) {
    throw new EstagioAccessError(400, "invalid_data_url", "Imagem da assinatura inválida.");
  }
  const mime = match[1];
  const base64 = match[2];
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  return { bytes, mime };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await context.params;
    const session = await assertEstagioAccess(id, "member");

    const body = (await request.json()) as SignBody;
    const db = getFirebaseAdminDb();
    const docRef = db.collection("estagios").doc(id).collection("documentos").doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new EstagioAccessError(404, "doc_not_found", "Documento não encontrado.");
    }

    const docData = docSnap.data() as {
      signatureRoles?: EstagioRole[];
      signatureUserIds?: string[];
      signatureBoxes?: SignatureBox[];
      currentFileUrl?: string;
      currentFilePath?: string;
      currentVersion?: number;
      estado?: string;
      nome?: string;
    };

    // Verificar permissão de assinar.
    if (!canSignDoc(session.uid, session.role, docData)) {
      throw new EstagioAccessError(403, "cannot_sign", "Não tem permissão para assinar este documento.");
    }

    // Verificar se já assinou.
    const existingSigSnap = await docRef.collection("assinaturas").doc(session.uid).get();
    if (existingSigSnap.exists) {
      throw new EstagioAccessError(409, "already_signed", "Já assinou este documento.");
    }

    // Deve existir um PDF atual.
    if (!docData.currentFileUrl) {
      throw new EstagioAccessError(400, "no_file", "O documento ainda não tem PDF associado.");
    }

    // Localizar a caixa de assinatura do utilizador.
    const boxes: SignatureBox[] = Array.isArray(docData.signatureBoxes) ? docData.signatureBoxes : [];
    let targetBox: SignatureBox | null = null;
    if (body.boxId) {
      targetBox = boxes.find((b) => b.id === body.boxId) ?? null;
    }
    if (!targetBox) {
      targetBox =
        boxes.find((b) => b.userId && b.userId === session.uid) ||
        boxes.find((b) => b.role && b.role === session.role) ||
        null;
    }

    if (!targetBox) {
      throw new EstagioAccessError(400, "no_box", "Não existe caixa de assinatura atribuída.");
    }

    const signatureDataUrl = body.signatureDataUrl ?? "";
    if (!signatureDataUrl) {
      throw new EstagioAccessError(400, "missing_signature", "Falta a imagem da assinatura.");
    }

    // Aplicar assinatura ao PDF.
    const pdfBytes = await fetchPdfBuffer(docData.currentFileUrl);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const pageIdx = Math.max(0, Math.min(pages.length - 1, (targetBox.page || 1) - 1));
    const page = pages[pageIdx];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    const { bytes: sigBytes, mime } = dataUrlToBuffer(signatureDataUrl);
    const signatureHash = crypto.createHash("sha256").update(sigBytes).digest("hex");

    const sigImage = mime.includes("png")
      ? await pdfDoc.embedPng(sigBytes)
      : await pdfDoc.embedJpg(sigBytes);

    // As coordenadas das caixas estão normalizadas 0..1 no sistema "topo-esquerda" (pdfjs).
    // pdf-lib usa "canto-inferior-esquerdo". Convertermos Y.
    const boxX = targetBox.x * pageWidth;
    const boxY = pageHeight - (targetBox.y + targetBox.height) * pageHeight;
    const boxW = targetBox.width * pageWidth;
    const boxH = targetBox.height * pageHeight;

    // Ajustar a imagem para caber mantendo aspect ratio.
    const imgAspect = sigImage.width / sigImage.height;
    const boxAspect = boxW / boxH;
    let drawW = boxW;
    let drawH = boxH;
    if (imgAspect > boxAspect) {
      drawH = boxW / imgAspect;
    } else {
      drawW = boxH * imgAspect;
    }
    const drawX = boxX + (boxW - drawW) / 2;
    const drawY = boxY + (boxH - drawH) / 2;

    page.drawImage(sigImage, { x: drawX, y: drawY, width: drawW, height: drawH });

    const newPdfBytes = await pdfDoc.save();
    const base64 = Buffer.from(newPdfBytes).toString("base64");

    // Bump version
    const currentVersion = Number(docData.currentVersion ?? 0);
    const newVersion = currentVersion + 1;

    // O PDF assinado é devolvido em base64 para o cliente fazer upload ao Storage
    // (uso de regras Storage per-user; evitamos ter o admin a escrever no bucket
    // através de APIs server-only). O cliente deverá então chamar PATCH para
    // atualizar currentFileUrl/currentFilePath + bumpVersion.
    //
    // Mas aqui já fazemos parte do registo: guardamos a assinatura no sub-doc
    // `assinaturas/{uid}` com hash e audit trail, e devolvemos o PDF resultante.
    const now = FieldValue.serverTimestamp();

    const allSignatureBoxes = boxes.length;
    const existingSigsSnap = await docRef.collection("assinaturas").get();
    const signaturesAfter = existingSigsSnap.size + 1;
    const allSigned = signaturesAfter >= allSignatureBoxes;

    await docRef.collection("assinaturas").doc(session.uid).set({
      uid: session.uid,
      role: session.role,
      nome: session.displayName || "",
      signedAt: now,
      ipAddress: getClientIp(request),
      signatureImageHash: signatureHash,
      boxId: targetBox.id,
    });

    // Notificações para outros membros.
    const membersSet = new Set<string>();
    if (session.estagio.professorId) membersSet.add(session.estagio.professorId);
    if (session.estagio.tutorId) membersSet.add(session.estagio.tutorId);
    if (session.estagio.alunoId) membersSet.add(session.estagio.alunoId);
    if (session.course?.courseDirectorId) membersSet.add(session.course.courseDirectorId);
    membersSet.delete(session.uid);

    const notifBatch = db.batch();
    for (const userId of membersSet) {
      const nRef = db.collection("estagios").doc(id).collection("notifications").doc();
      notifBatch.set(nRef, {
        userId,
        type: allSigned ? "doc_signed" : "doc_awaits_signature",
        docId,
        title: allSigned
          ? `Documento assinado por todos: ${docData.nome || ""}`
          : `Documento aguarda assinatura: ${docData.nome || ""}`,
        body: `${session.displayName || "Um utilizador"} acabou de assinar.`,
        readAt: null,
        createdAt: now,
      });
    }
    await notifBatch.commit();

    return NextResponse.json({
      ok: true,
      newVersion,
      pdfBase64: base64,
      allSigned,
      signaturesCount: signaturesAfter,
      totalRequired: allSignatureBoxes,
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
