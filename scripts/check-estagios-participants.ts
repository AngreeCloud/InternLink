/**
 * Script de diagnóstico para a API de participants (404).
 *
 * Uso:
 *   npx tsx scripts/check-estagios-participants.ts
 *
 * Lê todos os estágios com o Admin SDK (o mesmo usado pela API route)
 * e mostra: document ID, IDs dos participantes, empresa e anomalias.
 *
 * Opcional: passar um document ID como argumento para testar um específico:
 *   npx tsx scripts/check-estagios-participants.ts <estagioId>
 */

import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

// ── Carregar .env.local ────────────────────────────────────────────────
function loadEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("Ficheiro .env.local não encontrado em", envPath);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

// ── Admin SDK init ─────────────────────────────────────────────────────
function getAdminApp(env: Record<string, string>): App {
  if (getApps().length > 0) return getApps()[0]!;

  const rawJson = env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    const projectId = parsed.project_id ?? parsed.projectId;
    const clientEmail = parsed.client_email ?? parsed.clientEmail;
    const privateKey = (parsed.private_key ?? parsed.privateKey ?? "").replace(/\\n/g, "\n");
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = (env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// ── Listar utilizadores (para resolver nomes) ──────────────────────────
async function loadUsers(db: Firestore): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  const snap = await db.collection("users").get();
  snap.forEach((d) => map.set(d.id, d.data() as Record<string, unknown>));
  return map;
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  const env = loadEnv();
  const targetId = process.argv[2]?.trim();
  const app = getAdminApp(env);
  const db = getFirestore(app);

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  DIAGNÓSTICO — ESTÁGIOS (Admin SDK)");
  console.log("═══════════════════════════════════════════════════\n");

  // Carregar users para resolver nomes
  const users = await loadUsers(db);
  console.log(`Utilizadores carregados: ${users.size}\n`);

  // Query
  let estagiosSnap;
  if (targetId) {
    console.log(`🔍 A ler documento específico: estagios/${targetId}`);
    const docSnap = await db.collection("estagios").doc(targetId).get();
    if (!docSnap.exists) {
      console.log(`\n  ❌ DOCUMENTO NÃO ENCONTRADO: estagios/${targetId}\n`);
      console.log("  O Admin SDK NÃO consegue encontrar este documento.");
      console.log("  Possíveis causas:");
      console.log("    - O document ID está correto? Verifica no Firestore Console.");
      console.log("    - O Admin SDK aponta para o projeto certo? (ver .env.local)");
      console.log("    - A service account tem permissão de leitura?\n");
      process.exit(0);
    }
    estagiosSnap = [docSnap];
  } else {
    const all = await db.collection("estagios").get();
    estagiosSnap = all.docs;
    console.log(`Total de estágios: ${estagiosSnap.length}\n`);
  }

  let okCount = 0;
  let anomalyCount = 0;

  for (const doc of estagiosSnap) {
    const data = doc.data() as Record<string, unknown>;
    const docId = doc.id;

    console.log(`── Estágio: ${docId} ─${"─".repeat(Math.max(0, 50 - docId.length))}`);

    // Verificar se o documento tem um possível campo "id" que causaria o spread bug
    const hasIdField = "id" in data;
    if (hasIdField) {
      console.log(`  ⚠️  O documento TEM um campo "id" = ${JSON.stringify(data.id)}`);
      console.log(`      Isto SUBSTITUI o snap.id no { id: snap.id, ...data }!`);
      console.log(`      O fetch da API usaria "${data.id}" em vez de "${docId}"`);
    }

    // Participantes
    const alunoId = data.alunoId as string | undefined;
    const professorId = data.professorId as string | undefined;
    const tutorId = data.tutorId as string | undefined;

    console.log(`  Aluno:     ${alunoId ?? "❌ AUSENTE"}${alunoId ? `  → ${resolveName(users, alunoId)}` : ""}`);
    console.log(`  Professor: ${professorId ?? "❌ AUSENTE"}${professorId ? ` → ${resolveName(users, professorId)}` : ""}`);
    console.log(`  Tutor:     ${tutorId ?? "❌ AUSENTE"}${tutorId ? `  → ${resolveName(users, tutorId)}` : ""}`);

    // Empresa
    const empresa = (data.empresa as string) || (data.companyName as string) || (data.entidadeAcolhimento as string) || "";
    const empresaSnapshot = data.empresaSnapshot;
    console.log(`  Empresa:   ${empresa || "❌ AUSENTE"}`);
    console.log(`  empresaSnapshot: ${empresaSnapshot ? "✓ presente" : "❌ AUSENTE (usado na overview)"}`);

    // Datas / schedule
    const dataInicio = data.dataInicio as string | undefined;
    const dataFim = (data.dataFimEstimada as string) || (data.dataFim as string) || "";
    const horasDiarias = (data.horasDiarias as number) || (data.horasPorDia as number) || 0;
    const totalHoras = (data.totalHoras as number) || 0;
    console.log(`  Início:    ${dataInicio ?? "❌ AUSENTE"}`);
    console.log(`  Fim:       ${dataFim || "❌ AUSENTE"}`);
    console.log(`  Horas/dia: ${horasDiarias}`);
    console.log(`  Total:     ${totalHoras}h`);

    // School
    const schoolId = data.schoolId as string | undefined;
    console.log(`  School:    ${schoolId ?? "❌ AUSENTE"}`);

    // Estado
    const estado = (data.estadoEstagio as string) || (data.estado as string) || "";
    console.log(`  Estado:    ${estado || "❌ AUSENTE"}`);

    // Anomalias
    const anomalies: string[] = [];
    if (!alunoId) anomalies.push("alunoId em falta");
    if (!professorId) anomalies.push("professorId em falta");
    if (!dataInicio) anomalies.push("dataInicio em falta");
    if (!totalHoras) anomalies.push("totalHoras em falta");
    if (!horasDiarias) anomalies.push("horasDiarias/horasPorDia em falta");
    if (!empresa) anomalies.push("empresa/companyName em falta");
    if (!schoolId) anomalies.push("schoolId em falta");
    if (hasIdField) anomalies.push(`campo "id" presente (valor: ${JSON.stringify(data.id)})`);

    if (anomalies.length > 0) {
      anomalyCount++;
      for (const a of anomalies) {
        console.log(`  ⚠️  ${a}`);
      }
    } else {
      okCount++;
    }

    console.log();
  }

  // Sumário
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Documentos lidos: ${estagiosSnap.length}`);
  if (targetId) {
    console.log(`  Resultado: ${anomalyCount > 0 ? "COM anomalias" : "OK"}`);
  } else {
    console.log(`  OK: ${okCount}  |  Com anomalias: ${anomalyCount}`);
  }
  console.log("═══════════════════════════════════════════════════\n");

  if (anomalyCount > 0 && !targetId) {
    console.log("💡 Dica: Se algum estágio tiver o campo 'id' presente,");
    console.log("   o componente estagio-detail-view.tsx vai usar esse valor");
    console.log("   em vez do documentID para o fetch da API de participants.");
    console.log("   Isso causa o 404 que vês na consola.\n");
  }
}

function resolveName(users: Map<string, Record<string, unknown>>, uid: string): string {
  const u = users.get(uid);
  if (!u) return "(utilizador não encontrado)";
  return (u.nome as string) || (u.displayName as string) || (u.email as string) || uid;
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
