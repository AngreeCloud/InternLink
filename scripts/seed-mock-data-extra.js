/**
 * seed-mock-data-extra.js
 *
 * Cria dados adicionais: schedule_change_requests, notifications, chat, sumarios _state.
 * Executar APOS seed-mock-data.js.
 *
 * Uso: node scripts/seed-mock-data-extra.js
 */

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

// ──────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────

const ESTAGIO_ID = "estagio-carlos";

const UIDS = {
  admin: "admin-esrp",
  prof: "prof-eca",
  tutor: "tutor-ega",
  aluno: "aluno-carlos",
};

const NOW = Date.now();
const DAY = 86400000;

// ──────────────────────────────────────────────
// Firebase Init
// ──────────────────────────────────────────────

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

const DATABASE_URL = process.env.FIREBASE_ADMIN_DATABASE_URL;
if (!admin.apps.length) {
  admin.initializeApp({
    credential: buildCredential(),
    databaseURL: DATABASE_URL || undefined,
  });
}

const db = admin.firestore();
const rtdb = admin.database();

function ts() {
  return admin.firestore.FieldValue.serverTimestamp();
}

// ══════════════════════════════════════════════
// 1. Schedule Change Requests
// ══════════════════════════════════════════════

const SCHEDULE_REQUESTS = [
  {
    id: "future-absence-1",
    type: "future_absence",
    targetDate: "2026-03-20",
    status: "approved",
    absenceType: "total",
    hoursAffected: 8,
    reason: "Consulta médica de rotina no hospital. Já remarcada para a semana seguinte.",
    professorDecision: "approved",
    tutorDecision: "approved",
    studentId: UIDS.aluno,
    professorId: UIDS.prof,
    tutorId: UIDS.tutor,
    comments: [
      { authorId: UIDS.aluno, authorRole: "aluno", text: "Tenho uma consulta marcada para o dia 20. Posso compensar no sábado?" },
      { authorId: UIDS.prof, authorRole: "professor", text: "Aprovado. Confirme com o tutor a compensação." },
      { authorId: UIDS.tutor, authorRole: "tutor", text: "Ok, compensamos na sexta seguinte. Combinado." },
    ],
  },
  {
    id: "past-absence-1",
    type: "past_absence_justification",
    targetDate: "2026-02-10",
    status: "pending_professor",
    absenceType: "total",
    hoursAffected: 8,
    reason: "Faltei no dia 10 de fevereiro devido a uma gripe súbita. Apresento aqui a justificação.",
    studentId: UIDS.aluno,
    professorId: UIDS.prof,
    tutorId: UIDS.tutor,
    comments: [
      { authorId: UIDS.aluno, authorRole: "aluno", text: "Anexo o atestado médico. Estive de baixa esse dia." },
    ],
  },
  {
    id: "company-closure-1",
    type: "company_closure",
    targetDate: "2026-03-25",
    status: "approved",
    hoursAffected: 8,
    reason: "A Ramada & Associados encerra para inventário anual no dia 25 de março.",
    studentId: UIDS.aluno,
    professorId: UIDS.prof,
    tutorId: UIDS.tutor,
    comments: [
      { authorId: UIDS.tutor, authorRole: "tutor", text: "Comunicado oficial: dia de inventário anual. A empresa estará encerrada." },
    ],
  },
];

async function seedScheduleChangeRequests() {
  const col = db.collection("estagios").doc(ESTAGIO_ID).collection("schedule_change_requests");
  for (const r of SCHEDULE_REQUESTS) {
    const data = {
      type: r.type,
      targetDate: r.targetDate,
      status: r.status,
      hoursAffected: r.hoursAffected,
      reason: r.reason,
      studentId: r.studentId,
      professorId: r.professorId,
      tutorId: r.tutorId,
      comments: r.comments.map((c) => ({
        ...c,
        createdAt: new Date(NOW - (SCHEDULE_REQUESTS.indexOf(r) + 1) * DAY).toISOString(),
      })),
      createdAt: ts(),
      updatedAt: ts(),
    };
    if (r.absenceType) data.absenceType = r.absenceType;
    if (r.professorDecision) data.professorDecision = r.professorDecision;
    if (r.tutorDecision) data.tutorDecision = r.tutorDecision;
    if (r.professorDecision) data.professorDecidedAt = ts();
    if (r.tutorDecision) data.tutorDecidedAt = ts();

    await col.doc(r.id).set(data, { merge: true });
    console.log(`  ✓ Schedule Request ${r.id} (${r.type}, ${r.status})`);
  }
}

