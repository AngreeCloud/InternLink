/**
 * seed-mock-audit.js
 *
 * Cria 20 registos de auditoria em schools/{schoolId}/auditLogs/
 * Executar APOS seed-mock-data.js.
 *
 * Uso: node scripts/seed-mock-audit.js
 */

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

const UIDS = {
  admin: "admin-esrp",
  prof: "prof-eca",
  tutor: "tutor-ega",
  aluno: "aluno-carlos",
};

const ESTAGIO_ID = "estagio-carlos";
const EMPRESA_ID = "ramada-associados";
const CURSO_ID = "curso-turismo";

function buildCredential() {
  const rawJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      return admin.credential.cert({
        projectId: parsed.project_id ?? parsed.projectId,
        clientEmail: parsed.client_email ?? parsed.clientEmail,
        privateKey: (parsed.private_key ?? parsed.privateKey).replace(/\\n/g, "\n"),
      });
    } catch { /* fallback */ }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }
  return admin.credential.applicationDefault();
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: buildCredential() });
}

const db = admin.firestore();
const TS = admin.firestore.FieldValue.serverTimestamp;

const ENTRIES = [
  // ── Escola ────────────────────────────────
  { action: "create", entityType: "school", entityId: "uporto", entityLabel: "Universidade do Porto", changedBy: "super_admin", summary: "Escola criada por super admin", metadata: { educationLevel: "Ensino Superior (Universitário)" } },
  { action: "update_settings", entityType: "school", entityId: "uporto", entityLabel: "Universidade do Porto", changedBy: UIDS.admin, summary: "Domínio de email alterado para @up.pt", metadata: { field: "emailDomain", old: "@esrp.pt", new: "@up.pt" } },

  // ── Curso ─────────────────────────────────
  { action: "create", entityType: "course", entityId: CURSO_ID, entityLabel: "Técnico de Turismo", changedBy: UIDS.admin, summary: "Curso criado por admin escolar", metadata: { courseDirectorId: UIDS.prof } },
  { action: "update", entityType: "course", entityId: CURSO_ID, entityLabel: "Técnico de Turismo", changedBy: UIDS.admin, summary: "TeacherIds atualizado: Eça de Queirós adicionado", metadata: { teacherIds: [UIDS.prof] } },

  // ── Empresa ───────────────────────────────
  { action: "create", entityType: "empresa", entityId: EMPRESA_ID, entityLabel: "Ramada & Associados", changedBy: UIDS.prof, summary: "Empresa criada pelo professor Eça de Queirós", metadata: { nif: "500123456", setor: "Turismo e Hotelaria" } },
  { action: "update", entityType: "empresa", entityId: EMPRESA_ID, entityLabel: "Ramada & Associados", changedBy: UIDS.admin, summary: "Professor Eça de Queirós recebeu permissão de escrita", metadata: { grantAdded: UIDS.prof, grantType: "write" } },
  { action: "associate", entityType: "empresa", entityId: EMPRESA_ID, entityLabel: "Ramada & Associados", changedBy: UIDS.admin, summary: "Tutor João da Ega associado à empresa", metadata: { tutorId: UIDS.tutor } },

  // ── Utilizadores ──────────────────────────
  { action: "create", entityType: "user", entityId: UIDS.aluno, entityLabel: "Carlos da Maia", changedBy: UIDS.admin, summary: "Conta de aluno aprovada por admin escolar", metadata: { role: "aluno", estado: "ativo" } },
  { action: "create", entityType: "user", entityId: UIDS.tutor, entityLabel: "João da Ega", changedBy: UIDS.prof, summary: "Conta de tutor criada por professor", metadata: { role: "tutor", empresa: "Ramada & Associados" } },

  // ── Estágio ───────────────────────────────
  { action: "create", entityType: "estagio", entityId: ESTAGIO_ID, entityLabel: "Estágio Carlos da Maia — Ramada & Associados", changedBy: UIDS.prof, summary: "Estágio criado por Eça de Queirós", metadata: { aluno: "Carlos da Maia", tutor: "João da Ega", totalHoras: 400, horasDiarias: 8 } },
  { action: "status_change", entityType: "estagio", entityId: ESTAGIO_ID, entityLabel: "Estágio Carlos da Maia — Ramada & Associados", changedBy: UIDS.prof, summary: "Estado alterado: pendente → ativo", metadata: { from: "pendente", to: "ativo" } },
  { action: "update", entityType: "estagio", entityId: ESTAGIO_ID, entityLabel: "Estágio Carlos da Maia — Ramada & Associados", changedBy: UIDS.prof, summary: "Horário do estágio atualizado", metadata: { dataInicio: "2026-01-05", diasSemana: ["seg", "ter", "qua", "qui", "sex"] } },
  { action: "approve", entityType: "schedule_change_request", entityId: "future-absence-1", entityLabel: "Falta futura: 2026-03-20", changedBy: UIDS.prof, summary: "Professor aprovou pedido de falta futura", metadata: { targetDate: "2026-03-20", type: "future_absence" } },
  { action: "approve", entityType: "schedule_change_request", entityId: "future-absence-1", entityLabel: "Falta futura: 2026-03-20", changedBy: UIDS.tutor, summary: "Tutor aprovou pedido de falta futura", metadata: { targetDate: "2026-03-20", type: "future_absence" } },

  // ── Avaliações ────────────────────────────
  { action: "sign_avaliacao", entityType: "avaliacao", entityId: `${ESTAGIO_ID}/tutor`, entityLabel: "Avaliação do tutor", changedBy: UIDS.tutor, summary: "Tutor João da Ega assinou avaliação do formando", metadata: { parametros: { pontualidade: 4, iniciativa: 3, qualidade: 4 } } },
  { action: "sign_avaliacao", entityType: "avaliacao", entityId: `${ESTAGIO_ID}/professor`, entityLabel: "Avaliação do professor", changedBy: UIDS.prof, summary: "Professor Eça de Queirós atribuiu nota final", metadata: { notaFinal: 16, metodologia: "media" } },

  // ── Documentos ────────────────────────────
  { action: "create", entityType: "estagio", entityId: ESTAGIO_ID, entityLabel: "Plano de Trabalho (EA-IM-57)", changedBy: UIDS.prof, summary: "Documento carregado: Plano de Trabalho", metadata: { templateCode: "EA-IM-57", categoria: "Planos" } },
  { action: "approve", entityType: "estagio", entityId: ESTAGIO_ID, entityLabel: "Plano de Trabalho (EA-IM-57)", changedBy: UIDS.aluno, summary: "Aluno assinou Plano de Trabalho", metadata: { docId: "ea-im-57", templateCode: "EA-IM-57" } },

  // ── Diversos ──────────────────────────────
  { action: "delete_request", entityType: "estagio", entityId: ESTAGIO_ID, entityLabel: "Estágio Carlos da Maia", changedBy: UIDS.prof, summary: "Pedido de eliminação do estágio submetido", metadata: { motivo: "Aluno transferiu de curso" } },
  { action: "delete_rejected", entityType: "estagio", entityId: ESTAGIO_ID, entityLabel: "Estágio Carlos da Maia", changedBy: UIDS.admin, summary: "Admin rejeitou pedido de eliminação", metadata: { motivoRejeicao: "Estágio já em curso avançado" } },
];

async function run() {
  console.log("\n═══════════════════════════════════════");
  console.log("  Seed Mock Data — Audit Logs");
  console.log("═══════════════════════════════════════\n");

  const col = db.collection("schools").doc("uporto").collection("auditLogs");
  let i = 0;
  for (const e of ENTRIES) {
    const data = {
      schoolId: "uporto",
      entityType: e.entityType,
      entityId: e.entityId,
      action: e.action,
      changedBy: e.changedBy,
      timestamp: TS(),
    };
    if (e.entityLabel) data.entityLabel = e.entityLabel;
    if (e.summary) data.summary = e.summary;
    if (e.metadata) data.metadata = e.metadata;

    await col.add(data);
    i++;
    console.log(`  ✓ ${String(i).padStart(2, " ")}/20 [${e.action}] ${e.entityLabel || e.entityId}`);
  }

  console.log(`\n  ${i} registos de auditoria criados.`);
  console.log("═══════════════════════════════════════\n");
}

run().catch((err) => {
  console.error("\n✗ Erro:", err);
  process.exit(1);
});
