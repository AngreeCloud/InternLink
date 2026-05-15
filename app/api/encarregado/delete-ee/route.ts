import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { requireSessionUid, EstagioAccessError, toApiErrorResponse } from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();

    const callerSnap = await db.collection("users").doc(uid).get();
    if (!callerSnap.exists) {
      throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
    }
    const callerData = callerSnap.data() as { role?: string; schoolId?: string };
    if (callerData.role !== "admin_escolar" || !callerData.schoolId) {
      throw new EstagioAccessError(403, "not_admin", "Apenas o Administrador Escolar pode eliminar E.E.");
    }

    const body = (await request.json()) as { eeUid?: string };
    const { eeUid } = body;
    if (!eeUid) {
      throw new EstagioAccessError(400, "invalid_params", "Falta eeUid.");
    }

    // Verify EE belongs to the same school
    const eeSnap = await db.collection("users").doc(eeUid).get();
    if (!eeSnap.exists) {
      throw new EstagioAccessError(404, "ee_not_found", "E.E. não encontrado.");
    }
    const eeData = eeSnap.data() as {
      role?: string;
      schoolId?: string;
      educandoIds?: string[];
    };
    if (eeData.role !== "encarregado") {
      throw new EstagioAccessError(400, "not_ee", "Não é um Encarregado de Educação.");
    }
    if (eeData.schoolId !== callerData.schoolId) {
      throw new EstagioAccessError(403, "different_school", "EE pertence a outra escola.");
    }

    // Unlink from all students
    const educandoIds = Array.isArray(eeData.educandoIds) ? eeData.educandoIds : [];
    const batch = db.batch();
    for (const studentId of educandoIds) {
      batch.update(db.collection("users").doc(studentId), { encarregadoId: null });
      // Also clear from estagios
      const estagiosSnap = await db.collection("estagios").where("alunoId", "==", studentId).get();
      for (const d of estagiosSnap.docs) {
        batch.update(d.ref, { encarregadoId: null });
      }
    }

    // Delete Firestore doc
    batch.delete(db.collection("users").doc(eeUid));
    await batch.commit();

    // Delete Auth user
    const auth = getFirebaseAdminAuth();
    try {
      await auth.deleteUser(eeUid);
    } catch { /* ignore if already deleted */ }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/encarregado/delete-ee]", error);
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
