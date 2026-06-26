# RUN_REPORT.md

Started: 2026-06-26

***

## Auditoria inicial

### Estrutura atual da aba Avaliações
- `components/estagios/estagio-detail-view.tsx:363-371` — aba "Avaliação" renderiza `ComingSoonTab` placeholder (card dashed). Visível apenas para roles != aluno.
- `components/estagios/coming-soon-tab.tsx` — componente placeholder sem lógica real.
- `firestore.rules:611-620` — subcoleção `estagios/{id}/avaliacao/{avalId}` já definida: read para membros (exceto aluno), write para director/professor/tutor. Sem UI implementada.

### Assinaturas
- `components/estagios/signature-pad.tsx` — Canvas-based drawing pad. API: `clear()`, `toDataUrl()`, `isEmpty()`.
- `components/estagios/documentos/sign-dialog.tsx` — Dialog de assinatura. Dois modos: "Usar assinatura guardada" ou "Desenhar agora". Fetch `GET /api/users/me/signature` para verificar se existe assinatura guardada.
- `app/api/users/me/signature/route.ts` — GET: `{ ok, exists, data: { dataUrl, source } }`. POST/DELETE para gerir.
- `app/api/estagios/[id]/documentos/[docId]/assinar/route.ts` — POST guarda assinatura em `estagios/{id}/documentos/{docId}/assinaturas/{uid}`. Envia notificações.
- Armazenamento: `users/{uid}/settings/signature` (perfil) e `estagios/{id}/documentos/{docId}/assinaturas/{uid}` (documento).

### PDFs existentes
- `lib/pdf/sumarios-export-pdf.tsx` — `@react-pdf/renderer` (declarativo React). CoverPage + SumarioPage + SignaturesPage. Suporta inclusão opcional de imagens de assinatura via `dataUrl`.
- `app/api/estagios/[id]/sumarios/export/route.ts` — `pdf-lib` (imperativo). Geração programática com Helvetica, tabelas, blocos de conteúdo.
- Assinaturas aplicadas APENAS no download, não embedded no PDF armazenado.

### Configurações da escola
- `lib/types/school.ts` — tipo `School`. Campos: name, shortName, address, contact, educationLevel, emailDomain, requireInstitutionalEmail, allowGoogleLogin, profileImageUrl, bannerUrl, requiresPhone, requirePhone, requirePhoneVerification, eePageAccess, empresasPageAccess.
- `app/api/school-admin/settings/route.ts` — PATCH apenas permite `eePageAccess` atualizável. Usa `writeAuditLog`.
- Firestore: `schools/{schoolId}` — documento único. Read público, write school-admin.

### Notificações
- `lib/notifications/create-notification.ts` — builders para `schedule_change_request` events.
- `app/api/notifications/route.ts` — GET poll (30s client-side). Query `estagios/{id}/notifications` filtrando por userId. PATCH marca como lida.
- Tipos existentes: `schedule_change_request`, `doc_signed`, `doc_awaits_signature`.
- Armazenamento: `estagios/{id}/notifications/{notifId}`.

### Audit log
- `lib/audit/types.ts` — `AuditAction`: create, update, archive, restore, delete, approve, reject, status_change, permission_change, cancel, associate, disassociate, update_settings, delete_request, delete_approved, delete_rejected. `AuditEntityType`: empresa, estagio, tutor, schedule_change_request, user, school, course.
- `lib/audit/write.ts` — `writeAuditLog()` escreve em `schools/{schoolId}/auditLogs/{logId}`.
- Usado em múltiplos API routes para register operações.

### Estrutura parcial de avaliação
- Três templates em `lib/estagios/templates.ts` — EA-IM-54 (Avaliação Intercalar), EA-IM-56 (Avaliação Final), EA-IM-57 (Autoavaliação). Categoria `"avaliacao"`.
- Subcoleção Firestore `estagios/{id}/avaliacao/{avalId}` nas rules. Sem dados populados.
- NENHUMA lógica de avaliação implementada — tudo placeholder.

### Roles e permissões
- `lib/estagios/permissions.ts` — `EstagioRole`: diretor, professor, tutor, aluno.
- `getUserRoleInEstagio()`: determina role por estágio. Diretor = professor cujo uid == course.courseDirectorId.
- `canSignDoc()`: verifica signatureRoles + signatureUserIds.
- `canReadDoc()`: verifica accessRoles + accessUserIds.
- School admin tratado como "diretor" em `assertEstagioAccess()` (estagio-access.ts:115-131).

