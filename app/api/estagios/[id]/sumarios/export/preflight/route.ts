import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await assertEstagioAccess(id, "member");
    const db = getFirebaseAdminDb();

    const sumariosSnap = await db
      .collection("estagios")
      .doc(id)
      .collection("sumarios")
      .get();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);

    const pastWeeks: Array<{ weekId: string; weekNumber: number; weekYear: number }> = [];
    const notArchivedWeeks: string[] = [];

    sumariosSnap.forEach((d) => {
      const data = d.data() as {
        weekEnd?: string;
        weekNumber?: number;
        weekYear?: number;
        estado?: string;
        content?: string;
      };
      if (data.weekEnd && data.weekEnd < todayIso) {
        pastWeeks.push({
          weekId: d.id,
          weekNumber: data.weekNumber ?? 0,
          weekYear: data.weekYear ?? 0,
        });
        if (!data.content) {
          notArchivedWeeks.push(`Semana ${data.weekNumber ?? "?"}`);
        } else if (data.estado !== "arquivado") {
          notArchivedWeeks.push(`Semana ${data.weekNumber ?? "?"}`);
        }
      }
    });

    const allPastArchived = notArchivedWeeks.length === 0 && pastWeeks.length > 0;

    const alunoId = session.estagio.alunoId;
    const tutorId = session.estagio.tutorId;

    const [alunoSigSnap, tutorSigSnap] = await Promise.all([
      alunoId
        ? db.collection("users").doc(alunoId).collection("settings").doc("signature").get()
        : Promise.resolve(null),
      tutorId
        ? db.collection("users").doc(tutorId).collection("settings").doc("signature").get()
        : Promise.resolve(null),
    ]);

    const alunoHasSignature =
      alunoSigSnap?.exists && !!alunoSigSnap.data()?.dataUrl;
    const tutorHasSignature =
      tutorSigSnap?.exists && !!tutorSigSnap.data()?.dataUrl;

    const hasAnySumario = sumariosSnap.size > 0;
    const canExportSigned =
      allPastArchived && alunoHasSignature && tutorHasSignature && hasAnySumario;

    return NextResponse.json({
      ok: true,
      allSumariosArchived: allPastArchived,
      pastWeekCount: pastWeeks.length,
      pendingWeeks: notArchivedWeeks,
      alunoHasSignature,
      tutorHasSignature,
      canExportSigned,
      hasAnySumario,
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
