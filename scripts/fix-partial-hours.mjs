/**
 * Lists/fixes partial-absence documents where hoursAffected was stored as 0
 * due to the Number.isFinite bug in the API route.
 *
 * Usage:
 *   node scripts/fix-partial-hours.mjs                   # dry-run (list only)
 *   node scripts/fix-partial-hours.mjs 4                 # fix ALL with hoursAffected=4
 *   node scripts/fix-partial-hours.mjs --estagio <id> 4  # fix specific estagio
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
  const args = process.argv.slice(2);
  let targetEstagio = null;
  let fixHours = null;

  if (args[0] === "--estagio") {
    targetEstagio = args[1];
    fixHours = parseInt(args[2], 10);
  } else if (args[0]) {
    fixHours = parseInt(args[0], 10);
  }

  const dryRun = fixHours === null;
  getOrInitApp();
  const db = getFirestore();

  const estagios = targetEstagio
    ? { docs: [await db.collection("estagios").doc(targetEstagio).get()].filter(d => d.exists) }
    : await db.collection("estagios").get();

  if (!estagios.docs.length) { console.error("No estagios found."); process.exit(1); }

  let found = 0;
  for (const estagioDoc of estagios.docs) {
    const hpd = Number(estagioDoc.data().horasPorDia || estagioDoc.data().horasDiarias || 8);
    const snap = await estagioDoc.ref
      .collection("schedule_change_requests")
      .where("type", "==", "future_absence")
      .where("absenceType", "==", "partial")
      .get();

    for (const reqDoc of snap.docs) {
      const data = reqDoc.data();
      const h = Number(data.hoursAffected) || 0;
      if (h > 0) continue;

      const newVal = fixHours ?? hpd;
      console.log(`  ${reqDoc.id}: date=${data.targetDate} status=${data.status} hoursAffected=${h} → ${dryRun ? "would get" : "set to"} ${newVal}h`);
      if (!dryRun) {
        await reqDoc.ref.update({ hoursAffected: newVal });
      }
      found++;
    }
  }

  if (found === 0) console.log("No documents with hoursAffected=0 found.");
  console.log(`\nDone — ${dryRun ? "would fix" : "fixed"} ${found} document(s).`);
  if (dryRun) console.log("Pass <hours> as argument to fix (e.g. `node fix-partial-hours.mjs 4`).");
}

main().catch(err => { console.error(err); process.exit(1); });
