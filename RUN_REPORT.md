# RUN_REPORT.md — Sistema de Auditoria Centralizada

## Auditoria Inicial

**Estado encontrado:**
- `createdBy`/`updatedBy`/`archivedBy` apenas em `Empresa` (type + API `empresas/[id]/route.ts`)
- Resolução UID→nome ad-hoc (único local: `empresas/[id]/route.ts` linhas 80-95)
- `approvalHistory` subcollection para aprovações de professores (Firestore rules existentes)
- Componente `ApprovalHistorySection` em `/school-admin/historico`
- Sidebar já tem "Histórico" → `/school-admin/historico`
- NENHUM sistema de audit log genérico
- `estagios` sem `createdBy`/`updatedBy`
- `schools` sem `updatedBy` em subscrições
- `schedule_change_requests` sem audit trail de decisões
- `users` sem tracking de alterações
- Zero Cloud Functions no projeto
- Zero helper central de resolução de UIDs

---

## Alterações Feitas

### Infraestrutura (Fase B)

| Ficheiro | Descrição |
|---|---|
| `lib/audit/types.ts` | Tipos `AuditLogEntry`, `AuditAction`, `AuditEntityType`, `AuditFilters` |
| `lib/audit/write.ts` | `writeAuditLog()` server-only helper. Escreve em `schools/{schoolId}/auditLogs/{logId}` |
| `lib/audit/read.ts` | `readAuditLogs()` client-side helper com filtros, paginação por cursor |
| `lib/audit/resolve-users.ts` | `resolveUserNames()` — batch `db.getAll()` centralizado |
| `lib/audit/summaries.ts` | `buildSummary()` e `buildEntityLabel()` — summaries legíveis por entidade/ação |

### Firestore Rules + Indexes (Fase C)

| Ficheiro | Alteração |
|---|---|
| `firestore.rules` | Regras `auditLogs` — read/admin_escolar, create/admin_escolar+professor |
| `firestore.indexes.json` | 6 índices compostos para auditLogs (schoolId+timestamp, entityType+entityId+timestamp, changedBy+timestamp, entityType+timestamp, action+timestamp, entityType+action+timestamp) |

### Integração Empresas (Fase D)

| Rota | Ações auditadas |
|---|---|
| `POST /api/empresas` | create |
| `PATCH /api/empresas/[id]` | update, archive, restore |
| `POST /api/empresas/[id]/tutores` | associate |
| `PATCH /api/empresas/[id]/tutores/[tutorId]` | update |
| `DELETE /api/empresas/[id]/tutores/[tutorId]` | disassociate |

### Integração Estágios (Fase E)

| Rota | Ações auditadas |
|---|---|
| `POST /api/estagios` | create |
| `PATCH /api/estagios/[id]` | update, status_change |
| `DELETE /api/estagios/[id]` | delete |

### Integração Schedule Change Requests (Fase F)

| Rota | Ações auditadas |
|---|---|
| `POST /api/estagios/[id]/schedule-change-requests` | create |
| `PATCH .../professor-decision` | approve, reject |
| `PATCH .../tutor-decision` | approve, reject |
| `POST .../cancel` | cancel |

### Integração Escola (Fase G)

| Rota | Ações auditadas |
|---|---|
| `PATCH /api/school-admin/settings` | update_settings (eePageAccess) |

**Nota:** School info form (`school-info-form.tsx`) escreve diretamente via Firestore SDK client-side. Por princípio de segurança (logs não escritos pelo client), não foi integrado agora. Documentado como pendente.

### UI (Fases H + I)

| Ficheiro | Descrição |
|---|---|
| `components/audit/audit-block.tsx` | Bloco de auditoria reutilizável por entidade. Mostra metadados (criado/atualizado/arquivado por) + histórico recente. |
| `components/audit/audit-global-page.tsx` | Página global de atividade com filtros (entidade, ação, pesquisa textual), paginação, cards por evento. |
| `app/school-admin/historico/page.tsx` | Substituído `ApprovalHistorySection` por `AuditGlobalPage` |

### Cloud Function Retenção (Fase J)

| Ficheiro | Descrição |
|---|---|
| `functions/package.json` | Dependências firebase-admin + firebase-functions |
| `functions/tsconfig.json` | Config TypeScript |
| `functions/src/index.ts` | `cleanupOldAuditLogs` — scheduled function (03:00 daily, Europe/Lisbon). Apaga logs > 365 dias em batches de 500 por escola. |

### Testes (Fase K)

| Ficheiro | Testes | Status |
|---|---|---|
| `tests/actions/audit-summaries.test.ts` | 20 testes — todas as combinações entidade/ação + fallbacks | ✅ |
| `tests/actions/audit-retention.test.ts` | 9 testes — cutoff 365d, boundary, null safety, outras collections, batch size | ✅ |

---

## Áreas Cobertas

- [x] Empresas: create, update, archive, restore, tutor associate/disassociate/update
- [x] Estágios: create, update, status_change, delete
- [x] Schedule change requests: create, approve (professor+tutor), reject, cancel
- [x] School settings: update_settings (eePageAccess)
- [x] Página global de atividade com filtros e paginação
- [x] Bloco de auditoria reutilizável por entidade
- [x] Cloud Function retenção 365 dias
- [x] Testes summaries + retention logic

## Não Coberto (Pendentes Reais)

| Pendência | Motivo | Risco |
|---|---|---|
| School info form (`school-info-form.tsx`) | Escreve diretamente via Firestore SDK client-side. Adicionar audit logging exigiria mover para API route ou criar endpoint específico. | Baixo — school info muda raramente |
| Users — alterações de role/permissão/estado | Não existe API route centralizada para mudanças de permissão em users. As alterações são dispersas (várias routes/funções). | Médio — users é entidade crítica mas require refactor maior |
| AuditBlock não integrado nas páginas de detalhe existentes | `EmpresaDetail` já tem secção "Auditoria" própria. `AuditBlock` está disponível para uso futuro. | Nenhum |
| Resolução UID→nome na página global | A página global mostra `changedBy` como UID. Para resolver nome, precisa de chamada server-side. Criar endpoint `/api/audit/resolve-names` seria o passo seguinte. | Baixo — UID é legível, nome é cosmetic |

## Riscos Encontrados

1. **Audit log falha silenciosamente** — `writeAuditLog()` usa try/catch e retorna null. Não bloqueia a operação principal. Para produção, considerar monitoring.
2. **Índices Firestore** — 6 novos índices compostos para `auditLogs`. Necessário deploy com `firebase deploy --only firestore:indexes`.
3. **Cloud Function nunca testada em produção** — `functions/` tem package.json separado. Necessário `cd functions && npm install && npm run build && firebase deploy --only functions`.
4. **Escrita direta client-side** — `school-info-form.tsx` continua a escrever diretamente. Isto contorna o audit system. Migrar para API route é o plano a médio prazo.

## Tipo de Alterações

- 9 ficheiros novos (infraestrutura + UI + functions)
- 8 ficheiros alterados (routes + firestore.rules + indexes + historio page)
- 2 ficheiros de teste novos
- 0 dependências novas
- Padrões existentes respeitados (shadcn/ui, server-only, requireAuth, assertEstagioAccess)
