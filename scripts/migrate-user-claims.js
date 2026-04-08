// Run (dry-run): pnpm migrate:claims:check
// Run (apply changes): pnpm migrate:claims:apply
require("dotenv").config({ path: ".env.local" });
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function resolvePrivateKey(raw) {
  return typeof raw === "string" ? raw.replace(/\\n/g, "\n") : undefined;
}

function parseServiceAccountJson() {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      projectId: parsed.project_id || parsed.projectId,
      clientEmail: parsed.client_email || parsed.clientEmail,
      privateKey: resolvePrivateKey(parsed.private_key || parsed.privateKey),
    };
  } catch (error) {
    throw new Error(
      `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON invalido: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function resolveProjectId() {
  const fromJson = parseServiceAccountJson();
  return (
    fromJson.projectId ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

function buildCredential() {
  const fromJson = parseServiceAccountJson();
  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const projectId =
    fromJson.projectId || process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail =
    fromJson.clientEmail || process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey =
    fromJson.privateKey ||
    resolvePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY);

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
  return (
    process.env.FIREBASE_ADMIN_DATABASE_URL ||
    process.env.FIREBASE_DATABASE_URL ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  );
}

async function ensureInitialized() {
  if (!admin.apps.length) {
    const projectId = resolveProjectId();
    if (!projectId) {
      throw new Error(
        "Defina FIREBASE_ADMIN_PROJECT_ID, FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID ou FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON para executar esta migracao."
      );
    }

    admin.initializeApp({
      credential: buildCredential(),
      projectId,
      ...(buildDatabaseUrl() ? { databaseURL: buildDatabaseUrl() } : {}),
    });
  }
}

function normalizeClaim(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function migrateUserClaims({ applyChanges }) {
  const db = admin.firestore();
  const auth = admin.auth();

  const usersSnap = await db.collection("users").get();
  if (usersSnap.empty) {
    console.log("Nao existem utilizadores para migrar.");
    return;
  }

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let invalid = 0;

  for (const userDoc of usersSnap.docs) {
    scanned += 1;
    const data = userDoc.data() || {};
    const role = normalizeClaim(data.role);
    const estado = normalizeClaim(data.estado);

    if (!role || !estado) {
      invalid += 1;
      console.warn(`Ignorado ${userDoc.id}: role/estado em falta.`);
      continue;
    }

    if (!applyChanges) {
      console.log(`Dry-run ${userDoc.id}: role=${role}, estado=${estado}`);
      skipped += 1;
      continue;
    }

    await auth.setCustomUserClaims(userDoc.id, {
      role,
      estado,
    });
    updated += 1;
    console.log(`Claims atualizadas para ${userDoc.id}`);
  }

  console.log(`Utilizadores avaliados: ${scanned}`);
  console.log(`Utilizadores atualizados: ${updated}`);
  console.log(`Utilizadores ignorados: ${skipped}`);
  console.log(`Utilizadores invalidos: ${invalid}`);
}

async function run() {
  const applyChanges = process.argv.includes("--apply");
  await ensureInitialized();
  await migrateUserClaims({ applyChanges });
}

run().catch((error) => {
  console.error("Erro na migracao de custom claims:", error);
  process.exit(1);
});
