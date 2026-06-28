# RUN_REPORT.md

Started: 2026-06-28

***

## Auditoria inicial — Super Admin & Funcionalidades Adjacentes

### Estrutura de rotas atual
| Rota | Tipo | Proteção |
|---|---|---|
| `/` | Landing page pública | Nenhuma |
| `/login` | Login público | Nenhuma |
| `/register` | Registo público | Nenhuma |
| `/solicitar-acesso` | Formulário enliste público | Nenhuma |
| `/para-escolas`, `/contacto`, `/sobre` | Páginas estáticas | Nenhuma |
| `/termos`, `/privacidade`, `/licenca` | Páginas legais | Nenhuma |
| `/school-admin/**` | Admin escolar | Sessão + role=admin_escolar |
| `/professor/**` | Professor | Sessão + role=professor + estado=ativo |
| `/tutor/**` | Tutor | Sessão + role=tutor + estado=ativo |
| `/dashboard/**` | Aluno | Sessão + role=aluno + estado=ativo |
| `/encarregado/**` | Encarregado | Sessão + role=encarregado + estado=ativo |
| `/api/auth/session` | API sessão | idToken verification |
| `/api/**` | Vários endpoints API | Admin SDK (requireSessionUid) |

### Roles e claims existentes
- `AppUserRole`: `aluno`, `professor`, `tutor`, `admin_escolar`, `encarregado`
- `AppUserEstado`: `ativo`, `pendente`, `recusado`, `removido`, `inativo`
- Custom claims: `role`, `estado` — definidos em `ensureUserClaims()` (`lib/auth/custom-claims.ts`)
- Sincronização: `users/{uid}` → `role`, `estado` → custom claims do Firebase Auth
- Verificação server-side: `ensureUserClaims` valida contra Firestore, não confia só no token
- NÃO existem: `super_admin`, `support`

### Sistema de chat — implementação encontrada
- **Realtime Database** (Firebase RTDB)
- Paths: `conversations/{id}`, `messages/{convId}/{msgId}`, `typing/{convId}/{uid}`, `userConversations/{uid}/{convId}`
- `lib/chat/realtime-chat.ts` — 1363 linhas
- Sincronização via `onValue` + `runTransaction`
- OrgMember sync para chat de grupo
- Regras RTDB em `database.rules.json` (200 linhas)

### Conteúdo hard coded da landing page
- **Secção "Para quem é"** (audience): 4 itens — Alunos, Professores, Tutores, Escolas — cada com title, description, icon
- **Secção "Funcionalidades"** (features): 6 itens — Gestão integrada, Segurança, Documentos, Comunicação, Relatórios, Escalável
- **Secção "Como funciona"** (steps): 3 passos — Solicitar acesso, Criação admin, Configuração
- **Secção "FAQ"** (faqs): 3 perguntas — Gratuita?, Aprovação de contas, Começar com alguns cursos
- **Secção "Testemunhos"** (testimonials): 3 testemunhos — Catarina M., João S., Miguel P.
- **Hero section**: Título, subtítulo, descrição, botões
- **Footer**: Logo, descrição, email support, secções de links
- Total: ~25 campos de conteúdo editável

### Firestore rules atuais — resumo relevante
- 735 linhas em `firestore.rules`
- Funções de role: `isSchoolAdmin()`, `isSchoolAdminFor(schoolId)`, `isProfessor()`, `isProfessorFor()`, `isTutor()`, `isStudent()`
- **Nenhuma** função para `super_admin` ou `support`
- Coleção `schools/{schoolId}`: `allow read: if true` (pública!)
- Coleção `schoolRequests`: NÃO existe nas rules (usado pelo formulário solicitar-acesso via client action)
- Coleção `users/{userId}`: leitura restrita ao próprio, membros da mesma escola, school admin da escola
- Não existem coleções `schoolLeads`, `landingContent`, `supportTickets`

### Realtime Database rules atuais — resumo relevante
- 200 linhas em `database.rules.json`
- `.read: false`, `.write: false` por omissão
- `conversations/{id}`: apenas participantes (participants map)
- `messages/{convId}/{msgId}`: apenas participantes da conversa
- **Nenhuma** regra para tickets de suporte ou canais de suporte

