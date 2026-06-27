# RUN_REPORT.md

Started: 2026-06-26

***

## Auditoria inicial — Sistema de Notificações

### Componentes
- `components/chat/notifications-inbox.tsx` (206 linhas) — Caixa de entrada principal
- `components/chat/toast-container.tsx` (79 linhas) — Toasts de chat
- `components/chat/chat-notification.tsx` (125 linhas) — **Dead code** (não importado)
- `components/encarregado/encarregado-notificacoes.tsx` — Página EE

### Firestore
- Path: `estagios/{estagioId}/notifications/{notifId}`
- Campos: `userId`, `type`, `title`, `body`, `readAt`, `createdAt`, `estagioId`, `requestId?`, `requestType?`, `targetDate?`, `docId?`
- API: `GET /api/notifications` (collectionGroup), `PATCH` (mark read individual)
- Admin SDK usado para tudo (bypasses regras)

### Tipos de notificação
| Type | Quem recebe |
|---|---|
| `schedule_change_request` | Prof, Tutor, Aluno |
| `doc_signed` | Outros signatários |
| `doc_awaits_signature` | Outros signatários |
| `avaliacao_tutor_assinada` | Prof, Diretor |
| `avaliacao_professor_assinada` | Tutor, Diretor |
| `termino_antecipado` | Aluno, Tutor, Prof, EE |

### Funcionalidades existentes
- Poll 30s via `useEstagioNotifications`
- Marcar lido individual (PATCH)
- Distinção visual lido/não lido (bg/opacity)
- "Abrir" links para `schedule_change_request` e `doc_*` (só professor)

### Funcionalidades em falta
1. **Sem DELETE** — notificações acumulam para sempre
2. **Sem "marcar todas como lidas"**
3. **Sem "remover todas" / limpar caixa**
4. **3 tipos sem link válido**: `termino_antecipado`, `avaliacao_tutor_assinada`, `avaliacao_professor_assinada`
5. **Só Professor vê notificações de sistema** — Tutor, Aluno, SchoolAdmin só veem chat
6. **Mark-as-read local** reseta no reload
7. **Sem remover individual**

### Links mapeados (professor)
| Type | Destino |
|---|---|
| `schedule_change_request` (past_absence) | `/professor/justificacoes` |
| `schedule_change_request` (outros) | `/professor/justificacoes?tab=mudancas` |
| `doc_signed` / `doc_awaits_signature` | `/professor/estagios/{id}?tab=documents` |
| `avaliacao_tutor_assinada` | **null** ❌ |
| `avaliacao_professor_assinada` | **null** ❌ |
| `termino_antecipado` | **null** ❌ |

### Testes existentes
- `tests/actions/notifications-inbox.test.tsx` (2 testes)
- `tests/actions/create-notification.test.ts` (15 testes)

### Design system
- Cores: `bg-card`, `bg-muted/35`, `bg-red-600`, tokens Tailwind
- Read: `bg-muted/35 opacity-75`, Unread: `bg-card`
- Hover states apenas no botão de ação
- Sem dots/indicadores de não lido além do bg

***

## Parte 1 — API: DELETE + mark-all-read

**Status:** completo

**Ficheiros criados/modificados:**
- `app/api/notifications/route.ts` — Adicionado DELETE handler
- `app/api/notifications/mark-all-read/route.ts` — Novo endpoint POST
- `lib/notifications/use-estagio-notifications.ts` — Novos métodos: removeNotification, markAllAsRead, clearAll

**Decisões tomadas:**
- DELETE verifica userId antes de apagar
- mark-all-read usa batch write para performance
- clearAll faz DELETE sequencial (Firestore não tem batch delete cross-collection)

**Commit message proposta:**
feat(notifications): add DELETE endpoint + mark-all-read batch endpoint

- DELETE /api/notifications with estagioId + notificationId
- POST /api/notifications/mark-all-read uses collectionGroup + batch write
- Hook exposes removeNotification, markAllAsRead, clearAll

***

## Parte 2 — UI: Caixa de notificações redesenhada

**Status:** completo

**Ficheiros modificados:**
- `components/chat/notifications-inbox.tsx` — Redesign completo

**Melhorias:**
- Hover mostra ações: marcar lido (CheckCheck) + remover (X)
- Header com "Tudo lido" (marca todas) + "Limpar" (remove todas com confirm)
- Dot azul (bg-primary) para não lidas
- Read: bg-muted/20 + texto muted; Unread: bg-card + shadow-sm + texto foreground
- Callbacks: onMarkRead, onRemove, onMarkAllRead, onClearAll

**Commit message proposta:**
feat(notifications): redesign inbox with hover actions, mark-all-read, clear-all

- Hover reveals mark-read + remove buttons per notification
- Header actions: mark all as read, clear inbox with confirmation
- Improved visual distinction: primary dot for unread, muted bg for read
- New optional callbacks for parent components

***

## Parte 3 — Links "Abrir" corrigidos

**Status:** completo

**Ficheiros modificados:**
- `components/layout/professor-layout.tsx` — buildNotificationHref + wiring

**Links adicionados:**
- `avaliacao_tutor_assinada` → `/professor/estagios/{id}?tab=avaliacao`
- `avaliacao_professor_assinada` → `/professor/estagios/{id}?tab=avaliacao`
- `termino_antecipado` → `/professor/estagios/{id}?tab=calendario`

**Action labels:**
- `avaliacao_*` → "Ver avaliação"
- `termino_antecipado` → "Ver calendário"

**Wiring:**
- NotificationsInbox recebe onMarkRead, onRemove, onMarkAllRead, onClearAll
- estagioId incluído no mappedSystem para handlers de remoção

**Commit message proposta:**
fix(notifications): add missing links for avaliacao/termino notifications

- avaliacao_tutor_assinada and avaliacao_professor_assinada → tab=avaliacao
- termino_antecipado → tab=calendario
- Wire new inbox callbacks in professor-layout

***

## Parte 4 — Script de diagnóstico de links

**Status:** completo

**Ficheiro criado:**
- `scripts/audit-notification-links.ts`

**Funcionamento:**
- Liga à Firestore via Admin SDK
- Percorre todas as notificações de todos os estágios
- Descobre rotas válidas a partir de `app/`
- Classifica links: válido | inválido | suspeito | vazio
- Gera `notification-link-audit.json` e `notification-link-audit.txt`

**Execução:** `npx tsx scripts/audit-notification-links.ts`

**Commit message proposta:**
feat(scripts): add notification link audit script

- Firestore read-only audit of all notification links
- Classifies as valid/invalid/suspicious/empty
- Outputs JSON + TXT reports

