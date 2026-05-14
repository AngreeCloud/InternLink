import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse, EstagioAccessError } from "@/lib/estagios/estagio-access";
import {
  getNextStatus,
  calcNewEndDate,
  type ScheduleChangeRequest,
  type DecisionAction,
} from "@/lib/estagios/schedule-change-requests";
import { normalizeDiasSemana } from "@/lib/estagios/workdays";

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

    if (session.role !== "tutor") {
      throw new EstagioAccessError(
        403,
        "not_tutor",
        "Apenas o tutor da empresa pode decidir nesta etapa."
      );
    }

    const body = (await request.json()) as Body;

    if (!["approve", "reject", "comment"].includes(body.action)) {
      throw new EstagioAccessError(400, "invalid_action", "Ação inválida.");
    }

    const db = getFirebaseAdminDb();
    const estagioRef = db.collection("estagios").doc(id);
    const reqRef = estagioRef.collection("schedule_change_requests").doc(requestId);

    const [reqSnap, estagioSnap] = await Promise.all([reqRef.get(), estagioRef.get()]);

    if (!reqSnap.exists) {
      throw new EstagioAccessError(404, "not_found", "Pedido não encontrado.");
    }

    const req = reqSnap.data() as ScheduleChangeRequest;
    const estagioData = estagioSnap.data() as Record<string, unknown>;

    if (body.action === "comment") {
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

    // Decision
    const transition = getNextStatus(req.status, "tutor", body.action);
    if (!transition.ok) {
      throw new EstagioAccessError(409, "invalid_transition", transition.reason);
    }

    const reqUpdates: Record<string, unknown> = {
      status: transition.nextStatus,
      tutorDecision: body.action === "approve" ? "approved" : "rejected",
      tutorDecidedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.comment?.trim()) {
      reqUpdates.comments = FieldValue.arrayUnion({
        authorId: session.uid,
        authorRole: session.role,
        text: body.comment.trim(),
        createdAt: new Date().toISOString(),
      });
    }

    // Side-effects when fully approved
    const estagioUpdates: Record<string, unknown> = {};
    if (transition.nextStatus === "approved") {
      if (req.type === "future_absence") {
        // Extend the estagio end date by one workday
        const currentEnd =
          (estagioData.dataFimEstimada as string | undefined) ??
          (estagioData.dataFim as string | undefined) ??
          "";
        const diasSemana = normalizeDiasSemana(estagioData.diasSemana);
        if (currentEnd) {
          const newEnd = calcNewEndDate(currentEnd, diasSemana);
          if (newEnd !== currentEnd) {
            estagioUpdates.dataFimEstimada = newEnd;
            estagioUpdates.updatedAt = FieldValue.serverTimestamp();
          }
        }
      } else if (req.type === "early_termination") {
        // Mark the estagio as concluded
        estagioUpdates.estadoEstagio = "concluido";
        estagioUpdates.estado = "concluido";
        estagioUpdates.updatedAt = FieldValue.serverTimestamp();
      }
    }

    // Write both updates (best-effort batch)
    const batch = db.batch();
    batch.update(reqRef, reqUpdates);
    if (Object.keys(estagioUpdates).length > 0) {
      batch.update(estagioRef, estagioUpdates);
    }
    await batch.commit();

    return NextResponse.json({ ok: true, nextStatus: transition.nextStatus });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
