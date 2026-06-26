import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, EstagioAccessError, toApiErrorResponse } from "@/lib/estagios/estagio-access";
import {
  calcularDataFimEstimada,
  recalcularDataFimEstimada,
  DEFAULT_DIAS_SEMANA,
  type DiasSemana,
} from "@/lib/estagios/date-calc";
import { writeAuditLog } from "@/lib/audit/write";
import { buildSummary } from "@/lib/audit/summaries";

export const runtime = "nodejs";

type PatchBody = {
  titulo?: string;
  empresa?: string;
  empresaId?: string | null;
  entidadeAcolhimento?: string;
  tutorId?: string;
  dataInicio?: string;
  totalHoras?: number;
  horasDiarias?: number;
  diasSemana?: Partial<DiasSemana>;
  estadoEstagio?: "em_curso" | "concluido" | "suspenso" | "arquivado" | "eliminado";
  horasRealizadas?: number;
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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await assertEstagioAccess(id, "director");
    const db = getFirebaseAdminDb();
    const estagioTitulo = (session.estagio.titulo as string) || id;
    const schoolId = session.estagio.schoolId as string;

    // Check if director has delete permission
    const directorCanDelete = session.course?.directorCanDeleteEstagio === true;
    if (!directorCanDelete) {
      return NextResponse.json(
        { error: "O diretor do curso não tem permissão para eliminar estágios autonomamente. Solicite a eliminação ao administrador da escola.", code: "director_cannot_delete" },
        { status: 403 }
      );
    }

    // Soft-delete: set estado to eliminado
    await db.collection("estagios").doc(id).update({
      estado: "eliminado",
      estadoEstagio: "eliminado",
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: session.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeAuditLog({ schoolId, entityType: "estagio", entityId: id, entityLabel: estagioTitulo, action: "delete", changedBy: session.uid, summary: buildSummary("estagio", "delete", estagioTitulo) });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await assertEstagioAccess(id, "director");
    const body = (await request.json()) as PatchBody;
    const db = getFirebaseAdminDb();

    // Block edits on archived/eliminated internships (except archiving/eliminating itself)
    const currentEstado =
      (session.estagio.estado as string) ||
      (session.estagio.estadoEstagio as string) ||
      "ativo";
    if (
      (currentEstado === "arquivado" || currentEstado === "eliminado") &&
      body.estadoEstagio !== "arquivado" &&
      body.estadoEstagio !== "eliminado"
    ) {
      throw new EstagioAccessError(
        403,
        "archived_or_deleted",
        "Não é possível editar um estágio arquivado ou eliminado."
      );
    }

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (typeof body.titulo === "string" && body.titulo.trim().length > 0) {
      updates.titulo = body.titulo.trim();
    }
    if (typeof body.empresa === "string") {
      updates.empresa = body.empresa.trim();
      updates.entidadeAcolhimento = body.entidadeAcolhimento ?? body.empresa.trim();
    }
    if (typeof body.entidadeAcolhimento === "string") {
      updates.entidadeAcolhimento = body.entidadeAcolhimento.trim();
    }
    if (typeof body.tutorId === "string") {
      updates.tutorId = body.tutorId.trim();
    }
    if (
      body.estadoEstagio &&
      ["em_curso", "concluido", "suspenso", "arquivado", "eliminado"].includes(body.estadoEstagio)
    ) {
      updates.estadoEstagio = body.estadoEstagio;
      updates.estado = body.estadoEstagio === "concluido" ? "concluido" : body.estadoEstagio === "arquivado" ? "arquivado" : body.estadoEstagio === "eliminado" ? "eliminado" : "ativo";
      if (body.estadoEstagio === "eliminado") {
        updates.deletedAt = FieldValue.serverTimestamp();
        updates.deletedBy = session.uid;
      }
    }
    if (typeof body.horasRealizadas === "number" && body.horasRealizadas >= 0) {
      updates.horasRealizadas = body.horasRealizadas;
    }

    const hasScheduleChanges =
      typeof body.dataInicio === "string" ||
      typeof body.totalHoras === "number" ||
      typeof body.horasDiarias === "number" ||
      body.diasSemana;

    if (hasScheduleChanges) {
      const existing = session.estagio as typeof session.estagio & {
        dataInicio?: string;
        totalHoras?: number;
        horasDiarias?: number;
        horasRealizadas?: number;
        diasSemana?: Partial<DiasSemana>;
      };
      const dataInicio = body.dataInicio ?? existing.dataInicio ?? "";
      const totalHoras = Number(body.totalHoras ?? existing.totalHoras ?? 0);
      const horasDiarias = Number(body.horasDiarias ?? existing.horasDiarias ?? 0);
      const diasSemana = normalizeDiasSemana(body.diasSemana ?? existing.diasSemana);
      const horasRealizadas = Number(existing.horasRealizadas ?? 0);

      if (dataInicio && totalHoras > 0 && horasDiarias > 0) {
        const dateCalc = horasRealizadas > 0
          ? recalcularDataFimEstimada({
              totalHoras,
              horasRealizadas,
              horasDiarias,
              diasSemana,
            })
          : calcularDataFimEstimada({
              dataInicio,
              totalHoras,
              horasDiarias,
              diasSemana,
            });
        updates.dataInicio = dataInicio;
        updates.totalHoras = totalHoras;
        updates.horasDiarias = horasDiarias;
        updates.diasSemana = diasSemana;
        updates.dataFimEstimada = dateCalc.dataFimEstimada;
      }
    }

    if (body.empresaId !== undefined) {
      const currentEmpresaId = (session.estagio as Record<string, unknown>).empresaId as string | undefined;
      const newEmpresaId = body.empresaId === null ? null : body.empresaId.trim();

      if (newEmpresaId !== currentEmpresaId) {
        if (newEmpresaId) {
          const empresaSnap = await db.collection("empresas").doc(newEmpresaId).get();
          if (!empresaSnap.exists) {
            return NextResponse.json(
              { error: "Empresa não encontrada", code: "empresa_not_found" },
              { status: 404 }
            );
          }

          const empresaData = empresaSnap.data()!;
          if (empresaData.schoolId !== session.estagio.schoolId) {
            return NextResponse.json(
              { error: "Empresa não pertence à mesma escola do estágio", code: "empresa_wrong_school" },
              { status: 403 }
            );
          }

          updates.empresaId = newEmpresaId;
          updates.empresaSnapshot = {
            nome: empresaData.nome || "",
            morada: empresaData.morada || null,
            codigoPostal: empresaData.codigoPostal || null,
            localidade: empresaData.localidade || null,
            nif: empresaData.nif || null,
            emailGeral: empresaData.emailGeral || null,
            telefone: empresaData.telefone || null,
          };
          updates.empresa = empresaData.nome || "";
          updates.entidadeAcolhimento = empresaData.nome || "";
          updates.empresaMorada = empresaData.morada || null;
          updates.empresaCodigoPostal = empresaData.codigoPostal || null;
        } else {
          updates.empresaId = null;
        }
      }
    }

    await db.collection("estagios").doc(id).update(updates);

    const schoolId = session.estagio.schoolId as string;
    const estTitulo = (session.estagio.titulo as string) || id;
    const isStatusChange = body.estadoEstagio !== undefined;
    const action = isStatusChange ? "status_change" : "update";

    writeAuditLog({ schoolId, entityType: "estagio", entityId: id, entityLabel: estTitulo, action, changedBy: session.uid, summary: buildSummary("estagio", action, estTitulo), metadata: isStatusChange ? { from: session.estagio.estadoEstagio as string, to: body.estadoEstagio } : undefined });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
