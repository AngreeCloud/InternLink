import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import { checkPresencasCanValidate } from "@/lib/estagios/presencas";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await assertEstagioAccess(id, "member");
    const db = getFirebaseAdminDb();

    const role = session.role;
    if (role !== "aluno") {
      return NextResponse.json(
        { error: "Só o aluno pode disparar esta notificação.", code: "not_aluno" },
        { status: 403 }
      );
    }

    const estagioRef = db.collection("estagios").doc(id);
    const estagioSnap = await estagioRef.get();
    if (!estagioSnap.exists) {
      return NextResponse.json(
        { error: "Estágio não encontrado.", code: "not_found" },
        { status: 404 }
      );
    }

    const estagio = estagioSnap.data() as Record<string, unknown>;
    if (estagio.presencasValidatedByTutor === true) {
      return NextResponse.json({ ok: true, skipped: "already_validated" });
    }

    const tutorId = estagio.tutorId as string | undefined;
    if (!tutorId) {
      return NextResponse.json(
        { error: "Estágio sem tutor definido.", code: "no_tutor" },
        { status: 400 }
      );
    }

    const totalHoras = Number(estagio.totalHoras ?? 0) || 0;
    const horasDiarias = Number(estagio.horasDiarias ?? estagio.horasPorDia ?? 0) || 0;

    // Sum presencas hours
    const presencasSnap = await estagioRef.collection("presencas").get();
    let totalRealizado = 0;
    presencasSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      totalRealizado += Number(data.hoursWorked ?? 0) || 0;
    });

    const check = checkPresencasCanValidate(totalRealizado, totalHoras, horasDiarias);
    if (!check.podeValidar) {
      return NextResponse.json({ ok: true, skipped: "conditions_not_met" });
    }

    // Check existing unread notification for same tutor+estagio
    const existingNotifs = await estagioRef
      .collection("notifications")
      .where("userId", "==", tutorId)
      .where("type", "==", "presencas_ready")
      .where("readAt", "==", null)
      .limit(1)
      .get();

    if (!existingNotifs.empty) {
      return NextResponse.json({ ok: true, skipped: "already_notified" });
    }

    const alunoNome = (estagio.alunoNome as string) || session.displayName || "Aluno";
    const href = `/estagios/${id}?tab=horarios`;

    await estagioRef.collection("notifications").add({
      userId: tutorId,
      type: "presencas_ready",
      title: "Presenças prontas para validação",
      body: `${alunoNome} completou as horas previstas. Valide as presenças no separador Horários.`,
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
      estagioId: id,
      href,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
