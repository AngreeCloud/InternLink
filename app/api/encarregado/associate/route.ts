import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/firebase-admin";
import { requireSessionUid, EstagioAccessError, toApiErrorResponse } from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

function calculateAge(dataNascimento: string): number {
  const birth = new Date(dataNascimento);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export async function PATCH(request: Request) {
  try {
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();

    const callerSnap = await db.collection("users").doc(uid).get();
    if (!callerSnap.exists) {
      throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
    }
    const callerData = callerSnap.data() as { role?: string };
    if (callerData.role !== "professor") {
      throw new EstagioAccessError(403, "not_professor", "Apenas professores podem associar E.E.");
    }

    const body = (await request.json()) as { studentId?: string; eeUid?: string };
    const { studentId, eeUid } = body;

    if (!studentId || !eeUid) {
      throw new EstagioAccessError(400, "invalid_params", "Dados inválidos.");
    }

    // Validate student
    const studentSnap = await db.collection("users").doc(studentId).get();
    if (!studentSnap.exists) {
      throw new EstagioAccessError(404, "student_not_found", "Aluno não encontrado.");
    }
    const studentData = studentSnap.data() as {
      role?: string;
      dataNascimento?: string;
      encarregadoId?: string;
      schoolId?: string;
    };

    if (studentData.role !== "aluno") {
      throw new EstagioAccessError(400, "not_student", "O utilizador não é aluno.");
    }
    if (!studentData.dataNascimento) {
      throw new EstagioAccessError(400, "missing_dob", "Data de nascimento do aluno não disponível.");
    }
    if (calculateAge(studentData.dataNascimento) >= 18) {
      throw new EstagioAccessError(400, "student_is_adult", "O aluno tem 18+ anos. E.E. não aplicável.");
    }
    if (studentData.encarregadoId) {
      throw new EstagioAccessError(409, "ee_already_exists", "O aluno já tem um E.E. associado.");
    }

    // Validate EE
    const eeSnap = await db.collection("users").doc(eeUid).get();
    if (!eeSnap.exists) {
      throw new EstagioAccessError(404, "ee_not_found", "Encarregado de Educação não encontrado.");
    }
    const eeData = eeSnap.data() as { role?: string; estado?: string; schoolId?: string; educandoIds?: string[] };
    if (eeData.role !== "encarregado" || eeData.estado !== "ativo") {
      throw new EstagioAccessError(400, "not_ee", "O utilizador não é um Encarregado de Educação ativo.");
    }
    if (eeData.schoolId !== studentData.schoolId) {
      throw new EstagioAccessError(400, "different_school", "O E.E. pertence a outra escola.");
    }

    // Link EE to student
    await db.collection("users").doc(studentId).update({ encarregadoId: eeUid });

    // Add student to EE's educandos
    const educandos = Array.isArray(eeData.educandoIds) ? eeData.educandoIds : [];
    if (!educandos.includes(studentId)) {
      educandos.push(studentId);
      await db.collection("users").doc(eeUid).update({ educandoIds: educandos });
    }

    // Sync encarregadoId to all estagios
    const estagiosSnap = await db.collection("estagios").where("alunoId", "==", studentId).get();
    const batch = db.batch();
    for (const docSnap of estagiosSnap.docs) {
      batch.update(docSnap.ref, { encarregadoId: eeUid });
    }
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/encarregado/associate]", error);
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
