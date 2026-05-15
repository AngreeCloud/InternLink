import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse, EstagioAccessError } from "@/lib/estagios/estagio-access";
import {
  getNextStatus,
  skipsTutorStep,
  type ScheduleChangeRequest,
  type DecisionAction,
} from "@/lib/estagios/schedule-change-requests";

export const runtime = "nodejs";

type Body = {
  action: DecisionAction | "comment";
  comment?: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id, requestId } = await context.params;
    const session = await assertEstagioAccess(id, "member");

    if (session.role !== "professor" && session.role !== "diretor") {
      throw new EstagioAccessError(
        403,
        "not_professor",
        "Apenas o professor orientador ou diretor de curso pode decidir nesta etapa."
      );
    }

    const body = (await request.json()) as Body;

    if (!["approve", "reject", "comment"].includes(body.action)) {
      throw new EstagioAccessError(400, "invalid_action", "Ação inválida.");
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

    const req = snap.data() as ScheduleChangeRequest;

    if (body.action === "comment") {
      // Comment only — no status change
      if (!body.comment || body.comment.trim().length < 1) {
        throw new EstagioAccessError(400, "empty_comment", "O comentário não pode ser vazio.");
      }
      if (body.comment.trim().length > 1000) {
        throw new EstagioAccessError(400, "comment_too_long", "O comentário não pode exceder 1000 caracteres.");
      }

      await reqRef.update({
        comments: FieldValue.arrayUnion({
          authorId: session.uid,
          authorRole: session.role,
          text: body.comment.trim(),
          createdAt: new Date().toISOString(),
        }),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ ok: true });
    }

    // Decision (approve or reject)
    const transition = getNextStatus(req.status, session.role as "professor" | "diretor", body.action);
    if (!transition.ok) {
      throw new EstagioAccessError(409, "invalid_transition", transition.reason);
    }

    // For absence justifications, professor approval goes directly to "approved" (skip tutor)
    const nextStatus =
      body.action === "approve" && skipsTutorStep(req.type)
        ? "approved"
        : transition.nextStatus;

    const updates: Record<string, unknown> = {
      status: nextStatus,
      professorDecision: body.action === "approve" ? "approved" : "rejected",
      professorDecidedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.comment?.trim()) {
      updates.comments = FieldValue.arrayUnion({
        authorId: session.uid,
        authorRole: session.role,
        text: body.comment.trim(),
        createdAt: new Date().toISOString(),
      });
    }

    await reqRef.update(updates);

    return NextResponse.json({ ok: true, nextStatus: transition.nextStatus });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
