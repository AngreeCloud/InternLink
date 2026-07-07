/**
 * Atualiza emails dos users mock (esrp.pt → up.pt) no Auth + Firestore.
 * Uso: node scripts/fix-emails-mock-data.js
 */

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

function buildCredential() {
  const rawJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      return admin.credential.cert({
        projectId: parsed.project_id ?? parsed.projectId,
        clientEmail: parsed.client_email ?? parsed.clientEmail,
        privateKey: (parsed.private_key ?? parsed.privateKey).replace(/\\n/g, "\n"),
      });
    } catch { /* fallback */ }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }
  return admin.credential.applicationDefault();
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: buildCredential() });
}

const db = admin.firestore();
const auth = admin.auth();

const UPDATES = [
  { uid: "admin-esrp",  novoEmail: "afonso.henriques@up.pt" },
  { uid: "prof-eca",    novoEmail: "eca.queiros@up.pt" },
  { uid: "aluno-carlos", novoEmail: "carlos.maia@up.pt" },
];

async function run() {
  console.log("A atualizar emails...\n");
  for (const u of UPDATES) {
    try {
      // Auth
      await auth.updateUser(u.uid, { email: u.novoEmail });
      console.log(`  ✓ Auth ${u.uid}: email atualizado`);

      // Firestore
      await db.collection("users").doc(u.uid).update({ email: u.novoEmail });
      console.log(`  ✓ Firestore ${u.uid}: email atualizado`);
    } catch (err) {
      console.error(`  ✗ ${u.uid}: ${err.message}`);
    }
  }
  console.log("\nConcluído.");
}

run().catch(console.error);
