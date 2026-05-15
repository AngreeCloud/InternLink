import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { requireSessionUid, EstagioAccessError, toApiErrorResponse } from "@/lib/estagios/estagio-access";

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

    // Only allow eePageAccess updates
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    if (typeof body.eePageAccess === "string") {
      if (!["admin_only", "professors"].includes(body.eePageAccess as string)) {
        throw new EstagioAccessError(400, "invalid_value", "Valor inválido para eePageAccess.");
      }
      updates.eePageAccess = body.eePageAccess;
    }

    await db.collection("schools").doc(schoolId).update(updates);

    return NextResponse.json({ ok: true, eePageAccess: updates.eePageAccess });
  } catch (error) {
    console.error("[api/school-admin/settings]", error);
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