// ══════════════════════════════════════════════
// 2. Notifications
// ══════════════════════════════════════════════

const NOTIFICATIONS = [
  { id: "notif-1", userId: UIDS.prof, type: "schedule_change_request", title: "Nova justificação de falta", body: "Carlos da Maia submeteu justificação de falta para 10/02/2026.", readAt: null },
  { id: "notif-2", userId: UIDS.tutor, type: "schedule_change_request", title: "Pedido aprovado pelo professor", body: "Eça de Queirós aprovou o pedido de falta futura para 20/03/2026. Aguarda a sua decisão.", readAt: null },
  { id: "notif-3", userId: UIDS.aluno, type: "schedule_change_request", title: "Falta futura aprovada", body: "O teu pedido de falta para 20/03/2026 foi aprovado pelo professor e pelo tutor.", readAt: null },
  { id: "notif-4", userId: UIDS.tutor, type: "presencas_ready", title: "Presenças prontas para validação", body: "Carlos da Maia completou as horas previstas. Valide as presenças no separador Horários.", readAt: null, estagioId: ESTAGIO_ID, href: `/estagios/${ESTAGIO_ID}?tab=horarios` },
  { id: "notif-5", userId: UIDS.aluno, type: "doc_signed", title: "Documento assinado", body: "O professor Eça de Queirós assinou o Plano de Trabalho (EA-IM-57).", readAt: ts() },
  { id: "notif-6", userId: UIDS.prof, type: "termino_antecipado", title: "Pedido de término antecipado", body: "Carlos da Maia submeteu um pedido de término antecipado, com dispensa pretendida para 16/03/2026.", readAt: null },
  { id: "notif-7", userId: UIDS.admin, type: "schedule_change_request", title: "Comunicado de empresa", body: "João da Ega registou um fecho de empresa para 25/03/2026 (inventário anual).", readAt: ts() },
  { id: "notif-8", userId: UIDS.tutor, type: "avaliacao_tutor_assinada", title: "Avaliação do tutor pendente", body: "A sua avaliação do formando Carlos da Maia está pendente. Preencha os parâmetros no separador Avaliação.", readAt: null },
  { id: "notif-9", userId: UIDS.aluno, type: "relatorio_submitted", title: "Relatório final submetido", body: "O teu relatório final de estágio foi submetido com sucesso. Aguarda validação.", readAt: ts() },
  { id: "notif-10", userId: UIDS.prof, type: "doc_awaits_signature", title: "Documento aguarda assinatura", body: "O Relatório Final de Estágio de Carlos da Maia aguarda a sua assinatura.", readAt: null },
];

async function seedNotifications() {
  const col = db.collection("estagios").doc(ESTAGIO_ID).collection("notifications");
  for (const n of NOTIFICATIONS) {
    const data = {
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      readAt: n.readAt,
      createdAt: ts(),
    };
    if (n.estagioId) data.estagioId = n.estagioId;
    if (n.href) data.href = n.href;

    await col.doc(n.id).set(data, { merge: true });
    console.log(`  ✓ Notification ${n.id} (${n.type}) → ${n.userId}`);
  }
}

// ══════════════════════════════════════════════
// 3. Chat — Conversa Grupo + Mensagens
// ══════════════════════════════════════════════

const CONVERSATION_ID = "conv-estagio-carlos";

const MESSAGES = [
  { id: "msg-1", senderId: UIDS.prof, text: "Bom dia a ambos. Espero que o estágio esteja a correr bem. O Carlos tem demonstrado empenho?", daysAgo: 7 },
  { id: "msg-2", senderId: UIDS.aluno, text: "Bom dia, professor. Está a correr muito bem, já aprendi o sistema de reservas e comecei a fazer atendimento autónomo.", daysAgo: 6 },
  { id: "msg-3", senderId: UIDS.tutor, text: "Posso confirmar que o Carlos está a evoluir bem. Já faz check-ins e check-outs sozinho e lidou com uma reclamação de forma exemplar.", daysAgo: 5 },
  { id: "msg-4", senderId: UIDS.aluno, text: "Obrigado, tutor! Esta semana ajudei na organização de um seminário empresarial no salão do hotel. Foi uma experiência muito enriquecedora.", daysAgo: 3 },
  { id: "msg-5", senderId: UIDS.prof, text: "Excelente. Não te esqueças de ir escrevendo os sumários semanais. São importantes para o relatório final.", daysAgo: 2 },
  { id: "msg-6", senderId: UIDS.aluno, text: "Já escrevi até à semana 6. Amanhã vou tratar das semanas 7 e 8. O relatório final já está em curso.", daysAgo: 1 },
];

