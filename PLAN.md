# PLAN.md — Assinaturas no Relatório Final

## Visão Geral

Implementar um fluxo completo de assinaturas para o relatório final de estágio, com consentimento explícito, caixas de assinatura posicionadas no PDF, bloqueio de versão após assinatura tripla, e dependência de arquivamento do estágio.

---

## 1. Upload com Caixas de Assinatura (Aluno)

**Ficheiro:** `components/student/student-reports-manager.tsx`

**Problema atual:** Formulário simples (file picker + título + resumo). Sem posicionamento de assinaturas.

**Mudança:** Após o aluno escolher o ficheiro PDF e este ser pré-visualizado (já existe `<PdfViewer>` no componente), adicionar um step de posicionamento de caixas de assinatura:
- Exibir o PDF com overlay de `<SignatureBoxesOverlay>` (já existe em `components/estagios/pdf/signature-boxes-overlay.tsx`)
- O aluno arrasta 3 caixas: uma para si (Aluno), uma para o Professor Orientador, uma para o Tutor
- Cada caixa é associada a um papel (`role`) — guardado no array `signatureBoxes`
- No POST para `/api/estagios/{id}/relatorio-final`, incluir `signatureBoxes` e `signatureRoles: ["aluno", "professor", "tutor"]`

**Estado do documento após submissão:** `estado: "aguarda_assinatura"` (em vez de `"pendente"`)

**Ficheiros a alterar:**
- `components/student/student-reports-manager.tsx` — adicionar step de signature boxes
- `app/api/estagios/[id]/relatorio-final/route.ts` — aceitar e guardar `signatureBoxes`, `signatureRoles`, estado inicial `"aguarda_assinatura"`

---

## 2. Diálogo de Consentimento + Assinatura (Todos os Papéis)

### 2.1 Componente `ReportSignDialog`

**Novo ficheiro:** `components/estagios/documentos/report-sign-dialog.tsx`

Fluxo em 2 passos:

**Passo 1 — Consentimento (AlertDialog):**
- Texto de compromisso diferente por papel:

| Papel | Texto de Consentimento |
|-------|----------------------|
| **Aluno** | "Declaro que o presente relatório final de estágio é da minha autoria, que o conteúdo é verdadeiro e reflete fielmente o trabalho por mim realizado durante o período de estágio." |
| **Professor** | "Declaro que revi o relatório final de estágio apresentado pelo aluno e confirmo que o mesmo cumpre os requisitos académicos estabelecidos, refletindo o trabalho desenvolvido durante o estágio curricular." |
| **Tutor** | "Declaro que tomei conhecimento do relatório final de estágio apresentado pelo formando e confirmo que as atividades e resultados descritos são compatíveis com o plano de formação em contexto de trabalho em vigor na empresa." |

- Estilo visual: bloco de citação com `&ldquo;...&rdquo;` (igual ao sumários: `rounded-md border bg-muted/30`)
- Aviso: "Esta ação fica registada com a sua identidade e não pode ser revertida."
- Botão: "Li e concordo — Prosseguir para assinatura"

**Passo 2 — Assinatura Digital (reutilizar `sign-dialog.tsx`):**
- Após consentimento, abre o `sign-dialog.tsx` existente (tabs: "Usar assinatura guardada" / "Desenhar agora")
- Ao confirmar, chama `POST /api/estagios/{id}/documentos/{docId}/assinar` (rota já existente)
- Inclui o flag `consentGiven: true` para registar que o consentimento foi aceite

**Integração no `document-list.tsx`:**
- Botão "Assinar relatório" com ícone de caneta (em vez de "Assinar documento" genérico)
- Ao clicar, abre o `ReportSignDialog` (não o `sign-dialog.tsx` genérico)
- Apenas visível se `templateCode === "RELATORIO_FINAL"` e o utilizador ainda não assinou

**Ficheiros a criar/alterar:**
- `components/estagios/documentos/report-sign-dialog.tsx` — NOVO
- `components/estagios/documentos/document-list.tsx` — condição para abrir ReportSignDialog em vez de SignDialog genérico

---

## 3. Bloqueio de Versão Após Assinatura Tripla

**Regra:** Quando os 3 intervenientes (aluno, professor, tutor) assinam → `estado: "assinado"` → documento fica bloqueado.

### 3.1 Bloquear re-submissão pelo aluno

**Ficheiro:** `app/api/estagios/[id]/relatorio-final/route.ts` (POST)

Adicionar verificação antes do update:
```typescript
if (existing && existing.data().estado === "assinado") {
  throw new EstagioAccessError(400, "already_signed", 
    "O relatório já foi assinado por todas as partes. Não pode ser alterado.");
}
```

### 3.2 Bloquear bump de versão por professor/diretor

**Ficheiro:** `app/api/estagios/[id]/documentos/[docId]/route.ts` (PATCH)

No caminho `bumpVersion` (linhas 475-495), adicionar:
```typescript
if (existingDoc.estado === "assinado") {
  throw new EstagioAccessError(400, "doc_archived",
    "Documento assinado por todas as partes. Não pode ser alterado.");
}
```

### 3.3 Bloquear upload wizard para documento assinado

**Ficheiro:** `components/estagios/documentos/document-list.tsx`

Ocultar botão "Nova versão" / "Carregar" quando `d.estado === "assinado"`.

### 3.4 All-signed check no relatorio-final

**Ficheiro:** `app/api/estagios/[id]/relatorio-final/route.ts` (GET, linha 307)

Corrigir o `allSigned` hardcoded (`>= 2`) para usar `signatureBoxes.length` (3 caixas → 3 assinaturas necessárias).

