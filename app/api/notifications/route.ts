import { NextResponse } from "next/server";
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

    const estagiosSnap = await db
      .collection("estagios")
      .where("professorId", "==", uid)
      .get();

    const estagioIds = estagiosSnap.docs.map((d) => d.id);
    if (estagioIds.length === 0) {
      return NextResponse.json({ ok: true, notifications: [] });
    }

    const results = await Promise.all(
      estagioIds.map(async (estagioId) => {
        const snap = await db
          .collection("estagios")
          .doc(estagioId)
          .collection("notifications")
          .get();
        return snap.docs
          .filter((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            return data.userId === uid;
          })
          .map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            return {
              id: docSnap.id,
              userId: (data.userId as string) ?? "",
              type: (data.type as string) ?? "",
              title: (data.title as string) ?? "Notificacao",
              body: (data.body as string) ?? "",
              readAt: data.readAt ?? null,
              createdAtMs: toMillis(data.createdAt),
              estagioId: (data.estagioId as string) ?? estagioId,
              requestId: data.requestId as string | undefined,
              requestType: data.requestType as string | undefined,
              targetDate: data.targetDate as string | undefined,
              docId: data.docId as string | undefined,
            } satisfies ApiNotification;
          });
      })
    );

    const notifications = results
      .flat()
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 100);

    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    console.error("[api/notifications]", error);
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
