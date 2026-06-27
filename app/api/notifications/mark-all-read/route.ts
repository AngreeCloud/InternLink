import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  requireSessionUid,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();

    const notifsSnap = await db
      .collectionGroup("notifications")
      .where("userId", "==", uid)
      .where("readAt", "==", null)
      .get();

    if (notifsSnap.empty) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const batch = db.batch();
    for (const docSnap of notifsSnap.docs) {
      batch.update(docSnap.ref, { readAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();

    return NextResponse.json({ ok: true, updated: notifsSnap.size });
  } catch (error) {
    console.error("[api/notifications/mark-all-read]", error);
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
