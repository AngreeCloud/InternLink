/**
 * Backfills missing `absenceType` field on future_absence requests.
 *
 * Documents with `hoursAffected > 0` but no `absenceType` get `absenceType: "partial"`.
 * Documents with `hoursAffected === 0` or no `hoursAffected` get `absenceType: "total"`.
 *
 * Usage:
 *   node scripts/backfill-absence-type.mjs
 *   DRY_RUN=1 node scripts/backfill-absence-type.mjs
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const DRY_RUN = process.env.DRY_RUN === "1";

function resolvePrivateKey(raw) {
  if (!raw) return undefined;
  return raw.replace(/\\n/g, "\n");
}

function getOrInitApp() {
  if (getApps().length > 0) return getApps()[0];
  const rawJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    return initializeApp({ credential: cert({ projectId: parsed.project_id ?? parsed.projectId, clientEmail: parsed.client_email ?? parsed.clientEmail, privateKey: resolvePrivateKey(parsed.private_key ?? parsed.privateKey) }) });
  }
  const pid = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const email = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const key = resolvePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  if (pid && email && key) return initializeApp({ credential: cert({ projectId: pid, clientEmail: email, privateKey: key }) });
  console.error("No credentials"); process.exit(1);
}

async function main() {
  getOrInitApp();
  const db = getFirestore();

  const estagios = await db.collection("estagios").get();
  let fixed = 0;

  for (const estagioDoc of estagios.docs) {
    const snap = await estagioDoc.ref
      .collection("schedule_change_requests")
      .where("type", "==", "future_absence")
      .get();

    for (const reqDoc of snap.docs) {
      const data = reqDoc.data();
      const hasAbsenceType = data.absenceType != null;
      if (hasAbsenceType) continue;

      const h = Number(data.hoursAffected) || 0;
      const newType = h > 0 ? "partial" : "total";

      if (!DRY_RUN) {
        await reqDoc.ref.update({ absenceType: newType });
      }
      fixed++;
      console.log(`  [${DRY_RUN ? "DRY" : "OK"}] estagio ${estagioDoc.id} req ${reqDoc.id}: hoursAffected=${h} → absenceType="${newType}"`);
    }
  }

  console.log(`\nDone — ${DRY_RUN ? "would fix" : "fixed"} ${fixed} document(s).`);
  if (DRY_RUN) console.log("Run without DRY_RUN=1 to execute.");
}

main().catch(err => { console.error(err); process.exit(1); });
