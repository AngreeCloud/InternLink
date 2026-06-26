import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  EstagioAccessError,
  requireSessionUid,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

function toMillis(raw: unknown): number {
  if (!raw) return 0;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "object") {
    const obj = raw as { seconds?: number; toDate?: () => Date };
    if (typeof obj.toDate === "function") return obj.toDate().getTime();
    if (typeof obj.seconds === "number") return obj.seconds * 1000;
  }
  return 0;
}

export type ApiNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  readAt: unknown;
  createdAtMs: number;
  estagioId: string;
  requestId?: string;
  requestType?: string;
  targetDate?: string;
  docId?: string;
};

export async function GET() {
  try {
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();

    // Use collection group query — works for all roles (professor, tutor, aluno, director, school-admin)
    const notifsSnap = await db
      .collectionGroup("notifications")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const notifications: ApiNotification[] = [];
    for (const docSnap of notifsSnap.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      // Derive estagioId from the parent document path: estagios/{id}/notifications/{notifId}
      const pathParts = docSnap.ref.path.split("/");
      const estagioId = pathParts[pathParts.indexOf("estagios") + 1] ?? "";

      notifications.push({
        id: docSnap.id,
        userId: (data.userId as string) ?? "",
        type: (data.type as string) ?? "",
        title: (data.title as string) ?? "Notificação",
        body: (data.body as string) ?? "",
        readAt: data.readAt ?? null,
        createdAtMs: toMillis(data.createdAt),
        estagioId,
        requestId: data.requestId as string | undefined,
        requestType: data.requestType as string | undefined,
        targetDate: data.targetDate as string | undefined,
        docId: data.docId as string | undefined,
      });
    }

    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    console.error("[api/notifications]", error);
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { uid } = await requireSessionUid();
    const body = (await request.json()) as { estagioId?: string; notificationId?: string };

    if (!body.estagioId || !body.notificationId) {
      throw new EstagioAccessError(400, "missing_fields", "Faltam estagioId ou notificationId.");
    }

    const db = getFirebaseAdminDb();
    const ref = db
      .collection("estagios")
      .doc(body.estagioId)
      .collection("notifications")
      .doc(body.notificationId);

    const snap = await ref.get();
    if (!snap.exists) {
      throw new EstagioAccessError(404, "not_found", "Notificação não encontrada.");
    }

    const data = snap.data() as Record<string, unknown>;
    if (data.userId !== uid) {
      throw new EstagioAccessError(403, "not_owner", "Esta notificação não lhe pertence.");
    }

    await ref.update({ readAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/notifications/patch]", error);
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
