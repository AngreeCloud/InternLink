# REPORT_02_INTERNAL_ARCHITECTURE.md — Arquitetura Interna

> **Progresso**: 495/495 ficheiros inspecionados

---

## 1. Perfis de Utilizador (Roles)

### Diagrama de Relações entre Roles (Draw.io)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Super Admin (1)                              │
│  ──── cria ────▶ SchoolAdmin (N)                                    │
│  ──── gere ────▶ Support (N)                                        │
│  ──── edita ───▶ LandingContent (1)                                 │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      SchoolAdmin (1 por escola)                      │
│  ──── aprova/rejeita ────▶ Professor (N)                            │
│  ──── aprova/rejeita ────▶ Aluno (N)                                │
│  ──── cria/edita ────▶ Curso (N)                                    │
│  ──── gere ────▶ Pasta (N)                                          │
│  ──── vê ────▶ Auditoria                                            │
│  ──── aprova ────▶ DeleteEstagioRequest                             │
│  ──── gere ────▶ Encarregado (N)                                    │
└──────────────────────────────────────────────────────────────────────┘
          │                    │
          ▼                    ▼
┌──────────────────┐  ┌──────────────────────────────────────────────┐
│  Professor (N)   │  │              Aluno (N)                        │
│                  │  │                                              │
│  ──── cria ────▶ │  │  ──── tem ────▶ Estágio (1)                 │
│    Estágio (N)   │  │  ──── regista ────▶ Presenças (N)           │
│  ──── orienta ───│──│──▶ Aluno (N)      │                          │
│  ──── convida ──▶│  │  ──── escreve ────▶ Sumários (N)            │
│    Tutor (N)     │  │  ──── submete ───▶ Relatório Final (1)      │
│  ──── assina ───▶│  │  ──── assina ────▶ Documentos               │
│    Avaliação     │  │  ──── pede ────▶ Alteração Horário          │
│  ──── gere ────▶ │  │                                              │
│    Empresas (N)  │  │  ──── tem ────▶ Encarregado (1)             │
│  ──── gere ────▶ │  │                                              │
│    Documentos    │  └──────────────────────────────────────────────┘
└──────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        Tutor (N por empresa)                         │
│  ──── orienta ────▶ Estágio (N)                                     │
│  ──── valida ────▶ Sumários                                        │
│  ──── assina ────▶ Avaliação                                       │
│  ──── aprova/rejeita ────▶ ScheduleChangeRequest                   │
│  ──── cria ────▶ FechoEmpresa                                      │
│  ──── aprova/rejeita ────▶ TérminoAntecipado                       │
└──────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Encarregado de Educação (1:N)                      │
│  ──── vê ────▶ Educando (N)                                        │
│  ──── vê ────▶ Estágios dos educandos                              │
│  ──── aceita ────▶ Protocolo de Estágio                            │
│  ──── recebe ────▶ Notificações                                    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                        Support (N)                                   │
│  ──── gere ────▶ SupportTickets (N)                                 │
│  ──── vê ────▶ SchoolLeads                                         │
└──────────────────────────────────────────────────────────────────────┘
```

### Tabela Detalhada de Permissões

| Ação | Aluno | Professor | Diretor Curso | Tutor | Admin Escolar | Encarregado | Super Admin | Support |
|---|---|---|---|---|---|---|---|---|
| Ver próprio estágio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Criar estágio | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Editar estágio | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Eliminar estágio | ❌ | ❌ | ✅ (se permitido) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Arquivar estágio | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Registar horas (presenças) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Escrever sumários | ✅ | ❌ | ❌ | ✅ (só assinar) | ❌ | ❌ | ❌ | ❌ |
| Validar sumários (tutor) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Submeter relatório final | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Upload documentos | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Assinar documentos | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Criar pedido alteração horário | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Aprovar/rejeitar pedido (prof) | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Aprovar/rejeitar pedido (tutor) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Preencher avaliação tutor | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Atribuir nota final (prof) | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Criar fecho empresa | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Submeter término antecipado | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Aprovar término antecipado | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gerir empresas | ❌ | ✅ (com grant) | ✅ (com grant) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Gerir cursos | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Gerir utilizadores (escola) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Aprovar/rejeitar registos | ❌ | ✅ (alunos) | ✅ (alunos) | ❌ | ✅ (todos) | ❌ | ❌ | ❌ |
| Ver auditoria | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Criar escolas | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Editar landing page | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Gerir tickets suporte | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (assigned) | ✅ |
| Chat | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 2. Entidades Principais

### 2.1 Escola (`schools/{schoolId}`)

**Campos principais**: nome, morada, localidade, código postal, telefone, email, website, logoUrl, configurações (email institucional, Google login, telemóvel, avaliação)

**Relações**:
- `schools` 1──N `courses` (via schoolId)
- `schools` 1──N `users` (via schoolId)
- `schools` 1──N `empresas` (via schoolId)
- `schools` 1──N `estagios` (via schoolId)
- `schools` 1──N `folders` (subcoleção)
- `schools` 1──N `tutors` (subcoleção)
- `schools` 1──N `auditLogs` (subcoleção)

**Quem pode ler**: Público (todos autenticados)
**Quem pode escrever**: Apenas `admin_escolar` da própria escola

**Ciclo de vida**: Criada por Super Admin → configurada por School Admin → (sem estado de arquivo/eliminação)

---

### 2.2 Curso (`courses/{courseId}`)

**Campos principais**: nome, schoolId, teacherIds[], courseDirectorId, supportingTeacherIds[], reportMinHours, reportWaitDays, directorCanDeleteEstagio

**Relações**:
- `courses` N──1 `schools` (via schoolId)
- `courses` 1──N `users` (alunos/professores, via courseId)
- `courses` 1──N `estagios` (via courseId / alunoCourseId)

**Quem pode ler**: Público (todos autenticados)
**Quem pode escrever**: Apenas `admin_escolar` da escola do curso

**Subcoleção**: `courses/{id}/settings/` — configurações por curso (datas de avaliação)

---

### 2.3 Estágio (`estagios/{estagioId}`)

**Campos principais**: alunoId, professorId, tutorId, schoolId, courseId, alunoCourseId, empresaId, empresaSnapshot, dataInicio, dataFimEstimada, totalHoras, horasRealizadas, horasDiarias, diasSemana, estado/estadoEstagio

**Relações**:
- `estagios` N──1 `users` (aluno)
- `estagios` N──1 `users` (professor)
- `estagios` N──1 `users` (tutor)
- `estagios` N──1 `schools` (via schoolId)
- `estagios` N──1 `empresas` (via empresaId)
- `estagios` N──1 `courses` (via courseId)
- `estagios` 1──N `documentos` (subcoleção)
- `estagios` 1──N `presencas` (subcoleção)
- `estagios` 1──N `sumarios` (subcoleção)
- `estagios` 1──N `avaliacao` (subcoleção)
- `estagios` 1──N `schedule_change_requests` (subcoleção)
- `estagios` 1──N `notifications` (subcoleção)

**Quem pode ler**: Membros do estágio (aluno, professor, tutor, admin escolar da mesma escola, encarregado do aluno, diretor de curso)
**Quem pode escrever**: Professor/diretor (update/delete), aluno (presenças/sumários), tutor (avaliação/sumários)

**Ciclo de vida e transições de estado**:
```
┌──────────┐    diretor cria     ┌──────────┐
│  (nulo)  │ ──────────────────▶ │  ativo   │
└──────────┘                     └────┬─────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                  ▼
              ┌───────────┐   ┌────────────┐   ┌────────────┐
              │ concluído  │   │ arquivado  │   │ eliminado  │
              └───────────┘   └────────────┘   └────────────┘
               (tutor aprova    (auto-archive    (admin aprova
                early_term)      ou manual)       delete_request)