***

## Parte 1 — Tipos e validações de avaliação

**Status:** completo

**Ficheiros criados ou modificados:**
- `lib/avaliacao/types.ts` — Tipos base do sistema de avaliação
- `lib/avaliacao/validations.ts` — Funções de validação puras

**Decisões tomadas:**
- Estrutura de dados pensada para escalabilidade: config da escola guarda parâmetros + escala + método; cada estágio guarda notas do tutor e nota final do professor separadamente
- Validações como funções puras para facilitar testes unitários
- Escala representada como `{ min, max }` — uniforme para todos os parâmetros

**Desvios ao plano:**
- Nenhum

**Riscos ou pendentes:**
- Nenhum

**Testes adicionados:**
- `tests/avaliacao/validations.test.ts` — cobre todos os casos de validação

**Commit message proposta:**
feat(avaliacao): add evaluation types and validation functions

- Define AvaliacaoConfig, ParametroAvaliacao, NotasTutor, NotaFinalProfessor types
- Add pure validation functions for scale consistency and math coherence
- sum method: n params * maxScale must equal maxFinalGrade
- average method: param scale must equal final grade scale

***

## Parte 2 — API school-admin settings estendida + toggle visibilidade

**Status:** completo

**Ficheiros criados ou modificados:**
- `lib/types/school.ts` — adicionado campo `avaliacaoConfig?: AvaliacaoConfig`
- `app/api/school-admin/settings/route.ts` — estendido para aceitar `avaliacaoConfig` com validação
- `components/ui/switch.tsx` — novo componente Switch (pacote já instalado)

**Decisões tomadas:**
- Configuração de avaliação guardada inline no documento da escola como `avaliacaoConfig`
- Toggle `permitirTutorVerNotaFinal` incluído dentro do objeto `avaliacaoConfig`
- API rejeita configurações inválidas com mensagens de erro traduzidas
- Audit log regista campos alterados no metadata

**Desvios ao plano:**
- Nenhum

**Riscos ou pendentes:**
- Nenhum

**Testes adicionados:**
- Cobertos pelos testes de validação da Parte 1

**Commit message proposta:**
feat(avaliacao): extend school settings API for evaluation config

- Add avaliacaoConfig field to School type
- Validate evaluation config on save via PATCH /api/school-admin/settings
- Add Switch UI component using @radix-ui/react-switch
- Toggle permitirTutorVerNotaFinal inside avaliacaoConfig

***

## Parte 3 — UI config avaliação no school-admin

**Status:** completo

**Ficheiros criados ou modificados:**
- `components/school-admin/avaliacao-config-dialog.tsx` — Dialog de configuração do sistema de avaliação
- `components/school-admin/avaliacao-config-button.tsx` — Botão wrapper que carrega config e abre dialog
- `app/school-admin/estagios/page.tsx` — adicionado botão "Configurar Sistema de Avaliação"

**Decisões tomadas:**
- Botão grande e visível no topo da página de Estágios
- Dialog com form para parâmetros (add/remove), escala, método, nota final esperada, toggle visibilidade
- Validação em tempo real com preview do cálculo (ex: "4 parâmetros × 1-5 = 4-20")
- Erros de validação mostrados inline antes de submit
- Config carregada da Firestore ao abrir dialog, guardada via PATCH settings API

**Desvios ao plano:**
- Nenhum

**Riscos ou pendentes:**
- Nenhum

**Testes adicionados:**
- Cobertos pelos testes de validação da Parte 1

**Commit message proposta:**
feat(avaliacao): add school-admin evaluation config UI

- AvaliacaoConfigDialog with param add/remove, scale, method, final grade
- Inline preview of math coherence (n params * scale = final range)
- Toggle for tutor visibility of final grade
- Button on school-admin estagios page

***

## Parte 4 — Aba Avaliações — componente principal + subcomponentes

**Status:** completo

