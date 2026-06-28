# REPORT_01_EXTERNAL_ARCHITECTURE.md — Arquitetura Externa

> **Progresso**: 495/495 ficheiros inspecionados

---

## 1. Estrutura do Firestore

### 1.1 Coleções de Topo

#### `users/{uid}`
Documento principal de perfil de utilizador.

| Campo | Tipo | Descrição |
|---|---|---|
| `uid` | string | Firebase Auth UID |
| `nome` | string | Nome completo |
| `email` | string | Email |
| `role` | string | `aluno` \| `professor` \| `tutor` \| `admin_escolar` \| `encarregado` \| `super_admin` \| `support` |
| `estado` | string | `ativo` \| `pendente` \| `recusado` \| `removido` \| `inativo` |
| `schoolId` | string | ID da escola associada |
| `escola` | string | Nome da escola (denormalized) |
| `escolaId` | string | Alias de schoolId (legacy) |
| `courseId` | string | ID do curso/turma (alunos/professores) |
| `curso` | string | Nome do curso (denormalized) |
| `dataNascimento` | string | Data de nascimento ISO |
| `telefone` | string | Número de telefone |
| `photoURL` | string | URL da foto de perfil |
| `signatureDataUrl` | string | Assinatura em base64 data URL |
| `educandoIds` | string[] | IDs dos educandos (encarregado) |
| `encarregadoId` | string | ID do encarregado (aluno) |
| `empresa` | string | Empresa do tutor |
| `funcaoEmpresa` | string | Função na empresa (tutor) |
| `emailVerified` | boolean | Email verificado |
| `createdAt` | timestamp | Data de criação |
| `updatedAt` | timestamp | Data de atualização |

**Subcoleção**: `users/{uid}/settings/{settingId}` — configurações privadas (assinatura)

**Relações**:
- `users/{uid}` → `schools/{schoolId}` (N:1, via schoolId)
- `users/{uid}` → `courses/{courseId}` (N:1, via courseId)
- `users/{uid}` → `users/{encarregadoId}` (N:1, aluno→encarregado)
- `users/{uid}` → `users/{educandoIds}` (1:N, encarregado→alunos)

---

#### `pendingRegistrations/{uid}`
Registos pendentes de verificação de email ou aprovação.

| Campo | Tipo | Descrição |
|---|---|---|
| `role` | string | Role pretendida |
| `estado` | string | `pendente` \| `inativo` |
| `email` | string | Email |
| `emailVerified` | boolean | Estado de verificação |
| `schoolId` | string | ID da escola |
| `escola` | string | Nome da escola |
| `courseId` | string | ID do curso (aluno/professor) |
| `curso` | string | Nome do curso |

---

#### `schools/{schoolId}`
Metadados e configuração da escola.

| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | string | Nome da escola |
| `morada` | string | Morada |
| `codigoPostal` | string | Código postal |
| `localidade` | string | Localidade |
| `telefone` | string | Telefone |
| `email` | string | Email institucional |
| `website` | string | Website |
| `logoUrl` | string | URL do logotipo |
| `requireInstitutionalEmail` | boolean | Exigir email institucional |
| `emailDomain` | string | Domínio para email institucional |
| `allowGoogleLogin` | boolean | Permitir login Google |
| `requiresPhone` / `requirePhone` | boolean | Exigir telefone (legacy+novo) |
| `requirePhoneVerification` | boolean | Exigir verificação de telefone |
| `avaliacaoConfig` | object | Configuração de avaliação (escalas, parâmetros) |
| `empresasPageAccess` | object | Acesso à página de empresas por role |
| `createdAt` | timestamp | Data de criação |

**Subcoleções**:
- `schools/{id}/folders/{folderId}` — pastas de documentos
- `schools/{id}/tutors/{tutorId}` — registo de tutores na escola
- `schools/{id}/pendingTeachers/{uid}` — professores pendentes (legacy, migrando)
- `schools/{id}/deleteEstagioRequests/{requestId}` — pedidos de eliminação de estágio
- `schools/{id}/approvalHistory/{docId}` — histórico de aprovações
- `schools/{id}/auditLogs/{logId}` — logs de auditoria

