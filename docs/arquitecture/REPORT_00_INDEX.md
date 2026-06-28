# REPORT_00_INDEX.md — Índice Geral

> **Progresso de inspeção**: 495/495 ficheiros inspecionados (100%)

---

## Resumo Executivo

**InternLink** é uma plataforma de gestão de estágios curriculares (FCT — Formação em Contexto de Trabalho) para escolas secundárias e profissionais portuguesas. Centraliza a relação **escola ↔ aluno ↔ entidade acolhedora** ao longo do ciclo de vida completo do estágio: aprovação de contas, associação de cursos/turmas, gestão documental com assinaturas eletrónicas posicionais, comunicação em tempo real e painéis por perfil.

- **Tecnologias**: Next.js 16 (App Router), React 18, Tailwind CSS 4, Radix UI/shadcn/ui, Firebase (Auth + Firestore + Realtime Database + Storage), pdf-lib, pdfjs-dist, jose, zod, react-hook-form
- **Autor**: Miguel Pedrosa / AngreeCloud
- **Licença**: CC BY-NC 4.0
- **Repositório**: https://github.com/AngreeCloud/InternLink

---

## Estatísticas Gerais

| Métrica | Contagem |
|---|---|
| Total de ficheiros inspecionados | 495 |
| Rotas de página (App Router) | 88 |
| API Route Handlers | 75 |
| Componentes React | 120 |
| Ficheiros de biblioteca (lib/) | 50 |
| Testes | 45 |
| Scripts de migração/seed | 22 |
| Roles de utilizador | 7 |
| Estados de utilizador | 5 |
| Templates de documentos FCT | 12 |
| Coleções Firestore principais | 14+ |
| Regras Firestore (linhas) | 771 |
| Regras Storage (linhas) | 161 |
| Regras Realtime DB (linhas) | 200 |
| Índices Firestore configurados | 19 |

---

## Lista de Ficheiros do Relatório

| # | Ficheiro | Descrição |
|---|---|---|
| 00 | `REPORT_00_INDEX.md` | Este índice geral |
| 01 | `REPORT_01_EXTERNAL_ARCHITECTURE.md` | Firestore, RTDB, Storage, Auth, CI/CD, variáveis de ambiente, testes, segurança |
| 02 | `REPORT_02_INTERNAL_ARCHITECTURE.md` | Roles, entidades, módulos, permissões, ciclos de vida |
| 03 | `REPORT_03_FLOWS_FOR_DIAGRAMS.md` | Fluxos passo a passo para Draw.io |
| 04 | `REPORT_04_NOTABLE_IMPLEMENTATIONS.md` | Implementações técnica ou academicamente relevantes |

---

## Estrutura do Projeto (Diretórios Principais)

```
InternLink/
├── app/                     # Rotas Next.js (App Router) — páginas + API routes
│   ├── api/                 #   └─ 75 Route Handlers REST
│   ├── dashboard/           #   └─ Painel do aluno
│   ├── professor/           #   └─ Painel do professor
│   ├── tutor/               #   └─ Painel do tutor externo
│   ├── school-admin/        #   └─ Painel do admin escolar
│   ├── super-admin/         #   └─ Painel do super admin
│   ├── encarregado/         #   └─ Painel do encarregado de educação
│   ├── support/             #   └─ Painel de suporte
│   ├── login/               #   └─ Autenticação
│   └── register/            #   └─ Registo (aluno/professor/tutor)
├── components/              # Componentes React reutilizáveis
│   ├── estagios/            #   └─ Gestão de estágios (documentos, avaliação, sumários, calendário)
│   ├── professor/           #   └─ Componentes específicos do professor
│   ├── tutor/               #   └─ Componentes específicos do tutor
│   ├── school-admin/        #   └─ Componentes específicos do admin escolar
│   ├── chat/                #   └─ Sistema de chat em tempo real
│   ├── layout/              #   └─ Layouts por role
│   ├── profile/             #   └─ Perfil e assinatura
│   └── ui/                  #   └─ Primitivos shadcn/ui
├── lib/                     # Lógica de negócio e utilitários
│   ├── auth/                #   └─ Sessão JWT, custom claims, status routing
│   ├── estagios/            #   └─ Permissões, templates, date-calc, workdays, feriados
│   ├── avaliacao/           #   └─ Avaliações (PDFs, validações, tipos)
│   ├── chat/                #   └─ Chat tempo real, notificações
│   ├── notifications/       #   └─ Notificações (criação, polling)
│   ├── audit/               #   └─ Auditoria (leitura, escrita, tipos)
│   ├── empresas/            #   └─ Acesso a empresas
│   ├── pdf/                 #   └─ Exportação de sumários em PDF
│   ├── validators/          #   └─ Schemas Zod (NIF, registo, school-request)
│   └── types/               #   └─ Tipos TypeScript (chat, empresa, school)
├── actions/                 # Server Actions (registo, school requests)
├── functions/               # Firebase Cloud Functions (limpeza de audit logs)
├── scripts/                 # Migrações, seeds, diagnósticos
├── tests/                   # Vitest + Firebase emulator rules tests
├── docs/screenshots/        # Capturas de ecrã
├── firestore.rules          # Regras de segurança Firestore (771 linhas)
├── storage.rules            # Regras de segurança Storage (161 linhas)
├── database.rules.json      # Regras de segurança Realtime DB (200 linhas)
└── proxy.ts                 # Middleware de autorização edge (Next.js 16)
```

