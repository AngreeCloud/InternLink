/**
 * Migration: backfill `empresaGrants` for empresas created by professors.
 *
 * Bug: POST /api/empresas did not set empresaGrants for professor creator.
 * Professors with `empresaGrants[uid]` undefined see empty empresa list
 * because filterEmpresasByAccess() filters them out.
 *
 * This script:
 * 1. Finds all empresas where createdBy is a professor user
 * 2. Adds { [createdBy]: "write" } to empresaGrants if not already present
 * 3. Also adds grants for all users in createdBy field who are professors
 *
 * Safe: never removes grants, only adds missing ones.
 *
 * Usage:
 *   npx tsx scripts/migrate-empresas-professor-grants.ts
 *
 * Lê FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON do .env.local automaticamente.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function loadServiceAccount(): Record<string, string> {
  const json = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (json) return JSON.parse(json);

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return {
      type: "service_account",
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n"),
      token_uri: "https://oauth2.googleapis.com/token",
    };
  }

  console.error("No Firebase admin credentials found. Set FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON or FIREBASE_ADMIN_PROJECT_ID + FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY in .env.local");
  process.exit(1);
}

let serviceAccount: Record<string, string>;
try {
  serviceAccount = loadServiceAccount();
} catch {
  console.error("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: invalid JSON");
  process.exit(1);
}

let app;
if (getApps().length === 0) {
  app = initializeApp({ credential: cert(serviceAccount) });
} else {
  app = getApp();
}

const db = getFirestore(app);

async function migrate() {
  console.log("Fetching all professor UIDs...");
  const profSnap = await db
    .collection("users")
    .where("role", "==", "professor")
    .select("uid")
    .get();

  const professorUids = new Set(profSnap.docs.map((d) => d.id));
  console.log(`Found ${professorUids.size} professors`);

  console.log("Fetching all empresas with createdBy...");
  const empresasSnap = await db.collection("empresas").get();
  console.log(`Found ${empresasSnap.size} empresas`);

  let updated = 0;
  let skipped = 0;

  for (const doc of empresasSnap.docs) {
    const data = doc.data();
    const createdBy = data.createdBy as string | undefined;
    const existingGrants = (data.empresaGrants as Record<string, string> | undefined) ?? {};

    if (!createdBy) {
      skipped++;
      continue;
    }

    const candidates = new Set<string>();
    if (professorUids.has(createdBy)) {
      candidates.add(createdBy);
    }

    // Also check if createdBy is from another professor not in users collection
    // (edge case: deleted user)
    if (candidates.size === 0) continue;

    let needsUpdate = false;
    for (const uid of candidates) {
      if (!existingGrants[uid]) {
        existingGrants[uid] = "write";
        needsUpdate = true;
      }
    }

    if (!needsUpdate) {
      skipped++;
      continue;
    }

    await doc.ref.update({
      empresaGrants: existingGrants,
      updatedAt: FieldValue.serverTimestamp(),
    });
    updated++;
    process.stdout.write(".");
  }

  console.log(`\n\nDone. Updated: ${updated}, Skipped (already had grant or no professor creator): ${skipped}`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