```

---

### 2.4 Empresa (`empresas/{empresaId}`)

**Campos principais**: nome, nomeNormalizado, nif, nifNormalizado, setor, morada, localidade, contactos, schoolId, tutorIds[], empresaGrants{}, ativa, logoUrl, fotos[]

**Relações**:
- `empresas` N──1 `schools` (via schoolId)
- `empresas` 1──N `users` (tutores, via tutorIds)
- `empresas` 1──N `estagios` (via empresaId)

**Quem pode ler**: Admin escolar (todas), professor (com grant)
**Quem pode escrever**: Admin escolar (tudo), professor (com write grant, exceto empresaGrants)

**Ciclo de vida**: Criada → ativa=true → pode ser arquivada (ativa=false via PATCH, não delete)

---

### 2.5 Documento de Estágio (`estagios/{id}/documentos/{docId}`)

**Campos principais**: nome, descricao, categoria, ordem, templateCode, accessRoles[], signatureRoles[], signatureBoxes[], currentVersion, currentFileUrl, signedBy[], signedByRoles[], estado, pinned

**Relações**:
- `documentos` N──1 `estagios`
- `documentos` 1──N `versoes` (subcoleção, imutável)
- `documentos` 1──N `assinaturas` (subcoleção, por signatário)

**Quem pode ler**: Membros do estágio
**Quem pode escrever**: Diretor de curso, professor orientador, admin escolar

**Ciclo de vida**:
```
┌───────────┐   upload PDF    ┌────────────────────┐
│ pendente  │ ──────────────▶ │ aguarda_assinatura │
└───────────┘                 └────────┬───────────┘
                                       │ todas assinaturas
                                       ▼
                               ┌───────────┐
                               │ assinado  │
                               └───────────┘
