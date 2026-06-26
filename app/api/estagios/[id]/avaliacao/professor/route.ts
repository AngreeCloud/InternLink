import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  EstagioAccessError,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import { writeAuditLog } from "@/lib/audit/write";
import { validateNotasTutor, calculateNotaFinal } from "@/lib/avaliacao/validations";
import type {
  AvaliacaoConfig,
  NotaFinalProfessor,
  NotasTutor,
  SignatureData,
} from "@/lib/avaliacao/types";

export const runtime = "nodejs";

type ProfessorSubmitBody = {
  parametros: Record<string, number>;
  signatureDataUrl: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: estagioId } = await context.params;
    const session = await assertEstagioAccess(estagioId, "member");

    if (session.role !== "professor" && session.role !== "diretor") {
      throw new EstagioAccessError(
        403,
        "not_professor",
        "Apenas o professor orientador ou diretor de curso pode atribuir a nota final."
      );
    }

    const body = (await request.json()) as ProfessorSubmitBody;
    const db = getFirebaseAdminDb();

    // Load school config
    const schoolSnap = await db
      .collection("schools")
      .doc(session.estagio.schoolId ?? "")
      .get();
    if (!schoolSnap.exists) {
      throw new EstagioAccessError(400, "no_school", "Escola não encontrada.");
    }
    const schoolData = schoolSnap.data() as Record<string, unknown>;
    const config = schoolData.avaliacaoConfig as AvaliacaoConfig | undefined;
    if (!config || !config.parametros || config.parametros.length === 0) {
      throw new EstagioAccessError(
        400,
        "no_avaliacao_config",
        "O sistema de avaliação não está configurado para esta escola."
      );
    }

    // Check tutor has signed
    const tutorSnap = await db
      .collection("estagios")
      .doc(estagioId)
      .collection("avaliacao")
      .doc("tutor")
      .get();
    if (!tutorSnap.exists) {
      throw new EstagioAccessError(
        400,
        "tutor_not_signed",
        "O tutor ainda não preencheu a avaliação."
      );
    }
    const tutorData = tutorSnap.data() as NotasTutor;
    if (tutorData.estado !== "assinado") {
      throw new EstagioAccessError(
        400,
        "tutor_not_signed",
        "O tutor ainda não assinou a avaliação."
      );
    }

    // Validate parameter scores
    const validation = validateNotasTutor(body.parametros, config);
    if (!validation.valid) {
      throw new EstagioAccessError(400, "invalid_scores", validation.error ?? "Notas inválidas.");
    }

    const notaFinal = calculateNotaFinal(body.parametros, config);

    // Check not already signed
    const existingSnap = await db
      .collection("estagios")
      .doc(estagioId)
      .collection("avaliacao")
      .doc("professor")
      .get();
    if (existingSnap.exists) {
      const existingData = existingSnap.data() as NotaFinalProfessor;
      if (existingData.estado === "assinado") {
        throw new EstagioAccessError(409, "already_signed", "A nota final já foi atribuída e assinada.");
      }
    }

    // Validate signature
    if (!body.signatureDataUrl || !body.signatureDataUrl.startsWith("data:image/")) {
      throw new EstagioAccessError(400, "missing_signature", "Assinatura em falta.");
    }

    const now = FieldValue.serverTimestamp();
    const signature: SignatureData = {
      uid: session.uid,
      nome: session.displayName || "",
      role: session.role,
      signedAt: new Date().toISOString(),
      signatureDataUrl: body.signatureDataUrl,
    };

    const professorDoc: NotaFinalProfessor = {
      parametros: body.parametros,
      notaFinal,
      assinaturaProfessor: signature,
      estado: "assinado",
      assinadoEm: new Date().toISOString(),
    };

    await db
      .collection("estagios")
      .doc(estagioId)
      .collection("avaliacao")
      .doc("professor")
      .set(professorDoc);

    // Also add professor signature to tutor document
    await db
      .collection("estagios")
      .doc(estagioId)
      .collection("avaliacao")
      .doc("tutor")
      .update({
        assinaturaProfessor: signature,
      });

    // Notify tutor and others
    const membersSet = new Set<string>();
    if (session.estagio.tutorId) membersSet.add(session.estagio.tutorId);
    if (session.course?.courseDirectorId) membersSet.add(session.course.courseDirectorId);
    membersSet.delete(session.uid);

    const notifBatch = db.batch();
    for (const userId of membersSet) {
      const nRef = db.collection("estagios").doc(estagioId).collection("notifications").doc();
      notifBatch.set(nRef, {
        userId,
        type: "avaliacao_professor_assinada",
        estagioId,
        title: "Nota final atribuída",
        body: `${session.displayName || "O professor"} atribuiu a nota final do estágio.`,
        readAt: null,
        createdAt: now,
      });
    }
    await notifBatch.commit();

    // Audit log
    const estagioLabel =
      (session.estagio.titulo as string) ||
      (session.estagio.id as string) ||
      estagioId;
    writeAuditLog({
      schoolId: session.estagio.schoolId ?? "",
      entityType: "avaliacao",
      entityId: estagioId,
      entityLabel: estagioLabel,
      action: "sign_avaliacao",
      changedBy: session.uid,
      summary: `Professor atribuiu nota final do estágio: ${estagioLabel}`,
      metadata: { notaFinal },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
