/**
 * Backfills a company_closure request for specific estagios that
 * were missed by the broadcast.
 *
 * Usage:
 *   node scripts/backfill-comunicado.mjs <empresaId> <targetDate> <reason>
 *   node scripts/backfill-comunicado.mjs --estagio <estagioId> <targetDate> <reason>
 *
 * Examples:
 *   node scripts/backfill-comunicado.mjs EMP123 2026-06-24 "S. João"
 *   node scripts/backfill-comunicado.mjs --estagio ABC123 2026-06-24 "S. João"
 *
 * If you want to dry-run first, set env DRY_RUN=1:
 *   DRY_RUN=1 node scripts/backfill-comunicado.mjs EMP123 2026-06-24 "S. João"
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  console.error(
    "No credentials found. Set FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON or the alternative env vars.\n" +
    "See .env.example for details."
  );
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);

  let targetEstagioId = null;
  let empresaId = null;
  let targetDate;
  let reason;

  if (args[0] === "--estagio") {
    targetEstagioId = args[1];
    targetDate = args[2];
    reason = args[3] || "Fecho da empresa";
  } else {
    empresaId = args[0];
    targetDate = args[1];
    reason = args[2] || "Fecho da empresa";
  }

  if ((!empresaId && !targetEstagioId) || !targetDate) {
    console.error("Usage: node scripts/backfill-comunicado.mjs <empresaId> <targetDate> [reason]");
    console.error("   or: node scripts/backfill-comunicado.mjs --estagio <estagioId> <targetDate> [reason]");
    process.exit(1);
  }

  getOrInitApp();
  const db = getFirestore();

  let estagiosSnap;

  if (targetEstagioId) {
    // Direct estagio target
    const doc = await db.collection("estagios").doc(targetEstagioId).get();
    if (!doc.exists) {
      console.error(`Estagio ${targetEstagioId} not found.`);
      process.exit(1);
    }
    estagiosSnap = { size: 1, docs: [doc] };
    console.log(`\nTargeting estagio ${targetEstagioId} directly`);
  } else {
    // Find all active estagios for this empresa
    estagiosSnap = await db
      .collection("estagios")
      .where("empresaId", "==", empresaId)
      .where("estado", "==", "ativo")
      .get();
    console.log(`\nEmpresa ${empresaId}: ${estagiosSnap.size} active estagio(s)`);
  }

  // 2. For each estagio, check if it has a company_closure for targetDate
  let existing = 0;
  let missing = 0;
  const missingEstagios = [];

  for (const estagioDoc of estagiosSnap.docs) {
    const estagio = estagioDoc.data();
    const reqSnap = await estagioDoc.ref
      .collection("schedule_change_requests")
      .where("targetDate", "==", targetDate)
      .where("type", "==", "company_closure")
      .get();

    if (reqSnap.size > 0) {
      existing++;
      console.log(`  [✓] Estagio ${estagioDoc.id} (aluno: ${estagio.alunoId}) — exists`);
    } else {
      missing++;
      missingEstagios.push(estagioDoc);
      console.log(`  [✗] Estagio ${estagioDoc.id} (aluno: ${estagio.alunoId}) — MISSING`);
    }
  }

  console.log(`\nSummary: ${existing} have it, ${missing} missing\n`);

  if (missing === 0) {
    console.log("Nothing to do — every estagio already has the comunicado.");
    process.exit(0);
  }

  if (!DRY_RUN) {
    // 3. Create missing requests
    const batch = db.batch();

    for (const estagioDoc of missingEstagios) {
      const estagio = estagioDoc.data();
      const reqRef = estagioDoc.ref.collection("schedule_change_requests").doc();

      batch.set(reqRef, {
        estagioId: estagioDoc.id,
        studentId: estagio.alunoId,
        professorId: estagio.professorId || "",
        tutorId: estagio.tutorId || "",
        type: "company_closure",
        targetDate,
        absenceType: "total",
        hoursAffected: 0,
        reason,
        status: "approved",
        comments: [{
          authorId: "script",
          authorRole: "tutor",
          text: "Auto-gerado: Backfill de comunicado em falta.",
          createdAt: new Date().toISOString(),
        }],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`  Created request for estagio ${estagioDoc.id}`);
    }

    await batch.commit();
    console.log(`\nDone — backfilled ${missing} comunicado(s).`);
  } else {
    console.log("DRY RUN — would create", missing, "request(s).");
    console.log("Run without DRY_RUN=1 to execute.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
