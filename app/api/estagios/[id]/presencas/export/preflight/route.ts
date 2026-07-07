import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await assertEstagioAccess(id, "member");
    const db = getFirebaseAdminDb();
    const estagio = session.estagio;

    const presencasSnap = await db
      .collection("estagios")
      .doc(id)
      .collection("presencas")
      .orderBy("date", "asc")
      .get();

    let totalPresencas = 0;
    let hasAnyPresenca = false;
    presencasSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const horas = Number(data.hoursWorked ?? 0) || 0;
      if (horas > 0) {
        totalPresencas++;
        hasAnyPresenca = true;
      }
    });

    const tutorId = estagio.tutorId as string | undefined;
    const alunoId = estagio.alunoId as string | undefined;

    // Check signatures
    let alunoHasSignature = false;
    let tutorHasSignature = false;
    if (alunoId) {
      const sigSnap = await db.collection("users").doc(alunoId).collection("settings").doc("signature").get();
      alunoHasSignature = sigSnap.exists && !!sigSnap.data()?.dataUrl;
    }
    if (tutorId) {
      const sigSnap = await db.collection("users").doc(tutorId).collection("settings").doc("signature").get();
      tutorHasSignature = sigSnap.exists && !!sigSnap.data()?.dataUrl;
    }

    const presencasValidated = estagio.presencasValidatedByTutor === true;

    // School address
    let schoolHasAddress = true;
    if (estagio.schoolId) {
      try {
        const schoolSnap = await db.collection("schools").doc(estagio.schoolId as string).get();
        const school = schoolSnap.data() as Record<string, unknown> | undefined;
        schoolHasAddress = !!(school?.address || school?.morada);
      } catch {
        schoolHasAddress = false;
      }
    }

    return NextResponse.json({
      ok: true,
      hasAnyPresenca,
      totalPresencas,
      presencasValidated,
      alunoHasSignature,
      tutorHasSignature,
      canExportSigned: presencasValidated && alunoHasSignature && tutorHasSignature,
      schoolHasAddress,
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