**Relações**:
- `schools/{id}` → `courses` (1:N, via schoolId)
- `schools/{id}` → `users` (1:N, via schoolId)
- `schools/{id}` → `empresas` (1:N, via schoolId)
- `schools/{id}` → `estagios` (1:N, via schoolId)

---

#### `courses/{courseId}`
Cursos e turmas.

| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | string | Nome do curso |
| `schoolId` | string | ID da escola |
| `teacherIds` | string[] | IDs dos professores associados |
| `courseDirectorId` | string | ID do diretor de curso |
| `supportingTeacherIds` | string[] | IDs dos professores de apoio |
| `reportMinHours` | number | Horas mínimas para relatório final |
| `reportWaitDays` | number | Dias de espera antes de poder submeter relatório |
| `directorCanDeleteEstagio` | boolean | Diretor pode eliminar estágios |
| `createdAt` | timestamp | Data de criação |

**Subcoleção**: `courses/{id}/settings/{settingId}` — configurações (datas de avaliação, etc.)

---

#### `estagios/{estagioId}`
Documento principal do estágio FCT.

| Campo | Tipo | Descrição |
|---|---|---|
| `alunoId` | string | ID do aluno |
| `alunoNome` | string | Nome do aluno (denormalized) |
| `professorId` | string | ID do professor orientador |
| `professorNome` | string | Nome do professor (denormalized) |
| `tutorId` | string | ID do tutor externo |
| `tutorNome` | string | Nome do tutor (denormalized) |
| `schoolId` | string | ID da escola |
| `courseId` | string | ID do curso do professor |
| `alunoCourseId` | string | ID do curso do aluno |
| `empresaId` | string | ID da empresa |
| `empresaSnapshot` | object | Cópia dos dados da empresa no momento da associação |
| `titulo` | string | Título do estágio |
| `dataInicio` | string | Data de início (YYYY-MM-DD) |
| `dataFimEstimada` | string | Data de fim estimada (YYYY-MM-DD) |
| `totalHoras` | number | Total de horas previstas |
| `horasRealizadas` | number | Horas realizadas |
| `horasDiarias` | number | Horas por dia |
| `horasAusenciaAcumuladas` | number | Horas de ausência acumuladas |
| `diasSemana` | object | Dias da semana de trabalho (mapa booleano) |
| `estado` | string | Estado: `ativo` \| `concluido` \| `arquivado` \| `eliminado` \| `suspenso` |
| `estadoEstagio` | string | Estado legível: `em_curso` \| `concluido` \| `eliminado` |
| `arquivadoEm` | timestamp | Data de arquivo |
| `arquivadoPor` | string | UID de quem arquivou |
| `encarregadoId` | string | ID do encarregado de educação |
| `diasUteis` | number | Número de dias úteis calculados |
| `createdAt` | timestamp | Data de criação |

**Subcoleções**:
- `documentos/{docId}` — metadados do documento + currentVersion
- `documentos/{docId}/versoes/{n}` — versões imutáveis do PDF
- `documentos/{docId}/assinaturas/{signerUid}` — registo de assinatura
- `presencas/{dateId}` — registo diário de horas
- `sumarios/{weekId}` — sumário semanal
- `avaliacao/{avalId}` — avaliações (`tutor` e `professor`)
- `schedule_change_requests/{requestId}` — pedidos de alteração
- `notifications/{notifId}` — notificações do estágio

---

#### `empresas/{empresaId}`
Entidades de acolhimento.

| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | string | Nome da empresa |
| `nomeNormalizado` | string | Nome normalizado (busca) |
| `nif` | string | NIF |
| `nifNormalizado` | string | NIF só dígitos |
| `setor` | string | Setor de atividade |
| `morada` | string | Morada |
| `localidade` | string | Localidade |
| `codigoPostal` | string | Código postal |
| `website` | string | Website |
| `telefone` | string | Telefone |
| `email` | string | Email |
| `schoolId` | string | ID da escola |
| `tutorIds` | string[] | IDs dos tutores associados |
| `empresaGrants` | object | Permissões por professor: `{ [uid]: "read" \| "write" }` |
| `ativa` | boolean | Empresa ativa (não arquivada) |
| `logoUrl` | string | URL do logotipo |
| `fotos` | object[] | Galeria de fotos |
| `createdBy` | string | UID do criador |
| `createdAt` | timestamp | Data de criação |

**Subcoleção**: `empresas/{id}/tutores/{tutorId}` — overrides por empresa (função, telefone, notas)

---

#### Outras Coleções

| Coleção | Descrição |
|---|---|
| `tutorInvites/{inviteId}` | Convites a tutores externos |
| `internships/{id}` | Tabela legacy de estágios (migração em curso) |
| `internshipReports/{id}` | Relatórios legacy |
| `documentos/{id}` | Documentos geridos por professor |
| `chatAccess/{convId}` | Controlo de acesso a conversas (participants map) |
| `schoolLeads/{leadId}` | Leads de escolas interessadas |
| `landingContent/{docId}` | Conteúdo CMS da landing page |
| `supportTickets/{ticketId}` | Tickets de suporte |

---

### 1.2 Índices Configurados

19 índices compostos em `firestore.indexes.json`:
- `courses`: schoolId + createdAt
- `users`: schoolId + role + estado
- `estagios`: 8 índices (professorId + schoolId, empresaId + schoolId + createdAt, courseId + schoolId + estado, etc.)
- `notifications`: collection group (userId + createdAt)
- `empresas`: schoolId + nomeNormalizado (+ ativa)
- `auditLogs`: 6 índices (schoolId + timestamp, entityType + entityId + timestamp, changedBy + timestamp, etc.)

---

## 2. Estrutura da Realtime Database

Usada exclusivamente para o sistema de chat em tempo real.

```
conversations/{convId}/
├── type: "direct" | "group" | "support"
├── orgId: string | null
├── participants/{uid}: true
├── readState/{uid}: timestamp
├── lastMessage/{text, senderId, createdAt, hasAttachments}
├── createdAt: number
└── updatedAt: number

messages/{convId}/{msgId}/
├── senderId: string
├── text: string | null
├── attachments/{attId}/{url, storagePath, size, mimeType, fileName}
├── createdAt: number
├── editedAt: number | null
├── deleted: boolean
├── deletedAt: number | null
└── seenBy/{uid}: timestamp

typing/{convId}/{uid}: boolean

userConversations/{uid}/{convId}/
├── lastMessageText: string | null
├── lastMessageAt: number
├── unreadCount: number
└── isMuted: boolean

orgMembers/{orgId}/{uid}/
├── name: string
├── email: string
└── role: "student" | "teacher" | "tutor" | "admin" | "encarregado" | "support" | "super_admin"

userTutors/{studentId}/{tutorId}: true
userBlocks/{userId}/{blockedUserId}: true
```

---

## 3. Firebase Storage

### 3.1 Organização de Paths

