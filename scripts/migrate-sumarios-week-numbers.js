/**
 * Migration script: Atualiza sumários após alteração do cálculo de números de semana
 * 
 * Contexto: O sistema foi alterado para usar números de semana relativos ao dataInicio
 * do estágio individual, em vez de ISO week numbers. Isto causou que sumários antigos
 * fossem "perdidos" porque o weekId mudou.
 * 
 * Este script:
 * 1. Encontra todos os sumários "orfãos" (com IDs baseados em ISO week)
 * 2. Reconstrói o novo weekId baseado em semana relativa
 * 3. Move os documentos para os novos IDs
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function resolvePrivateKey(raw) {
  return typeof raw === 'string' ? raw.replace(/\\n/g, '\n') : undefined;
}

function parseServiceAccountJson() {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      projectId: parsed.project_id || parsed.projectId,
      clientEmail: parsed.client_email || parsed.clientEmail,
      privateKey: resolvePrivateKey(parsed.private_key || parsed.privateKey),
    };
  } catch (error) {
    throw new Error(
      `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON invalido: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function buildCredential() {
  const fromJson = parseServiceAccountJson();
  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const projectId =
    fromJson.projectId || process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail =
    fromJson.clientEmail || process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey =
    fromJson.privateKey ||
    resolvePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY);

  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const resolved = path.resolve(serviceAccountPath);
    return admin.credential.cert(require(resolved));
  }

  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }

  return admin.credential.applicationDefault();
}

function buildDatabaseUrl() {
  return (
    process.env.FIREBASE_ADMIN_DATABASE_URL ||
    process.env.FIREBASE_DATABASE_URL ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  );
}

if (!admin.apps.length) {
  const projectId =
    parseServiceAccountJson().projectId ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    console.error('❌ Erro: nao foi possivel resolver o projectId do Firebase.');
    console.error(
      'Defina FIREBASE_ADMIN_PROJECT_ID, FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID ou FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON no .env.local.'
    );
    process.exit(1);
  }

  admin.initializeApp({
    credential: buildCredential(),
    projectId,
    ...(buildDatabaseUrl() ? { databaseURL: buildDatabaseUrl() } : {}),
  });
}

const db = admin.firestore();

// Helper: Parse ISO date
function parseIsoDate(iso) {
  if (!iso || typeof iso !== 'string' || iso.length < 10) return null;
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Helper: Convert date to ISO string
function toIsoDate(d) {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Helper: Get ISO week start (Monday)
function getIsoWeekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNr = (d.getDay() + 6) % 7; // segunda=0
  d.setDate(d.getDate() - dayNr);
  return d;
}

// Helper: Calculate relative week number (1 = week containing stageStart)
function getRelativeWeekNumber(date, stageStartDate) {
  const stageWeekStart = getIsoWeekStart(stageStartDate);
  const dateWeekStart = getIsoWeekStart(date);
  const diffMs = dateWeekStart.getTime() - stageWeekStart.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  const weekNumber = 1 + Math.floor(diffDays / 7);
  return Math.max(1, weekNumber);
}

// Helper: Check if weekId looks like ISO week (e.g., "2026-W16")
function isIsoWeekId(weekId) {
  return /^\d{4}-W\d{2}$/.test(weekId);
}

// Helper: Reconstruct new weekId from ISO date
function buildNewWeekId(iso) {
  const date = parseIsoDate(iso);
  if (!date) return null;
  const weekStart = getIsoWeekStart(date);
  return toIsoDate(weekStart); // Returns date of Monday
}

async function main() {
  console.log('🔍 Migration: Buscando sumários com números de semana antigos...\n');

  const deleteOldDocuments = process.argv.includes('--delete-old');
  if (deleteOldDocuments) {
    console.log('🧹 Modo de limpeza ativo: os documentos antigos serão apagados após migração.\n');
  }

  try {
    // Get all estagios
    const estagiosSnap = await db.collection('estagios').get();
    console.log(`Found ${estagiosSnap.size} estágios\n`);

    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const estagioDoc of estagiosSnap.docs) {
      const estagioId = estagioDoc.id;
      const estagioData = estagioDoc.data();
      const alunoNome = estagioData.alunoNome || 'Unknown';
      const dataInicio = estagioData.dataInicio;

      // Only process estágios with dataInicio
      if (!dataInicio) {
        console.log(`⏭️  ${alunoNome} (${estagioId}): Sem dataInicio, pulando`);
        continue;
      }

      const stageStartDate = parseIsoDate(dataInicio);
      if (!stageStartDate) {
        console.log(`⏭️  ${alunoNome} (${estagioId}): dataInicio inválida, pulando`);
        continue;
      }

      console.log(`📋 ${alunoNome} (${estagioId}) - dataInicio: ${dataInicio}`);

      // Get all sumarios
      const sumariosSnap = await db
        .collection('estagios')
        .doc(estagioId)
        .collection('sumarios')
        .get();

      if (sumariosSnap.empty) {
        console.log(`  └─ Sem sumários\n`);
        continue;
      }

      console.log(`  └─ ${sumariosSnap.size} sumários encontrados`);

      // Check which ones need migration
      for (const sumarioDoc of sumariosSnap.docs) {
        const oldWeekId = sumarioDoc.id;
        const sumarioData = sumarioDoc.data();
        const weekStart = sumarioData.weekStart || '';

        // Detect if this needs migration
        if (isIsoWeekId(oldWeekId)) {
          console.log(`     🔄 CANDIDATO: ${oldWeekId} (ISO week format)`);

          // Build new weekId from weekStart date
          if (!weekStart) {
            console.log(`        ⚠️  Sem weekStart, não posso calcular novo ID`);
            totalSkipped++;
            continue;
          }

          const newRelativeWeekNumber = getRelativeWeekNumber(
            parseIsoDate(weekStart),
            stageStartDate
          );
          const newWeekId = `${newRelativeWeekNumber}-${weekStart}`;

          console.log(
            `        Old ID: ${oldWeekId}\n` +
            `        New ID: ${newWeekId}\n` +
            `        Semana relativa: ${newRelativeWeekNumber}`
          );

          // Check if new doc already exists
          const newDocSnap = await db
            .collection('estagios')
            .doc(estagioId)
            .collection('sumarios')
            .doc(newWeekId)
            .get();

          if (newDocSnap.exists) {
            console.log(`        ✓ Novo ID já existe, pulando (evitar sobrescrita)`);

            if (deleteOldDocuments) {
              await db
                .collection('estagios')
                .doc(estagioId)
                .collection('sumarios')
                .doc(oldWeekId)
                .delete();
              console.log(`        🗑️  Documento antigo apagado`);
            }

            console.log('');
            totalSkipped++;
            continue;
          }

          try {
            // Create new document with updated weekNumber
            const migratedData = {
              ...sumarioData,
              weekNumber: newRelativeWeekNumber,
            };
            await db
              .collection('estagios')
              .doc(estagioId)
              .collection('sumarios')
              .doc(newWeekId)
              .set(migratedData);

            console.log(`        ✅ Migrado com sucesso!`);

            if (deleteOldDocuments) {
              await db
                .collection('estagios')
                .doc(estagioId)
                .collection('sumarios')
                .doc(oldWeekId)
                .delete();
              console.log(`        🗑️  Documento antigo apagado`);
            }

            totalMigrated++;
          } catch (err) {
            console.log(`        ❌ Erro ao migrar: ${err.message}`);
            totalErrors++;
          }
        } else {
          // Already has new format
          console.log(`     ✓ ${oldWeekId} (já tem novo formato)`);
        }
      }

      console.log('');
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DA MIGRAÇÃO');
    console.log('='.repeat(60));
    console.log(`✅ Migrados com sucesso: ${totalMigrated}`);
    console.log(`⏭️  Pulados: ${totalSkipped}`);
    console.log(`❌ Erros: ${totalErrors}`);
    console.log('='.repeat(60));
    console.log(
      '\n📝 NOTA: Os documentos antigos não foram deletados automaticamente.'
    );
    console.log(
      '   Verifique que os novos foram criados corretamente antes de deletar manualmente.'
    );
  } catch (err) {
    console.error('❌ Erro crítico:', err);
    process.exit(1);
  }

  process.exit(0);
}

main();
