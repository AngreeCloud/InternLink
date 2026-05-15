import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { requireSessionUid, EstagioAccessError, toApiErrorResponse } from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();

    const callerSnap = await db.collection("users").doc(uid).get();
    if (!callerSnap.exists) {
      throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
    }
    const callerData = callerSnap.data() as { role?: string; schoolId?: string };

    // Allow school admins AND professors (if school grants access)
    if (callerData.role === "admin_escolar") {
      // always allowed
    } else if (callerData.role === "professor") {
      if (!callerData.schoolId) {
        throw new EstagioAccessError(403, "no_school", "Professor sem escola associada.");
      }
      const schoolSnap = await db.collection("schools").doc(callerData.schoolId).get();
      const schoolData = schoolSnap.data() as { eePageAccess?: string } | undefined;
      if (schoolData?.eePageAccess !== "professors") {
        throw new EstagioAccessError(403, "access_denied", "Acesso à página de E.E. não permitido.");
      }
    } else {
      throw new EstagioAccessError(403, "not_authorized", "Sem permissão para aceder.");
    }

    const schoolId = callerData.schoolId;
    if (!schoolId) {
      throw new EstagioAccessError(400, "no_school", "Sem escola associada.");
    }

    // Fetch all EEs in the school
    const eeSnap = await db
      .collection("users")
      .where("schoolId", "==", schoolId)
      .where("role", "==", "encarregado")
      .get();

    // Fetch all students for educando name resolution
    const studentsSnap = await db
      .collection("users")
      .where("schoolId", "==", schoolId)
      .where("role", "==", "aluno")
      .get();

    const studentNames = new Map<string, string>();
    for (const doc of studentsSnap.docs) {
      const data = doc.data() as { nome?: string };
      studentNames.set(doc.id, data.nome || "Aluno");
    }

    const ees = eeSnap.docs.map((doc) => {
      const data = doc.data() as {
        nome?: string;
        email?: string;
        estado?: string;
        educandoIds?: string[];
        createdAt?: unknown;
      };
      const educandoIds = Array.isArray(data.educandoIds) ? data.educandoIds : [];
      return {
        uid: doc.id,
        nome: data.nome || "—",
        email: data.email || "—",
        estado: data.estado || "ativo",
        educandos: educandoIds.map((eid) => ({
          id: eid,
          nome: studentNames.get(eid) || eid,
        })),
        educandosCount: educandoIds.length,
        createdAt: data.createdAt ?? null,
      };
    });

    ees.sort((a, b) => a.nome.localeCompare(b.nome, "pt-PT"));

    return NextResponse.json({ ok: true, ees });
  } catch (error) {
    console.error("[api/school-admin/encarregados]", error);
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
