import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  EstagioAccessError,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import type { EstagioRole } from "@/lib/estagios/permissions";

export const runtime = "nodejs";

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

type CreateDocBody = {
  nome?: string;
  descricao?: string;
  categoria?: string;
  templateCode?: string;
  pinned?: boolean;
  prazoAssinatura?: string | null;
  accessRoles?: EstagioRole[];
  accessUserIds?: string[];
  signatureRoles?: EstagioRole[];
  signatureUserIds?: string[];
  signatureBoxes?: SignatureBox[];
  currentFileUrl?: string;
  currentFilePath?: string;
};

const ALLOWED_ROLES: EstagioRole[] = ["diretor", "professor", "tutor", "aluno"];

function sanitizeRoles(roles?: EstagioRole[]): EstagioRole[] {
  if (!Array.isArray(roles)) return [];
  return roles.filter((r) => ALLOWED_ROLES.includes(r));
}

function sanitizeBoxes(boxes?: SignatureBox[]): SignatureBox[] {
  if (!Array.isArray(boxes)) return [];
  return boxes
    .filter((box) => {
      if (!box || typeof box !== "object") return false;
      if (!Number.isFinite(box.page) || box.page < 1) return false;
      if (!Number.isFinite(box.x) || !Number.isFinite(box.y)) return false;
      if (!Number.isFinite(box.width) || !Number.isFinite(box.height)) return false;
      return true;
    })
    .map((box) => ({
      id: String(box.id ?? ""),
      role: box.role && ALLOWED_ROLES.includes(box.role) ? box.role : undefined,
      userId: typeof box.userId === "string" ? box.userId : undefined,
      page: Math.floor(box.page),
      x: Math.max(0, Math.min(1, box.x)),
      y: Math.max(0, Math.min(1, box.y)),
      width: Math.max(0, Math.min(1, box.width)),
      height: Math.max(0, Math.min(1, box.height)),
      color: typeof box.color === "string" ? box.color : undefined,
      label: typeof box.label === "string" ? box.label : undefined,
    }));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    // Diretor de Curso OU Professor orientador podem criar documentos.
    const session = await assertEstagioAccess(id, "member");
    if (session.role !== "diretor" && session.role !== "professor") {
      throw new EstagioAccessError(
        403,
        "not_manager",
        "Apenas o Diretor de Curso ou o Professor orientador podem criar documentos."
      );
    }

    const body = (await request.json()) as CreateDocBody;

    const nome = (body.nome ?? "").trim();
    if (!nome) {
      throw new EstagioAccessError(400, "missing_name", "Nome do documento é obrigatório.");
    }

    const db = getFirebaseAdminDb();
    const docsCol = db.collection("estagios").doc(id).collection("documentos");

    // Próxima ordem (para posicionar no fim da lista).
    const allDocsSnap = await docsCol.get();
    let maxOrdem = 0;
    allDocsSnap.forEach((d) => {
      const ordem = Number((d.data() as { ordem?: number })?.ordem ?? 0);
      if (ordem > maxOrdem) maxOrdem = ordem;
    });

    const now = FieldValue.serverTimestamp();
    const hasFile =
      typeof body.currentFileUrl === "string" && body.currentFileUrl.length > 0;

    const docRef = docsCol.doc();
    await docRef.set({
      nome,
      descricao: typeof body.descricao === "string" ? body.descricao : "",
      categoria: typeof body.categoria === "string" ? body.categoria : "outros",
      templateCode: typeof body.templateCode === "string" ? body.templateCode : null,
      ordem: maxOrdem + 1,
      pinned: Boolean(body.pinned),
      pinnedAt: body.pinned ? now : null,
      estado: hasFile ? "aguarda_assinatura" : "pendente",
      prazoAssinatura:
        body.prazoAssinatura === null
          ? null
          : typeof body.prazoAssinatura === "string"
            ? body.prazoAssinatura
            : null,
      accessRoles: sanitizeRoles(body.accessRoles),
      accessUserIds: Array.isArray(body.accessUserIds) ? body.accessUserIds : [],
      signatureRoles: sanitizeRoles(body.signatureRoles),
      signatureUserIds: Array.isArray(body.signatureUserIds) ? body.signatureUserIds : [],
      signatureBoxes: sanitizeBoxes(body.signatureBoxes),
      currentVersion: hasFile ? 1 : 0,
      currentFileUrl: typeof body.currentFileUrl === "string" ? body.currentFileUrl : "",
      currentFilePath: typeof body.currentFilePath === "string" ? body.currentFilePath : "",
      createdAt: now,
      updatedAt: now,
      createdBy: session.uid,
    });

    if (hasFile) {
      await docRef.collection("versoes").doc("v1").set({
        version: 1,
        fileUrl: body.currentFileUrl,
        filePath: body.currentFilePath ?? "",
        uploadedAt: now,
        uploadedBy: session.uid,
        notes: "Versão inicial carregada.",
      });
    }

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
