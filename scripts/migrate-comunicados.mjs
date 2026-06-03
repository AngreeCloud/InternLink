/**
 * Migrates existing auto-approved schedule_change_requests
 * (created by the company closure / "fecho" system) from type
 * "future_absence" to "company_closure".
 *
 * Uses the same env-vars as the main app (see .env.example):
 *   - FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON  (full JSON, preferred)
 *   - FIREBASE_ADMIN_PROJECT_ID            (alternative)
 *   - FIREBASE_ADMIN_CLIENT_EMAIL          (alternative)
 *   - FIREBASE_ADMIN_PRIVATE_KEY           (alternative, use \\n for line breaks)
 *
 * Run with: node scripts/migrate-comunicados.mjs
 *
 * Safe to re-run — only migrates requests with "Auto-gerado" comment
 * that are still type "future_absence" (e.g. created before code change).
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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
  getOrInitApp();
  const db = getFirestore();
  const estagios = await db.collection("estagios").get();
  let migrated = 0;

  for (const estagioDoc of estagios.docs) {
    const snap = await estagioDoc.ref
      .collection("schedule_change_requests")
      .where("type", "==", "future_absence")
      .get();

    for (const reqDoc of snap.docs) {
      const data = reqDoc.data();
      const firstComment = (data.comments || [])[0];
      const isFechoGenerated =
        firstComment &&
        typeof firstComment.text === "string" &&
        firstComment.text.includes("Auto-gerado");

      if (!isFechoGenerated) continue;

      await reqDoc.ref.update({
        type: "company_closure",
        hoursAffected: 0,
        professorDecision: FieldValue.delete(),
        tutorDecision: FieldValue.delete(),
        professorDecidedAt: FieldValue.delete(),
        tutorDecidedAt: FieldValue.delete(),
      });

      migrated++;
      console.log(`  [✓] estagio ${estagioDoc.id} → ${reqDoc.id}`);
    }
  }

  console.log(`\nDone — migrated ${migrated} comunicado(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
