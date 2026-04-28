import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  EstagioAccessError,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

const TEMPLATE_CODE = "RELATORIO_FINAL";
const DEFAULT_MIN_HOURS = 80;

const MIME_TO_EXT: Record<string, "pdf" | "docx"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

type SubmitBody = {
  fileUrl?: string;
  filePath?: string;
  fileName?: string;
  fileMimeType?: string;
  fileExtension?: string;
  titulo?: string;
  resumo?: string;
};

function parseDate(value?: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function loadCourseRules(
  db: FirebaseFirestore.Firestore,
  courseId: string | null,
): Promise<{ reportMinHours: number; reportWaitDays: number }> {
  if (!courseId) return { reportMinHours: DEFAULT_MIN_HOURS, reportWaitDays: 0 };
  const snap = await db.collection("courses").doc(courseId).get();
  if (!snap.exists) return { reportMinHours: DEFAULT_MIN_HOURS, reportWaitDays: 0 };
  const data = snap.data() as { reportMinHours?: number; reportWaitDays?: number };
  return {
    reportMinHours:
      typeof data.reportMinHours === "number" && data.reportMinHours >= 0
        ? data.reportMinHours
        : DEFAULT_MIN_HOURS,
    reportWaitDays:
      typeof data.reportWaitDays === "number" && data.reportWaitDays >= 0
        ? data.reportWaitDays
        : 0,
  };
}

async function sumPresencasHours(
  db: FirebaseFirestore.Firestore,
  estagioId: string,
): Promise<number> {
  const snap = await db.collection("estagios").doc(estagioId).collection("presencas").get();
  let total = 0;
  snap.forEach((d) => {
    const data = d.data() as { hoursWorked?: number; horas?: number };
    const horas = Number(data.hoursWorked ?? data.horas ?? 0);
    if (Number.isFinite(horas) && horas > 0) total += horas;
  });
  return total;
}

async function findRelatorioDoc(
  db: FirebaseFirestore.Firestore,
  estagioId: string,
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  const docsCol = db.collection("estagios").doc(estagioId).collection("documentos");
  const snap = await docsCol.where("templateCode", "==", TEMPLATE_CODE).limit(1).get();
  if (!snap.empty) return snap.docs[0];
  return null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const session = await assertEstagioAccess(id, "member");

    if (session.role !== "aluno") {
      throw new EstagioAccessError(
        403,
        "not_aluno",
        "Apenas o aluno do estágio pode submeter o relatório final.",
      );
    }

    const body = (await request.json()) as SubmitBody;
    const fileUrl = (body.fileUrl ?? "").trim();
    const filePath = (body.filePath ?? "").trim();
    const fileMimeType = (body.fileMimeType ?? "").trim();
    if (!fileUrl || !filePath) {
      throw new EstagioAccessError(400, "missing_file", "Falta o ficheiro do relatório.");
    }
    const ext = MIME_TO_EXT[fileMimeType] ?? (body.fileExtension as "pdf" | "docx" | undefined);
    if (ext !== "pdf" && ext !== "docx") {
      throw new EstagioAccessError(
        400,
        "invalid_type",
        "O relatório tem de ser PDF ou DOCX.",
      );
    }

    // O caminho de Storage tem de pertencer ao próprio estágio (defesa em profundidade).
    if (!filePath.startsWith(`estagios/${id}/relatorios/`)) {
      throw new EstagioAccessError(400, "invalid_path", "Caminho de armazenamento inválido.");
    }

    const db = getFirebaseAdminDb();
    const courseId = (session.estagio.courseId ||
      session.estagio.alunoCourseId ||
      null) as string | null;

    const [{ reportMinHours, reportWaitDays }, hoursTotal] = await Promise.all([
      loadCourseRules(db, courseId),
      sumPresencasHours(db, id),
    ]);

    if (hoursTotal < reportMinHours) {
      throw new EstagioAccessError(
        400,
        "min_hours_not_met",
        `Necessita de ${reportMinHours}h mínimas. Horas registadas: ${hoursTotal}h.`,
      );
    }

    const dataInicio = parseDate(session.estagio.dataInicio);
    if (dataInicio && reportWaitDays > 0) {
      const minDate = new Date(dataInicio);
      minDate.setDate(minDate.getDate() + reportWaitDays);
      if (minDate.getTime() > Date.now()) {
        throw new EstagioAccessError(
          400,
          "wait_period",
          `Envio disponível a partir de ${minDate.toLocaleDateString("pt-PT")}.`,
        );
      }
    }

    const titulo = (body.titulo ?? "Relatório final de estágio").trim() || "Relatório final de estágio";
    const resumo = typeof body.resumo === "string" ? body.resumo.trim() : "";
    const now = FieldValue.serverTimestamp();
    const docsCol = db.collection("estagios").doc(id).collection("documentos");

    const existing = await findRelatorioDoc(db, id);
    let docRef: FirebaseFirestore.DocumentReference;
    let newVersion = 1;

    if (existing) {
      docRef = existing.ref;
      const data = existing.data() as { currentVersion?: number };
      newVersion = Number(data.currentVersion ?? 0) + 1;

      await docRef.update({
        nome: titulo,
        descricao: resumo,
        categoria: "relatorio_final",
        templateCode: TEMPLATE_CODE,
        pinned: true,
        pinnedAt: now,
        estado: "pendente",
        accessRoles: ["diretor", "professor", "tutor", "aluno"],
        currentVersion: newVersion,
        currentFileUrl: fileUrl,
        currentFilePath: filePath,
        fileMimeType,
        fileExtension: ext,
        updatedAt: now,
        submittedBy: session.uid,
        submittedAt: now,
      });
    } else {
      const allDocsSnap = await docsCol.get();
      let maxOrdem = 0;
      allDocsSnap.forEach((d) => {
        const ordem = Number((d.data() as { ordem?: number })?.ordem ?? 0);
        if (ordem > maxOrdem) maxOrdem = ordem;
      });

      docRef = docsCol.doc();
      await docRef.set({
        nome: titulo,
        descricao: resumo,
        categoria: "relatorio_final",
        templateCode: TEMPLATE_CODE,
        ordem: maxOrdem + 1,
        pinned: true,
        pinnedAt: now,
        estado: "pendente",
        prazoAssinatura: null,
        accessRoles: ["diretor", "professor", "tutor", "aluno"],
        accessUserIds: [],
        signatureRoles: [],
        signatureUserIds: [],
        signatureBoxes: [],
        currentVersion: 1,
        currentFileUrl: fileUrl,
        currentFilePath: filePath,
        fileMimeType,
        fileExtension: ext,
        createdAt: now,
        updatedAt: now,
        createdBy: session.uid,
        submittedBy: session.uid,
        submittedAt: now,
      });
    }

    await docRef.collection("versoes").doc(`v${newVersion}`).set({
      version: newVersion,
      fileUrl,
      filePath,
      fileMimeType,
      fileExtension: ext,
      uploadedAt: now,
      uploadedBy: session.uid,
      notes:
        newVersion === 1
          ? "Relatório final submetido pelo aluno."
          : "Nova versão do relatório final submetida pelo aluno.",
    });

    return NextResponse.json({
      ok: true,
      docId: docRef.id,
      version: newVersion,
      hoursTotal,
      reportMinHours,
      reportWaitDays,
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const session = await assertEstagioAccess(id, "member");

    const db = getFirebaseAdminDb();
    const courseId = (session.estagio.courseId ||
      session.estagio.alunoCourseId ||
      null) as string | null;

    const [{ reportMinHours, reportWaitDays }, hoursTotal, existing] = await Promise.all([
      loadCourseRules(db, courseId),
      sumPresencasHours(db, id),
      findRelatorioDoc(db, id),
    ]);

    let report: Record<string, unknown> | null = null;
    if (existing) {
      const data = existing.data() as Record<string, unknown>;
      const updatedAt = data.updatedAt as { toDate?: () => Date } | undefined;
      const submittedAt = data.submittedAt as { toDate?: () => Date } | undefined;
      report = {
        id: existing.id,
        nome: data.nome ?? "",
        descricao: data.descricao ?? "",
        currentFileUrl: data.currentFileUrl ?? "",
        currentFilePath: data.currentFilePath ?? "",
        fileMimeType: data.fileMimeType ?? "",
        fileExtension: data.fileExtension ?? "",
        currentVersion: data.currentVersion ?? 0,
        updatedAt: updatedAt?.toDate?.()?.toISOString() ?? null,
        submittedAt: submittedAt?.toDate?.()?.toISOString() ?? null,
      };
    }

    const dataInicio = parseDate(session.estagio.dataInicio);
    let availableAt: string | null = null;
    if (dataInicio && reportWaitDays > 0) {
      const minDate = new Date(dataInicio);
      minDate.setDate(minDate.getDate() + reportWaitDays);
      availableAt = minDate.toISOString();
    }

    return NextResponse.json({
      ok: true,
      role: session.role,
      estagioId: id,
      hoursTotal,
      reportMinHours,
      reportWaitDays,
      dataInicio: session.estagio.dataInicio ?? null,
      availableAt,
      report,
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
