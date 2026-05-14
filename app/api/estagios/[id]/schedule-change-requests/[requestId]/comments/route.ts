import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse, EstagioAccessError } from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

type Body = {
  text: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id, requestId } = await context.params;
    const session = await assertEstagioAccess(id, "member");

    const body = (await request.json()) as Body;

    if (!body.text || typeof body.text !== "string" || body.text.trim().length < 1) {
      throw new EstagioAccessError(400, "empty_comment", "O comentário não pode ser vazio.");
    }
    if (body.text.trim().length > 1000) {
      throw new EstagioAccessError(
        400,
        "comment_too_long",
        "O comentário não pode exceder 1000 caracteres."
      );
    }

    const db = getFirebaseAdminDb();
    const reqRef = db
      .collection("estagios")
      .doc(id)
      .collection("schedule_change_requests")
      .doc(requestId);

    const snap = await reqRef.get();
    if (!snap.exists) {
      throw new EstagioAccessError(404, "not_found", "Pedido não encontrado.");
    }

    await reqRef.update({
      comments: FieldValue.arrayUnion({
        authorId: session.uid,
        authorRole: session.role,
        text: body.text.trim(),
        createdAt: new Date().toISOString(),
      }),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
