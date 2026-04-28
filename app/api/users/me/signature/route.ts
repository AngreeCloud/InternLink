import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { requireSessionUid, toApiErrorResponse, EstagioAccessError } from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

type SignatureBody = {
  dataUrl?: string;
  source?: "drawn" | "uploaded";
};

export async function GET() {
  try {
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();
    const snap = await db.collection("users").doc(uid).collection("settings").doc("signature").get();
    if (!snap.exists) {
      return NextResponse.json({ ok: true, exists: false });
    }
    return NextResponse.json({ ok: true, exists: true, data: snap.data() });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireSessionUid();
    const body = (await request.json()) as SignatureBody;
    if (!body.dataUrl || !body.dataUrl.startsWith("data:image/")) {
      throw new EstagioAccessError(400, "invalid_data_url", "Imagem inválida.");
    }
    const source = body.source === "uploaded" ? "uploaded" : "drawn";
    const db = getFirebaseAdminDb();
    await db
      .collection("users")
      .doc(uid)
      .collection("settings")
      .doc("signature")
      .set(
        {
          dataUrl: body.dataUrl,
          source,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE() {
  try {
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();
    await db.collection("users").doc(uid).collection("settings").doc("signature").delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
