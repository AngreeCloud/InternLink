// Run (dry-run): pnpm migrate:chat-delete:check
// Run (apply changes): pnpm migrate:chat-delete:apply
require("dotenv").config({ path: ".env.local" });
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function buildCredential() {
  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const resolved = path.resolve(serviceAccountPath);
    return admin.credential.cert(require(resolved));
  }

  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }

  return admin.credential.applicationDefault();
}

function buildDatabaseUrl() {
  if (process.env.FIREBASE_DATABASE_URL) return process.env.FIREBASE_DATABASE_URL;
  if (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) return process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  throw new Error("Defina FIREBASE_DATABASE_URL ou NEXT_PUBLIC_FIREBASE_DATABASE_URL para executar esta migracao.");
}

async function ensureInitialized() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: buildCredential(),
      databaseURL: buildDatabaseUrl(),
    });
  }
}

async function migrateChatDeleteState({ applyChanges }) {
  const db = admin.database();
  const messagesSnap = await db.ref("messages").get();

  if (!messagesSnap.exists()) {
    console.log("Nao existem mensagens para migrar.");
    return;
  }

  const conversations = messagesSnap.val() || {};
  const updates = {};
  let conversationsCount = 0;
  let messagesCount = 0;
  let missingDeletedCount = 0;
  let missingDeletedAtCount = 0;

  for (const [conversationId, conversationMessages] of Object.entries(conversations)) {
    if (!conversationMessages || typeof conversationMessages !== "object") continue;
    conversationsCount += 1;

    for (const [messageId, message] of Object.entries(conversationMessages)) {
      if (!message || typeof message !== "object") continue;
      messagesCount += 1;

      const messagePath = `messages/${conversationId}/${messageId}`;
      const hasDeletedFlag = typeof message.deleted === "boolean";
      if (!hasDeletedFlag) {
        updates[`${messagePath}/deleted`] = false;
        missingDeletedCount += 1;
      }

      const isDeleted = hasDeletedFlag ? message.deleted === true : false;
      const hasDeletedAt = typeof message.deletedAt === "number";
      if (isDeleted && !hasDeletedAt) {
        updates[`${messagePath}/deletedAt`] =
          typeof message.createdAt === "number" ? message.createdAt : Date.now();
        missingDeletedAtCount += 1;
      }
    }
  }

  console.log(`Conversas avaliadas: ${conversationsCount}`);
  console.log(`Mensagens avaliadas: ${messagesCount}`);
  console.log(`Mensagens sem campo deleted: ${missingDeletedCount}`);
  console.log(`Mensagens deleted sem deletedAt: ${missingDeletedAtCount}`);

  const totalUpdates = Object.keys(updates).length;
  if (totalUpdates === 0) {
    console.log("Nao ha alteracoes necessarias.");
    return;
  }

  console.log(`Alteracoes preparadas: ${totalUpdates}`);

  if (!applyChanges) {
    console.log("Modo dry-run. Nenhuma alteracao aplicada.");
    console.log("Use --apply para aplicar a migracao.");
    return;
  }

  await db.ref().update(updates);
  console.log("Migracao concluida com sucesso.");
}

async function run() {
  const applyChanges = process.argv.includes("--apply");
  await ensureInitialized();
  await migrateChatDeleteState({ applyChanges });
}

run().catch((error) => {
  console.error("Erro na migracao de mensagens de chat:", error);
  process.exit(1);
});