```

---

### 2.6 Avaliação (`estagios/{id}/avaliacao/`)

Subdocumentos: `tutor` (NotasTutor), `professor` (NotaFinalProfessor)

**Tutor**: parametros (Record<string, number>), comentarios, signatureDataUrl, estado ("pendente"|"assinado"), resetCount
**Professor**: parametros (Record<string, number>), notaFinal (number), signatureDataUrl, estado ("pendente"|"assinado")

**Ciclo de vida**:
```
┌───────────┐   tutor submete   ┌────────────────────┐   prof atribui    ┌───────────┐
│ (não criado)│ ───────────────▶ │ tutor: "assinado"  │ ────────────────▶ │ prof: "assinado" │
└───────────┘                   └────────────────────┘                   └───────────┘
                   prof pode resetar ◀──────────────────
                   (incrementa resetCount)
```

---

### 2.7 Schedule Change Request (`estagios/{id}/schedule_change_requests/{requestId}`)

**Tipos**: `future_absence`, `past_absence_justification`, `early_termination`, `company_closure`

**Estados e transições**:
```
                  ┌──────────────────┐
                  │ pending_professor│◀── aluno cria (requiresApproval)
                  └────────┬─────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌────────────┐ ┌───────────┐ ┌───────────┐
     │approved    │ │pending_   │ │ rejected  │
     │(skips tutor)│ │tutor      │ │           │
     └────────────┘ └─────┬─────┘ └───────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌────────────┐ ┌───────────┐ ┌───────────┐
     │ approved   │ │ rejected  │ │ cancelled │
     └────────────┘ └───────────┘ │ (aluno)   │
                                  └───────────┘

     past_absence_justification → skips tutor (prof decide direto)
     company_closure → criado como "approved" diretamente (requer tutor)
     early_termination → fluxo completo professor→tutor
