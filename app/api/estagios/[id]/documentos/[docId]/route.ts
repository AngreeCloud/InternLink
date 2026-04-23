import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse } from "@/lib/estagios/estagio-access";
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await context.params;
    await assertEstagioAccess(id, "director");

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

    let newVersion: number | null = null;
    if (body.bumpVersion) {
      const snap = await docRef.get();
      const data = snap.exists ? snap.data() : null;
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
    await assertEstagioAccess(id, "director");

    const db = getFirebaseAdminDb();
    const docRef = db.collection("estagios").doc(id).collection("documentos").doc(docId);
    await docRef.delete();

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
