/**
 * Testes para regras Firestore de acesso a tutores e tutorInvites.
 *
 * Execução:
 *   pnpm test:rules
 * (Requer emulador firestore a correr)
 */

import assert from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

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

    // Active professor (schoolA)
    await setDoc(doc(db, "users", "profAtivo"), {
      role: "professor",
      estado: "ativo",
      schoolId: "schoolA",
      nome: "Professor Ativo",
      email: "ativo@a.pt",
    });

    // Pending professor (schoolA) — the key test case
    await setDoc(doc(db, "users", "profPendente"), {
      role: "professor",
      estado: "pendente",
      schoolId: "schoolA",
      nome: "Professor Pendente",
      email: "pendente@a.pt",
    });

    // Professor from another school
    await setDoc(doc(db, "users", "profOutra"), {
      role: "professor",
      estado: "ativo",
      schoolId: "schoolB",
      nome: "Professor Outra Escola",
      email: "outra@b.pt",
    });

    // School admin
    await setDoc(doc(db, "users", "adminA"), {
      role: "admin_escolar",
      estado: "ativo",
      schoolId: "schoolA",
      nome: "Admin A",
      email: "admin@a.pt",
    });

    // Tutor
    await setDoc(doc(db, "users", "tutorX"), {
      role: "tutor",
      estado: "ativo",
      schoolId: "schoolA",
      nome: "Tutor X",
      email: "tutor@empresa.pt",
    });

    // School tutors subcollection
    await setDoc(doc(db, "schools", "schoolA", "tutors", "tutorX"), {
      nome: "Tutor X",
      email: "tutor@empresa.pt",
      empresa: "Empresa X",
      schoolId: "schoolA",
      tutorId: "tutorX",
      role: "tutor",
    });

    await setDoc(doc(db, "schools", "schoolB", "tutors", "tutorY"), {
      nome: "Tutor Y",
      email: "tutor-y@empresa.pt",
      empresa: "Empresa Y",
      schoolId: "schoolB",
      tutorId: "tutorY",
      role: "tutor",
    });

    // Tutor invites
    await setDoc(doc(db, "tutorInvites", "inviteA"), {
      email: "convite@empresa.pt",
      nome: "Convite A",
      schoolId: "schoolA",
      professorId: "profAtivo",
      professorName: "Professor Ativo",
      estado: "pendente",
    });

    await setDoc(doc(db, "tutorInvites", "inviteB"), {
      email: "convite-b@empresa.pt",
      nome: "Convite B",
      schoolId: "schoolB",
      professorId: "profOutra",
      professorName: "Professor Outra",
      estado: "pendente",
    });
  });
});

// ── Tests: school tutors subcollection ──

test("active professor CAN read tutors from own school", async () => {
  const db = testEnv.authenticatedContext("profAtivo", {}).firestore();
  await assertSucceeds(getDoc(doc(db, "schools", "schoolA", "tutors", "tutorX")));
});

test("active professor CAN list all tutors from own school", async () => {
  const db = testEnv.authenticatedContext("profAtivo", {}).firestore();
  await assertSucceeds(getDocs(collection(db, "schools", "schoolA", "tutors")));
});

test("pending professor CAN read tutors from own school", async () => {
  const db = testEnv.authenticatedContext("profPendente", {}).firestore();
  await assertSucceeds(getDoc(doc(db, "schools", "schoolA", "tutors", "tutorX")));
});

test("pending professor CAN list all tutors from own school", async () => {
  const db = testEnv.authenticatedContext("profPendente", {}).firestore();
  await assertSucceeds(getDocs(collection(db, "schools", "schoolA", "tutors")));
});

test("professor from another school CANNOT read tutors from schoolA", async () => {
  const db = testEnv.authenticatedContext("profOutra", {}).firestore();
  await assertFails(getDoc(doc(db, "schools", "schoolA", "tutors", "tutorX")));
});

test("unauthenticated user CANNOT read tutors", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "schools", "schoolA", "tutors", "tutorX")));
});

// ── Tests: tutorInvites ──

test("active professor CAN read tutorInvites from own school", async () => {
  const db = testEnv.authenticatedContext("profAtivo", {}).firestore();
  await assertSucceeds(getDoc(doc(db, "tutorInvites", "inviteA")));
});

test("active professor CAN list tutorInvites from own school", async () => {
  const db = testEnv.authenticatedContext("profAtivo", {}).firestore();
  const q = collection(db, "tutorInvites");
  await assertSucceeds(getDocs(q));
});

test("pending professor CAN read tutorInvites from own school", async () => {
  const db = testEnv.authenticatedContext("profPendente", {}).firestore();
  await assertSucceeds(getDoc(doc(db, "tutorInvites", "inviteA")));
});

test("pending professor CAN list tutorInvites from own school", async () => {
  const db = testEnv.authenticatedContext("profPendente", {}).firestore();
  const q = collection(db, "tutorInvites");
  await assertSucceeds(getDocs(q));
});

test("professor from another school CANNOT read tutorInvites from schoolA", async () => {
  const db = testEnv.authenticatedContext("profOutra", {}).firestore();
  await assertFails(getDoc(doc(db, "tutorInvites", "inviteA")));
});

test("unauthenticated user CANNOT read tutorInvites", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "tutorInvites", "inviteA")));
});

// ── Sanity: existing tests still pass ──

test("admin CAN read tutors from own school", async () => {
  const db = testEnv.authenticatedContext("adminA", {}).firestore();
  await assertSucceeds(getDoc(doc(db, "schools", "schoolA", "tutors", "tutorX")));
});

test("tutor CAN read own tutor doc by matching tutorId", async () => {
  const db = testEnv.authenticatedContext("tutorX", {}).firestore();
  await assertSucceeds(getDoc(doc(db, "schools", "schoolA", "tutors", "tutorX")));
});
