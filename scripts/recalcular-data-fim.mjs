/**
 * Recalcular dataFimEstimada based on actual presence hours.
 * Replicates the logic from `recalcular-data-fim/route.ts`.
 *
 * Usage:
 *   node scripts/recalcular-data-fim.mjs --estagio <id>   # dry-run
 *   node scripts/recalcular-data-fim.mjs --estagio <id> --apply
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createInterface } from "readline";

// ---------------------------------------------------------------------------
// Helpers (inlined)
// ---------------------------------------------------------------------------

const WEEKDAY_KEYS = ["dom","seg","ter","qua","qui","sex","sab"];

function pad(n) { return n.toString().padStart(2, "0"); }
function toIsoDate(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function parseIsoDate(iso) {
  if (!iso || typeof iso !== "string" || iso.length < 10) return null;
  const [y, m, d] = iso.split("-").map(s => Number.parseInt(s, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function getEasterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(base, days) { const d = new Date(base); d.setDate(d.getDate() + days); return d; }

function getPortugueseHolidays(yearStart, yearEnd) {
  const set = new Set();
  for (let year = yearStart; year <= yearEnd; year++) {
    set.add(`${year}-01-01`);
    set.add(`${year}-04-25`);
    set.add(`${year}-05-01`);
    set.add(`${year}-06-10`);
    set.add(`${year}-08-15`);
    set.add(`${year}-10-05`);
    set.add(`${year}-11-01`);
    set.add(`${year}-12-01`);
    set.add(`${year}-12-08`);
    set.add(`${year}-12-25`);
    const easter = getEasterSunday(year);
    set.add(toIsoDate(addDays(easter, -47)));
    set.add(toIsoDate(addDays(easter, -2)));
    set.add(toIsoDate(easter));
    set.add(toIsoDate(addDays(easter, 60)));
  }
  return set;
}

function normalizeDias(raw) {
  if (!raw) return {};
  if (typeof raw !== "object") return {};
  const out = {};
  if (Array.isArray(raw)) {
    for (const idx of raw) {
      if (typeof idx === "number" && idx >= 0 && idx <= 6) out[WEEKDAY_KEYS[idx]] = true;
    }
  } else {
    for (const k of WEEKDAY_KEYS) { if (raw[k] === true) out[k] = true; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------

function resolvePrivateKey(raw) {
  if (!raw) return undefined;
  return raw.replace(/\\n/g, "\n");
}

function getOrInitApp() {
  if (getApps().length > 0) return getApps()[0];
  const rawJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    return initializeApp({ credential: cert({ projectId: parsed.project_id ?? parsed.projectId, clientEmail: parsed.client_email ?? parsed.clientEmail, privateKey: resolvePrivateKey(parsed.private_key ?? parsed.privateKey) }) });
  }
  const pid = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const email = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const key = resolvePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  if (pid && email && key) return initializeApp({ credential: cert({ projectId: pid, clientEmail: email, privateKey: key }) });
  console.error("No Firebase Admin credentials found.");
  process.exit(1);
}

function ask(query) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans.trim().toLowerCase()); }));
}

// ---------------------------------------------------------------------------
// Recalculation logic (replicates recalcularDataFimEstimada from date-calc.ts)
// ---------------------------------------------------------------------------

function recalcularDataFimEstimada({ totalHoras, horasRealizadas, horasDiarias, diasSemana, startFrom }) {
  const horasRestantes = Math.max(0, (totalHoras || 0) - (horasRealizadas || 0));
  if (horasRestantes <= 0) return { dataFimEstimada: "", diasUteis: 0, horasPorDia: horasDiarias, totalHoras: totalHoras };

  const diasNecessarios = Math.ceil(horasRestantes / horasDiarias) + 1;
  const cursor = startFrom ? parseIsoDate(startFrom) : new Date();
  if (!cursor) return { dataFimEstimada: "", diasUteis: 0 };

  cursor.setDate(cursor.getDate() + 1);

  const holidays = getPortugueseHolidays(cursor.getFullYear(), cursor.getFullYear() + 10);
  let diasUteisRestantes = diasNecessarios;
  let safety = 0;
  const HARD_LIMIT = 3660;

  while (diasUteisRestantes > 0 && safety < HARD_LIMIT) {
    const iso = toIsoDate(cursor);
    const key = WEEKDAY_KEYS[cursor.getDay()];
    if (diasSemana[key] && !holidays.has(iso)) {
      diasUteisRestantes--;
    }
    if (diasUteisRestantes > 0) {
      cursor.setDate(cursor.getDate() + 1);
      safety++;
    }
  }

  if (safety >= HARD_LIMIT) return { dataFimEstimada: "", diasUteis: 0 };

  return { dataFimEstimada: toIsoDate(cursor), diasUteis: diasNecessarios, horasPorDia: horasDiarias, totalHoras: totalHoras };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--estagio");
  const estagioId = idx >= 0 ? args[idx + 1] : null;
  const isApply = args.includes("--apply");
  const dryRun = !isApply;
  return { estagioId, dryRun };
}

async function main() {
  const { estagioId, dryRun } = parseArgs();
  const log = dryRun ? "[DRY-RUN]" : "[LIVE]";

  if (!estagioId) {
    console.error("Usage: node scripts/recalcular-data-fim.mjs --estagio <id> [--apply]");
    process.exit(1);
  }

  getOrInitApp();
  const db = getFirestore();
  const estagioRef = db.collection("estagios").doc(estagioId);
  const estagioSnap = await estagioRef.get();

  if (!estagioSnap.exists) {
    console.error(`Estagio ${estagioId} not found.`);
    process.exit(1);
  }

  const estagioData = estagioSnap.data();
  const totalHoras = Number(estagioData.totalHoras ?? 0);
  const horasDiarias = Number(estagioData.horasDiarias ?? estagioData.horasPorDia ?? 0);
  const diasSemana = normalizeDias(estagioData.diasSemana);
  const anyWorkday = WEEKDAY_KEYS.some(k => diasSemana[k]);

  if (totalHoras <= 0 || horasDiarias <= 0 || !anyWorkday) {
    console.error(`${log} Invalid estagio data (totalHoras, horasDiarias, or diasSemana).`);
    process.exit(1);
  }

  // Read presences
  const presencasSnap = await estagioRef.collection("presencas").get();
  let horasRealizadas = 0;
  let ultimaPresenca = estagioData.dataInicio || "";
  presencasSnap.forEach(d => {
    const data = d.data();
    const hr = Number(data.hoursWorked ?? 0) || 0;
    horasRealizadas += hr;
    const dateIso = data.date || d.id;
    if (hr > 0 && dateIso > ultimaPresenca) ultimaPresenca = dateIso;
  });

  const currentDataFim = estagioData.dataFimEstimada || estagioData.dataFim || "";
  const horasRestantes = Math.max(0, totalHoras - horasRealizadas);

  console.log(`${log} Estagio: ${estagioId}`);
  console.log(`${log}   totalHoras: ${totalHoras}`);
  console.log(`${log}   horasRealizadas: ${horasRealizadas}`);
  console.log(`${log}   horasRestantes: ${horasRestantes}`);
  console.log(`${log}   horasDiarias: ${horasDiarias}`);
  console.log(`${log}   ultimaPresenca: ${ultimaPresenca}`);
  console.log(`${log}   currentDataFim: ${currentDataFim}`);

  // Compute new date
  const result = recalcularDataFimEstimada({ totalHoras, horasRealizadas, horasDiarias, diasSemana, startFrom: ultimaPresenca });
  let newDataFim = result.dataFimEstimada;

  // Fallback: if completely done, set to last presence
  if (!newDataFim && horasRealizadas >= totalHoras) {
    newDataFim = ultimaPresenca;
  }

  // Never reduce guard (same as route.ts)
  if (currentDataFim && newDataFim && newDataFim < currentDataFim && horasRealizadas < totalHoras) {
    console.log(`${log}   Guard: computed date (${newDataFim}) < current (${currentDataFim}) — keeping current.`);
    newDataFim = currentDataFim;
  }

  if (!newDataFim) {
    console.log(`${log}   Could not compute new dataFimEstimada.`);
    process.exit(0);
  }

  const changed = newDataFim !== currentDataFim;
  console.log(`${log}   computed dataFimEstimada: ${newDataFim}${changed ? ` (was ${currentDataFim})` : " (unchanged)"}`);

  if (!changed) {
    console.log(`${log} Nothing to change.`);
    process.exit(0);
  }

  if (dryRun) {
    console.log(`\n${log} Dry-run. Pass --apply to write: dataFimEstimada → ${newDataFim}`);
    process.exit(0);
  }

  const ans = await ask(`\nWrite dataFimEstimada ${currentDataFim} → ${newDataFim}? (y/N) `);
  if (ans !== "y" && ans !== "yes") {
    console.log(`${log} Aborted.`);
    process.exit(0);
  }

  await estagioRef.update({
    dataFimEstimada: newDataFim,
    horasRealizadas,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`${log} ✓ dataFimEstimada: ${currentDataFim} → ${newDataFim}`);
  console.log(`${log} Done.`);
}

main().catch(err => { console.error(err); process.exit(1); });
