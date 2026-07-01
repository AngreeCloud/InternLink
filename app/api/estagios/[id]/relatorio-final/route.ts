import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { PDFDocument } from "pdf-lib";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import {
  assertEstagioAccess,
  EstagioAccessError,
  toApiErrorResponse,
} from "@/lib/estagios/estagio-access";
import type { EstagioRole } from "@/lib/estagios/permissions";

export const runtime = "nodejs";

const TEMPLATE_CODE = "RELATORIO_FINAL";
const DEFAULT_MIN_HOURS = 80;
const REPORT_SIGNATURE_ROLES: EstagioRole[] = ["aluno", "professor", "tutor"];
const ALLOWED_ROLES: EstagioRole[] = ["diretor", "professor", "tutor", "aluno"];

const MIME_TO_EXT: Record<string, "pdf" | "docx"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

type SignatureBox = {
  id: string;
  role?: EstagioRole;
  userId?: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  label?: string;
};

function sanitizeRoles(roles?: EstagioRole[]): EstagioRole[] {
  if (!Array.isArray(roles)) return [];
  return roles.filter((r) => ALLOWED_ROLES.includes(r));
}

function sanitizeBoxes(boxes?: SignatureBox[]): SignatureBox[] {
  if (!Array.isArray(boxes)) return [];
  return boxes
    .filter((box) => {
      if (!box || typeof box !== "object") return false;
      if (!Number.isFinite(box.page) || box.page < 1) return false;
      if (!Number.isFinite(box.x) || !Number.isFinite(box.y)) return false;
      if (!Number.isFinite(box.width) || !Number.isFinite(box.height)) return false;
      return true;
    })
    .map((box) => {
      const r: Record<string, unknown> = {
        id: String(box.id ?? ""),
        page: Math.floor(box.page),
        x: Math.max(0, Math.min(1, box.x)),
        y: Math.max(0, Math.min(1, box.y)),
        width: Math.max(0, Math.min(1, box.width)),
        height: Math.max(0, Math.min(1, box.height)),
      };
      if (box.role && ALLOWED_ROLES.includes(box.role)) r.role = box.role;
      if (typeof box.userId === "string") r.userId = box.userId;
      if (typeof box.color === "string") r.color = box.color;
      if (typeof box.label === "string") r.label = box.label;
      return r as unknown as SignatureBox;
    });
}

type SubmitBody = {
  fileUrl?: string;
  filePath?: string;
  fileName?: string;
  fileMimeType?: string;
  fileExtension?: string;
  titulo?: string;
  resumo?: string;
  signatureBoxes?: SignatureBox[];
  signatureRoles?: EstagioRole[];
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

    const signatureRoles = sanitizeRoles(body.signatureRoles);
    const effectiveSignatureRoles =
      signatureRoles.length > 0 ? signatureRoles : REPORT_SIGNATURE_ROLES;
    const signatureBoxes = sanitizeBoxes(body.signatureBoxes);
    const hasSignatureFlow = effectiveSignatureRoles.length > 0;
    const initialEstado = hasSignatureFlow ? "aguarda_assinatura" : "pendente";

    if (existing) {
      const existingData = existing.data() as {
        estado?: string;
        currentVersion?: number;
      };

      if (existingData.estado === "assinado") {
        throw new EstagioAccessError(
          400,
          "already_signed",
          "O relatório já foi assinado por todas as partes. Não pode ser alterado.",
        );
      }

      docRef = existing.ref;
      newVersion = Number(existingData.currentVersion ?? 0) + 1;

      const updateData: Record<string, unknown> = {
        nome: titulo,
        descricao: resumo,
        categoria: "relatorio_final",
        templateCode: TEMPLATE_CODE,
        pinned: true,
        pinnedAt: now,
        estado: initialEstado,
        accessRoles: ["diretor", "professor", "tutor", "aluno"],
        currentVersion: newVersion,
        currentFileUrl: fileUrl,
        currentFilePath: filePath,
        fileMimeType,
        fileExtension: ext,
        updatedAt: now,
        submittedBy: session.uid,
        submittedAt: now,
      };

      if (hasSignatureFlow) {
        updateData.signatureRoles = effectiveSignatureRoles;
        updateData.signatureUserIds = [];
        updateData.signatureBoxes = signatureBoxes;
        updateData.signedBy = [];
        updateData.signedByRoles = [];
      }

      await docRef.update(updateData);
    } else {
      const allDocsSnap = await docsCol.get();
      let maxOrdem = 0;
      allDocsSnap.forEach((d) => {
        const ordem = Number((d.data() as { ordem?: number })?.ordem ?? 0);
        if (ordem > maxOrdem) maxOrdem = ordem;
      });

      docRef = docsCol.doc();
      const setData: Record<string, unknown> = {
        nome: titulo,
        descricao: resumo,
        categoria: "relatorio_final",
        templateCode: TEMPLATE_CODE,
        ordem: maxOrdem + 1,
        pinned: true,
        pinnedAt: now,
        estado: initialEstado,
        prazoAssinatura: null,
        accessRoles: ["diretor", "professor", "tutor", "aluno"],
        accessUserIds: [],
        signatureRoles: hasSignatureFlow ? effectiveSignatureRoles : [],
        signatureUserIds: [],
        signatureBoxes: hasSignatureFlow ? signatureBoxes : [],
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
      };
      await docRef.set(setData);
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

    const membersSet = new Set<string>();
    if (session.estagio.professorId) membersSet.add(session.estagio.professorId);
    if (session.estagio.tutorId) membersSet.add(session.estagio.tutorId);
    if (session.course?.courseDirectorId) membersSet.add(session.course.courseDirectorId);
    membersSet.delete(session.uid);

    const notifBatch = db.batch();
    for (const userId of membersSet) {
      const nRef = db.collection("estagios").doc(id).collection("notifications").doc();
      notifBatch.set(nRef, {
        userId,
        type: "relatorio_submitted",
        docId: docRef.id,
        title: newVersion === 1 ? "Relatório final submetido" : "Relatório final atualizado",
        body: `${session.displayName || "O aluno"} submeteu o relatório final.`,
        readAt: null,
        createdAt: now,
      });
    }
    await notifBatch.commit();

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
      const boxes = (data.signatureBoxes as SignatureBox[] | undefined) ?? [];
      const estado = (data.estado as string | undefined) ?? "pendente";
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
        estado,
        signatureBoxes: boxes,
        signatureRoles: (data.signatureRoles as EstagioRole[] | undefined) ?? [],
      };
      let allSigned = false;
      try {
        const sigsSnap = await existing.ref.collection("assinaturas").get();
        allSigned = boxes.length > 0 && sigsSnap.size >= boxes.length;
      } catch { /* ignore */ }
      report.submitted = true;
      report.allSigned = allSigned;
      // Try to compute page count for PDF files (best-effort; will silently fail).
      try {
        const ext = (report.fileExtension as string | undefined) ?? "";
        const url = (report.currentFileUrl as string | undefined) ?? "";
        if (ext.toLowerCase() === "pdf" && url) {
          const res = await fetch(url);
          if (res.ok) {
            const arr = await res.arrayBuffer();
            const pdf = await PDFDocument.load(Buffer.from(arr));
            (report as any).pageCount = pdf.getPageCount();
          }
        }
      } catch (err) {
        // ignore page count failures
        console.error("[v0] relatorio pageCount failed", err);
      }
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
