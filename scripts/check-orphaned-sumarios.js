/**
 * Diagnostic script: Encontra sumários "orfãos" após mudança de números de semana
 * 
 * Este script APENAS LÊ e reporta - não faz nenhuma alteração.
 * Use isto primeiro para verificar o estado antes de migrar.
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

function toIsoDate(d) {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function checkOrphanedSumarios() {
  console.log('🔍 Verificando sumários orfãos...\n');

  try {
    // Find estágio for João da Ega
    const estagiosSnap = await db
      .collection('estagios')
      .where('alunoNome', '==', 'João da Ega')
      .get();

    if (estagiosSnap.empty) {
      console.log('❌ Nenhum estágio encontrado para "João da Ega"');
      process.exit(0);
    }

    console.log(`✓ Encontrados ${estagiosSnap.size} estágios para João da Ega\n`);

    for (const estagioDoc of estagiosSnap.docs) {
      const estagioId = estagioDoc.id;
      const estagioData = estagioDoc.data();
      const dataInicio = estagioData.dataInicio;
      const dataFim = estagioData.dataFim || estagioData.dataFimEstimada;

      console.log(`📋 Estágio: ${estagioId}`);
      console.log(`   Período: ${dataInicio} a ${dataFim}`);

      // Get all sumarios
      const sumariosSnap = await db
        .collection('estagios')
        .doc(estagioId)
        .collection('sumarios')
        .get();

      if (sumariosSnap.empty) {
        console.log(`   └─ Sem sumários encontrados\n`);
        continue;
      }

      console.log(`   └─ Sumários encontrados: ${sumariosSnap.size}`);

      // Analyze each sumario
      for (const sumarioDoc of sumariosSnap.docs) {
        const weekId = sumarioDoc.id;
        const data = sumarioDoc.data();
        const isIsoFormat = /^\d{4}-W\d{2}$/.test(weekId);
        const content = (data.content || '').substring(0, 50) + '...';

        console.log(
          `\n      weekId: ${weekId}\n` +
          `      ${isIsoFormat ? '⚠️  (ISO format - OLD STYLE)' : '✓ (Novo formato)'}\n` +
          `      weekStart: ${data.weekStart}\n` +
          `      weekEnd: ${data.weekEnd}\n` +
          `      weekNumber: ${data.weekNumber}\n` +
          `      content: "${content}"\n` +
          `      updatedAt: ${data.updatedAt?.toDate?.() || data.updatedAt || 'N/A'}`
        );
      }

      console.log('\n' + '='.repeat(70) + '\n');
    }
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }

  process.exit(0);
}

checkOrphanedSumarios();
