import test from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { get, ref, set } from "firebase/database";

let testEnv;

function getDatabaseEmulatorConfig() {
  const hostFromEnv = process.env.FIREBASE_DATABASE_EMULATOR_HOST;

  if (hostFromEnv && hostFromEnv.includes(":")) {
    const [host, port] = hostFromEnv.split(":");
    return { host, port: Number(port) };
  }

  return { host: "127.0.0.1", port: 9001 };
}

test.before(async () => {
  const emulator = getDatabaseEmulatorConfig();

  testEnv = await initializeTestEnvironment({
    projectId: "internlink-rules-test",
    database: {
      host: emulator.host,
      port: emulator.port,
      rules: readFileSync("database.rules.json", "utf8"),
    },
  });
});

test.after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

test.beforeEach(async () => {
  await testEnv.clearDatabase();
});

test("estudante consegue escrever relacao userTutors para o seu tutor", async () => {
  const db = testEnv.authenticatedContext("studentA").database();

  await assertSucceeds(
    set(ref(db, "userTutors/studentA/tutorX"), true)
  );
});

test("tutor consegue ler a relacao userTutors", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), "userTutors/studentA/tutorX"), true);
  });

  const db = testEnv.authenticatedContext("tutorX").database();
  const snap = await get(ref(db, "userTutors/studentA/tutorX"));
  if (!snap.exists() || snap.val() !== true) {
    throw new Error("Tutor nao consegue ler relacao");
  }
});

test("intruso nao consegue escrever userTutors alheia", async () => {
  const db = testEnv.authenticatedContext("intruder").database();

  await assertFails(
    set(ref(db, "userTutors/studentA/tutorX"), true)
  );
});

test("tutor consegue escrever auto-relacao", async () => {
  const db = testEnv.authenticatedContext("tutorX").database();

  await assertSucceeds(
    set(ref(db, "userTutors/studentA/tutorX"), true)
  );
});

test("apenas valor true permitido em userTutors", async () => {
  const db = testEnv.authenticatedContext("studentA").database();

  await assertFails(
    set(ref(db, "userTutors/studentA/tutorX"), "maybe")
  );

  await assertSucceeds(
    set(ref(db, "userTutors/studentA/tutorX"), true)
  );
});

test("aluno consegue remover relacao userTutors com null", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), "userTutors/studentA/tutorX"), true);
  });

  const db = testEnv.authenticatedContext("studentA").database();

  await assertSucceeds(
    set(ref(db, "userTutors/studentA/tutorX"), null)
  );
});