async function seedChat() {
  const rtdbRef = rtdb.ref();

  // Criar conversa
  const convData = {
    type: "group",
    orgId: "uporto",
    participants: {
      [UIDS.aluno]: true,
      [UIDS.prof]: true,
      [UIDS.tutor]: true,
    },
    lastMessage: {
      text: MESSAGES[MESSAGES.length - 1].text,
      senderId: MESSAGES[MESSAGES.length - 1].senderId,
      createdAt: NOW - 1 * DAY,
      hasAttachments: false,
    },
    createdAt: NOW - 7 * DAY,
    updatedAt: NOW - 1 * DAY,
  };

  await rtdbRef.child(`conversations/${CONVERSATION_ID}`).set(convData);
  console.log(`  ✓ Conversation ${CONVERSATION_ID}`);

  // Criar userConversations para cada participante
  const participantsList = [UIDS.aluno, UIDS.prof, UIDS.tutor];
  for (const uid of participantsList) {
    // sender has unreadCount 0, others have unreadCount based on messages they haven't seen
    const isSender = uid === MESSAGES[MESSAGES.length - 1].senderId;
    await rtdbRef.child(`userConversations/${uid}/${CONVERSATION_ID}`).set({
      lastMessageText: MESSAGES[MESSAGES.length - 1].text,
      lastMessageAt: NOW - 1 * DAY,
      lastSeenAt: isSender ? NOW - 1 * DAY : NOW - 7 * DAY,
      unreadCount: isSender ? 0 : 6,
      isMuted: false,
    });
  }
  console.log("  ✓ userConversations (3 participantes)");

  // Criar mensagens
  for (const m of MESSAGES) {
    const msgData = {
      senderId: m.senderId,
      text: m.text,
      attachments: {},
      createdAt: NOW - m.daysAgo * DAY,
      editedAt: null,
      deleted: false,
      deletedAt: null,
      seenBy: {
        [m.senderId]: NOW - m.daysAgo * DAY,
      },
    };
    await rtdbRef.child(`messages/${CONVERSATION_ID}/${m.id}`).set(msgData);
  }
  console.log(`  ✓ Messages (${MESSAGES.length} mensagens)`);

  // chatAccess
  await db.collection("chatAccess").doc(CONVERSATION_ID).set({
    participants: {
      [UIDS.aluno]: true,
      [UIDS.prof]: true,
      [UIDS.tutor]: true,
    },
    orgId: "uporto",
    type: "group",
    createdAt: NOW - 7 * DAY,
    updatedAt: NOW - 1 * DAY,
  });
  console.log("  ✓ chatAccess doc");

  // userTutors index
  await rtdbRef.child(`userTutors/${UIDS.aluno}/${UIDS.tutor}`).set(true);
  console.log("  ✓ userTutors index");
}

// ══════════════════════════════════════════════
// 4. Sumarios _state
// ══════════════════════════════════════════════

async function seedSumariosState() {
  await db.collection("estagios").doc(ESTAGIO_ID).collection("sumarios").doc("_state").set({
    allPreenchidos: true,
    allAssinados: false,
  }, { merge: true });
  console.log("  ✓ Sumarios _state (allPreenchidos, allAssinados: false)");
}

// ══════════════════════════════════════════════
// Run
// ══════════════════════════════════════════════

async function run() {
  console.log("\n═══════════════════════════════════════");
  console.log("  Seed Mock Data — Extra");
  console.log("═══════════════════════════════════════\n");

  console.log("1/4 Schedule Change Requests...");
  await seedScheduleChangeRequests();

  console.log("\n2/4 Notifications...");
  await seedNotifications();

  console.log("\n3/4 Chat...");
  await seedChat();

  console.log("\n4/4 Sumarios _state...");
  await seedSumariosState();

  console.log("\n═══════════════════════════════════════");
  console.log("  Extra seed concluído!");
  console.log("═══════════════════════════════════════\n");
}

run().catch((err) => {
  console.error("\n✗ Erro:", err);
  process.exit(1);
});