---

## Roles de Utilizador

| Role | Código | Âmbito | Nº de rotas próprias |
|---|---|---|---|
| Aluno | `aluno` | Próprio estágio | 10 |
| Professor | `professor` | Cursos/turmas | 13 |
| Tutor externo | `tutor` | Empresa/entidade | 16 |
| Admin Escolar | `admin_escolar` | Uma escola | 17 |
| Encarregado Educação | `encarregado` | Educandos associados | 6 |
| Super Admin | `super_admin` | Plataforma global | 5 |
| Suporte | `support` | Tickets de suporte | 2 |

---

## Estados de Utilizador

| Estado | Descrição |
|---|---|
| `ativo` | Conta aprovada e funcional |
| `pendente` | Aguarda aprovação por admin escolar/professor |
| `recusado` | Registo rejeitado |
| `removido` | Conta removida da escola |
| `inativo` | Email não verificado (tutores) ou conta desativada |

---

## Principais Coleções Firestore

| Coleção | Documentos estimados | Descrição |
|---|---|---|
| `users/{uid}` | ~M | Perfis de utilizador |
| `pendingRegistrations/{uid}` | ~D | Registos pendentes de aprovação |
| `schools/{schoolId}` | ~D | Metadados das escolas |
| `courses/{courseId}` | ~C | Cursos e turmas |
| `estagios/{estagioId}` | ~M | Estágios (documento principal) |
| `empresas/{empresaId}` | ~C | Entidades de acolhimento |
| `tutorInvites/{inviteId}` | ~D | Convites a tutores |
| `schoolLeads/{leadId}` | ~D | Leads de escolas interessadas |
| `landingContent/{docId}` | ~1 | Conteúdo CMS da landing page |
| `supportTickets/{ticketId}` | ~D | Tickets de suporte |

Subcoleções notáveis:
- `estagios/{id}/documentos/` — documentos do estágio
- `estagios/{id}/documentos/{docId}/versoes/` — versões imutáveis
- `estagios/{id}/documentos/{docId}/assinaturas/` — assinaturas por signatário
- `estagios/{id}/presencas/` — registos diários de horas
- `estagios/{id}/sumarios/` — sumários semanais
- `estagios/{id}/avaliacao/` — avaliações (tutor + professor)
- `estagios/{id}/schedule_change_requests/` — pedidos de alteração
- `estagios/{id}/notifications/` — notificações do estágio
- `schools/{id}/auditLogs/` — logs de auditoria
- `schools/{id}/tutors/` — tutores da escola
- `schools/{id}/pendingTeachers/` — professores pendentes (legacy)
- `schools/{id}/deleteEstagioRequests/` — pedidos de eliminação
- `schools/{id}/folders/` — pastas de documentos
- `courses/{id}/settings/` — configurações do curso