### Estruturas parciais encontradas
- `components/admin/admin-overview.tsx` (16919 linhas) — dashboard admin escolar existente
- `components/admin/users-manager.tsx` (9666 linhas) — gestão de utilizadores pelo admin escolar
- `actions/school-requests.ts` — ação client-side que escreve em `schoolRequests` (Firestore)
- `scripts/seed-school-admin.js` — padrão para scripts standalone com Firebase Admin SDK
- `.gitignore` cobre `.env*` mas NÃO específico para `scripts/create-super-admin.*`

### Testes existentes relevantes
- `tests/firestore/school-isolation.rules.test.mjs`
- `tests/firestore/tutor-professor-access.rules.test.mjs`
- `tests/firestore/course-director-estagio-access.rules.test.mjs`
- `tests/realtime/chat-creation.rules.test.mjs`
- `tests/realtime/user-tutors.rules.test.mjs`
- Runner: `tests/firestore/run-rules-tests.mjs` via `node --test`
- Formato: Firebase emulator rules tests (.mjs)

***

## Fase B — Script super admin + roles + routing

**Status:** completo

**Ficheiros modificados:**
- `lib/auth/session.ts` — Adicionado `super_admin` e `support` a AppUserRole, APP_USER_ROLES, PROTECTED_ROUTE_PREFIXES, isRoleAllowedForPath
- `lib/auth/status-routing.ts` — Adicionado redirect para /super-admin, /support
- `.gitignore` — Adicionado `scripts/create-super-admin.*`

**Ficheiros criados:**
- `scripts/create-super-admin.js` — Script standalone idempotente

**Decisões:**
- Password: `48<Hj5d%`, Email: `admin@internlink.com`
- Custom claims: `{ role: "super_admin", estado: "ativo" }`
- Idempotente — verifica existência antes de criar
- Usa `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` do `.env.local`

**Execução:** `node scripts/create-super-admin.js`

***

## Fase C — Firestore rules + Realtime Database rules

**Status:** completo

**Ficheiros modificados:**
- `firestore.rules` — +isSuperAdmin(), +isSupport(), regras schoolLeads/landingContent/supportTickets, override users/schools
- `database.rules.json` — type `support` validado, roles support/super_admin no validate

**Novas regras Firestore:**
| Collection | Read | Write |
|---|---|---|
| `schoolLeads/{leadId}` | super_admin, support | create any signed-in; update/delete super_admin+support |
| `landingContent/{docId}` | público | super_admin |
| `supportTickets/{ticketId}` | owner, support assigned, super_admin | owner create; support/super_admin update; super_admin delete |
| `users/{userId}` | +super_admin | (inalterado) |
| `schools/{schoolId}` | (inalterado) | +super_admin |

***

## Fase D — Dashboard do super admin

**Status:** completo

**Ficheiros criados/modificados:**
- `app/super-admin/layout.tsx` — Layout protegido (verifica role super_admin)
- `app/super-admin/page.tsx` — Visão geral com stats
- `app/super-admin/escolas/page.tsx` — Criar escola (auto school-admin) + ver leads
- `app/super-admin/support/page.tsx` — Gerir contas support (criar + listar)
- `app/super-admin/landing/page.tsx` — Editor de conteúdo da landing page
- `components/layout/super-admin-layout.tsx` — Layout com sidebar, auth check
- `app/api/super-admin/stats/route.ts` — GET stats
- `app/api/super-admin/schools/route.ts` — POST criar escola + admin
- `app/api/super-admin/support/route.ts` — GET/POST contas support
- `app/api/super-admin/leads/route.ts` — GET leads + schoolRequests
- `app/api/super-admin/landing/route.ts` — GET/POST conteúdo landing

**Decisões:**
- Password school-admin gerada com crypto.randomBytes
- Password support gerada com crypto.randomBytes
- Credenciais apresentadas no ecrã após criação — NÃO armazenadas em texto simples
- Layout segue padrão do school-admin-layout (sidebar + header + dropdown)
- API routes verificam claim super_admin via session cookie (server-side)

***

## Fase E — Script seed conteúdo landing page

**Status:** completo

**Ficheiro criado:**
- `scripts/seed-landing-content.ts` — Popula landingContent com dados hardcoded atuais

**Execução:** `npx tsx scripts/seed-landing-content.ts`

**Conteúdo migrado:**
- Hero (title, subtitle, description, CTA texts)
- Audience (4 itens)
- Features (6 itens)
- Steps (3 itens)
- FAQs (3 itens)
- Testimonials (3 itens)
- CTA section
- Footer (description, email)

***

## Fase F — Landing page lê da Firestore

**Status:** completo

