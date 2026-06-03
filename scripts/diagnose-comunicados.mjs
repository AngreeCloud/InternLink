/**
 * Diagnostic: list ALL company_closure requests for a specific estagio,
 * and all active estagios for a empresa.
 *
 * Usage:
 *   node scripts/diagnose-comunicados.mjs <estagioId>
 *   node scripts/diagnose-comunicados.mjs <empresaId> --by-empresa
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
    return initializeApp({
      credential: cert({
        projectId: parsed.project_id ?? parsed.projectId,
        clientEmail: parsed.client_email ?? parsed.clientEmail,
        privateKey: resolvePrivateKey(parsed.private_key ?? parsed.privateKey),
      }),
    });
  }
  const pid = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const email = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const key = resolvePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  if (pid && email && key) {
    return initializeApp({ credential: cert({ projectId: pid, clientEmail: email, privateKey: key }) });
  }
  console.error("No credentials found.");
  process.exit(1);
}

async function main() {
  const arg = process.argv[2];
  const mode = process.argv[3];
  if (!arg) { console.error("Usage: ... <estagioId|empresaId> [--by-empresa]"); process.exit(1); }

  getOrInitApp();
  const db = getFirestore();

  if (mode === "--by-empresa") {
    console.log(`\nLooking up empresa ${arg}...`);
    const estagios = await db.collection("estagios").where("empresaId", "==", arg).where("estado", "==", "ativo").get();
    console.log(`Active estagios: ${estagios.size}`);
    for (const doc of estagios.docs) {
      const data = doc.data();
      console.log(`\n  Estagio ${doc.id}: alunoId=${data.alunoId}, tutorId=${data.tutorId}`);
      const reqSnap = await doc.ref.collection("schedule_change_requests").where("type", "==", "company_closure").get();
      if (reqSnap.size === 0) {
        console.log("    No comunicados");
      } else {
        for (const r of reqSnap.docs) {
          const rd = r.data();
          console.log(`    [${rd.status}] ${rd.targetDate}: "${rd.reason}" (id=${r.id})`);
        }
      }
    }
  } else {
    console.log(`\nChecking estagio ${arg}...`);
    const doc = await db.collection("estagios").doc(arg).get();
    if (!doc.exists) { console.error("Not found"); process.exit(1); }
    const data = doc.data();
    console.log(`  EmpresaId: ${data.empresaId}, alunoId: ${data.alunoId}`);

    const reqSnap = await doc.ref.collection("schedule_change_requests").where("type", "==", "company_closure").get();
    console.log(`\n  Comunicados (${reqSnap.size}):`);
    for (const r of reqSnap.docs) {
      const rd = r.data();
      console.log(`    [${rd.status}] ${rd.targetDate}: "${rd.reason}" (id=${r.id})`);
    }

    console.log(`\n  ALL schedule_change_requests:`);
    const allSnap = await doc.ref.collection("schedule_change_requests").get();
    for (const r of allSnap.docs) {
      const rd = r.data();
      const dt = rd.targetDate || "(no date)";
      console.log(`    type=${rd.type} status=${rd.status} date=${dt} reason="${rd.reason}"`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
