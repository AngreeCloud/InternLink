# RUN_REPORT — Assinaturas no Relatório Final

## Resumo

Implementado o plano completo de assinaturas no relatório final (PLAN.md). 9 ficheiros alterados, 1 ficheiro criado.

---

## Checklist por Passo

### 1. API relatorio-final — signatureBoxes, bloqueio, allSigned corrigido ✅

**Ficheiro:** `app/api/estagios/[id]/relatorio-final/route.ts`

- Adicionado tipo `SignatureBox`, `sanitizeRoles()`, `sanitizeBoxes()` com validação rigorosa (página >= 1, coordenadas 0..1, roles permitidas)
- `SubmitBody` expandido para aceitar `signatureBoxes` e `signatureRoles`
- **POST (update):** Bloqueia se `estado === "assinado"` — erro `already_signed`
- **POST (update):** Aceita boxes/roles; se `hasSignatureFlow`, limpa `signedBy`, `signedByRoles` para reiniciar ciclo de assinaturas
- **POST (create):** `estado: "aguarda_assinatura"` (em vez de `"pendente"`) quando há fluxo de assinatura
- **POST (create):** `signatureRoles` default: `["aluno", "professor", "tutor"]`
- **GET:** `allSigned = boxes.length > 0 && sigsSnap.size >= boxes.length` (em vez de hardcoded `>= 2`)
- **GET:** Retorna `estado`, `signatureBoxes`, `signatureRoles` no objeto `report`

**Segurança:** `sanitizeBoxes()` valida todos os campos (página, coordenadas, roles), previne injeção de dados arbitrários.

### 2. Student upload — step de signature boxes ✅

**Ficheiro:** `components/student/student-reports-manager.tsx`

- Importações de `SignatureBoxEditor`, `SignatureBoxModel`, `EstagioRole`
- State: `sigBoxes`, `sigSelectedBoxId`, `sigActiveRole`, `sigDrawing`, `showSigBoxes`
- Secção "Posicionar assinaturas" aparece quando PDF selecionado — toggle "Posicionar caixas" / "Ocultar editor"
- Usa `PdfViewer` com `renderPageOverlay` → `SignatureBoxEditor` (idêntico ao upload-wizard)
- Sidebar: 3 botões de papel (Aluno, Orientador, Tutor), checkbox "Modo desenho", lista de caixas com ✕ delete
- `handleSubmit`: inclui `signatureRoles` e `signatureBoxes` no POST
- `clearFile`: reseta todo o state de assinaturas

### 3. ReportSignDialog — consentimento + assinatura ✅

**Ficheiro:** `components/estagios/documentos/report-sign-dialog.tsx` (NOVO)

- 2 passos: AlertDialog de consentimento → SignDialog de assinatura
- Textos de consentimento por papel:
  - **Aluno:** "Declaro que o presente relatório final de estágio é da minha autoria..."
  - **Professor:** "Declaro que revi o relatório final de estágio apresentado pelo aluno..."
  - **Tutor:** "Declaro que tomei conhecimento do relatório final de estágio apresentado pelo formando..."
- Estilo visual: bloco de citação `&ldquo;...&rdquo;` com `rounded-md border bg-muted/30` (igual ao sumários)
- Aviso: "Esta ação fica registada com a sua identidade e não pode ser revertida."
- Prop `currentUserRole` determina qual texto mostrar
- Reutiliza `SignDialog` existente para o passo de desenho/assinatura guardada

### 4. DocumentList — integração ReportSignDialog + esconder Nova versão ✅

**Ficheiro:** `components/estagios/documentos/document-list.tsx`

- `SignDialog` genérico vs `ReportSignDialog`: condicional por `templateCode === "RELATORIO_FINAL"`
- Botão "Nova versão" / "Carregar": oculto quando `d.estado === "assinado"` (linha 391)

### 5. Documentos PATCH — bloquear bump se assinado ✅

**Ficheiro:** `app/api/estagios/[id]/documentos/[docId]/route.ts`

- No caminho `bumpVersion`: verifica `estado === "assinado"` e lança `EstagioAccessError("doc_archived", "Documento assinado por todas as partes. Não pode ser alterado.")`

### 6. Archive — forçar arquivo para school-admin ✅

**Ficheiros:**
- `lib/estagios/archive-validations.ts` — `checkForceArchive()` com validações mínimas (não eliminado, não já arquivado)
- `components/estagios/archive-estagio-button.tsx` — prop `isSchoolAdmin`, botão "Forçar arquivo" (destructive style), diálogo de confirmação com aviso, PATCH com `forceArchive: true`
- `components/estagios/estagio-detail-view.tsx` — passa `isSchoolAdmin={currentUserRole === "admin_escolar"}`

**Lógica:** School-admin vê botão "Forçar arquivo" (vermelho) quando condições normais de arquivo não estão preenchidas. Ao forçar, ignora relatório não assinado, sumários pendentes, avaliações incompletas. Mantém apenas validações estruturais (não eliminado, não já arquivado).

### 7. Tutor reports view — acesso school-admin ✅

**Ficheiro:** `components/tutor/tutor-internship-reports-view.tsx`

- Verificação de acesso expandida: além de `tutorId === user.uid`, verifica `users/{uid}` para `role === "admin_escolar"` com `schoolId` correspondente
- School-admin da mesma escola pode ver todos os relatórios da página dedicada

---

## Ficheiros Alterados

| # | Ficheiro | Mudança |
|---|----------|---------|
| 1 | `app/api/estagios/[id]/relatorio-final/route.ts` | Boxes, bloqueio, allSigned |
| 2 | `components/student/student-reports-manager.tsx` | Step de signature boxes |
| 3 | `components/estagios/documentos/report-sign-dialog.tsx` | **NOVO** — consentimento + assinatura |
| 4 | `components/estagios/documentos/document-list.tsx` | Integração ReportSignDialog + ocultar upload |
| 5 | `app/api/estagios/[id]/documentos/[docId]/route.ts` | Bloquear bump assinado |
| 6 | `lib/estagios/archive-validations.ts` | `checkForceArchive()` |
| 7 | `components/estagios/archive-estagio-button.tsx` | Botão forçar arquivo |
| 8 | `components/estagios/estagio-detail-view.tsx` | Pass `isSchoolAdmin` |
| 9 | `components/tutor/tutor-internship-reports-view.tsx` | Acesso school-admin |

**Total:** 8 ficheiros alterados, 1 ficheiro criado.

---

## Verificações de Segurança

| Item | Implementação |
|------|---------------|
| `sanitizeBoxes()` | Valida página >= 1, coordenadas 0..1, roles da whitelist, previne campos extra |
| `sanitizeRoles()` | Filtra contra whitelist de `ALLOWED_ROLES` |
| Bloqueio de re-submissão | API verifica `estado === "assinado"` antes de aceitar update |
| Bloqueio de bump | API verifica `estado === "assinado"` antes de aceitar bumpVersion |
| Acesso school-admin | Verifica `users/{uid}` doc para `role === "admin_escolar"` + `schoolId` |
| Force archive | Apenas visível para `isSchoolAdmin=true`; validações mínimas (não eliminado/já arquivado) |
| Consentimento | Textos de compromisso específicos por papel antes da assinatura digital |
| Assinatura digital | Reutiliza o sistema existente (SignDialog → assinar/route.ts → subcoleção assinaturas) |
| Notificações | Já implementadas no passo anterior; professor, tutor, diretor notificados na submissão |