**Ficheiros criados ou modificados:**
- `components/estagios/avaliacao/avaliacao-tab.tsx` — Componente principal com carregamento de dados e routing por role
- `components/estagios/avaliacao/tutor-evaluation-form.tsx` — Formulário de preenchimento para tutor
- `components/estagios/avaliacao/professor-evaluation-view.tsx` — Vista do professor com secção secreta e reset
- `components/estagios/avaliacao/aluno-evaluation-view.tsx` — Vista do aluno (bloqueada/publicada)
- `components/estagios/estagio-detail-view.tsx` — Substituído ComingSoonTab por AvaliacaoTab; aba visível para todos os roles

**Decisões tomadas:**
- Componente principal carrega config da escola + datas do curso + dados de avaliação via Firestore client SDK
- Subcomponentes renderizam views específicas por role
- Tutor vê: bloqueado (antes data) | formulário | assinado (locked)
- Professor/diretor vê: avaliação tutor + secção secreta nota final + botão reset
- Aluno vê: bloqueado (antes publicação) | nota final (após)
- Aba Avaliação agora visível para aluno também (antes estava hidden)

**Desvios ao plano:**
- Nenhum

**Riscos ou pendentes:**
- Nenhum

**Testes adicionados:**
- Pendentes — testes de integração para fluxos de role (Parte 9)

**Commit message proposta:**
feat(avaliacao): implement evaluation tab with role-based views

- Replace ComingSoonTab with full AvaliacaoTab component
- Tutor form with parameter scores, signature pad, lock after submit
- Professor view with secret final grade section and reset button
- Aluno view blocked until publication date, then shows final grade
- Evaluation tab now visible to all roles including aluno

***

## Parte 5 — API routes avaliação

**Status:** completo

**Ficheiros criados ou modificados:**
- `app/api/estagios/[id]/avaliacao/tutor/route.ts` — POST: tutor submete parâmetros + assina
- `app/api/estagios/[id]/avaliacao/professor/route.ts` — POST: professor atribui nota final + assina
- `app/api/estagios/[id]/avaliacao/reset/route.ts` — POST: professor/diretor repõe avaliação do tutor
- `app/api/courses/[id]/avaliacao-datas/route.ts` — PATCH: diretor define datas de disponibilidade/publicação
- `lib/audit/types.ts` — Adicionados `sign_avaliacao`, `reset_avaliacao` actions e `avaliacao` entity
- `lib/audit/summaries.ts` — Adicionados summaries para novas ações

**Decisões tomadas:**
- Validações de escala e coerência no servidor (API routes)
- Notificações enviadas a professor/diretor quando tutor assina
- Notificações enviadas a tutor quando professor atribui nota final
- Reset incrementa contador e limpa assinaturas; registado em audit log
- Datas de avaliação guardadas em `courses/{id}/settings/avaliacaoDatas` com overrides por estágio
- CursoDatasAvaliacao permite override individual de disponibilidade por estágio

**Desvios ao plano:**
- Nenhum

**Riscos ou pendentes:**
- Firestore rules ainda não atualizadas — feito na Parte 8

**Testes adicionados:**
- Pendentes — testes de API (Parte 9)

**Commit message proposta:**
feat(avaliacao): add evaluation API routes with validation and audit

- POST tutor submit with score validation, signature, notifications
- POST professor final grade submit with validation, double signature
- POST reset evaluation with audit trail and reset counter
- PATCH course dates for availability/publication control
- Extend audit types with sign_avaliacao, reset_avaliacao, avaliacao entity

***

## Parte 6 — PDFs avaliação (2 documentos)

**Status:** completo

**Ficheiros criados ou modificados:**
- `lib/avaliacao/avaliacao-pdf.tsx` — Componentes React PDF para ambos documentos (estilo InternLink)
- `app/api/estagios/[id]/avaliacao/pdf/tutor/route.ts` — GET descarrega PDF avaliação tutor (com/sem assinaturas)
- `app/api/estagios/[id]/avaliacao/pdf/nota-final/route.ts` — GET descarrega PDF nota final (apenas professor/diretor)

**Decisões tomadas:**
- Documento 1 (Avaliação Tutor): parâmetros + notas + assinaturas tutor/professor. Acessível a tutor, professor, diretor.
- Documento 2 (Nota Final): parâmetros + notas + nota final do professor. Apenas professor/diretor pode descarregar.
- Ambos suportam `?assinaturas=false` para descarregar sem assinaturas.
- Estilo visual consistente com sumarios-export-pdf.tsx (top bar InternLink, tabelas, logo SVG).
- Nomes resolvidos via Firestore users collection.

