import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { calcularDataFimEstimada, DEFAULT_DIAS_SEMANA, type DiasSemana } from "@/lib/estagios/date-calc";
import { ESTAGIO_TEMPLATES } from "@/lib/estagios/templates";
import { EstagioAccessError, toApiErrorResponse } from "@/lib/estagios/estagio-access";
import { writeAuditLog } from "@/lib/audit/write";
import { buildSummary } from "@/lib/audit/summaries";

export const runtime = "nodejs";

type EmpresaSnapshot = {
  nome: string;
  morada?: string;
  codigoPostal?: string;
  localidade?: string;
  nif?: string;
  emailGeral?: string;
  telefone?: string;
};

type CreateEstagioBody = {
  alunoId?: string;
  tutorId?: string;
  empresa?: string;
  empresaId?: string;
  empresaSnapshot?: EmpresaSnapshot;
  titulo?: string;
  dataInicio?: string;
  totalHoras?: number;
  horasDiarias?: number;
  diasSemana?: Partial<DiasSemana>;
};

function normalizeDiasSemana(input?: Partial<DiasSemana>): DiasSemana {
  return {
    seg: input?.seg ?? DEFAULT_DIAS_SEMANA.seg,
    ter: input?.ter ?? DEFAULT_DIAS_SEMANA.ter,
    qua: input?.qua ?? DEFAULT_DIAS_SEMANA.qua,
    qui: input?.qui ?? DEFAULT_DIAS_SEMANA.qui,
    sex: input?.sex ?? DEFAULT_DIAS_SEMANA.sex,
    sab: input?.sab ?? DEFAULT_DIAS_SEMANA.sab,
    dom: input?.dom ?? DEFAULT_DIAS_SEMANA.dom,
  };
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const sessionCookie = jar.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) {
      throw new EstagioAccessError(401, "no_session", "Sessão inexistente.");
    }

    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;
    const db = getFirebaseAdminDb();

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
    }
    const userData = userSnap.data() as {
      role?: string;
      schoolId?: string;
      nome?: string;
    };

    if (userData.role !== "professor") {
      throw new EstagioAccessError(403, "not_professor", "Apenas professores podem criar estágios.");
    }
    if (!userData.schoolId) {
      throw new EstagioAccessError(403, "no_school", "Professor sem escola associada.");
    }

    const body = (await request.json()) as CreateEstagioBody;
    const alunoId = (body.alunoId ?? "").trim();
    const titulo = (body.titulo ?? "").trim();
    const empresa = (body.empresa ?? "").trim();
    const empresaId = (body.empresaId ?? "").trim();
    const empresaSnapshot = body.empresaSnapshot ?? null;
    const dataInicio = (body.dataInicio ?? "").trim();
    const totalHoras = Number(body.totalHoras);
    const horasDiarias = Number(body.horasDiarias);
    const tutorId = (body.tutorId ?? "").trim();
    const diasSemana = normalizeDiasSemana(body.diasSemana);

    let resolvedEmpresaNome = empresa;
    let resolvedEmpresaMorada: string | undefined;
    let resolvedEmpresaCodigoPostal: string | undefined;

    if (empresaId) {
      const empresaSnap = await db.collection("empresas").doc(empresaId).get();
      if (empresaSnap.exists) {
        const ed = empresaSnap.data() as {
          nome?: string;
          morada?: string;
          codigoPostal?: string;
          localidade?: string;
          nif?: string;
          emailGeral?: string;
          telefone?: string;
        };
        resolvedEmpresaNome = ed.nome || empresa;
        resolvedEmpresaMorada = ed.morada;
        resolvedEmpresaCodigoPostal = ed.codigoPostal;
      }
    }

    if (!alunoId || !titulo || !isIsoDate(dataInicio)) {
      throw new EstagioAccessError(400, "missing_fields", "Aluno, título e data de início são obrigatórios.");
    }
    if (!Number.isFinite(totalHoras) || totalHoras <= 0) {
      throw new EstagioAccessError(400, "invalid_total_horas", "Total de horas inválido.");
    }
    if (!Number.isFinite(horasDiarias) || horasDiarias <= 0 || horasDiarias > 24) {
      throw new EstagioAccessError(400, "invalid_horas_diarias", "Horas diárias inválidas.");
    }

    const alunoSnap = await db.collection("users").doc(alunoId).get();
    if (!alunoSnap.exists) {
      throw new EstagioAccessError(400, "aluno_not_found", "Aluno não encontrado.");
    }
    const alunoData = alunoSnap.data() as {
      nome?: string;
      email?: string;
      schoolId?: string;
      courseId?: string;
      role?: string;
      estado?: string;
      encarregadoId?: string | null;
    };

    if (alunoData.role !== "aluno") {
      throw new EstagioAccessError(400, "not_aluno", "Utilizador alvo não é aluno.");
    }
    if (alunoData.schoolId !== userData.schoolId) {
      throw new EstagioAccessError(403, "different_school", "O aluno pertence a outra escola.");
    }
    if (!alunoData.courseId) {
      throw new EstagioAccessError(400, "aluno_sem_curso", "O aluno não tem curso associado.");
    }

    // Diretor de Curso check — só o diretor do curso do aluno pode criar o estágio.
    const courseSnap = await db.collection("courses").doc(alunoData.courseId).get();
    if (!courseSnap.exists) {
      throw new EstagioAccessError(400, "course_not_found", "Curso do aluno não encontrado.");
    }
    const courseData = courseSnap.data() as {
      courseDirectorId?: string;
      schoolId?: string;
      nome?: string;
      name?: string;
    };

    if (courseData.courseDirectorId !== uid) {
      throw new EstagioAccessError(403, "not_director", "Apenas o Diretor de Curso pode criar este estágio.");
    }

    let tutorInfo: { id: string; nome: string; email: string; empresa: string } | null = null;
    if (tutorId) {
      const tutorSnap = await db
        .collection("schools")
        .doc(userData.schoolId)
        .collection("tutors")
        .doc(tutorId)
        .get();
      if (tutorSnap.exists) {
        const t = tutorSnap.data() as { nome?: string; email?: string; empresa?: string };
        tutorInfo = {
          id: tutorId,
          nome: t.nome || "",
          email: t.email || "",
          empresa: t.empresa || empresa || "",
        };
      }
    }

    const dateCalc = calcularDataFimEstimada({
      dataInicio,
      totalHoras,
      horasDiarias,
      diasSemana,
    });

    const estagioRef = db.collection("estagios").doc();
    const now = FieldValue.serverTimestamp();

    const estagioData: Record<string, unknown> = {
      titulo,
      schoolId: userData.schoolId,
      professorId: uid,
      professorNome: userData.nome || "",
      alunoId,
      alunoNome: alunoData.nome || "",
      alunoEmail: alunoData.email || "",
      encarregadoId: alunoData.encarregadoId || null,
      alunoCourseId: alunoData.courseId,
      courseId: alunoData.courseId,
      courseNome: courseData.nome || courseData.name || "",
      tutorId: tutorInfo?.id || "",
      tutorNome: tutorInfo?.nome || "",
      tutorEmail: tutorInfo?.email || "",
      tutorEmpresa: tutorInfo?.empresa || resolvedEmpresaNome || "",
      empresa: resolvedEmpresaNome,
      entidadeAcolhimento: resolvedEmpresaNome,
      dataInicio,
      totalHoras,
      horasDiarias,
      diasSemana,
      dataFimEstimada: dateCalc.dataFimEstimada,
      horasRealizadas: 0,
      estadoEstagio: "em_curso",
      estado: "ativo",
      createdAt: now,
      updatedAt: now,
    };

    if (empresaId) estagioData.empresaId = empresaId;
    if (empresaSnapshot) estagioData.empresaSnapshot = empresaSnapshot;
    if (resolvedEmpresaMorada) estagioData.empresaMorada = resolvedEmpresaMorada;
    if (resolvedEmpresaCodigoPostal) estagioData.empresaCodigoPostal = resolvedEmpresaCodigoPostal;

    await estagioRef.set(estagioData);

    // Seed dos 12 templates de documentos.
    const batch = db.batch();
    const docsCol = estagioRef.collection("documentos");
    for (const template of ESTAGIO_TEMPLATES) {
      const docRef = docsCol.doc();
      batch.set(docRef, {
        nome: template.nome,
        descricao: template.descricao,
        categoria: template.categoria,
        templateCode: template.code,
        ordem: template.ordem,
        pinned: false,
        pinnedAt: null,
        estado: "pendente",
        prazoAssinatura: null,
        accessRoles: template.accessRoles,
        accessUserIds: [],
        signatureRoles: template.signatureRoles,
        signatureUserIds: [],
        signatureBoxes: [],
        currentVersion: 0,
        currentFileUrl: "",
        currentFilePath: "",
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
      });
    }
    await batch.commit();

    writeAuditLog({ schoolId: userData.schoolId, entityType: "estagio", entityId: estagioRef.id, entityLabel: titulo, action: "create", changedBy: uid, summary: buildSummary("estagio", "create", titulo), metadata: { alunoId, alunoNome: alunoData.nome } });

    return NextResponse.json({
      ok: true,
      id: estagioRef.id,
      dataFimEstimada: dateCalc.dataFimEstimada,
      diasUteis: dateCalc.diasUteis,
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