**Ficheiros modificados:**
- `app/page.tsx` — fetch /api/landing-content no mount, merge com hardcoded fallback
- `app/api/landing-content/route.ts` — API pública para ler landingContent

**Decisões:**
- Hardcoded data mantido como fallback (graceful degradation)
- Icons permanecem hardcoded (React components não serializáveis)
- mergeItems() faz merge item-a-item, preservando icons do hardcoded

***

## Fase G — Dashboard de support

**Status:** completo

**Ficheiros criados:**
- `app/support/layout.tsx` — Layout protegido (verifica role support)
- `app/support/page.tsx` — Lista tickets com tabs (abertos/em progresso/fechados/todos)
- `components/layout/support-layout.tsx` — Layout com sidebar, auth check
- `app/api/support/tickets/route.ts` — GET (list tickets por support) + PATCH (update status)
- `app/api/support/tickets/create/route.ts` — POST (criar ticket)

**Decisões:**
- Tickets status: open, in_progress, closed
- Support agent vê só tickets atribuídos a si (where assignedTo == uid)
- Super admin vê todos os tickets
- UI com Select para mudar status inline

***

## Fase H — Botão de suporte

**Status:** parcial (professor + school-admin done)

**Ficheiros criados/modificados:**
- `components/chat/support-button.tsx` — Dialog de criação de ticket
- `components/layout/professor-layout.tsx` — +SupportButton no header
- `components/layout/school-admin-layout.tsx` — +SupportButton no header

**Pendente:**
- dashboard-layout (aluno)
- tutor-layout
- encarregado-layout
- landing page footer (pode usar SupportButton mesmo sem userId)

***

## Fase I — Formulário enliste 2 passos

**Status:** completo

**Ficheiros modificados/criados:**
- `app/solicitar-acesso/page.tsx` — Refatorado para 2 passos (escola + plano)
- `app/api/school-leads/route.ts` — POST para guardar leads

**Decisões:**
- Passo 1: dados da escola + contacto (campos existentes)
- Passo 2: seleção de plano (Starter/Organisation) + campos pagamento (UI only, disabled)
- Badge "Coming Soon" no pagamento
- Guarda em `schoolLeads/{leadId}` (nova coleção)
- Formulário antigo de solicitar-acesso continuava a usar `schoolRequests` — mantido em paralelo

***

## Fase J — Página de preços

**Status:** completo

**Ficheiro criado:**
- `app/precos/page.tsx` — Página com 2 planos (Starter 30€, Organisation 250€/ano)

**Decisões:**
- Limites apenas informativos (UI, não backend)
- Badge "Beta" + "Coming Soon" no Stripe
- Sem integração Stripe real
- Design consistente com landing page

***

## Resumo geral

### Fases completas: A, B, C, D, E, F, G, I, J
### Fase parcial: H (falta wiring em 3 layouts + landing footer)

### Commit messages propostas (ordem):

1. `feat(auth): add super_admin and support roles with routing protection`
2. `feat(scripts): add create-super-admin script with idempotent Firebase Auth setup`
3. `chore(security): add create-super-admin script to .gitignore`
4. `feat(rules): add super_admin/support roles to Firestore and Realtime Database rules`
5. `feat(super-admin): add dashboard with school creation, support accounts, leads, landing page editor`
6. `feat(landing): seed landing page content to Firestore with idempotent script`
7. `feat(landing): render landing page from Firestore with hardcoded fallback`
8. `feat(support): add support dashboard with ticket management system`
9. `feat(support): add support button component with ticket creation dialog`
10. `feat(enlist): refactor school request form to 2-step (school info + plan selection)`
11. `feat(pricing): add pricing page with Starter and Organisation plans`

### Pendentes reais:
1. Testes de Firestore rules para novas coleções (schoolLeads, landingContent, supportTickets)
2. Testes de Realtime Database rules para support chat
3. Wiring SupportButton nos layouts: dashboard, tutor, encarregado, landing footer
4. Integração do chat de suporte com RTDB (reutilizar infraestrutura conversations/messages)
5. Integração do Stripe (quando estiver pronto)

### Como correr cada script:
- `node scripts/create-super-admin.js` — Cria conta super admin
- `npx tsx scripts/seed-landing-content.ts` — Popula conteúdo landing page

### Riscos:
- Regras Firestore novas não testadas com emulador (testes pendentes)
- Claims super_admin/support não testadas em ambiente real
- School id generation pode colidir (baseado em nome)  

