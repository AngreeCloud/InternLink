import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
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
  signatureDataUrl?: string;
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
      currentVersion?: number;
      nome?: string;
    };

    if (!canSignDoc(session.uid, session.role, docData)) {
      throw new EstagioAccessError(403, "cannot_sign", "Não tem permissão para assinar este documento.");
    }

    const existingSigSnap = await docRef.collection("assinaturas").doc(session.uid).get();
    if (existingSigSnap.exists) {
      throw new EstagioAccessError(409, "already_signed", "Já assinou este documento.");
    }

    if (!docData.currentFileUrl) {
      throw new EstagioAccessError(400, "no_file", "O documento ainda não tem PDF associado.");
    }

    // Obter assinatura: prioridade ao body, fallback ao perfil guardado.
    let signatureDataUrl = body.signatureDataUrl ?? "";
    if (!signatureDataUrl) {
      const profileSigSnap = await db
        .collection("users")
        .doc(session.uid)
        .collection("settings")
        .doc("signature")
        .get();
      if (profileSigSnap.exists) {
        const profileSigData = profileSigSnap.data() as { dataUrl?: string };
        signatureDataUrl = profileSigData.dataUrl ?? "";
      }
    }

    if (!signatureDataUrl) {
      throw new EstagioAccessError(400, "missing_signature", "Falta a assinatura. Configure-a no perfil ou desenhe uma.");
    }

    const sigBytes = Buffer.from(signatureDataUrl.split(",")[1] ?? "", "base64");
    const signatureHash = crypto.createHash("sha256").update(sigBytes).digest("hex");

    const now = FieldValue.serverTimestamp();
    const boxes: SignatureBox[] = Array.isArray(docData.signatureBoxes) ? docData.signatureBoxes : [];
    const allSignatureBoxes = boxes.length;
    const existingSigsSnap = await docRef.collection("assinaturas").get();
    const signaturesAfter = existingSigsSnap.size + 1;
    const allSigned = allSignatureBoxes > 0 && signaturesAfter >= allSignatureBoxes;

    // Guardar assinatura na subcoleção — o PDF é gerado apenas no descarregamento.
    await docRef.collection("assinaturas").doc(session.uid).set({
      uid: session.uid,
      role: session.role,
      nome: session.displayName || "",
      signedAt: now,
      ipAddress: getClientIp(request),
      signatureImageHash: signatureHash,
      signatureDataUrl,
    });

    // Atualizar estado do documento.
    await docRef.update({
      signedBy: FieldValue.arrayUnion(session.uid),
      signedByRoles: FieldValue.arrayUnion(session.role),
      estado: allSigned ? "assinado" : "aguarda_assinatura",
      updatedAt: now,
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
      allSigned,
      signaturesCount: signaturesAfter,
      totalRequired: allSignatureBoxes,
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
