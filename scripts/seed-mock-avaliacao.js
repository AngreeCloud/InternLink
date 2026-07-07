/**
 * seed-mock-avaliacao.js
 *
 * Configura sistema de avaliação na mock data:
 * - AvaliacaoConfig na escola
 * - Datas de avaliação no curso
 * - Avaliação do tutor preenchida (estado: pendente)
 * - Avaliação do professor preenchida (estado: pendente)
 *
 * Uso: node scripts/seed-mock-avaliacao.js
 */

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

const SCHOOL_ID = "uporto";
const CURSO_ID = "curso-turismo";
const ESTAGIO_ID = "estagio-carlos";
const TUTOR_UID = "tutor-ega";
const PROF_UID = "prof-eca";
const ALUNO_UID = "aluno-carlos";

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

const PARAMETROS = [
  { nome: "Assiduidade e Pontualidade" },
  { nome: "Iniciativa e Autonomia" },
  { nome: "Qualidade do Trabalho" },
  { nome: "Relacionamento Interpessoal" },
  { nome: "Capacidade de Aprendizagem" },
];

const NOTAS_TUTOR = {
  "Assiduidade e Pontualidade": 17,
  "Iniciativa e Autonomia": 15,
  "Qualidade do Trabalho": 16,
  "Relacionamento Interpessoal": 18,
  "Capacidade de Aprendizagem": 14,
};

// Media dos parametros: (17+15+16+18+14)/5 = 16
const NOTA_FINAL_CALCULADA = 16;

const NOTAS_PROFESSOR = {
  "Assiduidade e Pontualidade": 16,
  "Iniciativa e Autonomia": 15,
  "Qualidade do Trabalho": 17,
  "Relacionamento Interpessoal": 18,
  "Capacidade de Aprendizagem": 15,
};

async function run() {
  console.log("\n═══════════════════════════════════════");
  console.log("  Seed Mock Data — Avaliação");
  console.log("═══════════════════════════════════════\n");

  // 1. AvaliacaoConfig na escola
  console.log("1/4 AvaliacaoConfig na escola...");
  await db.collection("schools").doc(SCHOOL_ID).set({
    avaliacaoConfig: {
      parametros: PARAMETROS,
      escala: { min: 0, max: 20 },
      metodoCalculo: "media",
      notaFinalEsperada: { min: 0, max: 20 },
      permitirTutorVerNotaFinal: true,
    },
  }, { merge: true });
  console.log("  ✓ AvaliacaoConfig: 5 parâmetros, 0-20, média");

  // 2. Datas de avaliação no curso
  console.log("\n2/4 Datas de avaliação...");
  const hoje = new Date();
  const fimEstagio = new Date("2026-03-16");
  const disponibilidade = new Date(fimEstagio);
  disponibilidade.setDate(disponibilidade.getDate() - 7);
  const publicacao = new Date(fimEstagio);
  publicacao.setDate(publicacao.getDate() + 14);

  await db.collection("courses").doc(CURSO_ID).collection("settings").doc("avaliacao_datas").set({
    cursoId: CURSO_ID,
    schoolId: SCHOOL_ID,
    datas: {
      disponibilidadePreenchimento: disponibilidade.toISOString().split("T")[0],
      publicacaoNotaFinal: publicacao.toISOString().split("T")[0],
    },
    autoArquivarNaPublicacao: false,
  }, { merge: true });
  console.log(`  ✓ Datas: preenchimento ${disponibilidade.toISOString().split("T")[0]}, publicação ${publicacao.toISOString().split("T")[0]}`);

  // 3. Tutor evaluation (preenchida mas pendente de assinatura)
  console.log("\n3/4 Avaliação do tutor...");
  await db.collection("estagios").doc(ESTAGIO_ID).collection("avaliacao").doc("tutor").set({
    parametros: NOTAS_TUTOR,
    comentarios: "O Carlos demonstrou um bom desempenho ao longo do estágio. Revelou iniciativa no atendimento ao cliente e capacidade de adaptação a novas tarefas. A pontualidade e a relação com a equipa foram exemplares. Recomendo que mantenha o foco na organização documental.",
    estado: "pendente",
    resetCount: 0,
  }, { merge: true });
  console.log("  ✓ Tutor avaliação preenchida (estado: pendente)");

  // 4. Professor evaluation (preenchida mas pendente de assinatura)
  console.log("\n4/4 Avaliação do professor...");
  await db.collection("estagios").doc(ESTAGIO_ID).collection("avaliacao").doc("professor").set({
    parametros: NOTAS_PROFESSOR,
    notaFinal: NOTA_FINAL_CALCULADA,
    estado: "pendente",
  }, { merge: true });
  console.log(`  ✓ Professor avaliação preenchida (estado: pendente, nota final: ${NOTA_FINAL_CALCULADA} valores)`);

  console.log("\n═══════════════════════════════════════");
  console.log("  Seed avaliação concluído!");
  console.log("═══════════════════════════════════════\n");
}

run().catch((err) => {
  console.error("\n✗ Erro:", err);
  process.exit(1);
});
