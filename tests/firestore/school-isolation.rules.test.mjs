/**
 * Instruções de execução deste teste (regras Firestore):
 * 1) Instalar dependências (se ainda não estiverem):
 *    pnpm install
 * 2) Iniciar o emulador do Firestore num terminal separado:
 *    pnpm dlx firebase-tools emulators:start --only firestore,database
 *    (ou: npx firebase emulators:start --only firestore,database)
 * 3) Executar este teste noutro terminal:
 *    pnpm test:rules
 */

import test from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let testEnv;

function getFirestoreEmulatorConfig() {
  const hostFromEnv = process.env.FIRESTORE_EMULATOR_HOST;

  if (hostFromEnv && hostFromEnv.includes(":")) {
    const [host, port] = hostFromEnv.split(":");
    return { host, port: Number(port) };
  }

  return { host: "127.0.0.1", port: 8081 };
}

test.before(async () => {
  const emulator = getFirestoreEmulatorConfig();

  testEnv = await initializeTestEnvironment({
    projectId: "internlink-rules-test",
    firestore: {
      host: emulator.host,
      port: emulator.port,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

test.after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, "users", "profA"), {
      role: "professor",
      estado: "ativo",
      schoolId: "schoolA",
      nome: "Professor A",
      email: "prof-a@school-a.pt",
    });

    await setDoc(doc(db, "users", "profB"), {
      role: "professor",
      estado: "ativo",
      schoolId: "schoolB",
      nome: "Professor B",
      email: "prof-b@school-b.pt",
    });

    await setDoc(doc(db, "users", "profC"), {
      role: "professor",
      estado: "ativo",
      schoolId: "schoolA",
      nome: "Professor C",
      email: "prof-c@school-a.pt",
    });

    await setDoc(doc(db, "users", "adminSchoolA"), {
      role: "admin_escolar",
      estado: "ativo",
      schoolId: "schoolA",
      nome: "Admin Escola A",
      email: "admin-a@school-a.pt",
    });

    await setDoc(doc(db, "users", "adminSchoolB"), {
      role: "admin_escolar",
      estado: "ativo",
      schoolId: "schoolB",
      nome: "Admin Escola B",
      email: "admin-b@school-b.pt",
    });

    await setDoc(doc(db, "users", "profRejected"), {
      role: "professor",
      estado: "recusado",
      schoolId: "schoolA",
      courseId: "courseA",
      curso: "Informática - Sistemas A",
      nome: "Professor Recusado",
      email: "prof-rejected@school-a.pt",
      reviewedAt: 1735689600000,
      reviewedBy: "adminSchoolA",
    });

    await setDoc(doc(db, "users", "profRemoved"), {
      role: "professor",
      estado: "removido",
      schoolId: "schoolA",
      courseId: "courseA",
      curso: "Informática - Sistemas A",
      nome: "Professor Removido",
      email: "prof-removed@school-a.pt",
      reviewedAt: 1735689600000,
      reviewedBy: "adminSchoolA",
    });

    await setDoc(doc(db, "users", "profPendingSelf"), {
      role: "professor",
      estado: "pendente",
      schoolId: "schoolA",
      nome: "Professor Pendente Self",
      email: "prof-pending-self@school-a.pt",
    });

    await setDoc(doc(db, "users", "studentA"), {
      role: "aluno",
      estado: "pendente",
      schoolId: "schoolA",
      courseId: "courseA",
      curso: "Informática - Sistemas A",
      nome: "Aluno A",
      email: "aluno-a@school-a.pt",
    });

    await setDoc(doc(db, "users", "studentRemovedA"), {
      role: "aluno",
      estado: "removido",
      schoolId: "schoolA",
      courseId: "courseA",
      curso: "Informática - Sistemas A",
      nome: "Aluno Removido A",
      email: "aluno-removido-a@school-a.pt",
      reviewedAt: 1735689600000,
      reviewedBy: "profA",
    });

    await setDoc(doc(db, "courses", "courseA"), {
      schoolId: "schoolA",
      name: "Informática - Sistemas A",
      teacherIds: ["profA"],
      supportingTeacherIds: [],
      courseDirectorId: "profA",
    });

    await setDoc(doc(db, "courses", "courseA2"), {
      schoolId: "schoolA",
      name: "Gestão A",
      teacherIds: ["profC"],
      supportingTeacherIds: [],
      courseDirectorId: "profC",
    });

    await setDoc(doc(db, "courses", "courseB"), {
      schoolId: "schoolB",
      name: "Eletrónica B",
      teacherIds: ["profB"],
      supportingTeacherIds: [],
      courseDirectorId: "profB",
    });

    await setDoc(doc(db, "schools", "schoolA", "pendingTeachers", "teacherPendingA"), {
      role: "teacher",
      name: "Professor Pendente A",
      email: "pending-a@school-a.pt",
    });

    await setDoc(doc(db, "pendingRegistrations", "pendingProfSchoolA"), {
      role: "professor",
      estado: "pendente",
      schoolId: "schoolA",
      email: "pending-prof-a@school-a.pt",
      emailVerified: false,
      escola: "Escola A",
    });

    await setDoc(doc(db, "pendingRegistrations", "pendingProfSchoolB"), {
      role: "professor",
      estado: "pendente",
      schoolId: "schoolB",
      email: "pending-prof-b@school-b.pt",
      emailVerified: false,
      escola: "Escola B",
    });

    await setDoc(doc(db, "pendingRegistrations", "profPendingSelf"), {
      role: "professor",
      estado: "pendente",
      schoolId: "schoolA",
      email: "prof-pending-self@school-a.pt",
      emailVerified: false,
      escola: "Escola A",
      updatedAt: 1735689600000,
    });

    await setDoc(doc(db, "chatAccess", "convA"), {
      participants: {
        profA: true,
        studentA: true,
      },
      orgId: "schoolA",
      type: "direct",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
});

test("professor de outra escola não consegue visualizar pedido de aluno pendente", async () => {
  const dbProfessorOutraEscola = testEnv.authenticatedContext("profB").firestore();

  await assertFails(getDoc(doc(dbProfessorOutraEscola, "users", "studentA")));
});

test("professor da mesma escola consegue visualizar aluno pendente da sua escola", async () => {
  const dbProfessorMesmaEscola = testEnv.authenticatedContext("profA").firestore();

  await assertSucceeds(getDoc(doc(dbProfessorMesmaEscola, "users", "studentA")));
});

test("professor de outra escola não consegue aprovar aluno pendente", async () => {
  const dbProfessorOutraEscola = testEnv.authenticatedContext("profB").firestore();

  await assertFails(
    updateDoc(doc(dbProfessorOutraEscola, "users", "studentA"), {
      estado: "ativo",
    })
  );
});

test("professor de outra escola não consegue visualizar pendingTeachers da escola alheia", async () => {
  const dbProfessorOutraEscola = testEnv.authenticatedContext("profB").firestore();

  await assertFails(
    getDoc(doc(dbProfessorOutraEscola, "schools", "schoolA", "pendingTeachers", "teacherPendingA"))
  );
});

test("professor da mesma escola consegue aprovar aluno pendente da sua escola", async () => {
  const dbProfessorMesmaEscola = testEnv.authenticatedContext("profA").firestore();

  await assertSucceeds(
    updateDoc(doc(dbProfessorMesmaEscola, "users", "studentA"), {
      estado: "ativo",
    })
  );
});

test("professor da mesma escola mas sem turma atribuída não consegue aprovar aluno", async () => {
  const dbProfessorSemTurma = testEnv.authenticatedContext("profC").firestore();

  await assertFails(
    updateDoc(doc(dbProfessorSemTurma, "users", "studentA"), {
      estado: "ativo",
    })
  );
});

test("professor da mesma escola consegue atualizar turma do aluno", async () => {
  const dbProfessorMesmaEscola = testEnv.authenticatedContext("profA").firestore();

  await assertSucceeds(
    updateDoc(doc(dbProfessorMesmaEscola, "users", "studentA"), {
      courseId: "courseA",
      curso: "Informática - Sistemas",
    })
  );
});

test("professor da turma não consegue mover aluno para turma que não leciona", async () => {
  const dbProfessorMesmaEscola = testEnv.authenticatedContext("profA").firestore();

  await assertFails(
    updateDoc(doc(dbProfessorMesmaEscola, "users", "studentA"), {
      courseId: "courseA2",
      curso: "Gestão A",
    })
  );
});

test("professor de outra escola não consegue atualizar turma do aluno", async () => {
  const dbProfessorOutraEscola = testEnv.authenticatedContext("profB").firestore();

  await assertFails(
    updateDoc(doc(dbProfessorOutraEscola, "users", "studentA"), {
      courseId: "courseA",
      curso: "Informática - Sistemas",
    })
  );
});

test("participante da conversa consegue ler chatAccess", async () => {
  const dbProfessorMesmaEscola = testEnv.authenticatedContext("profA").firestore();

  await assertSucceeds(getDoc(doc(dbProfessorMesmaEscola, "chatAccess", "convA")));
});

test("não participante da conversa não consegue ler chatAccess", async () => {
  const dbProfessorOutraEscola = testEnv.authenticatedContext("profB").firestore();

  await assertFails(getDoc(doc(dbProfessorOutraEscola, "chatAccess", "convA")));
});

test("participante não consegue alterar participantes de chatAccess", async () => {
  const dbProfessorMesmaEscola = testEnv.authenticatedContext("profA").firestore();

  await assertFails(
    updateDoc(doc(dbProfessorMesmaEscola, "chatAccess", "convA"), {
      participants: {
        profA: true,
        studentA: true,
        profB: true,
      },
    })
  );
});

test("professor recusado/removido consegue re-solicitar acesso mudando schoolId e limpando reviewed*", async () => {
  const dbProfRejected = testEnv.authenticatedContext("profRejected").firestore();
  const dbProfRemoved = testEnv.authenticatedContext("profRemoved").firestore();

  await assertSucceeds(
    updateDoc(doc(dbProfRejected, "users", "profRejected"), {
      estado: "pendente",
      schoolId: "schoolB",
      escola: "Escola B",
      courseId: "courseB",
      curso: "Eletrónica B",
      reviewedAt: null,
      reviewedBy: null,
      updatedAt: 1735776000000,
    })
  );

  await assertSucceeds(
    updateDoc(doc(dbProfRemoved, "users", "profRemoved"), {
      estado: "pendente",
      schoolId: "schoolB",
      escola: "Escola B",
      courseId: "courseB",
      curso: "Eletrónica B",
      reviewedAt: null,
      reviewedBy: null,
      updatedAt: 1735776000000,
    })
  );
});

test("aluno removido consegue re-solicitar acesso com escola e turma", async () => {
  const dbStudentRemoved = testEnv.authenticatedContext("studentRemovedA").firestore();

  await assertSucceeds(
    updateDoc(doc(dbStudentRemoved, "users", "studentRemovedA"), {
      estado: "pendente",
      schoolId: "schoolB",
      escola: "Escola B",
      courseId: "courseB",
      curso: "Eletrónica B",
      reviewedAt: null,
      reviewedBy: null,
      updatedAt: 1735776000000,
    })
  );
});

test("admin escolar só consegue ler pendingRegistrations da sua escola", async () => {
  const dbAdminSchoolA = testEnv.authenticatedContext("adminSchoolA").firestore();

  await assertSucceeds(getDoc(doc(dbAdminSchoolA, "pendingRegistrations", "pendingProfSchoolA")));
  await assertFails(getDoc(doc(dbAdminSchoolA, "pendingRegistrations", "pendingProfSchoolB")));
});

test("professor pendente só pode alterar schoolId/escola/updatedAt em pendingRegistrations", async () => {
  const dbProfPendingSelf = testEnv.authenticatedContext("profPendingSelf").firestore();

  await assertSucceeds(
    updateDoc(doc(dbProfPendingSelf, "pendingRegistrations", "profPendingSelf"), {
      schoolId: "schoolB",
      escola: "Escola B",
      updatedAt: 1735776000000,
    })
  );

  await assertFails(
    updateDoc(doc(dbProfPendingSelf, "pendingRegistrations", "profPendingSelf"), {
      estado: "ativo",
    })
  );
});

test("admin escolar consegue aprovar pendingRegistration de professor da sua escola", async () => {
  const dbAdminSchoolA = testEnv.authenticatedContext("adminSchoolA").firestore();

  await assertSucceeds(
    updateDoc(doc(dbAdminSchoolA, "pendingRegistrations", "pendingProfSchoolA"), {
      estado: "ativo",
      reviewedAt: 1735776000000,
      reviewedBy: "adminSchoolA",
    })
  );
});

test("admin escolar não consegue aprovar pendingRegistration de outra escola", async () => {
  const dbAdminSchoolA = testEnv.authenticatedContext("adminSchoolA").firestore();

  await assertFails(
    updateDoc(doc(dbAdminSchoolA, "pendingRegistrations", "pendingProfSchoolB"), {
      estado: "ativo",
      reviewedAt: 1735776000000,
      reviewedBy: "adminSchoolA",
    })
  );
});

test("admin escolar não consegue alterar campos sensíveis em pendingRegistration", async () => {
  const dbAdminSchoolA = testEnv.authenticatedContext("adminSchoolA").firestore();

  await assertFails(
    updateDoc(doc(dbAdminSchoolA, "pendingRegistrations", "pendingProfSchoolA"), {
      estado: "ativo",
      reviewedAt: 1735776000000,
      reviewedBy: "adminSchoolA",
      schoolId: "schoolB",
    })
  );
});
