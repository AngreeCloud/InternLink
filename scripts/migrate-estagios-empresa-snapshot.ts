/**
 * Migration script: populate `empresaSnapshot` on estagios that lack it.
 *
 * Reads all estagios for each school, finds those without empresaSnapshot,
 * looks up the linked empresa, builds the snapshot.
 *
 * Usage:
 *   npx tsx scripts/migrate-estagios-empresa-snapshot.ts
 *
 * Safe: only adds field, never overwrites existing snapshot.
 */

import { initializeApp, cert, getApps, getApp, type AppOptions } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!SERVICE_ACCOUNT_PATH) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS not set");
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

let app;
if (getApps().length === 0) {
  app = initializeApp({
    credential: cert(serviceAccount),
  } as AppOptions);
} else {
  app = getApp();
}

const db = getFirestore(app);

async function migrate() {
  const schoolsSnap = await db.collection("schools").get();
  console.log(`Found ${schoolsSnap.size} schools`);

  let totalMigrated = 0;

  for (const schoolDoc of schoolsSnap.docs) {
    const schoolId = schoolDoc.id;
    const estagiosSnap = await db
      .collection("estagios")
      .where("schoolId", "==", schoolId)
      .get();

    const empresaPromises: Promise<void>[] = [];

    for (const estagioDoc of estagiosSnap.docs) {
      const data = estagioDoc.data();
      if (data.empresaSnapshot) continue;

      const empresaId = data.empresaId;
      if (!empresaId) continue;

      empresaPromises.push(
        (async () => {
          try {
            const empresaSnap = await db.collection("empresas").doc(empresaId).get();
            if (!empresaSnap.exists) {
              console.warn(`  Empresa ${empresaId} not found for estagio ${estagioDoc.id}`);
              return;
            }
            const empresa = empresaSnap.data()!;
            const snapshot = {
              nome: empresa.nome,
              morada: empresa.morada ?? null,
              codigoPostal: empresa.codigoPostal ?? null,
              localidade: empresa.localidade ?? null,
              nif: empresa.nif ?? null,
              emailGeral: empresa.emailGeral ?? null,
              telefone: empresa.telefone ?? null,
            };
            await estagioDoc.ref.update({ empresaSnapshot: snapshot });
            totalMigrated++;
            process.stdout.write(".");
          } catch (err) {
            console.error(`  Error processing estagio ${estagioDoc.id}:`, err);
          }
        })()
      );
    }

    await Promise.all(empresaPromises);
    console.log(`\nSchool ${schoolId}: processed ${empresaPromises.length} estagios`);
  }

  console.log(`\nDone. Migrated ${totalMigrated} estagios.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
