// Run (dry-run): pnpm migrate:estagios:check
// Run (apply changes): pnpm migrate:estagios:apply
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

async function ensureInitialized() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: buildCredential(),
    });
  }
}

const tutorIdByEmailCache = new Map();

async function resolveTutorIdByEmail(db, emailValue) {
  const emailRaw = (emailValue || "").trim();
  if (!emailRaw) return null;

  const emailLower = emailRaw.toLowerCase();
  if (tutorIdByEmailCache.has(emailLower)) {
    return tutorIdByEmailCache.get(emailLower);
  }

  const candidates = [];
  const byExact = await db.collection("users").where("email", "==", emailRaw).get();
  candidates.push(...byExact.docs);

  if (emailLower !== emailRaw) {
    const byLower = await db.collection("users").where("email", "==", emailLower).get();
    candidates.push(...byLower.docs);
  }

  const tutorDoc = candidates.find((docSnap) => {
    const data = docSnap.data() || {};
    return String(data.role || "").toLowerCase() === "tutor";
  });

  const resolved = tutorDoc ? tutorDoc.id : null;
  tutorIdByEmailCache.set(emailLower, resolved);
  return resolved;
}

async function migrateEstagios({ applyChanges }) {
  const db = admin.firestore();
  const snap = await db.collection("estagios").get();

  const targets = snap.docs.filter((docSnap) => {
    const data = docSnap.data() || {};
    return Object.prototype.hasOwnProperty.call(data, "alunoPhotoURL")
      || Object.prototype.hasOwnProperty.call(data, "tutorPhotoURL")
      || Object.prototype.hasOwnProperty.call(data, "professorPhotoURL")
      || Object.prototype.hasOwnProperty.call(data, "tutorNome")
      || Object.prototype.hasOwnProperty.call(data, "tutorEmail")
      || (!data.tutorId && typeof data.tutorEmail === "string" && data.tutorEmail.trim().length > 0);
  });

  console.log(`Total estagios: ${snap.size}`);
  console.log(`Estagios com campos legacy: ${targets.length}`);

  const pending = [];
  for (const docSnap of targets) {
    const data = docSnap.data() || {};
    const updates = {
      alunoPhotoURL: admin.firestore.FieldValue.delete(),
      tutorPhotoURL: admin.firestore.FieldValue.delete(),
      professorPhotoURL: admin.firestore.FieldValue.delete(),
      tutorNome: admin.firestore.FieldValue.delete(),
      tutorEmail: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    let resolvedTutorId = "";
    if (typeof data.tutorId === "string" && data.tutorId.trim()) {
      resolvedTutorId = data.tutorId.trim();
    } else if (typeof data.tutorEmail === "string" && data.tutorEmail.trim()) {
      const foundTutorId = await resolveTutorIdByEmail(db, data.tutorEmail);
      if (foundTutorId) {
        resolvedTutorId = foundTutorId;
      }
    }

    if (resolvedTutorId) {
      updates.tutorId = resolvedTutorId;
    }

    pending.push({
      ref: docSnap.ref,
      id: docSnap.id,
      updates,
      needsTutorId: !resolvedTutorId,
    });
  }

  const unresolvedTutorIds = pending.filter((item) => item.needsTutorId).map((item) => item.id);
  if (unresolvedTutorIds.length > 0) {
    console.log(`Sem tutorId resolvido para ${unresolvedTutorIds.length} estágio(s): ${unresolvedTutorIds.join(", ")}`);
  }

  if (!applyChanges || pending.length === 0) {
    if (!applyChanges) {
      console.log("Modo dry-run. Nenhuma alteração aplicada.");
      console.log("Use --apply para remover os campos legacy.");
    }
    return;
  }

  const batchSize = 400;
  for (let index = 0; index < pending.length; index += batchSize) {
    const batch = db.batch();
    const chunk = pending.slice(index, index + batchSize);

    for (const item of chunk) {
      batch.update(item.ref, item.updates);
    }

    await batch.commit();
    console.log(`Atualizado chunk ${Math.floor(index / batchSize) + 1} (${chunk.length} documentos).`);
  }

  console.log("Migração concluída.");
}

async function run() {
  const applyChanges = process.argv.includes("--apply");
  await ensureInitialized();
  await migrateEstagios({ applyChanges });
}

run().catch((error) => {
  console.error("Erro na migração de estagios:", error);
  process.exit(1);
});
