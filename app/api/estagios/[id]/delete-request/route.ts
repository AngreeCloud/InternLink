import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { assertEstagioAccess, toApiErrorResponse } from "@/lib/estagios/estagio-access";
import { writeAuditLog } from "@/lib/audit/write";
import { buildSummary } from "@/lib/audit/summaries";

export const runtime = "nodejs";

/** POST — Create a delete request (for non-director professors or directors without permission) */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    // Allow any member of the estagio to create a delete request
    const session = await assertEstagioAccess(id, "member");
    const db = getFirebaseAdminDb();
    const schoolId = session.estagio.schoolId as string;
    const estagioTitulo = (session.estagio.titulo as string) || id;

    const body = (await request.json()) as { motivo?: string };

    const requestRef = db
      .collection("schools")
      .doc(schoolId)
      .collection("deleteEstagioRequests")
      .doc();

    await requestRef.set({
      estagioId: id,
      estagioTitulo,
      alunoId: session.estagio.alunoId || null,
      alunoNome: (session.estagio as Record<string, unknown>).alunoNome || null,
      courseId: session.estagio.courseId || session.estagio.alunoCourseId || null,
      professorId: session.uid,
      professorName: session.displayName || session.email || "Professor",
      motivo: body.motivo || "",
      estado: "pendente",
      createdAt: FieldValue.serverTimestamp(),
    });

    writeAuditLog({
      schoolId,
      entityType: "estagio",
      entityId: id,
      entityLabel: estagioTitulo,
      action: "delete_request",
      changedBy: session.uid,
      summary: buildSummary("estagio", "delete_request", estagioTitulo),
    });

    return NextResponse.json({ ok: true, requestId: requestRef.id });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/** PUT — School-admin approves or rejects a pending delete request */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const estagioId = (await context.params).id;
    const session = await assertEstagioAccess(estagioId, "member");
    const db = getFirebaseAdminDb();

    // Verify the user is a school admin
    const userRole = session.userDoc.role as string | undefined;
    if (userRole !== "admin_escolar") {
      return NextResponse.json(
        { error: "Apenas administradores escolares podem aprovar ou recusar pedidos de eliminação.", code: "not_admin" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { requestId: string; decisao: "aprovado" | "recusado" };
    const { requestId, decisao } = body;

    if (!requestId || !["aprovado", "recusado"].includes(decisao)) {
      return NextResponse.json(
        { error: "Parâmetros inválidos: requestId e decisão (aprovado/recusado) são obrigatórios.", code: "invalid_params" },
        { status: 400 }
      );
    }

    const schoolId = session.estagio.schoolId as string;
    const estagioTitulo = (session.estagio.titulo as string) || estagioId;
    const requestRef = db
      .collection("schools")
      .doc(schoolId)
      .collection("deleteEstagioRequests")
      .doc(requestId);

    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      return NextResponse.json(
        { error: "Pedido de eliminação não encontrado.", code: "request_not_found" },
        { status: 404 }
      );
    }

    const requestData = requestSnap.data() as { estado?: string };
    if (requestData.estado !== "pendente") {
      return NextResponse.json(
        { error: "Este pedido já foi processado.", code: "request_already_processed" },
        { status: 409 }
      );
    }

    if (decisao === "aprovado") {
      // Soft-delete the estagio
      await db.collection("estagios").doc(estagioId).update({
        estado: "eliminado",
        estadoEstagio: "eliminado",
        deletedAt: FieldValue.serverTimestamp(),
        deletedBy: session.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Update request status
    await requestRef.update({
      estado: decisao,
      decidedAt: FieldValue.serverTimestamp(),
      decidedBy: session.uid,
    });

    writeAuditLog({
      schoolId,
      entityType: "estagio",
      entityId: estagioId,
      entityLabel: estagioTitulo,
      action: decisao === "aprovado" ? "delete_approved" : "delete_rejected",
      changedBy: session.uid,
      summary: buildSummary("estagio", decisao === "aprovado" ? "delete_approved" : "delete_rejected", estagioTitulo),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
