// Run (dry-run): pnpm migrate:pending-teachers:check
// Run (apply changes): pnpm migrate:pending-teachers:apply
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

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function migratePendingTeachers({ applyChanges }) {
  const db = admin.firestore();
  const schoolsSnapshot = await db.collection("schools").get();

  if (schoolsSnapshot.empty) {
    console.log("Sem escolas para processar.");
    return;
  }

  let scanned = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const schoolDoc of schoolsSnapshot.docs) {
    const schoolId = schoolDoc.id;
    const schoolName = normalizeString(schoolDoc.get("name")) || schoolId;

    const pendingTeachersSnapshot = await db
      .collection("schools")
      .doc(schoolId)
      .collection("pendingTeachers")
      .get();

    for (const pendingTeacherDoc of pendingTeachersSnapshot.docs) {
      scanned += 1;
      const userId = pendingTeacherDoc.id;
      const data = pendingTeacherDoc.data() || {};

      const pendingRef = db.collection("pendingRegistrations").doc(userId);
      const pendingSnapshot = await pendingRef.get();

      if (!pendingSnapshot.exists) {
        const payload = {
          role: "professor",
          estado: "pendente",
          schoolId,
          escola: schoolName,
          nome: normalizeString(data.name || data.nome) || "",
          email: normalizeString(data.email) || "",
          emailVerified: false,
          migratedFromPendingTeachers: true,
          createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (!applyChanges) {
          console.log(`[dry-run] criar pendingRegistrations/${userId} (schoolId=${schoolId})`);
          created += 1;
          continue;
        }

        await pendingRef.set(payload, { merge: false });
        console.log(`Criado pendingRegistrations/${userId} (schoolId=${schoolId})`);
        created += 1;
        continue;
      }

      const pendingData = pendingSnapshot.data() || {};
      const patch = {};

      if (!normalizeString(pendingData.schoolId)) {
        patch.schoolId = schoolId;
      }

      if (!normalizeString(pendingData.escola)) {
        patch.escola = schoolName;
      }

      if (!normalizeString(pendingData.nome) && normalizeString(data.name || data.nome)) {
        patch.nome = normalizeString(data.name || data.nome);
      }

      if (!normalizeString(pendingData.email) && normalizeString(data.email)) {
        patch.email = normalizeString(data.email);
      }

      if (Object.keys(patch).length === 0) {
        skipped += 1;
        continue;
      }

      if (!applyChanges) {
        console.log(`[dry-run] atualizar pendingRegistrations/${userId}: ${Object.keys(patch).join(", ")}`);
        updated += 1;
        continue;
      }

      await pendingRef.set(
        {
          ...patch,
          migratedFromPendingTeachers: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`Atualizado pendingRegistrations/${userId}: ${Object.keys(patch).join(", ")}`);
      updated += 1;
    }
  }

  console.log(`Pendentes analisados: ${scanned}`);
  console.log(`Pendentes criados: ${created}`);
  console.log(`Pendentes atualizados: ${updated}`);
  console.log(`Pendentes sem alteracoes: ${skipped}`);
}

async function run() {
  const applyChanges = process.argv.includes("--apply");
  await ensureInitialized();
  await migratePendingTeachers({ applyChanges });
}

run().catch((error) => {
  console.error("Erro na migracao pendingTeachers -> pendingRegistrations:", error);
  process.exit(1);
});
