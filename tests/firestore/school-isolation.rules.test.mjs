/**
 * Instruções de execução deste teste (regras Firestore):
 * 1) Instalar dependências (se ainda não estiverem):
 *    pnpm install
 * 2) Iniciar o emulador do Firestore num terminal separado:
 *    pnpm dlx firebase-tools emulators:start --only firestore
 *    (ou: npx firebase emulators:start --only firestore)
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

  return { host: "127.0.0.1", port: 8080 };
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

    await setDoc(doc(db, "users", "studentA"), {
      role: "aluno",
      estado: "pendente",
      schoolId: "schoolA",
      nome: "Aluno A",
      email: "aluno-a@school-a.pt",
    });

    await setDoc(doc(db, "schools", "schoolA", "pendingTeachers", "teacherPendingA"), {
      role: "teacher",
      name: "Professor Pendente A",
      email: "pending-a@school-a.pt",
    });
  });
});

test("professor de outra escola não consegue visualizar pedido de aluno pendente", async () => {
  const dbProfessorOutraEscola = testEnv.authenticatedContext("profB").firestore();

  await assertFails(getDoc(doc(dbProfessorOutraEscola, "users", "studentA")));
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
