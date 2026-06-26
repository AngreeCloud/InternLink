/**
 * Testes para regra isCourseDirectorOfEstagio — diretor de curso deve
 * conseguir ler estágios de todos os professores da sua turma.
 *
 * Execução:
 *   pnpm test:rules
 * (Requer emulador firestore a correr)
 */

import assert from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";

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
  if (testEnv) await testEnv.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // School
    await setDoc(doc(db, "schools", "schoolA"), {
      name: "Escola A",
      shortName: "EA",
    });

    // Course — professor A is director
    await setDoc(doc(db, "courses", "course1"), {
      schoolId: "schoolA",
      name: "Curso 1",
      courseDirectorId: "profDir",
    });

    // Course 2 — no director set
    await setDoc(doc(db, "courses", "course2"), {
      schoolId: "schoolA",
      name: "Curso 2",
    });

    // Users
    await setDoc(doc(db, "users", "profDir"), {
      role: "professor",
      estado: "ativo",
      schoolId: "schoolA",
      nome: "Professor Diretor",
      email: "dir@a.pt",
    });

    await setDoc(doc(db, "users", "profNormal"), {
      role: "professor",
      estado: "ativo",
      schoolId: "schoolA",
      nome: "Professor Normal",
      email: "normal@a.pt",
    });

    await setDoc(doc(db, "users", "aluno1"), {
      role: "aluno",
      estado: "ativo",
      schoolId: "schoolA",
      nome: "Aluno 1",
      email: "aluno1@a.pt",
    });

    await setDoc(doc(db, "users", "tutor1"), {
      role: "tutor",
      estado: "ativo",
      nome: "Tutor 1",
      email: "tutor1@x.pt",
    });

    // Internships
    // Estágio no curso do diretor, atribuído a outro professor
    await setDoc(doc(db, "estagios", "est1"), {
      schoolId: "schoolA",
      alunoId: "aluno1",
      professorId: "profNormal",
      tutorId: "tutor1",
      alunoCourseId: "course1",
      titulo: "Estágio curso do diretor",
      estado: "ativo",
    });

    // Estágio no curso do diretor, atribuído ao próprio diretor
    await setDoc(doc(db, "estagios", "est2"), {
      schoolId: "schoolA",
      alunoId: "aluno1",
      professorId: "profDir",
      tutorId: "tutor1",
      alunoCourseId: "course1",
      titulo: "Estágio do diretor",
      estado: "ativo",
    });

    // Estágio noutro curso (sem diretor), atribuído ao profNormal
    await setDoc(doc(db, "estagios", "est3"), {
      schoolId: "schoolA",
      alunoId: "aluno1",
      professorId: "profNormal",
      tutorId: "tutor1",
      alunoCourseId: "course2",
      titulo: "Estágio curso sem diretor",
      estado: "ativo",
    });
  });
});

// ── Director can read internships from their course (even other professor's) ──

test("diretor de curso lê estágio da sua turma atribuído a outro professor", async () => {
  const context = testEnv.authenticatedContext("profDir");
  const db = context.firestore();
  await assertSucceeds(getDoc(doc(db, "estagios", "est1")));
});

test("diretor de curso lê estágio da sua turma atribuído a si próprio", async () => {
  const context = testEnv.authenticatedContext("profDir");
  const db = context.firestore();
  await assertSucceeds(getDoc(doc(db, "estagios", "est2")));
});

test("diretor de curso NÃO lê estágio de curso que não dirige (não é professor atribuído)", async () => {
  const context = testEnv.authenticatedContext("profDir");
  const db = context.firestore();
  await assertFails(getDoc(doc(db, "estagios", "est3")));
});

// ── Professor normal can only read own internships ──

test("professor normal lê os seus próprios estágios", async () => {
  const context = testEnv.authenticatedContext("profNormal");
  const db = context.firestore();
  await assertSucceeds(getDoc(doc(db, "estagios", "est1")));
});

test("professor normal NÃO lê estágio de outro professor se não for diretor", async () => {
  const context = testEnv.authenticatedContext("profNormal");
  const db = context.firestore();
  // est2 pertence a profDir, e profNormal não é diretor de course1
  await assertFails(getDoc(doc(db, "estagios", "est2")));
});

// ── Aluno/tutor still restricted ──

test("aluno só lê o seu próprio estágio", async () => {
  const context = testEnv.authenticatedContext("aluno1");
  const db = context.firestore();
  await assertSucceeds(getDoc(doc(db, "estagios", "est1")));
  // est2 tem o mesmo aluno, por isso também consegue
  await assertSucceeds(getDoc(doc(db, "estagios", "est2")));
});

test("tutor só lê estágios onde está atribuído", async () => {
  const context = testEnv.authenticatedContext("tutor1");
  const db = context.firestore();
  await assertSucceeds(getDoc(doc(db, "estagios", "est1")));
});

// ── Query-level: director can list all internships in their course ──

test("diretor de curso consegue fazer query por courseId da sua turma", async () => {
  const context = testEnv.authenticatedContext("profDir");
  const db = context.firestore();
  const q = query(
    collection(db, "estagios"),
    where("alunoCourseId", "==", "course1"),
    where("schoolId", "==", "schoolA")
  );
  await assertSucceeds(getDocs(q));
});

test("professor normal NÃO consegue fazer query por courseId da turma que não dirige", async () => {
  const context = testEnv.authenticatedContext("profNormal");
  const db = context.firestore();
  const q = query(
    collection(db, "estagios"),
    where("alunoCourseId", "==", "course1"),
    where("schoolId", "==", "schoolA")
  );
  // profNormal não é diretor de course1, e a query inclui est2 (de outro prof)
  await assertFails(getDocs(q));
});
