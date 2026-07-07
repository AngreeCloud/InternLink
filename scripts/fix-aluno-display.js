/**
 * Add `escola` and `curso` display fields to aluno user docs.
 * Uso: node scripts/fix-aluno-display.js
 */
require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");
function bc() {
  const j = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (j) { try { return admin.credential.cert(JSON.parse(j)); } catch {} }
  const p = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const e = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const k = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (p && e && k) return admin.credential.cert({ projectId: p, clientEmail: e, privateKey: k });
  return admin.credential.applicationDefault();
}
admin.initializeApp({ credential: bc() });
const db = admin.firestore();
async function run() {
  await db.collection("users").doc("aluno-carlos").set({ curso: "Técnico de Turismo", escola: "Universidade do Porto", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  console.log("✓ aluno-carlos");
  await db.collection("users").doc("aluno-campos").set({ curso: "Técnico de Comunicação e Marketing", escola: "Universidade do Porto", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  console.log("✓ aluno-campos");
}
run().catch(console.error);
