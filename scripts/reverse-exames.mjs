/**
 * REVERSE: reverts 3 exam-related requests wrongly migrated to "company_closure".
 *
 * The migration used professorDecision+tutorDecision as detection, but that
 * also matches real future absences that went through full approval.
 *
 * Targets by reason text (exam keywords) and restores type + fields.
 *
 * Run with: node scripts/reverse-exames.mjs
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const EXAM_KEYWORDS = ["Exame", "exame"];

function resolvePrivateKey(raw) {
  if (!raw) return undefined;
  return raw.replace(/\\n/g, "\n");
}

function getOrInitApp() {
  if (getApps().length > 0) return getApps()[0];
  const rawJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    return initializeApp({
      credential: cert({
        projectId: parsed.project_id ?? parsed.projectId,
        clientEmail: parsed.client_email ?? parsed.clientEmail,
        privateKey: resolvePrivateKey(parsed.private_key ?? parsed.privateKey),
      }),
    });
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = resolvePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  console.error("No credentials found.");
  process.exit(1);
}

function isExam(reason) {
  return EXAM_KEYWORDS.some((kw) => reason.includes(kw));
}

async function main() {
  getOrInitApp();
  const db = getFirestore();
  const estagios = await db.collection("estagios").get();
  let reverted = 0;

  for (const estagioDoc of estagios.docs) {
    const snap = await estagioDoc.ref
      .collection("schedule_change_requests")
      .where("type", "==", "company_closure")
      .get();

    for (const reqDoc of snap.docs) {
      const data = reqDoc.data();
      const reason = data.reason || "";
      if (!isExam(reason)) continue;

      await reqDoc.ref.update({
        type: "future_absence",
        absenceType: data.absenceType || "total",
        hoursAffected: 0,
        professorDecision: "approved",
        tutorDecision: "approved",
      });

      reverted++;
      console.log(`  [←] estagio ${estagioDoc.id} → ${reqDoc.id}  "${reason}"`);
    }
  }

  console.log(`\nDone — reverted ${reverted} request(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