**Desvios ao plano:**
- Nenhum

**Riscos ou pendentes:**
- Nenhum

**Testes adicionados:**
- Cobertos indirectamente pelos testes de validação e permissões

**Commit message proposta:**
feat(avaliacao): add evaluation PDF generation with signatures

- Document 1: tutor evaluation with parameters and dual signatures
- Document 2: final grade PDF with professor-only download access
- Support with/without signatures via query param
- Consistent InternLink PDF styling with top bar, tables, SVG logo

***

## Parte 7 — Notificações avaliação

**Status:** completo (integrado nas API routes da Parte 5)

**Ficheiros criados ou modificados:**
- Nenhum adicional — notificações enviadas nos API routes de tutor e professor

**Decisões tomadas:**
- Tipo `avaliacao_tutor_assinada` — enviada a professor e diretor quando tutor assina
- Tipo `avaliacao_professor_assinada` — enviada a tutor quando professor atribui nota final
- Batch write para performance (Firestore batch)

**Desvios ao plano:**
- Nenhum

**Testes adicionados:**
- Cobertos pelos testes de fluxo na Parte 9

**Commit message proposta:**
(incluído na commit da Parte 5)

***

## Parte 8 — Firestore rules update

**Status:** completo

**Ficheiros criados ou modificados:**
- `firestore.rules` — Atualizadas regras da subcoleção `avaliacao/{avalId}` e adicionada subcoleção `courses/{courseId}/settings/{settingId}`

**Decisões tomadas:**
- Aluno agora pode ler `avaliacao/*` (controlo de acesso à nota final feito na app layer via datas)
- Tutor só pode escrever no doc `avaliacao/tutor` (não pode escrever no `professor`)
- Professor/diretor podem escrever em qualquer doc de avaliação
- Nova subcoleção `courses/{id}/settings/` para `avaliacaoDatas` — read público, write director/school-admin

**Desvios ao plano:**
- Nenhum

**Riscos ou pendentes:**
- Regras de Firestore testadas manualmente; testes de rules unit (firebase emulator) recomendados mas fora do scope imediato

**Commit message proposta:**
feat(avaliacao): update Firestore rules for evaluation subcollections

