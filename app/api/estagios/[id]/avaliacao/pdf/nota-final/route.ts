import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  EstagioAccessError,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import { renderNotaFinalPDF, type AvaliacaoPDFData } from "@/lib/avaliacao/avaliacao-pdf";
import type {
  AvaliacaoConfig,
  NotasTutor,
  NotaFinalProfessor,
} from "@/lib/avaliacao/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: estagioId } = await context.params;
    const session = await assertEstagioAccess(estagioId, "member");

    if (session.role !== "professor" && session.role !== "diretor") {
      throw new EstagioAccessError(
        403,
        "not_allowed",
        "Apenas o professor orientador ou diretor de curso pode descarregar este documento."
      );
    }

    const url = new URL(request.url);
    const includeSignatures = url.searchParams.get("assinaturas") !== "false";

    const db = getFirebaseAdminDb();

    // Load school config
    const schoolSnap = await db
      .collection("schools")
      .doc(session.estagio.schoolId ?? "")
      .get();
    const schoolData = schoolSnap.exists
      ? (schoolSnap.data() as Record<string, unknown>)
      : {};
    const config = schoolData.avaliacaoConfig as
      | AvaliacaoConfig
      | undefined;

    if (!config) {
      throw new EstagioAccessError(
        400,
        "no_config",
        "Sistema de avaliação não configurado."
      );
    }

    // Load tutor evaluation
    const tutorSnap = await db
      .collection("estagios")
      .doc(estagioId)
      .collection("avaliacao")
      .doc("tutor")
      .get();
    const tutorData = tutorSnap.exists
      ? (tutorSnap.data() as NotasTutor)
      : null;

    // Load professor final grade
    const professorSnap = await db
      .collection("estagios")
      .doc(estagioId)
      .collection("avaliacao")
      .doc("professor")
      .get();
    const professorData = professorSnap.exists
      ? (professorSnap.data() as NotaFinalProfessor)
      : null;

    // Resolve names
    const names = await resolveNames(
      db,
      session.estagio.alunoId,
      session.estagio.tutorId,
      session.estagio.professorId
    );

    // Resolve course name
    let courseName =
      (session.estagio.courseNome as string) ||
      (session.estagio.courseName as string) ||
      "";
    if (!courseName) {
      const courseId =
        (session.estagio.courseId as string) ||
        (session.estagio.alunoCourseId as string);
      if (courseId) {
        try {
          const courseSnap = await db.collection("courses").doc(courseId).get();
          if (courseSnap.exists) {
            const cd = courseSnap.data() as { nome?: string; name?: string };
            courseName = cd.nome || cd.name || "";
          }
        } catch { /* ignore */ }
      }
    }

    const pdfData: AvaliacaoPDFData = {
      alunoName: names.alunoName,
      tutorName: names.tutorName,
      professorName: names.professorName,
      empresa:
        (session.estagio.entidadeAcolhimento as string) ||
        (session.estagio.empresa as string) ||
        "",
      courseName,
      config,
      parametros: professorData?.parametros ?? tutorData?.parametros ?? {},
      assinaturaTutor: tutorData?.assinaturaTutor,
      assinaturaProfessor: professorData?.assinaturaProfessor,
      notaFinal: professorData?.notaFinal,
      generatedAt: new Date().toLocaleDateString("pt-PT"),
    };

    const pdfBuffer = await renderNotaFinalPDF(
      pdfData,
      includeSignatures
    );

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="nota-final-${estagioId}.pdf"`,
      },
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

async function resolveNames(
  db: ReturnType<typeof getFirebaseAdminDb>,
  alunoId?: string,
  tutorId?: string,
  professorId?: string
) {
  const ids = [alunoId, tutorId, professorId].filter(Boolean) as string[];
  const snapshots = await Promise.all(
    ids.map((id) => db.collection("users").doc(id).get())
  );
  const names: Record<string, string> = {};
  for (const snap of snapshots) {
    if (snap.exists) {
      const data = snap.data() as { nome?: string; displayName?: string };
      names[snap.id] = data.nome || data.displayName || snap.id;
    }
  }
  return {
    alunoName: names[alunoId ?? ""] || "—",
    tutorName: names[tutorId ?? ""] || "—",
    professorName: names[professorId ?? ""] || "—",
  };
}