| Path | Conteúdo | Limite | Tipos permitidos |
|---|---|---|---|
| `profile-photos/{userId}/*` | Fotos de perfil | 5 MB | image/* |
| `school-assets/{schoolId}/*` | Assets da escola | 5 MB | image/* |
| `chat-attachments/{convId}/{msgId}/{attId}/*` | Anexos de chat | 8 MB | qualquer |
| `empresa-logos/{empresaId}/*` | Logotipos de empresas | 5 MB | image/* |
| `empresa-photos/{empresaId}/*` | Fotos de empresas | 10 MB | image/* |
| `signatures/{userId}/*` | Assinaturas pessoais | 2 MB | image/* |
| `estagios/{id}/documentos/*` | PDFs e docs de estágio | 25 MB | PDF, DOCX, XLSX, image/* |
| `estagios/{id}/relatorios/*` | Relatórios finais | 25 MB | PDF, DOCX |
| `estagios/__broadcast__/{courseId}/*` | Documentos broadcast | 25 MB | PDF, DOCX, XLSX |

### 3.2 Regras de Segurança (Resumo)

- **profile-photos**: Leitura por qualquer autenticado; escrita só pelo próprio
- **school-assets**: Leitura por qualquer autenticado; escrita só por admin_escolar da escola
- **chat-attachments**: Leitura/escrita só por participantes da conversa (verifica `chatAccess/{convId}`)
- **empresa-logos/photos**: Leitura autenticados; escrita por admin_escolar ou professor ativo
- **signatures**: Leitura/escrita só pelo próprio
- **estagios/{id}/documentos**: Leitura por membros do estágio (verifica via `firestore.get`); escrita por professor ou admin da escola; **delete bloqueado** (histórico imutável)
- **estagios/{id}/relatorios**: Leitura por membros; escrita só pelo aluno
- **estagios/__broadcast__**: Leitura por qualquer autenticado; escrita por professor ativo

---

## 4. Sistema de Autenticação Firebase Auth

### 4.1 Métodos

- **Email + Password**: Método principal
- **Google Sign-In**: Opcional, controlado por escola (`allowGoogleLogin`). Bloqueado se `requireInstitutionalEmail=true`
- **Verificação de email**: Obrigatória para alunos e professores; opcional para tutores (ficam `inativo` até verificarem)

### 4.2 Custom Claims

| Claim | Valores | Descrição |
|---|---|---|
| `role` | `aluno`, `professor`, `tutor`, `admin_escolar`, `encarregado`, `super_admin`, `support` | Role do utilizador |
| `estado` | `ativo`, `pendente`, `recusado`, `removido`, `inativo` | Estado da conta |

Sincronizadas via `lib/auth/custom-claims.ts:ensureUserClaims()` — lê Firestore `users/{uid}` (ou `pendingRegistrations/{uid}` como fallback), normaliza valores, só escreve se alteradas.

### 4.3 Sessão

- **Cookie**: `internlink_session` — HTTP-only, Secure (produção), SameSite=Lax, 14 dias
- **Validação**: JWT via `jose` (Edge-compatible), chaves públicas Google JWKS cacheadas
- **Middleware**: `proxy.ts` — valida cookie em todas as rotas protegidas, redireciona para `/login` ou `/account-status`

### 4.4 Roles e Permissões Associadas

| Role | Pode |
|---|---|
| `aluno` | Ver próprio estágio, registar horas, escrever sumários, submeter relatório, assinar docs, chat |
| `professor` | Criar/editar estágios, gerir documentos, aprovar/rejeitar alunos, assinar avaliações, gerir empresas, convidar tutores, chat |
| `tutor` | Ver estágios atribuídos, validar sumários, assinar avaliação, aprovar/rejeitar pedidos, criar fechos de empresa, chat |
| `admin_escolar` | Gerir cursos, aprovar/rejeitar professores/alunos, gerir pastas, ver auditoria, configurar escola, gerir EE, eliminar estágios |
| `encarregado` | Ver educandos e seus estágios, aceitar protocolos, receber notificações |
| `super_admin` | Criar escolas+admins, editar landing page, ver stats globais, gerir contas suporte |
| `support` | Ver/gerir tickets de suporte, responder a utilizadores |

---

## 5. Middleware de Proteção de Rotas

### `proxy.ts`
Ficheiro: `proxy.ts:55`

Middleware edge que corre em todas as rotas protegidas:
1. Verifica se o path é protegido (`isProtectedPath`)
2. Lê cookie `internlink_session`
3. Valida JWT via `validateFirebaseSessionJwt` (verifica `exp`, `role`, `estado`)
4. Cache em memória de perfis (keyed por `uid:exp`)
5. Verifica `isRoleAllowedForPath` — mapeia prefixos de rota para roles permitidas
6. Redireciona para `/login` se não autenticado, `/account-status` se estado != ativo

**Matcher**: `/student/:path*`, `/dashboard/:path*`, `/professor/:path*`, `/tutor/:path*`, `/school-admin/:path*`, `/encarregado/:path*`

### Route-Level Protection Matrix

| Prefixo | Roles permitidos | Estado exigido |
|---|---|---|
| `/dashboard` | `aluno` | `ativo` |
| `/professor` | `professor` | `ativo` |
| `/tutor` | `tutor` | `ativo` |
| `/school-admin` | `admin_escolar` | `ativo` |
| `/encarregado` | `encarregado` | `ativo` |
| `/super-admin` | `super_admin` | (sem restrição) |
| `/support` | `support` | (sem restrição) |
| `/profile` | todos | autenticado |
| `/account-status` | todos | autenticado |

---

## 6. Mapa Completo de Rotas

### 6.1 Páginas Públicas (sem auth)

| Rota | Descrição |
|---|---|
| `/` | Landing page (CMS-driven) |
| `/login` | Login |
| `/register` | Seleção de role para registo |
| `/register/aluno` | Registo de aluno |
| `/register/professor` | Registo de professor |
| `/register/tutor` | Registo de tutor |
| `/forgot-password` | Recuperação de password |
| `/verify-email` | Verificação de email |
| `/sobre` | Sobre o projeto |
| `/para-escolas` | Página para escolas |
| `/precos` | Preços |
| `/contacto` | Contacto |
| `/termos` | Termos de serviço |
| `/privacidade` | Política de privacidade |
| `/licenca` | Licença |
| `/solicitar-acesso` | Pedido de acesso para escolas |

### 6.2 Páginas Protegidas (requerem auth)

| Rota | Role(s) | Descrição |
|---|---|---|
| `/dashboard` | aluno | Dashboard do aluno |
| `/dashboard/chat` | aluno | Chat do aluno |
| `/dashboard/estagio` | aluno | Resolver estágio |
| `/dashboard/estagio/[id]` | aluno | Detalhe do estágio |
| `/dashboard/protocols` | aluno | Protocolos |
| `/dashboard/reports` | aluno | Relatórios |
| `/dashboard/users` | aluno | Redireciona para dashboard |
| `/professor` | professor | Dashboard professor |
| `/professor/alunos` | professor | Gestão de alunos |
| `/professor/aprovacoes` | professor | Redireciona para alunos |
| `/professor/chat` | professor | Chat |
| `/professor/documentos` | professor | Gestão de documentos |
| `/professor/empresas` | professor | Lista de empresas |
| `/professor/empresas/nova` | professor | Nova empresa |
| `/professor/empresas/[id]` | professor | Detalhe empresa |
| `/professor/estagios` | professor | Lista de estágios |
| `/professor/estagios/[id]` | professor | Detalhe estágio |
| `/professor/justificacoes` | professor | Centro de pedidos |
| `/professor/tutores` | professor | Gestão de tutores |
| `/tutor` | tutor | Dashboard tutor |
| `/tutor/chat` | tutor | Chat |
| `/tutor/documentos` | tutor | Documentos |
| `/tutor/estagios` | tutor | Seletor de escola |
| `/tutor/estagios/[schoolId]` | tutor | Estágios da escola |
| `/tutor/estagios/[schoolId]/[estagioId]` | tutor | Detalhe estágio |
| `/tutor/estagios/[schoolId]/[estagioId]/protocolo` | tutor | Protocolo |
| `/tutor/estagios/[schoolId]/[estagioId]/relatorios` | tutor | Relatórios |
| `/tutor/inbox` | tutor | Inbox |
| `/tutor/solicitacoes-horario` | tutor | Pedidos de horário |
| `/tutor/sumarios` | tutor | Validação de sumários |
| `/school-admin` | admin_escolar | Dashboard |
| `/school-admin/aprovacoes` | admin_escolar | Aprovações |
| `/school-admin/chat` | admin_escolar | Chat |
| `/school-admin/cursos` | admin_escolar | Gestão de cursos |
| `/school-admin/empresas` | admin_escolar | Empresas |
| `/school-admin/empresas/nova` | admin_escolar | Nova empresa |
| `/school-admin/empresas/[id]` | admin_escolar | Detalhe empresa |
| `/school-admin/encarregados` | admin_escolar | Gestão de EE |
| `/school-admin/estagios` | admin_escolar | Todos os estágios |
| `/school-admin/estagios/[id]` | admin_escolar | Detalhe estágio |
| `/school-admin/historico` | admin_escolar | Auditoria |
| `/school-admin/informacoes` | admin_escolar | Info da escola |
| `/school-admin/pastas` | admin_escolar | Pastas |
| `/school-admin/perfil` | admin_escolar | Perfil |
| `/school-admin/professores` | admin_escolar | Professores |
| `/school-admin/tutores` | admin_escolar | Tutores |
| `/encarregado` | encarregado | Dashboard |
| `/encarregado/chat` | encarregado | Chat |
| `/encarregado/configuracoes` | encarregado | Configurações |
| `/encarregado/educando/[id]` | encarregado | Detalhe educando |
| `/encarregado/notificacoes` | encarregado | Notificações |
| `/super-admin` | super_admin | Dashboard |
| `/super-admin/escolas` | super_admin | Gestão escolas |
| `/super-admin/landing` | super_admin | Editor landing |
| `/super-admin/support` | super_admin | Gestão suporte |
| `/support` | support | Tickets |
| `/profile` | todos auth | Perfil |
| `/account-status` | todos auth | Estado da conta |
| `/waiting` | todos auth | Redireciona account-status |
| `/re-solicitar-acesso` | professor | Re-solicitar acesso |

### 6.3 API Routes (75 endpoints)

Ver `REPORT_00_INDEX.md` para contagem. Organizadas por domínio:

| Domínio | Nº Rotas | Destaques |
|---|---|---|
| Auth | 2 | Criar/verificar sessão |
| Estágios | 22 | CRUD, docs, assinatura, avaliação, sumários, schedule changes, término antecipado |
| Empresas | 8 | CRUD, fechos, tutores |
| Chat | 3 | Perfis, search, resolve |
| Notificações | 2 | Listar, marcar lidas |
| Professor | 3 | Alunos, broadcast, docs |
| School Admin | 3 | Encarregados, remover prof, settings |
| Encarregado | 4 | CRUD, associate, search |
| Super Admin | 4 | Landing, leads, schools, stats |
| Support | 3 | Chat, tickets create/list |
| Cursos | 2 | CRUD, datas avaliação |
| Outros | 6 | Audit resolve, files proxy, firebase config, landing content, recaptcha, signature, school leads, término antecipado |

---

## 7. GitHub Actions / CI/CD

Ficheiro: `.github/workflows/ci.yml`

| Trigger | Ações |
|---|---|
| `push` e `pull_request` | Ubuntu, pnpm 9, Node 20, Java 21 (Temurin) |
| | `pnpm install --frozen-lockfile` |
| | `pnpm run test` (= `test:unit` + `test:rules`) |

- `test:unit`: `vitest run tests/actions`
- `test:rules`: `firebase emulators:exec --only firestore,database "node tests/firestore/run-rules-tests.mjs"`

---

## 8. Variáveis de Ambiente

| Variável | Descrição | Crítica Segurança |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | API key Firebase (pública) | Não |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth domain | Não |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project ID | Não |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket | Não |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID | Não |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID | Não |
| `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` | Service account JSON completo | **Sim** — chave privada Admin SDK |
| `FIREBASE_ADMIN_PROJECT_ID` | Project ID (fallback ADC) | Não |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Client email (fallback ADC) | Não |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Private key (fallback ADC) | **Sim** |
| `FIREBASE_ADMIN_DATABASE_URL` | RTDB URL | Não |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | reCAPTCHA v3 site key | Não |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA v3 secret | **Sim** |
| `NEXT_PUBLIC_ENABLE_SEED_ADMIN` | Seed auto em dev | **Sim** — desativar em produção |
| `AUTH_DEBUG` | Debug de autenticação | Não |

---

## 9. Framework de Testes

- **Framework**: Vitest (`vitest.config.mjs`)
- **Tipos**: Unitários (`tests/actions/`) + Regras Firebase (`tests/firestore/`, `tests/realtime/`)
- **Cobertura**: Não configurada formalmente
- **Mocking**: Firebase Auth + Firestore mockados nos testes unitários

### Ficheiros de teste

| Categoria | Nº ficheiros | Descrição |
|---|---|---|
| Unitários (actions) | 40 | Lógica pura: date-calc, workdays, permissions, validations, session, routing, etc. |
| Integração (actions) | 10 | Componentes: login-form, dashboard-layout, professor-layout, etc. |
| Firestore rules | 4 | school-isolation, tutor-professor-access, course-director-estagio-access, run-rules-tests |
| Realtime rules | 2 | chat-creation, user-tutors |
| Avaliação | 3 | archive-validations, eliminados-filter, permissions, validations |

---

## 10. Bibliotecas de Validação

- **Zod** (`zod 3.25.67`): Schemas em `lib/validators/` — registo (3 schemas), NIF, school-request
- **react-hook-form** (`^7.60.0`): Formulários no cliente
- **@hookform/resolvers** (`^3.10.0`): Integração zod ↔ react-hook-form
- **Validações manuais**: `lib/avaliacao/validations.ts`, `lib/estagios/archive-validations.ts`, `lib/estagios/termino-antecipado.ts`, `lib/estagios/schedule-change-requests.ts`

---

## 11. Segurança

### 11.1 CAPTCHA
- **Google reCAPTCHA v3**: `lib/recaptcha-v3.ts` — carregamento dinâmico do script
- **API**: `POST /api/recaptcha/verify` — verificação server-side com chave secreta
- Aplicado nos formulários de registo e login

### 11.2 Rate Limiting
- Não encontrado rate limiting explícito (sem Redis, sem middleware de rate limit)
- Limitações implícitas via regras de negócio:
  - Cooldown em submissão de relatórios (`reportWaitDays`)
  - Bloqueio de dupla assinatura (409 em avaliações)
  - Limite de 1000 caracteres em comentários de schedule change requests

### 11.3 Sanitização
- Texto sanitizado para WinAnsi em PDFs (remove em-dash, smart quotes, elipses)
- NIF: stripping de whitespace e não-dígitos
- Coordenadas de assinatura: clamped 0-1
- Roles sanitizados contra ALLOWED_ROLES no upload de documentos

### 11.4 CSRF
- Cookies SameSite=Lax + HTTP-only (proteção implícita)
- Sem token CSRF explícito

### 11.5 Gestão de Tokens e Sessões
- Sessão: cookie JWT `internlink_session`, 14 dias, HTTP-only, Secure, SameSite=Lax
- Refresh: `POST /api/auth/session` força refresh do ID token quando claims desatualizadas (HTTP 428)
- Logout: revoga refresh tokens Firebase + limpa cookie + signOut cliente
- Cache em memória no proxy para evitar DB reads repetidos

---

## 12. Integrações Externas

| Serviço | SDK/Lib | Uso |
|---|---|---|
| Firebase Auth | `firebase/auth`, `firebase-admin/auth` | Autenticação |
| Firebase Firestore | `firebase/firestore`, `firebase-admin/firestore` | Base de dados principal |
| Firebase Realtime DB | `firebase/database`, `firebase-admin/database` | Chat em tempo real |
| Firebase Storage | `firebase/storage`, `firebase-admin/storage` | Ficheiros |
| Google reCAPTCHA v3 | Script dinâmico + API verify | Anti-bot |
| Vercel Analytics | `@vercel/analytics` | Analytics |
| Google JWKS | `jose` | Validação JWT edge |
| pdf-lib | `pdf-lib` | Manipulação de PDFs |
| pdfjs-dist | `pdfjs-dist` | Preview de PDFs |
| @react-pdf/renderer | `@react-pdf/renderer` | Geração de PDFs (sumários) |
| fabric | `fabric` | Canvas para assinaturas e posicionamento |
| mammoth | `mammoth` | Preview de DOCX |
