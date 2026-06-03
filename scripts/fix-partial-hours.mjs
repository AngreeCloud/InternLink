/**
 * Fix dataFimEstimada and horasAusenciaAcumuladas for estagios where
 * partial absences (absenceType="partial") were processed with full-day
 * hours (horasPorDia) due to the Number.isFinite bug.
 *
 * Replays the approval logic using actual hoursAffected to determine
 * the correct accumulated hours and end date.
 *
 * Safeguards:
 *   - Only writes if computed differs from stored
 *   - Never increases dataFimEstimada
 *   - Validates all inputs before computation
 *   - Requires explicit --apply to write
 *   - Range-checks accumulated hours
 *   - Limits pull-back to 5 days maximum
 *   - Logs every diff
 *
 * Usage:
 *   node scripts/fix-partial-hours.mjs --estagio <id>         # dry-run (default)
 *   node scripts/fix-partial-hours.mjs --estagio <id> --apply  # write after confirm
 *   DRY_RUN=1 node scripts/fix-partial-hours.mjs --estagio <id>
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createInterface } from "readline";

// ---------------------------------------------------------------------------
// Helpers (inlined from pt-holidays.ts + workdays.ts for ESM compatibility)
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

/**
 * Convert raw diasSemana (map or array) to a map like {seg:true, ter:true}.
 */
function normalizeDias(raw) {
  if (!raw) return {};
  if (typeof raw !== "object") return {};
  const out = {};
  if (Array.isArray(raw)) {
    // number[] like [1,2,3,4,5]
    for (const idx of raw) {
      if (typeof idx === "number" && idx >= 0 && idx <= 6) {
        out[WEEKDAY_KEYS[idx]] = true;
      }
    }
  } else {
    // Record<string, boolean>
    for (const k of WEEKDAY_KEYS) {
      if (raw[k] === true) out[k] = true;
    }
  }
  return out;
}

/**
 * Returns true if a given ISO date is a workday (active per diasSemana, not a holiday).
 */
function isWorkday(iso, diasSemana, holidays) {
  const d = parseIsoDate(iso);
  if (!d) return false;
  const key = WEEKDAY_KEYS[d.getDay()];
  if (!diasSemana[key]) return false;
  if (holidays.has(iso)) return false;
  return true;
}

/**
 * Go N workdays backward from currentEnd using diasSemana and holidays.
 * Returns null if no valid date found within 2-year safety window.
 */
function calcPrevEndDate(currentEnd, count, diasSemana, holidays) {
  if (!currentEnd || count <= 0) return currentEnd;
  const date = parseIsoDate(currentEnd);
  if (!date) return null;
  let remaining = count;
  let safety = 0;
  while (remaining > 0 && safety < 730) {
    date.setDate(date.getDate() - 1);
    safety++;
    const iso = toIsoDate(date);
    if (isWorkday(iso, diasSemana, holidays)) {
      remaining--;
    }
  }
  if (remaining > 0) return null; // couldn't find enough workdays
  return toIsoDate(date);
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
    return initializeApp({
      credential: cert({
        projectId: parsed.project_id ?? parsed.projectId,
        clientEmail: parsed.client_email ?? parsed.clientEmail,
        privateKey: resolvePrivateKey(parsed.private_key ?? parsed.privateKey),
      }),
    });
  }
  const pid = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const email = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const key = resolvePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  if (pid && email && key) return initializeApp({ credential: cert({ projectId: pid, clientEmail: email, privateKey: key }) });
  console.error("No Firebase Admin credentials found.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function ask(query) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans.trim().toLowerCase()); }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--estagio");
  const estagioId = idx >= 0 ? args[idx + 1] : null;
  const isApply = args.includes("--apply");
  const isDryRunVal = args.includes("--dry-run");
  const envDryRun = process.env.DRY_RUN === "1";
  const dryRun = isDryRunVal || envDryRun || !isApply;
  return { estagioId, dryRun };
}

