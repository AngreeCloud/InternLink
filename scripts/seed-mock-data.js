/**
 * seed-mock-data.js
 *
 * Cria mock data para apresentação: escola, users, curso, empresa, estágio, presenças.
 * Personagens da literatura/história portuguesa.
 * Re-executável (upsert com merge, UIDs fixos).
 *
 * Uso: node scripts/seed-mock-data.js
 *
 * Requer GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_SERVICE_ACCOUNT_PATH
 * no ambiente ou .env.local com FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// ──────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────

const SCHOOL_ID = "uporto";

const PASSWORD_DEFAULT = "InternLink2026!";

const PERSONAGENS = {
  admin: {
    uid: "admin-esrp",
    email: "afonso.henriques@up.pt",
    nome: "D. Afonso Henriques",
    role: "admin_escolar",
    password: "ReiDePortugal123!",
  },
  professor: {
    uid: "prof-eca",
    email: "eca.queiros@up.pt",
    nome: "Eça de Queirós",
    role: "professor",
    password: "OsMaias1888!",
  },
  tutor: {
    uid: "tutor-ega",
    email: "joao.ega@ramada.pt",
    nome: "João da Ega",
    role: "tutor",
    password: "EgaBoemio!123",
  },
  aluno: {
    uid: "aluno-carlos",
    email: "carlos.maia@up.pt",
    nome: "Carlos da Maia",
    role: "aluno",
    password: "CarlosMedico!456",
  },
};

const CURSO_ID = "curso-turismo";

const EMPRESA_ID = "ramada-associados";

const ESTAGIO_ID = "estagio-carlos";

// ══════════════════════════════════════════════
// Firebase Init
// ══════════════════════════════════════════════

function buildCredential() {
  // Tenta service account JSON em string (igual a lib/firebase-admin.ts)
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
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }

  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (saPath && fs.existsSync(saPath)) {
    return admin.credential.cert(require(path.resolve(saPath)));
  }

  return admin.credential.applicationDefault();
}

function ensureInitialized() {
  if (!admin.apps.length) {
    admin.initializeApp({ credential: buildCredential() });
  }
  return admin.firestore();
}

// ══════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════

function ts() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isWorkday(date, diasSemana) {
  const weekdayKeys = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  const key = weekdayKeys[date.getDay()];
  return !!diasSemana[key];
}

function getIsoWeekNumber(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 3);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return weekNum;
}

function calcularDataFimEstimada({ dataInicio, totalHoras, horasDiarias, diasSemana }) {
  const start = new Date(dataInicio + "T00:00:00");
  const diasNecessarios = Math.ceil(totalHoras / horasDiarias);
  const holidays = new Set(getHolidays(start.getFullYear(), start.getFullYear() + 1));
  let count = 0;
  const cursor = new Date(start);
  let safety = 0;
  while (count < diasNecessarios && safety < 2000) {
    if (isWorkday(cursor, diasSemana) && !holidays.has(toIsoDate(cursor))) {
      count++;
      if (count === diasNecessarios) break;
    }
    cursor.setDate(cursor.getDate() + 1);
    safety++;
  }
  return toIsoDate(cursor);
}

function getHolidays(startYear, endYear) {
  const fixed = {
    "01-01": "Ano Novo",
    "04-25": "Dia da Liberdade",
    "05-01": "Dia do Trabalhador",
    "06-10": "Dia de Portugal",
    "08-15": "Assunção de Nossa Senhora",
    "10-05": "Implantação da República",
    "11-01": "Todos os Santos",
    "12-01": "Restauração da Independência",
    "12-08": "Imaculada Conceição",
    "12-25": "Natal",
  };
  const out = new Set();
  for (let y = startYear; y <= endYear; y++) {
    for (const md of Object.keys(fixed)) {
      out.add(`${y}-${md}`);
    }
    // Páscoa (Gauss)
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const easter = new Date(y, month - 1, day);
    // Sexta-feira Santa
    const sextaSanta = new Date(easter);
    sextaSanta.setDate(easter.getDate() - 2);
    out.add(toIsoDate(sextaSanta));
    // Carnaval (47 dias antes da Páscoa)
    const carnaval = new Date(easter);
    carnaval.setDate(easter.getDate() - 47);
    out.add(toIsoDate(carnaval));
    // Corpo de Deus (60 dias depois da Páscoa)
    const corpoDeus = new Date(easter);
    corpoDeus.setDate(easter.getDate() + 60);
    out.add(toIsoDate(corpoDeus));
  }
  return out;
}

// ══════════════════════════════════════════════
// Seeds
// ══════════════════════════════════════════════

async function seedEscola(db) {
  const data = {
    name: "Universidade do Porto",
    shortName: "UP",
    address: "Praça Gomes Teixeira, s/n",
    localidade: "Porto",
    codigoPostal: "4099-002",
    distrito: "Porto",
    pais: "Portugal",
    emailDomain: "@up.pt",
    requireInstitutionalEmail: false,
    educationLevel: "Ensino Superior (Universitário)",
    contact: "Telefone: 220 408 000",
    allowGoogleLogin: false,
    createdAt: ts(),
    updatedAt: ts(),
  };
  await db.collection("schools").doc(SCHOOL_ID).set(data, { merge: true });
  console.log(`  ✓ Escola: ${data.name}`);
}

async function seedUser(db, auth, personagem, extraFields = {}) {
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

  const userData = {
    nome: personagem.nome,
    email: personagem.email,
    role: personagem.role,
    schoolId: SCHOOL_ID || null,
    estado: "ativo",
    createdAt: ts(),
    updatedAt: ts(),
    ...extraFields,
  };

  await db.collection("users").doc(userRecord.uid).set(userData, { merge: true });

  // Sincronizar custom claims
  await auth.setCustomUserClaims(userRecord.uid, { role: personagem.role, estado: "ativo" });

  console.log(`  ✓ User doc: ${personagem.nome} (${personagem.role})`);
  return userRecord.uid;
}

async function seedCurso(db) {
  const data = {
    nome: "Técnico de Turismo",
    name: "Técnico de Turismo",
    schoolId: SCHOOL_ID,
    courseDirectorId: PERSONAGENS.professor.uid,
    teacherIds: [PERSONAGENS.professor.uid],
    supportingTeacherIds: [],
    reportMinHours: 300,
    reportWaitDays: 5,
    directorCanDeleteEstagio: true,
    createdAt: ts(),
    updatedAt: ts(),
  };
  await db.collection("courses").doc(CURSO_ID).set(data, { merge: true });
  console.log(`  ✓ Curso: ${data.nome}`);
}

async function seedEmpresa(db) {
  const data = {
    nome: "Ramada & Associados",
    nomeNormalizado: "ramada-e-associados",
    nif: "500123456",
    nifNormalizado: "500123456",
    setor: "Turismo e Hotelaria",
    morada: "Avenida dos Descobrimentos, 15",
    codigoPostal: "4490-050",
    localidade: "Póvoa de Varzim",
    concelho: "Póvoa de Varzim",
    distrito: "Porto",
    pais: "Portugal",
    emailGeral: "info@ramada.pt",
    telefone: "252 987 654",
    website: "https://ramada.pt",
    schoolId: SCHOOL_ID,
    tutorIds: [PERSONAGENS.tutor.uid],
    empresaGrants: { [PERSONAGENS.professor.uid]: "write" },
    ativa: true,
    createdBy: PERSONAGENS.admin.uid,
    updatedBy: PERSONAGENS.admin.uid,
    createdAt: ts(),
    updatedAt: ts(),
  };
  await db.collection("empresas").doc(EMPRESA_ID).set(data, { merge: true });
  console.log(`  ✓ Empresa: ${data.nome}`);
}

async function seedEstagio(db) {
  const dataInicio = "2026-01-05";
  const totalHoras = 400;
  const horasDiarias = 8;
  const diasSemana = { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false };

  const dataFimEstimada = calcularDataFimEstimada({
    dataInicio,
    totalHoras,
    horasDiarias,
    diasSemana,
  });

  const empresaSnapshot = {
    nome: "Ramada & Associados",
    morada: "Avenida dos Descobrimentos, 15",
    codigoPostal: "4490-050",
    localidade: "Póvoa de Varzim",
    nif: "500123456",
    emailGeral: "info@ramada.pt",
    telefone: "252 987 654",
  };

  const data = {
    titulo: "Estágio Carlos da Maia — Ramada & Associados",
    alunoId: PERSONAGENS.aluno.uid,
    alunoNome: PERSONAGENS.aluno.nome,
    alunoEmail: PERSONAGENS.aluno.email,
    alunoCourseId: CURSO_ID,
    professorId: PERSONAGENS.professor.uid,
    professorNome: PERSONAGENS.professor.nome,
    tutorId: PERSONAGENS.tutor.uid,
    tutorNome: PERSONAGENS.tutor.nome,
    tutorEmail: PERSONAGENS.tutor.email,
    tutorEmpresa: "Ramada & Associados",
    cursoNome: "Técnico de Turismo",
    schoolId: SCHOOL_ID,
    courseId: CURSO_ID,
    empresa: "Ramada & Associados",
    empresaId: EMPRESA_ID,
    entidadeAcolhimento: "Ramada & Associados",
    empresaSnapshot,
    dataInicio,
    totalHoras,
    horasRealizadas: 280,
    horasDiarias,
    diasSemana,
    dataFimEstimada,
    estado: "ativo",
    estadoEstagio: "em_curso",
    presencasValidatedByTutor: false,
    createdAt: ts(),
    updatedAt: ts(),
  };

  await db.collection("estagios").doc(ESTAGIO_ID).set(data, { merge: true });
  console.log(`  ✓ Estágio: ${data.titulo} (dataFim: ${dataFimEstimada})`);
}

async function seedPresencas(db) {
  const dataInicio = "2026-01-05";
  const horasDiarias = 8;
  const diasSemana = { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false };

  // 280h em batches
  const batches = [
    { start: "2026-01-05", days: 15, label: "Janeiro" },
    { start: "2026-02-02", days: 15, label: "Fevereiro" },
    { start: "2026-03-02", days: 5, label: "Março" },
  ];

  const presencasRef = db.collection("estagios").doc(ESTAGIO_ID).collection("presencas");
  const holidays = getHolidays(2026, 2026);

  let total = 0;

  for (const batch of batches) {
    const cursor = new Date(batch.start + "T00:00:00");
    let planted = 0;
    let safety = 0;
    while (planted < batch.days && safety < 200) {
      const iso = toIsoDate(cursor);
      if (isWorkday(cursor, diasSemana) && !holidays.has(iso)) {
        const presenca = {
          date: iso,
          hoursWorked: horasDiarias,
          hoursScheduled: horasDiarias,
          updatedAt: ts(),
          updatedBy: PERSONAGENS.aluno.uid,
          updatedByRole: "aluno",
        };
        await presencasRef.doc(iso).set(presenca, { merge: true });
        total += horasDiarias;
        planted++;
      }
      cursor.setDate(cursor.getDate() + 1);
      safety++;
    }
    console.log(`  ✓ Presenças ${batch.label}: ${planted} dias (${planted * horasDiarias}h)`);
  }

  console.log(`  ✓ Total presenças: ${total}h`);

  // Atualizar horasRealizadas no estágio
  await db.collection("estagios").doc(ESTAGIO_ID).update({
    horasRealizadas: total,
    updatedAt: ts(),
  });
}

// ══════════════════════════════════════════════
// Sumários
// ══════════════════════════════════════════════

const SUMARIOS_DATA = [
  {
    weekStart: "2026-01-05",
    weekEnd: "2026-01-09",
    weekNumber: 1,
    content:
      "Esta semana iniciei o estágio na Ramada & Associados. Fui recebido pelo tutor João da Ega que me apresentou as instalações e a equipa. " +
      "Realizei uma formação inicial sobre o sistema de reservas utilizado pela empresa (o HotelPro ERP) e familiarizei-me com os procedimentos " +
      "de check-in e check-out. Observei o atendimento ao cliente na receção e tirei notas sobre as etapas do processo de acolhimento de hóspedes. " +
      "Comecei também a estudar a documentação interna sobre os serviços do hotel e as parcerias locais.",
    estado: "arquivado",
    signedByTutor: true,
  },
  {
    weekStart: "2026-01-12",
    weekEnd: "2026-01-16",
    weekNumber: 2,
    content:
      "Durante esta semana acompanhei a equipa da receção no atendimento ao público. Ajudei na organização das reservas e na " +
      "emissão de faturas. Aprendi a utilizar o módulo de gestão de hóspedes do HotelPro ERP, incluindo a atualização de perfis e " +
      "o registo de preferências. Participei também no processo de check-out de um grupo de turistas espanhóis, onde pude aplicar " +
      "os conhecimentos de espanhol que tenho vindo a desenvolver. Foi uma semana bastante produtiva em termos de aprendizagem prática.",
    estado: "arquivado",
    signedByTutor: true,
  },
  {
    weekStart: "2026-01-19",
    weekEnd: "2026-01-23",
    weekNumber: 3,
    content:
      "Esta semana foi dedicada à exploração dos pacotes turísticos oferecidos pela Ramada & Associados. Analisei as parcerias " +
      "com empresas locais de animação turística e os roteiros culturais na região da Póvoa de Varzim. Colaborei na elaboração " +
      "de um folheto informativo sobre os pontos de interesse nas imediações, incluindo o mosteiro de Rates e a paisagem " +
      "protegida do litoral. Aprendi também a utilizar o software de gestão de inventário para controlar os materiais promocionais.",
    estado: "arquivado",
    signedByTutor: true,
  },
  {
    weekStart: "2026-02-02",
    weekEnd: "2026-02-06",
    weekNumber: 4,
    content:
      "Iniciei o mês de fevereiro com a participação numa reunião de equipa sobre a época alta que se aproxima. Foi-me pedido " +
      "que ajudasse na preparação de um dossiê de boas-vindas para hóspedes internacionais, com informações sobre a região em " +
      "inglês e francês. Traduzi e formatei os documentos, que incluíam mapas, recomendações de restaurantes e horários de " +
      "transportes públicos. O tutor elogiou a qualidade do trabalho e sugeriu pequenas melhorias na disposição gráfica.",
    estado: "arquivado",
    signedByTutor: true,
  },
  {
    weekStart: "2026-02-09",
    weekEnd: "2026-02-13",
    weekNumber: 5,
    content:
      "Esta semana foi marcada pelo primeiro atendimento autónomo ao balcão da receção. Sob a supervisão do tutor, realizei " +
      "check-ins e check-outs de forma independente, incluindo o processamento de pagamentos multibanco e a emissão de faturas " +
      "recibo. Lidei com uma reclamação de um hóspede sobre o ruído noturno e encaminhei-a para a direção seguindo o " +
      "procedimento interno. Sinto-me cada vez mais confiante no contacto com o público e na resolução de situações do dia a dia.",
    estado: "arquivado",
    signedByTutor: true,
  },
  {
    weekStart: "2026-02-16",
    weekEnd: "2026-02-20",
    weekNumber: 6,
    content:
      "Colaborei com a equipa de eventos na organização de um seminário empresarial realizado no salão do hotel. Ajudei na " +
      "montagem do espaço, na receção dos participantes e no apoio logístico durante o evento. Esta experiência permitiu-me " +
      "perceber a complexidade da organização de eventos e a importância da coordenação entre diferentes departamentos. " +
      "Registei os contactos dos participantes no sistema CRM e arquivei a documentação do evento.",
    estado: "preenchido",
  },
  {
    weekStart: "2026-02-23",
    weekEnd: "2026-02-27",
    weekNumber: 7,
    content:
      "Durante esta semana dediquei-me à atualização das bases de dados de clientes e à limpeza de registos duplicados no " +
      "sistema. Aprendi a gerar relatórios de ocupação e taxas de reserva direta versus reservas através de agências online. " +
      "Participei também numa ação de formação interna sobre boas práticas de proteção de dados (RGPD) aplicadas ao turismo. " +
      "Foi uma semana mais focada na componente administrativa e de back-office do negócio hoteleiro.",
    estado: "preenchido",
  },
  {
    weekStart: "2026-03-02",
    weekEnd: "2026-03-06",
    weekNumber: 8,
    content:
      "Esta semana iniciei a preparação do relatório de estágio, com a orientação do tutor. Recolhi os documentos necessários, " +
      "organizei as notas das semanas anteriores e comecei a estruturar os capítulos do relatório. Continuei também a apoiar a " +
      "receção no período da manhã, mantendo as tarefas habituais de atendimento e gestão de reservas. O balanço desta semana " +
      "é muito positivo: sinto que evoluí significativamente desde o início do estágio.",
    estado: "preenchido",
  },
];

async function seedSumarios(db) {
  const sumariosRef = db.collection("estagios").doc(ESTAGIO_ID).collection("sumarios");

  for (const s of SUMARIOS_DATA) {
    const weekId = `${s.weekNumber}-${s.weekStart}`;
    const docData = {
      weekId,
      weekStart: s.weekStart,
      weekEnd: s.weekEnd,
      weekNumber: s.weekNumber,
      weekYear: 2026,
      content: s.content,
      estado: s.estado,
      updatedAt: ts(),
      updatedBy: PERSONAGENS.aluno.uid,
      updatedByRole: "aluno",
    };

    if (s.signedByTutor) {
      docData.signedByTutor = true;
      docData.tutorSignedAt = ts();
      docData.tutorSignedById = PERSONAGENS.tutor.uid;
      docData.tutorSignedByName = PERSONAGENS.tutor.nome;
    }

    await sumariosRef.doc(weekId).set(docData, { merge: true });
    console.log(`  ✓ Sumário Semana ${s.weekNumber} (${s.weekStart} — ${s.weekEnd}): ${s.estado}`);
  }
}

// ══════════════════════════════════════════════
// Run
// ══════════════════════════════════════════════

async function run() {
  console.log("\n═══════════════════════════════════════");
  console.log("  Seed Mock Data — InternLink");
  console.log("═══════════════════════════════════════\n");

  const db = ensureInitialized();
  const auth = admin.auth();

  console.log("1/6 Escola...");
  await seedEscola(db);

  console.log("\n2/6 Utilizadores...");
  const adminUid = await seedUser(db, auth, PERSONAGENS.admin);
  const profUid = await seedUser(db, auth, PERSONAGENS.professor);
  const tutorUid = await seedUser(db, auth, PERSONAGENS.tutor, {
    empresa: "Ramada & Associados",
  });
  const alunoUid = await seedUser(db, auth, PERSONAGENS.aluno, {
    courseId: CURSO_ID,
  });

  console.log("\n3/6 Curso...");
  await seedCurso(db);

  console.log("\n4/6 Empresa...");
  await seedEmpresa(db);

  console.log("\n5/6 Estágio...");
  await seedEstagio(db);

  console.log("\n6/6 Presenças...");
  await seedPresencas(db);

  console.log("\n7/7 Sumários...");
  await seedSumarios(db);

  console.log("\n═══════════════════════════════════════");
  console.log("  Seed concluído com sucesso!");
  console.log("\n  Credenciais de login:");
  console.log(`  Admin:     ${PERSONAGENS.admin.email} / ${PERSONAGENS.admin.password}`);
  console.log(`  Professor: ${PERSONAGENS.professor.email} / ${PERSONAGENS.professor.password}`);
  console.log(`  Tutor:     ${PERSONAGENS.tutor.email} / ${PERSONAGENS.tutor.password}`);
  console.log(`  Aluno:     ${PERSONAGENS.aluno.email} / ${PERSONAGENS.aluno.password}`);
  console.log("═══════════════════════════════════════\n");
}

run().catch((err) => {
  console.error("\n✗ Erro durante seed:", err);
  process.exit(1);
});
