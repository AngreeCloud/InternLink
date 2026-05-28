import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse, EstagioAccessError } from "@/lib/estagios/estagio-access";
import {
  validateNoOverlap,
  requiresApproval,
  type ScheduleChangeRequest,
  type ScheduleChangeRequestType,
} from "@/lib/estagios/schedule-change-requests";
import {
  buildNotification,
  shouldNotifyProfessorOnCreate,
  shouldNotifyTutorOnCreate,
} from "@/lib/notifications/create-notification";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET — list all requests for this estagio (any member)
// ---------------------------------------------------------------------------
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await assertEstagioAccess(id, "member");

    const db = getFirebaseAdminDb();
    const snap = await db
      .collection("estagios")
      .doc(id)
      .collection("schedule_change_requests")
      .orderBy("createdAt", "desc")
      .get();

    const requests = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

// ---------------------------------------------------------------------------
// POST — create a new request (aluno only)
// ---------------------------------------------------------------------------
type CreateBody = {
  type: ScheduleChangeRequestType;
  targetDate: string;
  reason: string;
  absenceType?: "total" | "partial";
  hoursAffected: number;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await assertEstagioAccess(id, "member");

    if (session.role !== "aluno") {
      throw new EstagioAccessError(
        403,
        "not_aluno",
        "Apenas o aluno pode submeter pedidos de mudança de horário."
      );
    }

    const body = (await request.json()) as CreateBody;

    // Validate type
    if (!["future_absence", "past_absence_justification", "early_termination"].includes(body.type)) {
      throw new EstagioAccessError(400, "invalid_type", "Tipo de pedido inválido.");
    }

    // Validate targetDate
    if (
      !body.targetDate ||
      typeof body.targetDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)
    ) {
      throw new EstagioAccessError(400, "invalid_date", "Data alvo inválida.");
    }

    // Validate reason
    if (!body.reason || typeof body.reason !== "string" || body.reason.trim().length < 10) {
      throw new EstagioAccessError(
        400,
        "invalid_reason",
        "O motivo deve ter pelo menos 10 caracteres."
      );
    }
    if (body.reason.trim().length > 1000) {
      throw new EstagioAccessError(
        400,
        "reason_too_long",
        "O motivo não pode exceder 1000 caracteres."
      );
    }

    const db = getFirebaseAdminDb();
    const col = db
      .collection("estagios")
      .doc(id)
      .collection("schedule_change_requests");

    // Check for overlapping active requests on the same date
    const existingSnap = await col.where("targetDate", "==", body.targetDate).get();
    const existing = existingSnap.docs.map((d) => d.data() as Pick<ScheduleChangeRequest, "targetDate" | "status">);
    const overlap = validateNoOverlap(existing, body.targetDate);

    if (!overlap.ok) {
      throw new EstagioAccessError(
        409,
        "overlap",
        `Já existe um pedido ativo para essa data (estado: ${overlap.conflictingStatus}).`
      );
    }

    const estagioData = session.estagio as Record<string, unknown>;
    const professorId = (estagioData.professorId as string | undefined) ?? "";
    const tutorId = (estagioData.tutorId as string | undefined) ?? "";

    // Justificação de falta → professor deve analisar
    const initialStatus = requiresApproval(body.type) ? "pending_professor" : "acknowledged";

    const newRef = col.doc();
    const payload: Omit<ScheduleChangeRequest, "id"> = {
      estagioId: id,
      studentId: session.uid,
      professorId,
      tutorId,
      type: body.type,
      targetDate: body.targetDate,
      absenceType: body.absenceType,
      hoursAffected: Number.isFinite(body.hoursAffected) ? body.hoursAffected : 0,
      reason: body.reason.trim(),
      status: initialStatus,
      comments: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await newRef.set(payload);

    const studentLabel = session.displayName || "O aluno";
    const notifsCol = db.collection("estagios").doc(id).collection("notifications");
    const batch = db.batch();

    // Notify professor for all request types
    if (shouldNotifyProfessorOnCreate(body.type) && professorId && professorId !== session.uid) {
      const n = buildNotification(professorId, newRef.id, body.type, body.targetDate, id, {
        kind: "request_created",
        studentName: studentLabel,
      });
      batch.set(notifsCol.doc(), { ...n, createdAt: FieldValue.serverTimestamp() });
    }

    // Notify tutor for justification requests
    if (shouldNotifyTutorOnCreate(body.type) && tutorId && tutorId !== session.uid) {
      const n = buildNotification(tutorId, newRef.id, body.type, body.targetDate, id, {
        kind: "request_created",
        studentName: studentLabel,
      });
      batch.set(notifsCol.doc(), { ...n, createdAt: FieldValue.serverTimestamp() });
    }

    await batch.commit();

    return NextResponse.json({ ok: true, id: newRef.id }, { status: 201 });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
