# Sistema de Auditoria Centralizada — TASKS

## Estado da Auditoria (09/06/2026)

### O que já existe
- `createdBy`/`updatedBy`/`archivedBy` apenas em `Empresa` (type + API)
- UID→nome resolvido ad-hoc em `empresas/[id]/route.ts` (único local)
- `approvalHistory` subcollection em `schools/{schoolId}/approvalHistory` (só aprovações de professores)
- Componente `ApprovalHistorySection` em `/school-admin/historico`
- Sidebar já tem "Histórico" → `/school-admin/historico`
- Testes: Vitest com mocks pesados (vi.mock), 43 ficheiros em `tests/actions/`

### Gaps encontrados
- Nenhum sistema de audit log existe
- `estagios` não tem `createdBy`/`updatedBy`
- `schools` não tem `updatedBy` na subscrição
- `schedule_change_requests` não tem audit trail de decisões
- `users` sem tracking de alterações de permissão/role
- Nenhuma Cloud Function existe no projeto
- Nenhum helper central de resolução de UIDs
- `firestore.rules` sem regras para `auditLogs`

---

## Fases

### [x] Fase A — TASKS.md (este ficheiro) ✓

### [x] Fase B — Infraestrutura central
- [x] Criar `lib/audit/types.ts` — tipos AuditLogEntry, etc.
- [x] Criar `lib/audit/write.ts` — writeAuditLog() helper server-side
- [x] Criar `lib/audit/read.ts` — readAuditLogs() helper client-side
- [x] Criar `lib/audit/resolve-users.ts` — central UID→name helper
- [x] Criar `lib/audit/summaries.ts` — summary builders por entidade

### [x] Fase C — Firestore rules + indexes
- [x] Adicionar regra `auditLogs` em firestore.rules
- [x] Adicionar índices em firestore.indexes.json

### [x] Fase D — Integração empresas
- [x] POST /api/empresas → create log
- [x] PATCH /api/empresas/[id] → update/archive/restore log
- [x] POST /api/empresas/[id]/tutores → add tutor log
- [x] PATCH /api/empresas/[id]/tutores/[tutorId] → update tutor log
- [x] DELETE /api/empresas/[id]/tutores/[tutorId] → remove tutor log

### [x] Fase E — Integração estágios
- [x] POST /api/estagios → create log
- [x] PATCH /api/estagios/[id] → update/status_change log
- [x] DELETE /api/estagios/[id] → delete log

### [x] Fase F — Integração schedule_change_requests
- [x] POST → create log
- [x] PATCH professor-decision → approve/reject log
- [x] PATCH tutor-decision → approve/reject log
- [x] PATCH cancel → cancel log

### [x] Fase G — Integração school info + users
- [x] School info update log (via API route se existir, ou client-side com server action)
- [x] User permission/role changes log (quando aplicável)

### [x] Fase H — UI de auditoria por entidade
- [x] `components/audit/audit-block.tsx` — componente reutilizável
- [x] `components/audit/audit-block-entidade.tsx` — bloco entidade

### [x] Fase I — Página global de atividade
- [x] `components/audit/audit-global-page.tsx` — página de atividade global
- [x] Atualizar `/school-admin/historico/page.tsx`

### [x] Fase J — Cloud Function retenção 365 dias
- [x] `functions/package.json`
- [x] `functions/src/index.ts` — scheduled function cleanup
- [x] Documentar deploy

### [x] Fase K — Testes
- [x] Testes write helper
- [x] Testes resolve-users helper
- [x] Testes summaries
- [x] Testes retention logic (pure)
- [x] Testes página global (render)

### [x] Fase L — RUN_REPORT.md
- [x] Relatório final

---

## Bloqueios
- Nenhum por agora

## Próximos passos
Fase B → C → D → E → F → G → H → I → J → K → L
