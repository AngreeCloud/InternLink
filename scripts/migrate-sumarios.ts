/**
 * Migração de sumários - Versão TypeScript
 *
 * Execute com:
 * npx ts-node scripts/migrate-sumarios.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getFirebaseAdminDb } from '../lib/firebase-admin';

const db = getFirebaseAdminDb();

function parseIsoDate(iso: string): Date | null {
  if (!iso || typeof iso !== 'string' || iso.length < 10) return null;
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toIsoDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getIsoWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNr = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayNr);
  return d;
}

function getRelativeWeekNumber(date: Date, stageStartDate: Date): number {
  const stageWeekStart = getIsoWeekStart(stageStartDate);
  const dateWeekStart = getIsoWeekStart(date);
  const diffMs = dateWeekStart.getTime() - stageWeekStart.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  const weekNumber = 1 + Math.floor(diffDays / 7);
  return Math.max(1, weekNumber);
}

function isIsoWeekId(weekId: string): boolean {
  return /^\d{4}-W\d{2}$/.test(weekId);
}

async function migrateForStudent(alunoNome: string) {
  console.log(`\n🔍 Procurando estágios para: ${alunoNome}\n`);

  const estagiosSnap = await db
    .collection('estagios')
    .where('alunoNome', '==', alunoNome)
    .get();

  if (estagiosSnap.empty) {
    console.log(`❌ Nenhum estágio encontrado para "${alunoNome}"`);
    return;
  }

  console.log(`✓ Encontrados ${estagiosSnap.size} estágios\n`);

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const estagioDoc of estagiosSnap.docs) {
    const estagioId = estagioDoc.id;
    const estagioData = estagioDoc.data();
    const dataInicio = estagioData.dataInicio as string;

    if (!dataInicio) {
      console.log(`⏭️  Estágio ${estagioId}: sem dataInicio, pulando\n`);
      continue;
    }

    const stageStartDate = parseIsoDate(dataInicio);
    if (!stageStartDate) {
      console.log(`⏭️  Estágio ${estagioId}: dataInicio inválida, pulando\n`);
      continue;
    }

    console.log(`📋 Estágio: ${estagioId}`);
    console.log(`   dataInicio: ${dataInicio}`);

    const sumariosSnap = await db
      .collection('estagios')
      .doc(estagioId)
      .collection('sumarios')
      .get();

    if (sumariosSnap.empty) {
      console.log(`   └─ Sem sumários\n`);
      continue;
    }

    console.log(`   └─ ${sumariosSnap.size} sumários encontrados\n`);

    for (const sumarioDoc of sumariosSnap.docs) {
      const oldWeekId = sumarioDoc.id;
      const sumarioData = sumarioDoc.data();
      const weekStart = sumarioData.weekStart as string;

      if (!isIsoWeekId(oldWeekId)) {
        console.log(`      ✓ ${oldWeekId} (já tem novo formato)`);
        continue;
      }

      console.log(`      🔄 ${oldWeekId} (ISO format - precisa migração)`);

      if (!weekStart) {
        console.log(`         ⚠️  sem weekStart, pulando`);
        totalSkipped++;
        continue;
      }

      const weekStartDate = parseIsoDate(weekStart);
      if (!weekStartDate) {
        console.log(`         ⚠️  weekStart inválida, pulando`);
        totalSkipped++;
        continue;
      }

      const newWeekNumber = getRelativeWeekNumber(weekStartDate, stageStartDate);
      const newWeekId = `${newWeekNumber}-${weekStart}`;

      console.log(`         New ID: ${newWeekId} (Semana ${newWeekNumber})`);

      try {
        // Check if already exists
        const newDocSnap = await db
          .collection('estagios')
          .doc(estagioId)
          .collection('sumarios')
          .doc(newWeekId)
          .get();

        if (newDocSnap.exists) {
          console.log(`         ✓ Novo ID já existe`);
          totalSkipped++;
          continue;
        }

        // Create new document
        const migratedData = { ...sumarioData, weekNumber: newWeekNumber };
        await db
          .collection('estagios')
          .doc(estagioId)
          .collection('sumarios')
          .doc(newWeekId)
          .set(migratedData);

        console.log(`         ✅ Migrado com sucesso`);
        totalMigrated++;
      } catch (err) {
        console.log(`         ❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
        totalErrors++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO');
  console.log('='.repeat(60));
  console.log(`✅ Migrados: ${totalMigrated}`);
  console.log(`⏭️  Pulados: ${totalSkipped}`);
  console.log(`❌ Erros: ${totalErrors}`);
  console.log('='.repeat(60) + '\n');
}

async function main() {
  try {
    await migrateForStudent('João da Ega');
  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }

  process.exit(0);
}

main();
