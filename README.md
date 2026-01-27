# InternLink

## 🧠 Objetivo do Projeto

Esta aplicação web tem como objetivo **facilitar e organizar a gestão dos estágios curriculares (FCT)** entre alunos, escolas e empresas.  
É uma plataforma central onde os três intervenientes — **Aluno**, **Representante da Escola** e **Representante da Empresa** — podem comunicar, partilhar documentos e acompanhar o progresso do estágio.  
Além disso, existe um **Administrador** que gere as entidades envolvidas e aprova os acessos.

O foco está em criar uma solução **intuitiva, segura e escalável**, com desenvolvimento rápido e baixo overhead técnico, aproveitando ao máximo os serviços serverless da Firebase.

---

## 🧱 Stack Tecnológica

Para garantir **velocidade de desenvolvimento**, **simplicidade de deploy** e **manutenção mínima**, a stack escolhida é:

- **Framework principal:** [Next.js](https://nextjs.org/) (React + SSR/CSR/SSG + API Routes)  
- **Estilização:** Tailwind CSS  
- **Backend-as-a-Service:** Firebase  
- **Base de Dados:** Firebase Realtime Database  
- **Storage de Ficheiros:** Firebase Cloud Storage  
- **Autenticação:** Firebase Authentication (email/senha + Google)  
- **Chat em tempo real:** Firebase Realtime Database  
- **Deploy:** Vercel (Next.js) + Firebase Hosting (assets e fallback)  
- **Gestão de dependências:** `package.json` + CI/CD com GitHub Actions  

---

## 👥 Perfis de Utilizador

- **Aluno**: consulta protocolo, submete relatório após desbloqueio e comunica com os outros intervenientes.  
- **Representante da Escola**: submete protocolo, acompanha relatório e comunica com aluno e empresa.  
- **Representante da Empresa**: visualiza protocolo e relatório, participa no chat.  
- **Administrador**: aprova contas, cria escolas e empresas, associa utilizadores e gere permissões.

---

## 🔐 Registo e Autenticação

- Registo com nome, email, password, tipo de utilizador, escola, empresa e descrição do estágio.  
- Conta fica **pendente** até aprovação do administrador.  
- Autenticação via **Firebase Authentication** (email/senha + Google).  
- Papéis e estado de aprovação guardados na **Realtime Database**.

---

## 📁 Gestão de Documentos

- **Protocolo de Estágio**: submetido pela escola, visível para todos os intervenientes, guardado no **Cloud Storage** com metadados na DB.  
- **Relatório de Estágio**: submetido pelo aluno (bloqueado nas primeiras 2 semanas), depois disponível para upload. Escola e empresa podem visualizar/download. Guardado no **Cloud Storage** com permissões controladas.

---

## 💬 Comunicação (Chat)

- Canal de chat privado por estágio, entre aluno, escola e empresa.  
- Implementado com **Firebase Realtime Database**, garantindo sincronização em tempo real.  
- Mensagens com timestamp e remetente, visíveis apenas para os participantes.

---

## 🧭 Navegação e Filtros

- Escola e empresa podem filtrar protocolos e relatórios por aluno.  
- Interface com **setas de navegação** e **barra de pesquisa**.  
- Implementado no frontend com React/Next.js, consumindo dados da DB.

---

## 🛠️ Painel Administrativo

- Aprovar/rejeitar contas pendentes.  
- Criar escolas e empresas.  
- Associar utilizadores.  
- Gerir permissões e papéis.  
- Construído em Next.js (React) e protegido por regras de acesso.

---

## 🔒 Segurança e Validações

- Passwords geridas pelo Firebase Auth (encriptação automática).  
- Uploads validados (PDF/DOCX).  
- Regras de segurança Firebase garantem acesso restrito.  
- Logs de atividade guardados na DB (submissões, visualizações).

---

## 📣 Extras

- **Notificações**: via listeners no frontend ou Firebase Cloud Messaging.  
- **Exportação de relatórios em PDF**: no cliente (ex.: pdfmake) ou via Cloud Function.  
- **CI/CD**: GitHub Actions automatiza build e deploy (Vercel + Firebase Hosting).

---

## 🚀 Instalação e Execução

1. Clonar o repositório:
   \`\`\`bash
   git clone https://github.com/AngreeCloud/InternLink.git
   cd InternLink
