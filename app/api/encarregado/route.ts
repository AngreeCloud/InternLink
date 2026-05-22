import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/firebase-admin";
import { requireSessionUid, EstagioAccessError, toApiErrorResponse } from "@/lib/estagios/estagio-access";

export const runtime = "nodejs";

function generateSecurePassword(length = 16): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;

  const arr = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  for (let i = arr.length; i < length; i++) {
    arr.push(all[Math.floor(Math.random() * all.length)]);
  }

  return arr.sort(() => Math.random() - 0.5).join("");
}

function nameToEmailSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "")
    .slice(0, 40);
}

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

// POST /api/encarregado
// Body: { studentId: string; nomeEE: string }
export async function POST(request: Request) {
  try {
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();

    // Verify caller is a professor
    const callerSnap = await db.collection("users").doc(uid).get();
    if (!callerSnap.exists) {
      throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
    }
    const callerData = callerSnap.data() as { role?: string };
    if (callerData.role !== "professor") {
      throw new EstagioAccessError(403, "not_professor", "Apenas professores podem criar contas de E.E.");
    }

    const body = (await request.json()) as { studentId?: string; nomeEE?: string };
    const { studentId, nomeEE } = body;

    if (!studentId || !nomeEE || nomeEE.trim().length < 2) {
      throw new EstagioAccessError(400, "invalid_params", "Dados inválidos.");
    }

    // Validate student
    const studentSnap = await db.collection("users").doc(studentId).get();
    if (!studentSnap.exists) {
      throw new EstagioAccessError(404, "student_not_found", "Aluno não encontrado.");
    }

    const studentData = studentSnap.data() as {
      dataNascimento?: string;
      nome?: string;
      schoolId?: string;
      role?: string;
      encarregadoId?: string;
    };

    if (studentData.role !== "aluno") {
      throw new EstagioAccessError(400, "not_student", "O utilizador não é aluno.");
    }

    if (!studentData.dataNascimento) {
      throw new EstagioAccessError(400, "missing_dob", "Data de nascimento do aluno não disponível.");
    }

    const age = calculateAge(studentData.dataNascimento);
    if (age >= 18) {
      throw new EstagioAccessError(400, "student_is_adult", "O aluno tem 18 anos ou mais. Conta de E.E. não permitida.");
    }

    if (studentData.encarregadoId) {
      throw new EstagioAccessError(409, "ee_already_exists", "O aluno já tem um Encarregado de Educação associado.");
    }

    // Generate email and password
    const slug = nameToEmailSlug(nomeEE.trim());
    const suffix = Math.floor(Math.random() * 9000 + 1000);
    const email = `${slug}${suffix}@internlink.com`;
    const password = generateSecurePassword();

    const auth = getFirebaseAdminAuth();

    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: nomeEE.trim(),
    });

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: "encarregado",
      estado: "ativo",
    });

    // Create Firestore user doc
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      nome: nomeEE.trim(),
      email,
      role: "encarregado",
      estado: "ativo",
      schoolId: studentData.schoolId || "",
      educandoIds: [studentId],
      createdAt: new Date().toISOString(),
    });

    // Link EE to student
    await db.collection("users").doc(studentId).update({
      encarregadoId: userRecord.uid,
    });

    // Sync encarregadoId to all estagios for this student (for rules-based access)
    const estagiosSnap = await db
      .collection("estagios")
      .where("alunoId", "==", studentId)
      .get();
    const estagioBatch = db.batch();
    for (const docSnap of estagiosSnap.docs) {
      estagioBatch.update(docSnap.ref, { encarregadoId: userRecord.uid });
    }
    await estagioBatch.commit();

    return NextResponse.json({
      uid: userRecord.uid,
      nome: nomeEE.trim(),
      email,
      password,
    });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/encarregado?studentId=xxx
export async function DELETE(request: Request) {
  try {
    const { uid } = await requireSessionUid();
    const db = getFirebaseAdminDb();

    // Accept deletion request from either a professor or the student themselves
    const callerSnap = await db.collection("users").doc(uid).get();
    if (!callerSnap.exists) {
      throw new EstagioAccessError(403, "user_not_found", "Utilizador não encontrado.");
    }
    const callerData = callerSnap.data() as { role?: string };
    const role = callerData.role;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    // If the caller is a student, they can only disassociate their own EE
    if (role === "aluno" && studentId !== uid) {
      throw new EstagioAccessError(403, "forbidden", "Sem permissão para esta operação.");
    }

    if (role !== "professor" && role !== "aluno" && role !== "admin_escolar") {
      throw new EstagioAccessError(403, "not_authorized", "Sem permissão para esta operação.");
    }

    const targetStudentId = studentId || uid;

    const studentSnap = await db.collection("users").doc(targetStudentId).get();
    if (!studentSnap.exists) {
      throw new EstagioAccessError(404, "student_not_found", "Aluno não encontrado.");
    }

    const studentData = studentSnap.data() as { encarregadoId?: string; dataNascimento?: string };
    const encarregadoId = studentData.encarregadoId;

    if (!encarregadoId) {
      throw new EstagioAccessError(404, "no_ee", "Nenhum Encarregado de Educação associado.");
    }

    // Apenas alunos com 18+ podem desassociar E.E.
    if (role === "aluno") {
      const birth = new Date(studentData.dataNascimento ?? "");
      let idadeOk = false;
      if (!isNaN(birth.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        idadeOk = age >= 18;
      }
      if (!idadeOk) {
        throw new EstagioAccessError(403, "minor", "Apenas alunos com 18+ anos podem desassociar a conta de E.E.");
      }
    }

    // Unlink from student
    await db.collection("users").doc(targetStudentId).update({
      encarregadoId: null,
    });

    // Remove from EE's educandoIds
    try {
      const eeSnap = await db.collection("users").doc(encarregadoId).get();
      if (eeSnap.exists) {
        const { FieldValue } = await import("firebase-admin/firestore");
        await db.collection("users").doc(encarregadoId).update({
          educandoIds: FieldValue.arrayRemove(targetStudentId)
        });
      }
    } catch { /* ignore */ }

    // Clear encarregadoId from estagios for this student
    const estagiosSnap = await db
      .collection("estagios")
      .where("alunoId", "==", targetStudentId)
      .get();
    const estagioBatch = db.batch();
    for (const docSnap of estagiosSnap.docs) {
      estagioBatch.update(docSnap.ref, { encarregadoId: null });
    }
    await estagioBatch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    const { body, status } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