async function main() {
  const { estagioId, dryRun } = parseArgs();

  if (!estagioId) {
    console.error("Usage: node scripts/fix-partial-hours.mjs --estagio <id> [--apply]");
    console.error("  --estagio <id>   Estagio document ID (required)");
    console.error("  --apply          Write changes to Firestore (default: dry-run)");
    process.exit(1);
  }

  const log = dryRun ? "[DRY-RUN]" : "[LIVE]";

  getOrInitApp();
  const db = getFirestore();

  // -----------------------------------------------------------------------
  // 1. Read estagio
  // -----------------------------------------------------------------------
  const estagioRef = db.collection("estagios").doc(estagioId);
  const estagioSnap = await estagioRef.get();
  if (!estagioSnap.exists) {
    console.error(`Estagio ${estagioId} not found.`);
    process.exit(1);
  }

  const estagioData = estagioSnap.data();
  const stAcc = Number(estagioData.horasAusenciaAcumuladas ?? 0);
  const stEnd = (estagioData.dataFimEstimada || estagioData.dataFim || "");
  const hpd = Number(estagioData.horasPorDia || estagioData.horasDiarias || 0);
  const diasRaw = estagioData.diasSemana;
  const diasMap = normalizeDias(diasRaw);
  const anyWorkday = WEEKDAY_KEYS.some(k => diasMap[k]);

  // Safeguard: validate inputs
  const errors = [];
  if (!hpd || hpd <= 0) errors.push("horasPorDia missing or <= 0");
  if (!anyWorkday) errors.push("diasSemana has no active workdays");
  if (!stEnd || stEnd.length < 10) errors.push("dataFimEstimada missing");
  if (stAcc < 0 || stAcc > 100) errors.push(`horasAusenciaAcumuladas ${stAcc} out of range [0,100]`);

  if (errors.length > 0) {
    console.error(`${log} Validation failed for estagio ${estagioId}:`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }

  const fixAlreadyApplied = estagioData._partialAbsenceFixApplied === true;

  console.log(`${log} Estagio: ${estagioId}`);
  console.log(`${log}   horasPorDia: ${hpd}`);
  console.log(`${log}   stored dataFimEstimada: ${stEnd}`);
  console.log(`${log}   stored horasAusenciaAcumuladas: ${stAcc}`);
  console.log(`${log}   _partialAbsenceFixApplied: ${fixAlreadyApplied}`);

  // -----------------------------------------------------------------------
  // 2. Fetch approved future_absence requests
  // -----------------------------------------------------------------------
  const snap = await estagioRef
    .collection("schedule_change_requests")
    .where("type", "==", "future_absence")
    .where("status", "==", "approved")
    .get();

  const requests = [];
  snap.forEach(doc => requests.push({ id: doc.id, data: doc.data() }));
  requests.sort((a, b) => (a.data.targetDate || "").localeCompare(b.data.targetDate || ""));

  if (requests.length === 0) {
    console.log(`${log} No approved future_absence requests found. Nothing to do.`);
    process.exit(0);
  }

  console.log(`${log} Approved future_absence requests: ${requests.length}`);

  // -----------------------------------------------------------------------
  // 3. Compute old vs new totals
  // -----------------------------------------------------------------------
  let newTotal = 0;
  let partialCount = 0;
  let nonPartialCount = 0;
  for (const { id, data } of requests) {
    const ah = Number(data.hoursAffected ?? 0);
    const hasPartial = data.absenceType === "partial";
    // Old code: hoursAffected=0 (or <= 0) → used horasPorDia
    // New code: hoursAffected > 0 → use hoursAffected
    const added = (hasPartial && ah > 0) ? ah : hpd;
    newTotal += added;

    if (hasPartial && ah > 0) {
      partialCount++;
      console.log(`${log}   ${id}: target=${data.targetDate} type=partial hoursAffected=${ah}h (fixed: yes)`);
    } else {
      nonPartialCount++;
      console.log(`${log}   ${id}: target=${data.targetDate} type=${data.absenceType || "?"} hoursAffected=${ah}h (full day)`);
    }
  }

  const oldTotal = requests.length * hpd;
  const diff = oldTotal - newTotal;

  if (diff === 0 && !fixAlreadyApplied) {
    console.log(`${log} No difference between old and new totals. Nothing to correct.`);
    process.exit(0);
  }

  // Safeguard: if newTotal > oldTotal, something is wrong
  if (diff < 0) {
    console.error(`${log} ERROR: new total (${newTotal}h) > old total (${oldTotal}h) — cannot increase. Aborting.`);
    process.exit(1);
  }

  // -----------------------------------------------------------------------
  // 4. Compute excess pushes and correct accumulated
  // -----------------------------------------------------------------------
  // Formula (works with any pre-existing accumulated carry-over):
  //   excessPushes = floor((stAcc + oldTotal) / hpd) - floor((stAcc + newTotal) / hpd)
  //   correctAcc   = (stAcc + newTotal) % hpd
  const oldPushes = Math.floor((stAcc + oldTotal) / hpd);
  const newPushes = Math.floor((stAcc + newTotal) / hpd);
  const excessPushes = oldPushes - newPushes;
  const correctAcc = (stAcc + newTotal) % hpd;

  // Safeguard: excessPushes must be >= 0
  if (excessPushes < 0) {
    console.error(`${log} ERROR: negative excess pushes (${excessPushes}). Aborting.`);
    process.exit(1);
  }

  // Safeguard: at most 1 push per request
  if (excessPushes > requests.length) {
    console.error(`${log} ERROR: excess pushes (${excessPushes}) > requests (${requests.length}). Aborting.`);
    process.exit(1);
  }

  // Safeguard: at most 5 days pull-back
  if (excessPushes > 5) {
    console.error(`${log} ERROR: would pull back ${excessPushes} days (>5 limit). Aborting.`);
    process.exit(1);
  }

  // Safeguard: correct acc must be 0 <= acc < hpd
  if (correctAcc < 0 || correctAcc >= hpd) {
    console.error(`${log} ERROR: computed correct accumulated ${correctAcc} out of range [0, ${hpd}). Aborting.`);
    process.exit(1);
  }

  console.log(`${log}   old total hours per req: ${oldTotal}h (${requests.length} × ${hpd}h)`);
  console.log(`${log}   new total hours per req: ${newTotal}h`);
  console.log(`${log}   old pushes: ${oldPushes}, new pushes: ${newPushes}`);
  console.log(`${log}   excess pushes: ${excessPushes}`);
  console.log(`${log}   correct horasAusenciaAcumuladas: ${correctAcc}`);

  // -----------------------------------------------------------------------
  // 5. Determine what needs fixing
  // -----------------------------------------------------------------------
  const accNeedsFix = correctAcc !== stAcc;

  if (fixAlreadyApplied) {
    if (!accNeedsFix) {
      console.log(`${log} Fix already applied and accumulated is correct. Nothing to do.`);
      process.exit(0);
    }
    // acc-only fix: the end date was already corrected, just accumulated is stale
    console.log(`${log} Fix was applied but horasAusenciaAcumuladas is stale (${stAcc} → ${correctAcc}).`);
    console.log(`${log} Applying acc-only correction (end date already fixed).`);
  }

  if (!fixAlreadyApplied) {
    // Full fix: also compute new end date
    // -----------------------------------------------------------------------
    // 5b. Compute new end date
    // -----------------------------------------------------------------------
    const holidays = getPortugueseHolidays(
      parseIsoDate(stEnd).getFullYear() - 1,
      parseIsoDate(stEnd).getFullYear() + 1
    );

    let newEnd = stEnd;
    if (excessPushes > 0) {
      newEnd = calcPrevEndDate(stEnd, excessPushes, diasMap, holidays);
      if (!newEnd) {
        console.error(`${log} ERROR: could not compute previous workday for ${stEnd} (${excessPushes} day(s) back). Aborting.`);
        process.exit(1);
      }
    }

    // Safeguard: never increase end date
    if (newEnd > stEnd) {
      console.error(`${log} ERROR: new dataFimEstimada (${newEnd}) > stored (${stEnd}). Aborting.`);
      process.exit(1);
    }

    // Safeguard: if not pulling back enough — warn but continue
    if (newEnd === stEnd && excessPushes > 0) {
      console.error(`${log} ERROR: could not pull back (same date). Aborting.`);
      process.exit(1);
    }

    console.log(`${log}   new dataFimEstimada: ${newEnd}${newEnd !== stEnd ? ` (was ${stEnd})` : " (unchanged)"}`);

    // -----------------------------------------------------------------------
    // 6. Compare — skip if unchanged
    // -----------------------------------------------------------------------
    const endChanged = newEnd !== stEnd;

    if (!endChanged && !accNeedsFix) {
      console.log(`${log} Nothing to change — computed values match stored.`);
      process.exit(0);
    }

    console.log(`\n${log} === CHANGES TO APPLY ===`);
    if (endChanged) console.log(`${log}   dataFimEstimada:           ${stEnd} → ${newEnd}`);
    if (accNeedsFix) console.log(`${log}   horasAusenciaAcumuladas:   ${stAcc} → ${correctAcc}`);

    if (dryRun) {
      console.log(`\n${log} Dry-run mode. Pass --apply to write changes.`);
      console.log(`${log} Set DRY_RUN=0 to force apply.`);
      process.exit(0);
    }

    // -----------------------------------------------------------------------
    // 7. Confirm and write
    // -----------------------------------------------------------------------
    const ans = await ask(`\nWrite these changes to Firestore? (y/N) `);
    if (ans !== "y" && ans !== "yes") {
      console.log(`${log} Aborted by user.`);
      process.exit(0);
    }

    const batch = db.batch();
    if (endChanged) batch.update(estagioRef, { dataFimEstimada: newEnd });
    if (accNeedsFix) batch.update(estagioRef, { horasAusenciaAcumuladas: correctAcc });
    batch.update(estagioRef, {
      updatedAt: new Date().toISOString(),
      _partialAbsenceFixApplied: true,
    });

    await batch.commit();

    console.log(`${log} ✓ Written:`);
    if (endChanged) console.log(`${log}   dataFimEstimada: ${stEnd} → ${newEnd}`);
    if (accNeedsFix) console.log(`${log}   horasAusenciaAcumuladas: ${stAcc} → ${correctAcc}`);
    console.log(`${log} Done.`);
    return;
  }

  // ── acc-only fix (fix already applied, just accumulated is stale) ──
  if (!accNeedsFix) {
    console.log(`${log} Nothing to change — accumulated matches stored.`);
    process.exit(0);
  }

  console.log(`\n${log} === CHANGES TO APPLY (acc only) ===`);
  console.log(`${log}   horasAusenciaAcumuladas:   ${stAcc} → ${correctAcc}`);

  if (dryRun) {
    console.log(`\n${log} Dry-run mode. Pass --apply to write changes.`);
    process.exit(0);
  }

  const ans2 = await ask(`\nWrite acc correction to Firestore? (y/N) `);
  if (ans2 !== "y" && ans2 !== "yes") {
    console.log(`${log} Aborted by user.`);
    process.exit(0);
  }

  await estagioRef.update({
    horasAusenciaAcumuladas: correctAcc,
    updatedAt: new Date().toISOString(),
  });

  console.log(`${log} ✓ Acc corrected: ${stAcc} → ${correctAcc}`);
  console.log(`${log} Done.`);
}

main().catch(err => { console.error(err); process.exit(1); });
