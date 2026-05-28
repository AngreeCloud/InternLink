import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse, EstagioAccessError } from "@/lib/estagios/estagio-access";
import { getNextStatus, type ScheduleChangeRequest } from "@/lib/estagios/schedule-change-requests";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id, requestId } = await context.params;
    const session = await assertEstagioAccess(id, "member");

    if (session.role !== "aluno") {
      throw new EstagioAccessError(403, "not_aluno", "Apenas o aluno pode cancelar os seus pedidos.");
    }

    const db = getFirebaseAdminDb();
    const reqRef = db.collection("estagios").doc(id).collection("schedule_change_requests").doc(requestId);

    const snap = await reqRef.get();
    if (!snap.exists) {
      throw new EstagioAccessError(404, "not_found", "Pedido não encontrado.");
    }

    const req = snap.data() as ScheduleChangeRequest;

    if (req.studentId !== session.uid) {
      throw new EstagioAccessError(403, "not_owner", "Não podes cancelar um pedido que não criaste.");
    }

    const transition = getNextStatus(req.status, "aluno", "cancel");
    if (!transition.ok) {
      throw new EstagioAccessError(400, "invalid_transition", transition.reason);
    }

    await reqRef.update({
      status: transition.nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, nextStatus: transition.nextStatus });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
