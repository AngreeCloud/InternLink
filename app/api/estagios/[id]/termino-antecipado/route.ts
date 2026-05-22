import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse, EstagioAccessError } from "@/lib/estagios/estagio-access";
import {
  calculateProjection,
  validateSubmission,
  type TerminoAntecipado,
} from "@/lib/estagios/termino-antecipado";
import { normalizeDiasSemana } from "@/lib/estagios/workdays";
import {
  buildTerminoAntecipadoNotification,
  buildTutorSubmittedNotification,
} from "@/lib/notifications/termino-antecipado-notifications";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await assertEstagioAccess(id, "member");

    if (session.role !== "aluno") {
      throw new EstagioAccessError(403, "not_aluno", "Apenas o aluno pode submeter um pedido de término antecipado.");
    }

    const db = getFirebaseAdminDb();
    const estagio = session.estagio as Record<string, unknown>;

    const totalHoras = Number(estagio.totalHoras ?? 0) || 0;
    const horasDiarias = Number(estagio.horasDiarias ?? estagio.horasPorDia ?? 0) || 0;
    const dataInicio = (estagio.dataInicio as string | undefined) ?? "";
    const dataFim = (estagio.dataFimEstimada as string | undefined) ?? (estagio.dataFim as string | undefined) ?? "";
    const diasSemana = normalizeDiasSemana(estagio.diasSemana);
    const professorId = (estagio.professorId as string | undefined) ?? "";
    const professorNome = (estagio.professorNome as string | undefined) ?? "";
    const tutorId = (estagio.tutorId as string | undefined) ?? "";
    const tutorNome = (estagio.tutorNome as string | undefined) ?? "";
    const encarregadoEducacaoId = (estagio.encarregadoEducacaoId as string | undefined) || undefined;
    const encarregadoEducacaoNome = (estagio.encarregadoEducacaoNome as string | undefined) || undefined;
    const alunoNome = session.displayName || (estagio.alunoNome as string) || "O aluno";

    // Calculate horas realizadas
    const presencasSnap = await db
      .collection("estagios")
      .doc(id)
      .collection("presencas")
      .get();

    let horasRealizadas = 0;
    presencasSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      horasRealizadas += Number(data.hoursWorked ?? 0) || 0;
    });

    const horasRestantes = Math.max(0, totalHoras - horasRealizadas);

    // Check for existing active request
    const existingSnap = await db
      .collection("estagios")
      .doc(id)
      .collection("termino_antecipado")
      .where("estado", "in", ["pendente", "aprovado"])
      .get();

    const existingActive = !existingSnap.empty;

    // Validate submission
    const validation = validateSubmission(horasRealizadas, totalHoras, horasDiarias, existingActive);
    if (!validation.ok) {
      throw new EstagioAccessError(400, "not_eligible", validation.reason);
    }

    // Calculate projection
    const projection = calculateProjection(horasRestantes, horasDiarias, dataInicio, dataFim, diasSemana);
    if (!projection) {
      throw new EstagioAccessError(400, "projection_failed", "Não foi possível calcular a projeção de dias futuros.");
    }

    if (projection.diasParaCumprir.length === 0) {
      throw new EstagioAccessError(400, "no_days", "Não existem dias futuros suficientes para a projeção.");
    }

    // Create the document
    const col = db.collection("estagios").doc(id).collection("termino_antecipado");
    const newRef = col.doc();

    const payload: Omit<TerminoAntecipado, "id"> = {
      estagioId: id,
      alunoId: session.uid,
      alunoNome,
      tutorId,
      tutorNome,
      professorOrientadorId: professorId,
      professorOrientadorNome: professorNome,
      encarregadoEducacaoId,
      encarregadoEducacaoNome,
      horasPrevistasTotais: totalHoras,
      horasRealizadasNaSubmissao: horasRealizadas,
      horasRestantesNaSubmissao: horasRestantes,
      horasPorDia: horasDiarias,
      diasParaCumprir: projection.diasParaCumprir,
      diaDeDispensa: projection.diaDeDispensa,
      estado: "pendente",
      submittedAt: FieldValue.serverTimestamp(),
      notificadosReadOnly: [],
    };

    await newRef.set(payload);

    // Create notifications
    const notifsCol = db.collection("estagios").doc(id).collection("notifications");
    const batch = db.batch();

    // Notify tutor (decision required)
    if (tutorId && tutorId !== session.uid) {
      const tn = buildTutorSubmittedNotification(
        tutorId,
        newRef.id,
        id,
        alunoNome,
        projection.diaDeDispensa,
        horasRestantes,
        projection.diasParaCumprir
      );
      batch.set(notifsCol.doc(), { ...tn, createdAt: FieldValue.serverTimestamp() });
    }

    // Notify aluno (confirmation)
    const an = buildTerminoAntecipadoNotification(session.uid, newRef.id, id, {
      kind: "submitted",
      alunoNome,
      diaDeDispensa: projection.diaDeDispensa,
      horasRestantes,
      diasParaCumprir: projection.diasParaCumprir,
    });
    batch.set(notifsCol.doc(), { ...an, createdAt: FieldValue.serverTimestamp() });

    // Notify professor (read-only)
    if (professorId && professorId !== session.uid) {
      const pn = buildTerminoAntecipadoNotification(professorId, newRef.id, id, {
        kind: "submitted_readonly",
        alunoNome,
        diaDeDispensa: projection.diaDeDispensa,
      });
      batch.set(notifsCol.doc(), { ...pn, createdAt: FieldValue.serverTimestamp() });
    }

    // Notify encarregado de educacao (read-only)
    if (encarregadoEducacaoId && encarregadoEducacaoId !== session.uid) {
      const een = buildTerminoAntecipadoNotification(encarregadoEducacaoId, newRef.id, id, {
        kind: "submitted_readonly",
        alunoNome,
        diaDeDispensa: projection.diaDeDispensa,
      });
      batch.set(notifsCol.doc(), { ...een, createdAt: FieldValue.serverTimestamp() });
    }

    // Track read-only notifications in the document
    const readOnlyIds: string[] = [];
    if (professorId) readOnlyIds.push(professorId);
    if (encarregadoEducacaoId) readOnlyIds.push(encarregadoEducacaoId);

    batch.update(newRef, { notificadosReadOnly: readOnlyIds } as Record<string, unknown>);

    await batch.commit();

    return NextResponse.json({ ok: true, id: newRef.id }, { status: 201 });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
