import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { requireSessionUid, EstagioAccessError, toApiErrorResponse } from "@/lib/estagios/estagio-access";
import { writeAuditLog } from "@/lib/audit/write";
import { validateConfig } from "@/lib/avaliacao/validations";
import type { AvaliacaoConfig } from "@/lib/avaliacao/types";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();

    const callerSnap = await db.collection("users").doc(uid).get();
    if (!callerSnap.exists) {
      throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
    }
    const callerData = callerSnap.data() as { role?: string; schoolId?: string };
    if (callerData.role !== "admin_escolar" || !callerData.schoolId) {
      throw new EstagioAccessError(403, "not_admin", "Apenas o Administrador Escolar pode alterar definições.");
    }

    const schoolId = callerData.schoolId;
    const body = (await request.json()) as Record<string, unknown>;

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    const updatedFields: string[] = [];

    if (typeof body.eePageAccess === "string") {
      if (!["admin_only", "professors"].includes(body.eePageAccess as string)) {
        throw new EstagioAccessError(400, "invalid_value", "Valor inválido para eePageAccess.");
      }
      updates.eePageAccess = body.eePageAccess;
      updatedFields.push("eePageAccess");
    }

    if (body.avaliacaoConfig !== undefined) {
      const config = body.avaliacaoConfig as AvaliacaoConfig;
      const validation = validateConfig(config);
      if (!validation.valid) {
        throw new EstagioAccessError(400, "invalid_avaliacao_config", validation.error ?? "Configuração de avaliação inválida.");
      }
      updates.avaliacaoConfig = config;
      updatedFields.push("avaliacaoConfig");
    }

    await db.collection("schools").doc(schoolId).update(updates);

    writeAuditLog({
      schoolId,
      entityType: "school",
      entityId: schoolId,
      entityLabel: schoolId,
      action: "update_settings",
      changedBy: uid,
      summary: "Definições da escola atualizadas.",
      metadata: { updates: updatedFields },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/school-admin/settings]", error);
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
