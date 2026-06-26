/**
 * Migração: adiciona campo `parametros` a documentos `avaliacao/professor`
 * antigos que só tinham `notaFinal` (antes da alteração que passou o
 * professor a preencher também a grelha de parâmetros).
 *
 * Execução:
 *   npx tsx scripts/migrate-professor-avaliacao-parametros.ts
 *
 * O script percorre todos os estágios, verifica se existe o documento
 * `avaliacao/professor` sem o campo `parametros`, e adiciona `parametros: {}`.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

if (!getApps().length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("Variáveis de ambiente Firebase Admin em falta.");
    process.exit(1);
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const db = getFirestore();

async function migrate() {
  console.log("A migrar documentos avaliacao/professor sem parametros...");

  const estagiosSnap = await db.collection("estagios").get();
  let migrated = 0;
  let skipped = 0;

  for (const estagioDoc of estagiosSnap.docs) {
    const profRef = db
      .collection("estagios")
      .doc(estagioDoc.id)
      .collection("avaliacao")
      .doc("professor");

    const profSnap = await profRef.get();
    if (!profSnap.exists) continue;

    const data = profSnap.data();
    if (!data) continue;

    if (data.parametros !== undefined) {
      skipped++;
      continue;
    }

    // Documento antigo: só tem notaFinal, sem parametros
    await profRef.update({
      parametros: {},
    });

    migrated++;
    console.log(`  Corrigido: estagio ${estagioDoc.id}`);
  }

  console.log(`\nMigração concluída: ${migrated} corrigidos, ${skipped} ignorados (já tinham parametros).`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erro na migração:", err);
    process.exit(1);
  });
