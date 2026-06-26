import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  EstagioAccessError,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import { writeAuditLog } from "@/lib/audit/write";
import { validateNotasTutor } from "@/lib/avaliacao/validations";
import type { AvaliacaoConfig, NotasTutor, SignatureData } from "@/lib/avaliacao/types";

export const runtime = "nodejs";

type TutorSubmitBody = {
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

    if (session.role !== "tutor") {
      throw new EstagioAccessError(403, "not_tutor", "Apenas o tutor pode preencher a avaliação.");
    }

    const body = (await request.json()) as TutorSubmitBody;
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
        "O sistema de avaliação não está configurado para esta escola. Contacte o administrador escolar."
      );
    }

    // Validate scores
    const validation = validateNotasTutor(body.parametros, config);
    if (!validation.valid) {
      throw new EstagioAccessError(400, "invalid_scores", validation.error ?? "Notas inválidas.");
    }

    // Check not already signed
    const existingSnap = await db
      .collection("estagios")
      .doc(estagioId)
      .collection("avaliacao")
      .doc("tutor")
      .get();
    if (existingSnap.exists) {
      const existingData = existingSnap.data() as NotasTutor;
      if (existingData.estado === "assinado") {
        throw new EstagioAccessError(409, "already_signed", "A avaliação já foi assinada pelo tutor.");
      }
    }

    // Validate signature
    if (!body.signatureDataUrl || !body.signatureDataUrl.startsWith("data:image/")) {
      throw new EstagioAccessError(400, "missing_signature", "Assinatura em falta. Configure-a no perfil ou desenhe uma.");
    }

    const now = FieldValue.serverTimestamp();
    const signature: SignatureData = {
      uid: session.uid,
      nome: session.displayName || "",
      role: session.role,
      signedAt: new Date().toISOString(),
      signatureDataUrl: body.signatureDataUrl,
    };

    const tutorDoc: NotasTutor = {
      parametros: body.parametros,
      assinaturaTutor: signature,
      estado: "assinado",
      assinadoEm: new Date().toISOString(),
      resetCount: 0,
    };

    await db
      .collection("estagios")
      .doc(estagioId)
      .collection("avaliacao")
      .doc("tutor")
      .set(tutorDoc);

    // Notify professor and director
    const membersSet = new Set<string>();
    if (session.estagio.professorId) membersSet.add(session.estagio.professorId);
    if (session.course?.courseDirectorId) membersSet.add(session.course.courseDirectorId);
    membersSet.delete(session.uid);

    const notifBatch = db.batch();
    for (const userId of membersSet) {
      const nRef = db.collection("estagios").doc(estagioId).collection("notifications").doc();
      notifBatch.set(nRef, {
        userId,
        type: "avaliacao_tutor_assinada",
        estagioId,
        title: "Avaliação preenchida pelo tutor",
        body: `${session.displayName || "O tutor"} preencheu e assinou a avaliação do estágio.`,
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
      summary: `Tutor assinou avaliação do estágio: ${estagioLabel}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