```

---

### 2.8 Término Antecipado (`estagios/{id}/.../termino_antecipado`)

**Estados**: `pendente` → `aprovado` | `recusado` | `invalidado_por_incumprimento`

Ativado quando horas restantes < 5 dias de trabalho (LIMIAR_DIAS=5) e último dia é parcial.

---

### 2.9 Sumário Semanal (`estagios/{id}/sumarios/{weekId}`)

**Campos**: weekId, weekLabel, dataInicio, dataFim, atividades (texto 10-4000 chars), estado ("rascunho"|"preenchido"|"arquivado"), signedByTutor (boolean)

**Ciclo**: aluno escreve → estado="preenchido" → tutor valida → estado="arquivado" (imutável)

---

### 2.10 Presença Diária (`estagios/{id}/presencas/{dateId}`)

**Campos**: dateId (YYYY-MM-DD), hours (number, 0-12), absence, registeredAt

---

## 3. Módulos e Features

### 3.1 Gestão de Escolas
- **Ficheiros**: `app/super-admin/escolas/page.tsx`, `app/api/super-admin/schools/route.ts`
- **Acesso**: super_admin
- **Fluxo**: Super admin preenche form (nome, email admin, password) → API cria Auth user + Firestore school doc + admin user doc → devolve credenciais

### 3.2 Gestão de Cursos
- **Ficheiros**: `components/school-admin/courses-manager.tsx`, `app/school-admin/cursos/page.tsx`, `app/api/courses/[id]/route.ts`
- **Acesso**: admin_escolar
- **Fluxo**: Criar/editar curso (nome, teacherIds, courseDirectorId, supportingTeacherIds) → PATCH API → audit log para mudanças de diretor/teachers

### 3.3 Gestão de Estágios
- **Ficheiros**: `components/estagios/estagio-detail-view.tsx` (hub central), `create-estagio-dialog.tsx`, `edit-estagio-dialog.tsx`, `overview-tab.tsx`, `horario-tab.tsx`, `sumarios-tab.tsx`, `calendario-tab.tsx`, `components/estagios/avaliacao/*`
- **Acesso**: Todos os roles (com views diferentes)
- **Fluxo**: `EstagioDetailView` → tabs (Overview, Documentos, Horário, Sumários, Calendário, Avaliação) → cada tab com subsistema próprio
- **Lógica notável**: Role resolution via `getUserRoleInEstagio()` que deriva "diretor" se professor for courseDirectorId

### 3.4 Gestão de Empresas
- **Ficheiros**: `components/empresas/empresas-page.tsx`, `empresas-create-form.tsx`, `empresas-detail.tsx`, `empresas-edit-form.tsx`, `empresa-permissions.tsx`, `empresa-photos.tsx`
- **Acesso**: admin_escolar (total), professor (com grant)
- **Fluxo**: Lista → Criar (NIF validation, nomeNormalizado dedup) → Detalhe (Info, Tutores, Estágios, Fotos, Permissões) → Arquivar/Restaurar

### 3.5 Gestão de Utilizadores e Convites
- **Ficheiros**: `components/school-admin/pending-teachers.tsx`, `components/professor/pending-students-manager.tsx`, `components/professor/approved-students-manager.tsx`, `app/api/professor/alunos/route.ts`
- **Acesso**: admin_escolar (aprova professores), professor (aprova alunos), tutor auto-aprovado
- **Fluxo de aprovação**: Registo → pendingRegistrations/users (estado="pendente") → admin/professor aprova → estado="ativo" + custom claims sync

### 3.6 Documentos
- **Ficheiros**: `components/estagios/documentos/document-list.tsx`, `upload-wizard.tsx`, `sign-dialog.tsx`, `document-preview-dialog.tsx`, `version-history-dialog.tsx`, `fullscreen-document-viewer.tsx`, `docx-preview.tsx`, `broadcast-dialog.tsx`
- **Acesso**: Membros do estágio
- **Fluxo**: Seed 12 templates → Upload wizard (3 passos: PDF → signature boxes → roles) → Assinar (valida permissão, desenha assinatura com pdf-lib, nova versão imutável) → Download (com página de assinaturas dinâmica)

### 3.7 Avaliações
- **Ficheiros**: `components/estagios/avaliacao/avaliacao-tab.tsx`, `tutor-evaluation-form.tsx`, `professor-evaluation-view.tsx`, `aluno-evaluation-view.tsx`, `avaliacao-fullscreen-viewer.tsx`, `datas-avaliacao-editor.tsx`
- **Acesso**: Tutor preenche → Professor atribui nota final → Aluno vê (quando publicada)
- **Fluxo**: Config → Tutor avalia (parâmetros + comentários + assinatura) → Professor valida e atribui nota final → PDF gerado → Aluno pode ver (date-gated)

### 3.8 Notificações
- **Ficheiros**: `lib/notifications/create-notification.ts`, `termino-antecipado-notifications.ts`, `use-estagio-notifications.ts`, `components/chat/notifications-inbox.tsx`
- **Acesso**: Destinatário
- **Tipos**: request_created, professor_approved/rejected, tutor_approved/rejected, termino_submitted/approved/rejected/invalidated
- **Polling**: 30s via `/api/notifications`

### 3.9 Chat
- **Ficheiros**: `lib/chat/realtime-chat.ts`, `use-chat-notifications.ts`, `components/chat/internal-chat-hub.tsx`, `chat-interface.tsx`, `chat-org-member-sync.tsx`, `chat-nav-unread-badge.tsx`
- **Acesso**: Todos os roles
- **Tecnologia**: Firebase Realtime Database
- **Funcionalidades**: Conversas diretas/grupo/suporte, mensagens (2000 chars, 3 anexos, 8MB), edit/delete/restore, blocos, reports, typing indicators, search, org member sync, auto-conversação na atribuição de tutor

### 3.10 Sumários
- **Ficheiros**: `components/estagios/sumarios-tab.tsx`, `sumarios-export-panel.tsx`, `lib/pdf/sumarios-export-pdf.tsx`
- **Acesso**: Aluno (escrever), Tutor (validar), Todos (ver)
- **Fluxo**: Aluno escreve por semana → estado="preenchido" → Tutor assina → estado="arquivado" → Export PDF (cover + semanas + assinaturas)

### 3.11 Relatório Final
- **Ficheiros**: `app/api/estagios/[id]/relatorio-final/route.ts`
- **Acesso**: Aluno (submeter), Todos (ver estado)
- **Validações**: Horas mínimas (course.reportMinHours), período de espera (course.reportWaitDays), formato PDF/DOCX, path válido

### 3.12 Painel do Aluno
- **Ficheiros**: `components/student/student-dashboard-overview.tsx`, `components/student/student-protocol-view.tsx`, `components/student/student-reports-manager.tsx`
- **Dados**: Estágio ativo, horas realizadas, relatório, protocolo

### 3.13 Painel do Professor/Diretor
- **Ficheiros**: `components/professor/professor-dashboard-overview.tsx`, `internship-manager.tsx`, `estagios-section.tsx`, `professor-requests-center.tsx`
- **Dados**: Estágios por turma, alunos pendentes, contagens

### 3.14 Painel do Tutor
- **Ficheiros**: `components/tutor/tutor-dashboard-overview.tsx`, `tutor-school-internships.tsx`, `tutor-requests-center.tsx`, `tutor-summaries-validation.tsx`, `tutor-terminos-antecipados-center.tsx`, `tutor-inbox.tsx`
- **Dados**: Estágios atribuídos, sumários pendentes, pedidos pendentes

### 3.15 Painel do School Admin
- **Ficheiros**: `components/school-admin/*` (15+ componentes)
- **Dados**: Cursos, aprovações, professores ativos, auditoria, informação da escola, pastas

### 3.16 Audit Log
- **Ficheiros**: `lib/audit/*`, `components/audit/*`, `app/api/audit/resolve-users/route.ts`
- **Acesso**: admin_escolar
- **Entidades**: empresa, estagio, tutor, schedule_change_request, user, school, course, avaliacao
- **Ações**: create, update, archive, restore, delete, approve, reject, status_change, permission_change, cancel, associate, disassociate, update_settings, delete_request, delete_approved, delete_rejected, sign_avaliacao, reset_avaliacao
- **Armazenamento**: `schools/{schoolId}/auditLogs/{logId}`
- **Limpeza**: Cloud Function diária (365 dias de retenção)

### 3.17 Permissões por Empresa/Estrutura
- **Ficheiros**: `lib/empresas/empresa-access.ts`, `components/empresas/empresa-permissions.tsx`
- **Sistema**: empresaGrants — mapa `{ [uid]: "read"|"write" }` por empresa
- **Admin**: acesso total a todas as empresas da escola
- **Professor**: só vê empresas onde tem grant explícito; write grant permite editar empresa e associar tutores

### 3.18 Landing Page CMS
- **Ficheiros**: `app/super-admin/landing/page.tsx`, `app/api/landing-content/route.ts`, `app/api/super-admin/landing/route.ts`, `scripts/seed-landing-content.ts`
- **Acesso**: super_admin (escrita), público (leitura)
- **Secções editáveis**: Hero, Audience, Features, Steps, FAQs, Testimonials, CTA, Footer, Legal (Termos, Privacidade, Licença), Support auto-reply
- **Fallback**: Conteúdo hardcoded PT quando API falha

---

## 4. Mapa de Ficheiros por Módulo

| Módulo | Ficheiros principais |
|---|---|
| Auth | `lib/auth/*` (7 ficheiros), `proxy.ts`, `components/auth/*`, `app/login/*`, `app/register/*` |
| Sessão | `app/api/auth/session/*`, `lib/auth/jwt-session.ts`, `lib/auth/edge-jwks.ts` |
| Custom Claims | `lib/auth/custom-claims.ts`, `scripts/migrate-user-claims.js` |
| Estágios | `lib/estagios/*` (15 ficheiros), `components/estagios/*` (30+ ficheiros), `app/api/estagios/**` (22 rotas) |
| Empresas | `lib/empresas/*`, `components/empresas/*` (6 ficheiros), `app/api/empresas/**` (8 rotas) |
| Cursos | `app/api/courses/**`, `components/school-admin/courses-*.tsx` |
| Chat | `lib/chat/*` (3 ficheiros), `components/chat/*` (8 ficheiros), `database.rules.json` |
| Avaliações | `lib/avaliacao/*` (3 ficheiros), `components/estagios/avaliacao/*` (7 ficheiros), `app/api/estagios/*/avaliacao/**` (5 rotas) |
| Notificações | `lib/notifications/*` (3 ficheiros), `app/api/notifications/**` (2 rotas) |
| Auditoria | `lib/audit/*` (5 ficheiros), `components/audit/*` (2 ficheiros) |
| PDF | `lib/pdf/*`, `lib/avaliacao/avaliacao-pdf.ts`, `components/estagios/pdf/*` |
| Documentos | `components/estagios/documentos/*` (8 ficheiros), `app/api/estagios/*/documentos/**` (4 rotas) |
| Sumários | `components/estagios/sumarios-*.tsx`, `app/api/estagios/*/sumarios/**` |
| Término Antecipado | `lib/estagios/termino-antecipado.ts`, `app/api/estagios/*/termino-antecipado/**` (6 rotas) |
| Schedule Changes | `lib/estagios/schedule-change-requests.ts`, `app/api/estagios/*/schedule-change-requests/**` (6 rotas) |
| School Admin | `components/school-admin/*` (15+ ficheiros), `app/school-admin/*` (17 páginas) |
| Super Admin | `app/super-admin/*` (5 páginas), `app/api/super-admin/**` (4 rotas) |
| Firebase Admin | `lib/firebase-admin.ts`, `lib/firebase-runtime.ts` |
