/**
 * Teste de integração — João da Ega (19070@esrpeixoto.edu.pt)
 *
 * Faz fetch do Firestore, corre as funções puras, e compara.
 *
 * Uso:
 *   npx tsx scripts/test-estagio-joao.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getFirebaseAdminDb } from "../lib/firebase-admin";
import {
  recalcularDataFimEstimada,
  calcularDataFimComAusencias,
  calcularReplayAbsences,
  calcularReplayFormula,
  type DiasSemana,
  type ReplayRequest,
  type AusenciaRequest,
} from "../lib/estagios/date-calc";
import { getPortugueseHolidays } from "../lib/estagios/pt-holidays";

// ---------------------------------------------------------------------------
// Helpers de formatação
// ---------------------------------------------------------------------------
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const CHECK = "\u2713";
const CROSS = "\u2717";

function ok(v: boolean): string {
  return v ? `${GREEN}${CHECK}${RESET}` : `${RED}${CROSS}${RESET}`;
}

function padR(s: string, n: number): string {
  return s.padEnd(n);
}

function sep(title: string): void {
  console.log(`\n${CYAN}─── ${title} ${"─".repeat(60 - title.length)}${RESET}`);
}

function toIsoDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nthWorkdayAfter(startIso: string, n: number, ds: DiasSemana, holidays: Set<string>): string {
  const [y, m, d] = startIso.split("-").map(Number);
  const cursor = new Date(y, m - 1, d + 1);
  const keys = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
  let found = 0;
  for (let safety = 0; safety < 3660; safety++) {
    const iso = toIsoDate(cursor);
    const key = keys[cursor.getDay()];
    if (ds[key] && !holidays.has(iso)) {
      found++;
      if (found === n) return iso;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return "(not found)";
}

function sumHorasAte(presList: { date: string; hr: number }[], ate: string): number {
  let sum = 0;
  for (const p of presList) {
    if (p.date <= ate) sum += p.hr;
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  let allOk = true;
  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.log(`  ${RED}${CROSS} ${msg}${RESET}`);
      allOk = false;
    }
  };

  console.log(`\n${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║     TESTE INTEGRAÇÃO — João da Ega                    ║${RESET}`);
  console.log(`${BOLD}║     estagio: Bm5LVOUWMmR4husaeK5A                    ║${RESET}`);
  console.log(`${BOLD}║     aluno:   19070@esrpeixoto.edu.pt                 ║${RESET}`);
  console.log(`${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}`);

  const db = getFirebaseAdminDb();

  // ── 1. Buscar user ──────────────────────────────────────────────────
  const usersSnap = await db
    .collection("users")
    .where("email", "==", "19070@esrpeixoto.edu.pt")
    .get();
  if (usersSnap.empty) {
    console.error(`${RED}User not found.${RESET}`);
    process.exit(1);
  }
  const userDoc = usersSnap.docs[0];
  const alunoUid = userDoc.id;
  const alunoNome = userDoc.data().nome || "(sem nome)";

  // ── 2. Buscar estagio ────────────────────────────────────────────────
  const estagiosSnap = await db
    .collection("estagios")
    .where("alunoId", "==", alunoUid)
    .get();
  if (estagiosSnap.empty) {
    console.error(`${RED}Estagio not found.${RESET}`);
    process.exit(1);
  }
  const estagioDoc = estagiosSnap.docs[0];
  const estagioId = estagioDoc.id;
  const est = estagioDoc.data();

  const storedDataFim = (est.dataFimEstimada || est.dataFim || "") as string;
  const storedHorasRealizadas = (est.horasRealizadas ?? 0) as number;
  const storedAcc = (est.horasAusenciaAcumuladas ?? 0) as number;
  const totalHoras = (est.totalHoras ?? 0) as number;
  const horasDiarias = (est.horasDiarias ?? est.horasPorDia ?? 8) as number;
  const diasSemana = (est.diasSemana ?? { seg: true, ter: true, qua: true, qui: true, sex: true }) as DiasSemana;
  const dataInicio = (est.dataInicio ?? "") as string;
  const fixApplied = (est._partialAbsenceFixApplied ?? false) as boolean;

  // ── 3. Presences ─────────────────────────────────────────────────────
  const presencasSnap = await estagioDoc.ref.collection("presencas").get();
  let horasRealizadas = 0;
  let ultimaPresenca = dataInicio || "";
  const presList: { date: string; hr: number }[] = [];
  presencasSnap.forEach((d) => {
    const data = d.data();
    const hr = Number(data.hoursWorked ?? data.horas ?? 0) || 0;
    horasRealizadas += hr;
    const dateIso = (data.date as string) || d.id;
    if (hr > 0 && dateIso > ultimaPresenca) ultimaPresenca = dateIso;
    presList.push({ date: dateIso, hr });
  });
  presList.sort((a, b) => a.date.localeCompare(b.date));

  // ── 4. Schedule change requests ──────────────────────────────────────
  const scrSnap = await estagioDoc.ref.collection("schedule_change_requests").get();
  const requests: { type: string; absenceType: string | undefined; hoursAffected: number; targetDate: string; status: string }[] = [];
  scrSnap.forEach((d) => {
    const data = d.data();
    requests.push({
      type: (data.type ?? "") as string,
      absenceType: data.absenceType as string | undefined,
      hoursAffected: (data.hoursAffected ?? 0) as number,
      targetDate: (data.targetDate ?? d.id) as string,
      status: (data.status ?? "") as string,
    });
  });
  // sort by targetDate then type
  requests.sort((a, b) => a.targetDate.localeCompare(b.targetDate) || a.type.localeCompare(b.type));

  const approvedRequests = requests.filter((r) => r.status === "approved");

  // ── PRINT FIXTURE ─────────────────────────────────────────────────────
  sep("Fixture (Firestore)");
  console.log(`  ${padR("alunoNome:", 28)} ${alunoNome}`);
  console.log(`  ${padR("estagioId:", 28)} ${estagioId}`);
  console.log(`  ${padR("totalHoras:", 28)} ${totalHoras}`);
  console.log(`  ${padR("horasDiarias:", 28)} ${horasDiarias}`);
  console.log(`  ${padR("diasSemana:", 28)} ${WEEKDAY_KEYS(diasSemana)}`);
  console.log(`  ${padR("dataInicio:", 28)} ${dataInicio}`);
  console.log(`  ${padR("dataFimEstimada (stored):", 28)} ${storedDataFim}`);
  console.log(`  ${padR("horasRealizadas (stored):", 28)} ${storedHorasRealizadas}`);
  console.log(`  ${padR("horasAusenciaAcum (stored):", 28)} ${storedAcc}`);
  console.log(`  ${padR("_partialAbsenceFixApplied:", 28)} ${fixApplied}`);

  sep("Presences");
  console.log(`  ${padR("total registos:", 28)} ${presList.length}`);
  console.log(`  ${padR("sum hoursWorked:", 28)} ${horasRealizadas}`);
  console.log(`  ${padR("ultimaPresenca:", 28)} ${ultimaPresenca}`);
  if (presList.length <= 10) {
    for (const p of presList) {
      console.log(`    ${p.date}  ${p.hr}h`);
    }
  } else {
    for (const p of presList.slice(0, 5)) {
      console.log(`    ${p.date}  ${p.hr}h`);
    }
    console.log(`    ... (${presList.length - 5} more)`);
    for (const p of presList.slice(-3)) {
      console.log(`    ${p.date}  ${p.hr}h`);
    }
  }

  sep("Schedule Change Requests");
  console.log(`  ${padR("total (approved):", 28)} ${approvedRequests.length}/${requests.length}`);
  console.log(`  ${padR("(all requests):", 28)} ${requests.length}`);
  for (let i = 0; i < approvedRequests.length; i++) {
    const r = approvedRequests[i];
    const partialTag = r.absenceType === "partial" ? ` (partial, ${r.hoursAffected}h)` : " (full-day)";
    console.log(`  ${(i + 1).toString().padStart(2)}. ${r.targetDate}  ${padR(r.type, 30)} ${padR(r.status, 12)} ${partialTag}`);
  }

  // ── TEST: recalcularDataFimEstimada (raw, sem ausências) ────────────────
  sep("recalcularDataFimEstimada (raw)");
  const rawResult = recalcularDataFimEstimada({
    totalHoras,
    horasRealizadas,
    horasDiarias,
    diasSemana,
    startFrom: ultimaPresenca,
  });
  console.log(`  ${padR("params:", 28)} total=${totalHoras}, realizadas=${horasRealizadas}, hpd=${horasDiarias}, startFrom=${ultimaPresenca}`);
  console.log(`  ${padR("raw computed:", 28)} ${rawResult.dataFimEstimada}`);
  console.log(`  ${padR("raw diasUteis:", 28)} ${rawResult.diasUteis}`);

  // Invariant (recalcular com +1 buffer): último dia útil real = diasUteis-1
  const horasRestantes = Math.max(0, totalHoras - horasRealizadas);
  const diasReais = rawResult.diasUteis - 1;
  const horasUltimoDia = horasRestantes - (diasReais - 1) * horasDiarias;
  const invOk = horasUltimoDia > 0 && horasUltimoDia <= horasDiarias;
  console.log(`  ${padR("invariant (horas_ultimo ≤ hpd):", 28)} diasReais=${diasReais}  horasUltimoDia=${horasUltimoDia}  hpd=${horasDiarias}  ${ok(invOk)}`);
  assert(invOk, `horasUltimoDia (${horasUltimoDia}) should be between 1 and horasDiarias (${horasDiarias})`);

  // ── Último dia útil real ──────────────────────────────────────────────
  sep("Último dia útil real (sem buffer +1)");
  const holidaysSet = getPortugueseHolidays(2026, 2026);
  const ultimoDiaReal = nthWorkdayAfter(ultimaPresenca, diasReais, diasSemana, holidaysSet);
  const horasAcumReais = horasRealizadas + (diasReais - 1) * horasDiarias;
  const horasTotalAposUltimo = horasAcumReais + horasUltimoDia;
  console.log(`  ${padR("ultimaPresenca:", 28)} ${ultimaPresenca}`);
   console.log(`  ${padR("dias úteis reais:", 28)} ${diasReais} (de ${rawResult.diasUteis} com +1 buffer)`);
  console.log(`  ${padR("data último dia real:", 28)} ${ultimoDiaReal}`);
  console.log(`  ${padR("horas nesse dia:", 28)} ${horasUltimoDia}h`);
  const horasInicioUltimoDia = horasRealizadas + (diasReais - 1) * horasDiarias;
  const horasFimUltimoDia = horasInicioUltimoDia + horasUltimoDia;
  console.log(`  ${padR("dias anteriores (8h cada):", 28)} ${diasReais - 1} × ${horasDiarias}h = ${(diasReais - 1) * horasDiarias}h`);
  console.log(`  ${padR("já realizadas (presences):", 28)} ${horasRealizadas}h`);
  console.log(`  ${padR("horas acum. início último dia:", 28)} ${horasRealizadas}h + ${(diasReais - 1) * horasDiarias}h = ${horasInicioUltimoDia}h`);
  console.log(`  ${padR("horas acum. fim último dia:", 28)} ${horasInicioUltimoDia}h + ${horasUltimoDia}h = ${horasFimUltimoDia}h`);
  console.log(`  ${padR("completa totalHoras?", 28)} ${horasFimUltimoDia === totalHoras ? `${GREEN}yes${RESET}` : `${RED}não (${horasFimUltimoDia} !== ${totalHoras})${RESET}`}`);
  console.log(`  ${padR("dataFimEstimada (com buffer):", 28)} ${rawResult.dataFimEstimada} (dia de buffer)`);

  // ── Projeção real (com ausências) via app lib ──────────────────────────
  sep("calcularDataFimComAusencias (app lib)");
  const ausenciaRequests: AusenciaRequest[] = approvedRequests.map((r) => ({
    targetDate: r.targetDate,
    absenceType: r.absenceType,
    hoursAffected: r.hoursAffected,
  }));
  const ausenciasResult = calcularDataFimComAusencias({
    totalHoras,
    horasRealizadas,
    horasDiarias,
    diasSemana,
    startFrom: ultimaPresenca,
    requests: ausenciaRequests,
  });
  console.log(`  ${padR("ultimaPresenca:", 28)} ${ultimaPresenca}`);
  console.log(`  ${padR("dias úteis percorridos:", 28)} ${ausenciasResult.diasUteis}`);
  console.log(`  ${padR("data último dia real:", 28)} ${ausenciasResult.dataFim}`);
  console.log(`  ${padR("stored dataFim:", 28)} ${storedDataFim}`);
  const match1 = ausenciasResult.dataFim === storedDataFim;
  console.log(`  ${padR("result:", 28)} ${ok(match1)} ${match1 ? "MATCH" : `MISMATCH (ausencias ${ausenciasResult.dataFim} !== stored ${storedDataFim})`}`);
  assert(match1, `calcularDataFimComAusencias result (${ausenciasResult.dataFim}) should match stored dataFimEstimada (${storedDataFim})`);
  console.log(`  ${padR("horas acum. início último dia:", 28)} ${ausenciasResult.horasAcumInicio}h`);
  console.log(`  ${padR("horas acum. fim último dia:", 28)} ${ausenciasResult.horasAcumFim}h`);
  const projCompleta = ausenciasResult.horasAcumFim >= totalHoras;
  console.log(`  ${padR("completa totalHoras?", 28)} ${projCompleta ? `${GREEN}yes${RESET}` : `${RED}não${RESET}`}`);
  if (ausenciasResult.diasUteis > 0) {
    const diff = rawResult.dataFimEstimada > ausenciasResult.dataFim
      ? `${ausenciasResult.dataFim} → ${rawResult.dataFimEstimada} (raw ${Math.round((new Date(rawResult.dataFimEstimada).getTime() - new Date(ausenciasResult.dataFim).getTime()) / 86400000)}d depois)`
      : `${ausenciasResult.dataFim} (mesmo ou igual)`;
    console.log(`  ${padR("raw vs ausencias diff:", 28)} ${diff}`);
  }

  // ── TEST: calcularReplayAbsences ──────────────────────────────────────
  sep("calcularReplayAbsences");
  const ORIGINAL_PRE_ACC = 7;
  const replayRequests: ReplayRequest[] = approvedRequests.map((r) => ({
    absenceType: r.absenceType,
    hoursAffected: r.hoursAffected,
  }));
  const replayResult = calcularReplayAbsences(ORIGINAL_PRE_ACC, replayRequests, horasDiarias);
  console.log(`  ${padR("preAcc (original):", 28)} ${ORIGINAL_PRE_ACC}`);
  console.log(`  ${padR("hpd:", 28)} ${horasDiarias}`);
  console.log(`  ${padR("total requests:", 28)} ${replayRequests.length}`);
  console.log(`  ${padR("oldPushes:", 28)} ${replayResult.oldPushes}`);
  console.log(`  ${padR("newPushes:", 28)} ${replayResult.newPushes}`);
  console.log(`  ${padR("excessPushes:", 28)} ${replayResult.excessPushes}`);
  console.log(`  ${padR("correctAcc:", 28)} ${replayResult.correctAcc}`);
  console.log(`  ${padR("oldAcc:", 28)} ${replayResult.oldAcc}`);
  console.log(`  ${padR("newAcc:", 28)} ${replayResult.newAcc}`);
  console.log(`  ${padR("stored acc:", 28)} ${storedAcc}`);
  const match2 = replayResult.correctAcc === storedAcc;
  console.log(`  ${padR("result:", 28)} ${ok(match2)} ${match2 ? `MATCH (correctAcc ${replayResult.correctAcc} === stored ${storedAcc})` : `MISMATCH (correctAcc ${replayResult.correctAcc} !== stored ${storedAcc})`}`);
  assert(match2, `correctAcc (${replayResult.correctAcc}) should match stored horasAusenciaAcumuladas (${storedAcc})`);

  // ── Cross-check: formula fechada ──────────────────────────────────────
  sep("Fórmula fechada (cross-check)");
  const formulaResult = calcularReplayFormula(ORIGINAL_PRE_ACC, replayRequests, horasDiarias);
  console.log(`  ${padR("excessPushes (formula):", 28)} ${formulaResult.excessPushes}`);
  console.log(`  ${padR("correctAcc (formula):", 28)} ${formulaResult.correctAcc}`);
  const x1 = formulaResult.excessPushes === replayResult.excessPushes;
  const x2 = formulaResult.correctAcc === replayResult.correctAcc;
  console.log(`  ${padR("excessPushes match:", 28)} ${ok(x1)}${x1 ? "" : ` formula=${formulaResult.excessPushes} loop=${replayResult.excessPushes}`}`);
  console.log(`  ${padR("correctAcc match:", 28)} ${ok(x2)}${x2 ? "" : ` formula=${formulaResult.correctAcc} loop=${replayResult.correctAcc}`}`);
  assert(x1, `excessPushes formula (${formulaResult.excessPushes}) === loop (${replayResult.excessPushes})`);
  assert(x2, `correctAcc formula (${formulaResult.correctAcc}) === loop (${replayResult.correctAcc})`);

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`\n${BOLD}════════════════════════════════════════════════════════════${RESET}`);
  if (allOk) {
    console.log(`${GREEN}${BOLD}  ${CHECK} All assertions passed.${RESET}`);
  } else {
    console.log(`${RED}${BOLD}  ${CROSS} Some assertions failed.${RESET}`);
  }
  console.log(`${BOLD}════════════════════════════════════════════════════════════${RESET}\n`);

  process.exit(allOk ? 0 : 1);
}

function WEEKDAY_KEYS(ds: DiasSemana): string {
  const names: (keyof DiasSemana)[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
  return names.filter((k) => ds[k]).join(",");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
