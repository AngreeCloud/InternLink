/**
 * Script para popular a coleção landingContent com conteúdo hard coded atual.
 *
 * PRÉ-REQUISITOS:
 *   - .env.local com FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON
 *
 * EXECUÇÃO:
 *   npx tsx scripts/seed-landing-content.ts
 *
 * IDEMPOTÊNCIA:
 *   - Usa set() com merge: true — não duplica, atualiza apenas.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getFirebaseAdminDb } from "../lib/firebase-admin";

async function run() {
  const db = getFirebaseAdminDb();

  // Hero section
  await db.collection("landingContent").doc("hero").set({
    heroTitle: "A plataforma completa para gerir estágios curriculares",
    heroSubtitle: "Gestão integrada de estágios",
    heroDescription: "A InternLink centraliza comunicação, documentação e aprovações entre escolas, alunos e empresas.",
    heroCtaPrimary: "Criar Conta",
    heroCtaSecondary: "Solicitar Acesso",
    updatedAt: new Date(),
  }, { merge: true });

  // Audience
  await db.collection("landingContent").doc("audience").set({
    items: [
      { title: "Alunos", description: "Acompanham o estágio, submetem relatórios e comunicam com a escola." },
      { title: "Professores", description: "Validam documentos, monitorizam progresso e aprovam etapas." },
      { title: "Tutores", description: "Interagem com o aluno e acompanham o plano de estágio." },
      { title: "Escolas", description: "Gerem cursos, pastas e aprovações com total visibilidade." },
    ],
    updatedAt: new Date(),
  }, { merge: true });

  // Features
  await db.collection("landingContent").doc("features").set({
    items: [
      { title: "Gestão integrada", description: "Fluxo único para alunos, professores e tutores acompanharem estágios em tempo real." },
      { title: "Segurança e aprovação", description: "Estados pendente/ativo e validações garantem controlo e conformidade." },
      { title: "Documentos e protocolos", description: "Centralização de protocolos, relatórios e evidências de estágio." },
      { title: "Comunicação fluida", description: "Chat integrado e notificações para decisões rápidas." },
      { title: "Relatórios claros", description: "Dashboards e indicadores para o acompanhamento pedagógico." },
      { title: "Escalável e moderno", description: "Arquitetura cloud pronta para crescimento e novas integrações." },
    ],
    updatedAt: new Date(),
  }, { merge: true });

  // Steps
  await db.collection("landingContent").doc("steps").set({
    items: [
      { title: "Solicitar acesso", description: "A escola submete o pedido e recebe orientação para configuração inicial." },
      { title: "Criação de admin escolar", description: "É criado o perfil responsável e ativados os módulos principais." },
      { title: "Configuração e uso", description: "Cursos, professores e alunos são geridos pela própria escola." },
    ],
    updatedAt: new Date(),
  }, { merge: true });

  // FAQs
  await db.collection("landingContent").doc("faqs").set({
    items: [
      { question: "A plataforma é gratuita?", answer: "Sim, é uma solução académica pensada para uso escolar e projetos PAP." },
      { question: "Como é feita a aprovação de contas?", answer: "O administrador escolar valida contas e controla quem entra na plataforma." },
      { question: "Posso começar só com alguns cursos?", answer: "Sim. A escola pode ativar apenas os cursos necessários e expandir depois." },
    ],
    updatedAt: new Date(),
  }, { merge: true });

  // Testimonials
  await db.collection("landingContent").doc("testimonials").set({
    items: [
      { name: "Catarina M.", role: "Coordenadora de Estágios", text: "Finalmente temos um fluxo claro para aprovar protocolos e acompanhar cada aluno." },
      { name: "João S.", role: "Aluno", text: "Consigo ver o estado do meu estágio e falar com o tutor num só local." },
      { name: "Miguel P.", role: "Professor", text: "A gestão de relatórios ficou muito mais rápida e organizada." },
    ],
    updatedAt: new Date(),
  }, { merge: true });

  // CTA
  await db.collection("landingContent").doc("cta").set({
    ctaTitle: "Pronto para começar?",
    ctaSubtitle: "Crie a sua conta ou solicite acesso para a sua escola.",
    ctaDescription: "Respostas rápidas e acompanhamento contínuo durante todo o processo.",
    updatedAt: new Date(),
  }, { merge: true });

  // Footer
  await db.collection("landingContent").doc("footer").set({
    footerDescription: "Plataforma de gestão de estágios curriculares para escolas, alunos e empresas.",
    footerEmail: "support@internlink.com",
    updatedAt: new Date(),
  }, { merge: true });

  // Legal
  await db.collection("landingContent").doc("legal").set({
    termos: "Conteúdo de termos em preparação. Estes termos irão descrever as regras de utilização da InternLink.",
    privacidade: "Política de privacidade em preparação. Aqui será explicado como tratamos e protegemos os dados.",
    licenca: "A InternLink é um projeto académico. Informação de licença em preparação.",
    updatedAt: new Date(),
  }, { merge: true });

  // Support auto-reply
  await db.collection("landingContent").doc("support").set({
    autoReply: "Olá! Obrigado por contactar a equipa de suporte da InternLink. Um agente irá responder-lhe em breve.",
    updatedAt: new Date(),
  }, { merge: true });

  console.log("[seed-landing] Conteúdo da landing page semeado com sucesso.");
}

run().catch((err) => {
  console.error("[seed-landing] Erro:", err.message || err);
  process.exit(1);
});