**Ficheiros a alterar:**
- `app/api/estagios/[id]/relatorio-final/route.ts` — bloquear POST se assinado + corrigir allSigned
- `app/api/estagios/[id]/documentos/[docId]/route.ts` — bloquear PATCH se assinado
- `components/estagios/documentos/document-list.tsx` — esconder botão "Nova versão"

---

## 4. Dependência de Arquivamento do Estágio

### 4.1 Arquivo normal (já parcialmente implementado)

**Ficheiro:** `lib/estagios/archive-validations.ts`

Já existe `reportAllSigned` como condição de bloqueio (linha 39). O `archive-estagio-button.tsx` já consulta `report.allSigned` via GET do relatorio-final.

**Ação:** Confirmar que funciona com a correção do `allSigned` (secção 3.4).

### 4.2 Arquivo forçado (school-admin)

**Ficheiro:** `components/estagios/archive-estagio-button.tsx`

Adicionar um segundo botão "Forçar arquivamento" visível apenas para school-admin:
- Aparece quando `checkCanArchive()` retorna `false`
- Chama `PATCH /api/estagios/{id}` com `{ estadoEstagio: "arquivado", forceArchive: true }`

**Ficheiro:** `app/api/estagios/[id]/route.ts` (PATCH)

No handler de PATCH, quando `forceArchive: true` e `session.role === "diretor"` (school-admin mapeia para diretor):
- Saltar as validações de `reportAllSigned`, `allSumariosAssinados`, etc.
- Manter apenas validações estruturais (estágio não eliminado, etc.)

**Ficheiro:** `lib/estagios/archive-validations.ts`

Adicionar função `checkForceArchive()` com validações mínimas (não eliminado, não já arquivado).

**Ficheiros a alterar:**
- `components/estagios/archive-estagio-button.tsx` — botão de forçar arquivo
- `app/api/estagios/[id]/route.ts` — aceitar `forceArchive`
- `lib/estagios/archive-validations.ts` — `checkForceArchive()`

---

## 5. Acesso do School-Admin aos Relatórios

**Diagnóstico:** School-admin já é mapeado para `role: "diretor"` em `estagio-access.ts:117-130`. Isto significa:
- `canReadDoc` retorna `true` (diretor vê tudo)
- `canSignDoc` funciona se `signatureRoles` incluir `"diretor"` (não é o caso do relatório — só `aluno/professor/tutor`)
- `assertManagerRole` aceita diretor → pode gerir documentos

**Verificações necessárias:**
- Confirmar que school-admin consegue aceder à página `/tutor/estagios/{schoolId}/{estagioId}/relatorios` (a página dedicada de relatórios)
- Confirmar que school-admin vê o relatório na tab Documentos do `EstagioDetailView`
- School-admin **não** deve poder assinar o relatório (só aluno, professor, tutor) — já está correto porque `signatureRoles` não inclui `"diretor"`

**Ações:**
1. `TutorInternshipReportsView`: a verificação de acesso (`estagio.tutorId === user.uid`) bloqueia school-admin. Alterar para também permitir school-admin da mesma escola.
2. `EstagioDetailView`: school-admin já vê o estágio via `assertEstagioAccess` (mapeado para diretor). A tab Documentos já funciona.

**Ficheiros a alterar:**
- `components/tutor/tutor-internship-reports-view.tsx` — permitir school-admin na verificação de acesso

---

## 6. Resumo de Ficheiros

### A criar (1):
| Ficheiro | Descrição |
|----------|-----------|
| `components/estagios/documentos/report-sign-dialog.tsx` | Diálogo de consentimento + assinatura para relatório |

### A alterar (8):
| Ficheiro | Mudança |
|----------|---------|
| `components/student/student-reports-manager.tsx` | Step de signature boxes no upload |
| `components/estagios/documentos/document-list.tsx` | Abrir ReportSignDialog para relatório; esconder "Nova versão" se assinado |
| `app/api/estagios/[id]/relatorio-final/route.ts` | Aceitar signatureBoxes; estado inicial aguarda_assinatura; bloquear POST se assinado; corrigir allSigned |
| `app/api/estagios/[id]/documentos/[docId]/route.ts` | Bloquear PATCH se estado === "assinado" |
| `components/estagios/archive-estagio-button.tsx` | Botão "Forçar arquivamento" para school-admin |
| `app/api/estagios/[id]/route.ts` | Aceitar forceArchive no PATCH |
| `lib/estagios/archive-validations.ts` | checkForceArchive() com validações mínimas |
| `components/tutor/tutor-internship-reports-view.tsx` | Permitir acesso a school-admin |

### Sem alterações (já ok):
| Ficheiro | Razão |
|----------|-------|
| `app/api/estagios/[id]/documentos/[docId]/assinar/route.ts` | Já suporta signatureBoxes.length para allSigned; já guarda assinaturas; já envia notificações |
| `components/estagios/documentos/sign-dialog.tsx` | Reutilizado pelo ReportSignDialog (passo 2) |
| `components/estagios/pdf/signature-boxes-overlay.tsx` | Reutilizado no upload wizard do aluno |
| `lib/estagios/permissions.ts` | canSignDoc já funciona com signatureRoles |
| `lib/estagios/estagio-access.ts` | School-admin já mapeado para "diretor" |

---

## 7. Ordem de Implementação

1. **API relatorio-final** — aceitar `signatureBoxes`/`signatureRoles`, corrigir `allSigned`, bloquear re-submissão
2. **Student upload** — adicionar step de signature boxes no `student-reports-manager.tsx`
3. **ReportSignDialog** — criar componente de consentimento + assinatura
4. **DocumentList** — integrar ReportSignDialog + esconder "Nova versão" para assinados
5. **Documentos PATCH** — bloquear bump de versão se assinado
6. **Archive** — forçar arquivo para school-admin
7. **Tutor reports view** — acesso school-admin