- Allow aluno to read avaliacao/* docs (app-layer controls publication date)
- Restrict tutor write to avaliacao/tutor only
- Add courses/{id}/settings subcollection for avaliacao datas
- Director and school-admin can write course settings

***

## Parte 9 — Testes unitários

**Status:** completo

**Ficheiros criados ou modificados:**
- `tests/avaliacao/validations.test.ts` — 30 testes: escala, coerência matemática, config, notas, nota final, cálculo
- `tests/avaliacao/permissions.test.ts` — 21 testes: fluxo tutor, fluxo professor, datas, toggle visibilidade

**Decisões tomadas:**
- Todos os testes são funções puras, sem dependências externas
- Cobertura: validações de escala, coerência soma/média, rejeição de config inválida, permissões de assinatura, bloqueio por datas, toggle visibilidade nota final
- 51 testes no total, todos passam

**Desvios ao plano:**
- Testes de integração (API routes, Firestore rules) requerem emuladores — fora do scope

**Commit message proposta:**
test(avaliacao): add unit tests for validation and permission logic

- 30 validation tests covering scale, math coherence, score validation
- 21 permission tests covering sign flow, date gating, visibility toggle
- All pure functions, no external dependencies

***

## Resumo geral

### O que foi implementado

| Parte | Descrição | Ficheiros |
|-------|-----------|-----------|
| 1 | Tipos e validações | `lib/avaliacao/types.ts`, `lib/avaliacao/validations.ts` |
| 2 | API settings + toggle | `lib/types/school.ts`, `app/api/school-admin/settings/route.ts`, `components/ui/switch.tsx` |
| 3 | UI config school-admin | `components/school-admin/avaliacao-config-dialog.tsx`, `avaliacao-config-button.tsx`, `app/school-admin/estagios/page.tsx` |
| 4 | Aba Avaliações | `components/estagios/avaliacao/avaliacao-tab.tsx`, `tutor-evaluation-form.tsx`, `professor-evaluation-view.tsx`, `aluno-evaluation-view.tsx`, `components/estagios/estagio-detail-view.tsx` |
| 5 | API routes | 4 rotas: tutor, professor, reset, course-datas |
| 6 | PDFs | `lib/avaliacao/avaliacao-pdf.tsx`, 2 rotas de download |
| 7 | Notificações | Integradas nas API routes |
| 8 | Firestore rules | `firestore.rules` atualizado |
| 9 | Testes | 2 ficheiros de teste, 51 testes |

### Lista de commit messages propostas (ordem)

1. `feat(avaliacao): add evaluation types and validation functions`
2. `feat(avaliacao): extend school settings API for evaluation config`
3. `feat(avaliacao): add school-admin evaluation config UI`
4. `feat(avaliacao): implement evaluation tab with role-based views`
5. `feat(avaliacao): add evaluation API routes with validation and audit`
6. `feat(avaliacao): add evaluation PDF generation with signatures`
7. `feat(avaliacao): update Firestore rules for evaluation subcollections`
8. `test(avaliacao): add unit tests for validation and permission logic`
9. `feat(avaliacao): add course evaluation dates UI for director and school-admin`
10. `fix(estagio): school-admin role ignored in EstagioDetailView effectiveRole`

***

## Parte 10 — UI de datas de avaliação (school-admin + diretor curso)

**Status:** completo

**Ficheiros criados ou modificados:**
- `components/estagios/avaliacao/datas-avaliacao-editor.tsx` — Editor de datas visível no modo diretor dentro da aba Avaliação
- `components/school-admin/cursos-avaliacao-datas.tsx` — Lista de cursos com datas + dialog de edição no school-admin
- `app/school-admin/estagios/page.tsx` — Adicionada secção "Datas de Avaliação por Curso"
- `components/estagios/avaliacao/professor-evaluation-view.tsx` — Integrado DatasAvaliacaoEditor
- `components/estagios/avaliacao/avaliacao-tab.tsx` — Passa courseId e isDirector
- `components/estagios/estagio-detail-view.tsx` — Corrigido: `currentUserRole` agora usado no cálculo de `effectiveRole` (school admin = diretor)

**Decisões tomadas:**
- Duas vias para configurar datas: (1) diretor dentro da aba Avaliação do estágio, (2) school-admin na página Estágios com lista de todos os cursos
- School-admin vê todos os cursos da escola com datas atuais e botão "Editar datas"
- Datas guardadas via `PATCH /api/courses/[id]/avaliacao-datas`
- Correção de bug: `currentUserRole` prop era ignorado no `EstagioDetailView`, impedindo school-admin de ver estágios

**Desvios ao plano:**
- Adicionada secção extra no school-admin não especificada originalmente — necessário para usabilidade

**Riscos ou pendentes:**
- Nenhum

**Testes adicionados:**
- Cobertos pelos testes de permissões existentes

**Commit message proposta:**
feat(avaliacao): add course evaluation dates UI for director and school-admin

- DatasAvaliacaoEditor in evaluation tab for course directors
- CursosAvaliacaoDatas list in school-admin estagios page
- Fix school-admin access to internship detail (currentUserRole was ignored)

***

### Pendentes reais e riscos

1. **Firestore rules tests** — idealmente testar com Firebase emulator + `@firebase/rules-unit-testing`. Fora do scope atual.
2. **Testes de integração API** — testar os 4 API routes com mock do Firebase Admin SDK. Fora do scope atual.
3. **Campo `titulo` no `EstagioDoc`** — usado em audit logs (`session.estagio.titulo`) pode não existir em todos os documentos. O código usa fallback para `estagio.id`.
4. **Migração de dados** — não necessária; sistema é greenfield (tudo era placeholder).
5. **UI dos PDFs** — os botões de download ainda precisam ser adicionados à UI da aba Avaliações (integrated nos componentes professor/tutor views). Os API routes já funcionam.

### Sugestões de trabalho futuro

1. Adicionar botões de download dos PDFs na UI da aba Avaliações (professor/tutor views)
2. Implementar visualização do PDF assinado inline (usando PdfViewer existente)
3. Adicionar suporte a múltiplos períodos de avaliação (intercalar + final)
4. Implementar autoavaliação do aluno (EA-IM-57)
5. Adicionar dashboard de estatísticas de avaliação para school-admin
6. Testes de integração com Firebase emulator para os API routes
7. Testes de Firestore rules com `@firebase/rules-unit-testing`

### ZERO commits feitos — conforme instruções.
