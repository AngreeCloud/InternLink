/**
 * Instrucoes de execucao deste teste (regras Realtime Database):
 * 1) Instalar dependencias (se ainda nao estiverem):
 *    pnpm install
 * 2) Iniciar o emulador do Realtime Database num terminal separado:
 *    pnpm dlx firebase-tools emulators:start --only firestore,database
 * 3) Executar este teste noutro terminal:
 *    pnpm test:rules
 */

import test from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { get, ref, set, update } from "firebase/database";

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

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.database();
    const now = Date.now();

    await set(ref(db, "conversations/convExisting"), {
      type: "direct",
      orgId: "schoolA",
      participants: {
        studentA: true,
        profA: true,
      },
      lastMessage: {
        text: null,
        senderId: "studentA",
        createdAt: now,
        hasAttachments: false,
      },
      createdAt: now,
      updatedAt: now,
    });

    await set(ref(db, "userConversations/studentA/convExisting"), {
      lastMessageText: null,
      lastMessageAt: now,
      unreadCount: 0,
      isMuted: false,
    });

    await set(ref(db, "userConversations/profA/convExisting"), {
      lastMessageText: null,
      lastMessageAt: now,
      unreadCount: 0,
      isMuted: false,
    });

    await set(ref(db, "messages/convExisting"), {});
  });
});

test("participante consegue criar conversa e userConversations em update atomico", async () => {
  const db = testEnv.authenticatedContext("studentA").database();
  const now = Date.now();

  const updates = {
    "conversations/convAtomic": {
      type: "direct",
      orgId: "schoolA",
      participants: {
        studentA: true,
        profA: true,
      },
      lastMessage: {
        text: null,
        senderId: "studentA",
        createdAt: now,
        hasAttachments: false,
      },
      createdAt: now,
      updatedAt: now,
    },
    "userConversations/studentA/convAtomic": {
      lastMessageText: null,
      lastMessageAt: now,
      unreadCount: 0,
      isMuted: false,
    },
    "userConversations/profA/convAtomic": {
      lastMessageText: null,
      lastMessageAt: now,
      unreadCount: 0,
      isMuted: false,
    },
  };

  await assertSucceeds(update(ref(db), updates));
  await assertSucceeds(get(ref(db, "conversations/convAtomic")));
});

test("utilizador nao participante nao consegue escrever userConversations sem conversa valida", async () => {
  const db = testEnv.authenticatedContext("intruder").database();
  const now = Date.now();

  await assertFails(
    set(ref(db, "userConversations/intruder/convNope"), {
      lastMessageText: null,
      lastMessageAt: now,
      unreadCount: 0,
      isMuted: false,
    })
  );
});

test("participante consegue atualizar metadata de userConversations em conversa existente", async () => {
  const db = testEnv.authenticatedContext("studentA").database();
  const now = Date.now();

  await assertSucceeds(
    set(ref(db, "userConversations/studentA/convExisting"), {
      lastMessageText: "Ola",
      lastMessageAt: now,
      unreadCount: 0,
      isMuted: false,
    })
  );
});

test("participante consegue enviar mensagem sem anexos", async () => {
  const db = testEnv.authenticatedContext("studentA").database();
  const now = Date.now();

  await assertSucceeds(
    set(ref(db, "messages/convExisting/msgNoAttachments"), {
      senderId: "studentA",
      text: "Ola sem anexos",
      createdAt: now,
      editedAt: null,
      deleted: false,
      seenBy: {
        studentA: now,
      },
    })
  );
});

test("participante consegue enviar mensagem com anexos validos", async () => {
  const db = testEnv.authenticatedContext("studentA").database();
  const now = Date.now();

  await assertSucceeds(
    set(ref(db, "messages/convExisting/msgWithAttachment"), {
      senderId: "studentA",
      text: "Ola com anexo",
      attachments: {
        att1: {
          url: "https://example.com/file.pdf",
          storagePath: "chat-attachments/convExisting/msgWithAttachment/att1/file.pdf",
          size: 1024,
          mimeType: "application/pdf",
          fileName: "file.pdf",
        },
      },
      createdAt: now,
      editedAt: null,
      deleted: false,
      seenBy: {
        studentA: now,
      },
    })
  );
});
