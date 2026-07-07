/**
 * seed-mock-turma2.js
 *
 * Segunda turma com personagens de Fernando Pessoa.
 * Curso: Técnico de Comunicação e Marketing
 * Escola: Universidade do Porto (mesma schoolId = uporto)
 *
 * Uso: node scripts/seed-mock-turma2.js
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const SCHOOL_ID = "uporto";

const PESSOAS = {
  professor: {
    uid: "prof-pessoa",
    email: "fernando.pessoa@up.pt",
    nome: "Fernando Pessoa",
    role: "professor",
    password: "Heteronimos1925!",
  },
  tutor: {
    uid: "tutor-soares",
    email: "bernardo.soares@publicitas.pt",
    nome: "Bernardo Soares",
    role: "tutor",
    password: "LivroDesassossego!",
  },
  aluno: {
    uid: "aluno-campos",
    email: "alvaro.campos@up.pt",
    nome: "Álvaro de Campos",
    role: "aluno",
    password: "Tabacaria1928!",
  },
};

const CURSO_ID = "curso-comunicacao";
const EMPRESA_ID = "publicitas-portuguesa";
const ESTAGIO_ID = "estagio-campos";

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
const auth = admin.auth();

function ts() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isWorkday(date, diasSemana) {
  const weekdayKeys = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  return !!diasSemana[weekdayKeys[date.getDay()]];
}

function getHolidays(startYear, endYear) {
  const fixed = {
    "01-01": "Ano Novo", "04-25": "Dia da Liberdade", "05-01": "Dia do Trabalhador",
    "06-10": "Dia de Portugal", "08-15": "Assunção", "10-05": "Implantação República",
    "11-01": "Todos os Santos", "12-01": "Restauração", "12-08": "Imaculada",
    "12-25": "Natal",
  };
  const out = new Set();
  for (let y = startYear; y <= endYear; y++) {
    for (const md of Object.keys(fixed)) out.add(`${y}-${md}`);
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const easter = new Date(y, month - 1, day);
    const sextaSanta = new Date(easter); sextaSanta.setDate(easter.getDate() - 2); out.add(toIsoDate(sextaSanta));
    const carnaval = new Date(easter); carnaval.setDate(easter.getDate() - 47); out.add(toIsoDate(carnaval));
    const corpoDeus = new Date(easter); corpoDeus.setDate(easter.getDate() + 60); out.add(toIsoDate(corpoDeus));
  }
  return out;
}

async function seedUser(personagem, extraFields = {}) {
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(personagem.email);
    console.log(`  ~ Auth já existe: ${personagem.email}`);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      userRecord = await auth.createUser({
        uid: personagem.uid,
        email: personagem.email,
        displayName: personagem.nome,
        password: personagem.password,
        emailVerified: true,
      });
      console.log(`  ✓ Auth criado: ${personagem.email}`);
    } else {
      throw err;
    }
  }

  await db.collection("users").doc(userRecord.uid).set({
    nome: personagem.nome,
    email: personagem.email,
    role: personagem.role,
    schoolId: SCHOOL_ID,
    estado: "ativo",
    createdAt: ts(),
    updatedAt: ts(),
    ...extraFields,
  }, { merge: true });

  await auth.setCustomUserClaims(userRecord.uid, { role: personagem.role, estado: "ativo" });
  console.log(`  ✓ User doc: ${personagem.nome} (${personagem.role})`);
  return userRecord.uid;
}

async function run() {
  console.log("\n═══════════════════════════════════════");
  console.log("  Seed Mock Data — Turma 2 (Pessoa)");
  console.log("═══════════════════════════════════════\n");

  // 1. Users
  console.log("1/6 Utilizadores...");
  await seedUser(PESSOAS.professor, {
    escola: "Universidade do Porto",
  });
  await seedUser(PESSOAS.tutor, { empresa: "Publicitas Portuguesa, Lda." });
  await seedUser(PESSOAS.aluno, {
    courseId: CURSO_ID,
    curso: "Técnico de Comunicação e Marketing",
    escola: "Universidade do Porto",
  });

  // 2. Curso
  console.log("\n2/6 Curso...");
  await db.collection("courses").doc(CURSO_ID).set({
    nome: "Técnico de Comunicação e Marketing",
    name: "Técnico de Comunicação e Marketing",
    schoolId: SCHOOL_ID,
    courseDirectorId: PESSOAS.professor.uid,
    teacherIds: [PESSOAS.professor.uid],
    supportingTeacherIds: [],
    reportMinHours: 300,
    reportWaitDays: 5,
    directorCanDeleteEstagio: true,
    createdAt: ts(),
    updatedAt: ts(),
  }, { merge: true });
  console.log("  ✓ Curso: Técnico de Comunicação e Marketing");

  // 3. Empresa
  console.log("\n3/6 Empresa...");
  await db.collection("empresas").doc(EMPRESA_ID).set({
    nome: "Publicitas Portuguesa, Lda.",
    nomeNormalizado: "publicitas-portuguesa",
    nif: "500654321",
    setor: "Comunicação e Publicidade",
    morada: "Rua do Alecrim, 48",
    codigoPostal: "1200-018",
    localidade: "Lisboa",
    concelho: "Lisboa",
    distrito: "Lisboa",
    pais: "Portugal",
    emailGeral: "contacto@publicitas.pt",
    telefone: "213 456 789",
    website: "https://publicitas.pt",
    schoolId: SCHOOL_ID,
    tutorIds: [PESSOAS.tutor.uid],
    empresaGrants: { [PESSOAS.professor.uid]: "write" },
    ativa: true,
    createdBy: PESSOAS.professor.uid,
    updatedBy: PESSOAS.professor.uid,
    createdAt: ts(),
    updatedAt: ts(),
  }, { merge: true });
  console.log("  ✓ Empresa: Publicitas Portuguesa, Lda.");

  // Tutor → Escola
  await db.collection("schools").doc(SCHOOL_ID).collection("tutors").doc(PESSOAS.tutor.uid).set({
    nome: PESSOAS.tutor.nome,
    email: PESSOAS.tutor.email,
    empresa: "Publicitas Portuguesa, Lda.",
    createdAt: ts(),
  }, { merge: true });
  console.log("  ✓ Tutor associado à escola");

  // 4. Estágio
  console.log("\n4/6 Estágio...");
  const dataInicio = "2026-02-02";
  const totalHoras = 400;
  const horasDiarias = 7;
  const diasSemana = { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false };

  await db.collection("estagios").doc(ESTAGIO_ID).set({
    titulo: "Estágio Álvaro de Campos — Publicitas Portuguesa",
    alunoId: PESSOAS.aluno.uid,
    alunoNome: PESSOAS.aluno.nome,
    alunoEmail: PESSOAS.aluno.email,
    alunoCourseId: CURSO_ID,
    professorId: PESSOAS.professor.uid,
    professorNome: PESSOAS.professor.nome,
    tutorId: PESSOAS.tutor.uid,
    tutorNome: PESSOAS.tutor.nome,
    tutorEmail: PESSOAS.tutor.email,
    tutorEmpresa: "Publicitas Portuguesa, Lda.",
    cursoNome: "Técnico de Comunicação e Marketing",
    schoolId: SCHOOL_ID,
    courseId: CURSO_ID,
    empresa: "Publicitas Portuguesa, Lda.",
    empresaId: EMPRESA_ID,
    entidadeAcolhimento: "Publicitas Portuguesa, Lda.",
    empresaSnapshot: {
      nome: "Publicitas Portuguesa, Lda.",
      morada: "Rua do Alecrim, 48",
      codigoPostal: "1200-018",
      localidade: "Lisboa",
      nif: "500654321",
      emailGeral: "contacto@publicitas.pt",
      telefone: "213 456 789",
    },
    dataInicio,
    totalHoras,
    horasRealizadas: 0,
    horasDiarias,
    diasSemana,
    dataFimEstimada: "2026-05-29",
    estado: "ativo",
    estadoEstagio: "em_curso",
    presencasValidatedByTutor: false,
    createdAt: ts(),
    updatedAt: ts(),
  }, { merge: true });
  console.log("  ✓ Estágio: Álvaro de Campos — Publicitas Portuguesa");

  // 5. Presenças (112h, 16 dias)
  console.log("\n5/6 Presenças...");
  const presencasRef = db.collection("estagios").doc(ESTAGIO_ID).collection("presencas");
  const holidays = getHolidays(2026, 2026);
  const cursor = new Date("2026-02-02T00:00:00");
  let totalPresencas = 0;
  const DIAS_PRESENCA = 16;
  let planted = 0;
  let safety = 0;
  while (planted < DIAS_PRESENCA && safety < 100) {
    const iso = toIsoDate(cursor);
    if (isWorkday(cursor, diasSemana) && !holidays.has(iso)) {
      await presencasRef.doc(iso).set({
        date: iso,
        hoursWorked: horasDiarias,
        hoursScheduled: horasDiarias,
        updatedAt: ts(),
        updatedBy: PESSOAS.aluno.uid,
        updatedByRole: "aluno",
      }, { merge: true });
      totalPresencas += horasDiarias;
      planted++;
    }
    cursor.setDate(cursor.getDate() + 1);
    safety++;
  }
  await db.collection("estagios").doc(ESTAGIO_ID).update({ horasRealizadas: totalPresencas });
  console.log(`  ✓ Presenças: ${planted} dias (${totalPresencas}h)`);

  // 6. Sumários (3 semanas preenchidas)
  console.log("\n6/6 Sumários...");
  const SUMARIOS = [
    {
      weekStart: "2026-02-02", weekEnd: "2026-02-06", weekNumber: 1,
      content: "Iniciei o estágio na Publicitas Portuguesa, uma agência de comunicação no Chiado. O tutor Bernardo Soares apresentou-me a equipa criativa e os projetos em curso. Familiarizei-me com o software de design gráfico (Adobe Creative Suite) e assisti a uma reunião de briefing com um cliente do setor hoteleiro. Comecei a estudar o manual de identidade visual da agência e os processos de atendimento.",
    },
    {
      weekStart: "2026-02-09", weekEnd: "2026-02-13", weekNumber: 2,
      content: "Colaborei na elaboração de uma campanha para redes sociais. Ajudei na pesquisa de referências visuais e na redação de textos publicitários. Aprendi a utilizar o sistema de gestão de projetos (Trello) e participei numa sessão de brainstorming para uma marca de calçado português. O ambiente criativo da agência é estimulante e sinto que estou a desenvolver um olhar mais crítico sobre comunicação visual.",
    },
    {
      weekStart: "2026-02-16", weekEnd: "2026-02-20", weekNumber: 3,
      content: "Esta semana foi dedicada à produção de conteúdo para o blogue da agência. Escrevi dois artigos sobre tendências de marketing digital e ajudei na revisão de textos para uma newsletter. Participei também na preparação de uma apresentação para um novo cliente. O tutor elogiou a minha capacidade de escrita e sugeriu-me que explorasse mais a área de copywriting. Sinto que encontrei o meu rumo profissional.",
    },
  ];

  const sumariosRef = db.collection("estagios").doc(ESTAGIO_ID).collection("sumarios");
  for (const s of SUMARIOS) {
    const weekId = `${s.weekNumber}-${s.weekStart}`;
    await sumariosRef.doc(weekId).set({
      weekId,
      weekStart: s.weekStart,
      weekEnd: s.weekEnd,
      weekNumber: s.weekNumber,
      weekYear: 2026,
      content: s.content,
      estado: "preenchido",
      updatedAt: ts(),
      updatedBy: PESSOAS.aluno.uid,
      updatedByRole: "aluno",
    }, { merge: true });
  }
  console.log(`  ✓ Sumários: ${SUMARIOS.length} semanas preenchidas`);

  console.log("\n═══════════════════════════════════════");
  console.log("  Turma 2 criada com sucesso!");
  console.log("\n  Credenciais:");
  console.log(`  Professor: ${PESSOAS.professor.email} / ${PESSOAS.professor.password}`);
  console.log(`  Tutor:     ${PESSOAS.tutor.email} / ${PESSOAS.tutor.password}`);
  console.log(`  Aluno:     ${PESSOAS.aluno.email} / ${PESSOAS.aluno.password}`);
  console.log("═══════════════════════════════════════\n");
}

run().catch((err) => {
  console.error("\n✗ Erro:", err);
  process.exit(1);
});
