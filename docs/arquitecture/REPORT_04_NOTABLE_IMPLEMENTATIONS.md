# REPORT_04_NOTABLE_IMPLEMENTATIONS.md — Implementações Notáveis

> **Progresso**: 495/495 ficheiros inspecionados

---

## 1. Segurança e Autorização

### 1.1 Firestore Rules Granulares com Funções Reutilizáveis
**Ficheiro**: `firestore.rules:1`
**Relevância**: 771 linhas de regras com funções reutilizáveis que implementam controlo de acesso multi-tenant.
**Porquê interessante**: Arquitetura de security rules baseada em funções composable (`isSchoolAdmin()`, `isProfessorFor()`, `isEstagioMember()`), cada uma verificando claims + existência de documentos + associações entre entidades. Cross-school isolation garantida por `schoolId` matching. Professores só aprovam alunos de cursos onde estão assignados (`isProfessorAssignedToCourse`). As regras de update são restritas por diff de chaves (`affectedKeys().hasOnly([...])`), prevenindo escalação de privilégios.
```javascript
function isProfessorAssignedToCourse(courseId) {
  return courseExists(courseId)
    && courseData(courseId).schoolId == currentUserData().schoolId
    && (
      (courseData(courseId).courseDirectorId is string && courseData(courseId).courseDirectorId == request.auth.uid)
      || (courseData(courseId).teacherIds is list && courseData(courseId).teacherIds.hasAny([request.auth.uid]))
      || (courseData(courseId).supportingTeacherIds is list && courseData(courseId).supportingTeacherIds.hasAny([request.auth.uid]))
    );
}
```

### 1.2 Realtime Database Rules com Atomicidade
**Ficheiro**: `database.rules.json:1`
**Relevância**: 200 linhas de regras com validações de atomicidade nas operações de chat.
**Porquê interessante**: As regras validam que criação de conversa + userConversations é atómica; validações de tipo MIME e tamanho nos anexos (≤8MB), controle de escrita por `senderId` (não podem forjar mensagens de outros), e regras de `readState` e `seenBy` por UID. O campo `participants` é declarado imutável após criação para prevenir escalação de privilégios.
```json
"messages": {
  "$conversationId": {
    "$messageId": {
      ".write": "auth != null && root.child('conversations').child($conversationId).child('participants').child(auth.uid).val() === true && ((!data.exists() && newData.child('senderId').val() === auth.uid) || (data.exists() && data.child('senderId').val() === auth.uid && newData.child('senderId').val() === data.child('senderId').val()))"
    }
  }
}
```

### 1.3 Custom Claims Sincronização Lazy
**Ficheiro**: `lib/auth/custom-claims.ts:1`
**Relevância**: Sincroniza claims Firebase Auth com Firestore apenas quando alteradas.
**Porquê interessante**: `ensureUserClaims()` lê Firestore para obter role/estado autoritativo, normaliza, e só escreve no Auth se diferente — evita invalidação desnecessária de tokens. Suporta fallback para `pendingRegistrations` e auto-promoção de tutores `inativo→ativo` quando email verificado.
```typescript
if (claimsChanged) {
  await auth.setCustomUserClaims(uid, newClaims);
} else {
  return { updated: false };
}
```

### 1.4 Proxy Edge com Cache de Perfis
**Ficheiro**: `proxy.ts:55`
**Relevância**: Middleware de autorização que corre em todas as rotas protegidas com cache em memória.
**Porquê interessante**: Cache em memória keyed por `uid:exp` com TTL derivado da expiração do JWT, evitando DB reads repetidos por request. Suporte a debug logging condicional (`AUTH_DEBUG`). Fallback para redirect para `/account-status` quando role/estado não permitem a rota.
```typescript
const roleCache = new Map<string, RoleCacheEntry>();
function getCachedProfile(uid: string, exp: number) {
  const entry = roleCache.get(getRoleCacheKey(uid, exp));
  if (!entry || entry.expiresAt <= Date.now()) { roleCache.delete(key); return null; }
  return { role: entry.role, estado: entry.estado };
}
```

### 1.5 Assinatura Eletrónica com Hash SHA-256 e IP Tracking
**Ficheiro**: `app/api/estagios/[id]/documentos/[docId]/assinar/route.ts:1`
**Relevância**: Assinatura de documentos com verificação de integridade da imagem e registo de IP.
**Porquê interessante**: Gera hash SHA-256 da imagem da assinatura para verificação de integridade. Regista IP do signatário (`x-forwarded-for` / `x-real-ip`). Valida permissão via `canSignDoc()`. Armazena assinatura em subcoleção dedicada `assinaturas/{signerUid}`.
```typescript
const signatureHash = crypto.createHash("sha256").update(signatureBuffer).digest("hex");
const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
```

---

## 2. Validações Complexas

### 2.1 Validação Matemática de Configuração de Avaliação
**Ficheiro**: `lib/avaliacao/validations.ts:1`
**Relevância**: Valida coerência matemática entre parâmetros, escalas e nota final.
**Porquê interessante**: Para método `soma`: verifica que `numParams × scaleMax === expectedFinalMax`. Para `media`: verifica que a escala dos parâmetros é igual à escala final. Estas validações previnem configurações impossíveis (ex: 3 parâmetros 0-5 com nota final 0-20 via soma = inconsistente).
```typescript
export function validateCoerenciaMatematica(config: AvaliacaoConfig): ValidationResult {
  if (metodo === "soma") {
    const sumMax = parametros.length * escala.max;
    if (sumMax !== notaFinal.max) return { valid: false, message: `...` };
  }
}
```

### 2.2 Validação de NIF Português
**Ficheiro**: `lib/validators/nif.ts:1`
**Relevância**: Algoritmo de check digit para NIF português (contribuinte).
**Porquê interessante**: Implementa o algoritmo mod 11 português: 9 dígitos, primeiro dígito 1-9, nem todos iguais, check digit = 11 - (soma ponderada mod 11).
```typescript
const checkDigit = 11 - (sum % 11);
const expectedCheckDigit = checkDigit >= 10 ? 0 : checkDigit;
return { valid: expectedCheckDigit === parseInt(digits[8]), message: ... };
```

### 2.3 Validação de Sobreposição de Pedidos
**Ficheiro**: `lib/estagios/schedule-change-requests.ts:1`
**Relevância**: Impede pedidos duplicados para a mesma data.
**Porquê interessante**: `validateNoOverlap()` verifica se já existe um pedido ativo (não cancelado/rejeitado) para a mesma data, prevenindo conflitos.
```typescript
export function validateNoOverlap(requests: ScheduleChangeRequest[], targetDate: string, excludeRequestId?: string) {
  const conflict = requests.find(r => r.targetDate === targetDate && r.id !== excludeRequestId && !["rejected","cancelled"].includes(r.status));
  return { ok: !conflict, conflictId: conflict?.id };
}
```

### 2.4 Validação de Elegibilidade para Término Antecipado
**Ficheiro**: `lib/estagios/termino-antecipado.ts:1`
**Relevância**: Determina se aluno pode pedir dispensa do último dia parcial.
**Porquê interessante**: Calcula horas restantes, verifica LIMIAR_DIAS=5, projeta dias futuros necessários, identifica dia dispensável. Validação de submissão e aprovação separadas. Invalidação automática se aluno falta no dia dispensado.

---

## 3. Padrões React/Next.js

### 3.1 Server Session com Retry e HTTP 428
**Ficheiro**: `lib/auth/client-session.ts:1`
**Relevância**: Criação de sessão com retry loop e tratamento de claims desatualizadas.
**Porquê interessante**: 4 tentativas com delays progressivos (300ms, 700ms, 1200ms). Detecta HTTP 428 "Precondition Required" como sinal para refrescar ID token e re-tentar. Força refresh do token antes de re-tentar.
```typescript
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const response = await fetch("/api/auth/session", { method: "POST", body: JSON.stringify({ idToken }) });
  if (response.status === 428) { /* claims atualizadas — refresh token e tenta de novo */ }
}
```

### 3.2 Lazy Firebase Init com Config da API
**Ficheiro**: `lib/firebase-runtime.ts:1`
**Relevância**: Inicialização lazy do Firebase client SDK com config obtida da API.
**Porquê interessante**: Em vez de expor config Firebase no bundle, obtém via `GET /api/firebase-public-config`. Singleton `initPromise` previne dupla inicialização. Usa `memoryLocalCache()` para Firestore para evitar problemas de IndexedDB em SSR.
```typescript
let initPromise: Promise<void> | null = null;
export async function ensureFirebaseInitialized(): Promise<FirebasePublicConfig> {
  if (initPromise) return initPromise.then(() => config);
  initPromise = (async () => { /* fetch config + initializeApp */ })();
  return initPromise.then(() => config);
}
```

### 3.3 EstagioDetailView — Hub Central com Tab Routing
**Ficheiro**: `components/estagios/estagio-detail-view.tsx:1`
**Relevância**: Vista principal do estágio com tabs navegáveis por search params.
**Porquê interessante**: Usa `useSearchParams` para tab routing sem estado local. `getUserRoleInEstagio()` deriva "diretor" de professor se for courseDirectorId. Cada tab é subsistema independente com seu próprio `onSnapshot`. Recalcula dataFimEstimada no mount se horas completas.
```
tab routing: ?tab=overview|documentos|horario|sumarios|calendario|avaliacao
```

### 3.4 Subscription Pattern com Cleanup
**Ficheiro**: `lib/estagios/use-pending-requests.ts:1`
**Relevância**: Hook React com subscriptions aninhadas e prevenção de memory leaks.
**Porquê interessante**: Padrão consistente em todo o projeto: flag `isCancelled` para prevenir setState após unmount; nested `onSnapshot` listeners com cleanup chain; supressão silenciosa de `permission-denied` (comum após logout).
```typescript
let cancelled = false;
const unsub1 = onSnapshot(q1, (snap) => {
  if (cancelled) return;
  // nested onSnapshot per document
}, (err) => { if (err.code !== "permission-denied") console.error(err); });
return () => { cancelled = true; unsub1(); /* cleanup nested */ };
```

### 3.5 Wizard de Upload com Posicionamento Visual de Assinaturas
**Ficheiro**: `components/estagios/documentos/upload-wizard.tsx:1`
**Relevância**: Wizard 3-passos para upload de documento com definição visual de caixas de assinatura.
**Porquê interessante**: Integração pdfjs-dist + fabric.js: renderiza páginas do PDF como imagens via pdfjs-dist, sobrepõe canvas fabric para desenhar retângulos de assinatura, coordenadas normalizadas 0-1 para serem resolution-independent. Step 3 mapeia cada caixa a um role.

---

## 4. Hooks Personalizados

### 4.1 useChatNotifications
**Ficheiro**: `lib/chat/use-chat-notifications.ts:1`
**Relevância**: Hook de notificações de chat com dedup e backoff.
**Porquê interessante**: Usa `sessionStorage` para dedup de notificações já mostradas. Exponential backoff no reconnect do listener RTDB (até 30s). Carrega perfis dos participantes em batch. Queue-based processing para evitar race conditions.
```typescript
const backoffDelays = [1000, 2000, 4000, 8000, 16000, 30000];
```

### 4.2 useEstagioNotifications
**Ficheiro**: `lib/notifications/use-estagio-notifications.ts:1`
**Relevância**: Hook de polling de notificações do estágio.
**Porquê interessante**: Polling a cada 30s via `setInterval`. Trata 401/403 silenciosamente (transições de logout). Fornece ações CRUD: markAsRead, remove, markAllRead, clearAll. `unreadCount` derivado via `useMemo`.

### 4.3 useSidebarCollapsed
**Ficheiro**: `lib/use-sidebar-collapsed.ts:1`
**Relevância**: Estado colapsado da sidebar persistido em localStorage.
**Porquê interessante**: Lê valor inicial do `localStorage` no mount. Atualização atómica com forma funcional do setState. Silent catch para `localStorage` indisponível.

---

## 5. Lógica de Negócio Não Trivial

### 5.1 Date Calc Pipeline — Cálculo de Datas de Fim de Estágio
**Ficheiro**: `lib/estagios/date-calc.ts:1`
**Relevância**: Pipeline multi-etapa de cálculo de data de fim considerando horas, ausências e correções.
**Porquê interessante**: 4 funções encadeadas: (1) `calcularDataFimEstimada` — walk dia a dia sem considerar ausências, (2) `calcularDataFimComAusencias` — walk completo com ausências aprovadas, (3) `calcularReplayAbsences` — calcula excesso de pushes para correção de `horasAusenciaAcumuladas` (corrige bug onde ausências parciais eram tratadas como totais), (4) `calcularReplayFormula` — versão closed-form para cross-verification nos testes. Hard limit de 3660 dias como safety. Testado com fuzz testing comparando loop vs fórmula.
```typescript
// Correção de bug: replay calcula pushes corretos com hoursAffected real
while (accumulated >= hpd) {
  endDate = nextWorkday(endDate, diasSemana, excludedDates, holidays);
  accumulated -= hpd;
  pushes++;
}
```

### 5.2 Schedule Change Request State Machine
**Ficheiro**: `lib/estagios/schedule-change-requests.ts:1`
**Relevância**: Máquina de estados explícita com 7 estados e 6 regras de transição.
**Porquê interessante**: Cada transição validada por `getNextStatus()` que verifica: estado atual válido, ator autorizado (aluno/professor/tutor), ação permitida. Suporta caminhos alternativos: `past_absence_justification` skips aprovação do tutor; `company_closure` criado como `approved` diretamente.
```typescript
const transitions = [
  { from: "pending_professor", action: "approve", actor: "professor", to: "pending_tutor" },
  { from: "pending_professor", action: "reject", actor: "professor", to: "rejected" },
  { from: "pending_tutor", action: "approve", actor: "tutor", to: "approved" },
  { from: "pending_tutor", action: "reject", actor: "tutor", to: "rejected" },
  // ...
];
```

### 5.3 Feriados Portugueses com Algoritmo de Easter
**Ficheiro**: `lib/estagios/pt-holidays.ts:1`
**Relevância**: Cálculo de feriados nacionais portugueses incluindo móveis.
**Porquê interessante**: Implementa algoritmo de Meeus/Jones/Butcher para calcular a Páscoa Gregoriana, derivando Carnaval, Sexta-feira Santa e Corpo de Deus. 10 feriados fixos + 4 móveis. Retorna `Set<string>` para lookup O(1). Suporta feriados municipais via `excludedDates` manuais.
```typescript
// Meeus/Jones/Butcher algorithm
const a = year % 19;
const b = Math.floor(year / 100);
const c = year % 100;
// ...
const easterMonth = Math.floor((h + L - 7 * m + 114) / 31);
const easterDay = ((h + L - 7 * m + 114) % 31) + 1;
```

### 5.4 Auto-Archive com 7 Condições
**Ficheiro**: `lib/estagios/archive-validations.ts:1`
**Relevância**: Verificação de 7 condições para arquivar um estágio.
**Porquê interessante**: Cada condição falhada gera uma razão legível em português. Usado tanto para UI (mostrar ao utilizador o que falta) quanto para auto-archive server-side. Condições: estado não arquivado/eliminado, data fim passada, relatório submetido + 2+ assinaturas, sumários preenchidos + assinados, avaliação tutor assinada, avaliação professor assinada.

---

## 6. Geração de PDFs

### 6.1 PDF de Avaliação com Assinaturas Embutidas
**Ficheiro**: `lib/avaliacao/avaliacao-pdf.ts:1`
**Relevância**: Geração de PDFs de avaliação (tutor e nota final) com assinaturas embutidas.
**Porquê interessante**: Usa `pdf-lib` para criar PDFs do zero com layout profissional. Embuta imagens de assinatura em base64 PNG. Line-wrapping de comentários (~90 chars). Layout de duas colunas para assinaturas (tutor esquerda, professor direita). Sanitização de texto para WinAnsi (remove em-dash, smart quotes, elipses).
```typescript
const signatureImage = await pdfDoc.embedPng(signatureBytes);
page.drawImage(signatureImage, { x, y, width: scaledWidth, height: scaledHeight });
```

### 6.2 PDF de Sumários Multi-Página com @react-pdf/renderer
**Ficheiro**: `lib/pdf/sumarios-export-pdf.tsx:1`
**Relevância**: Exportação de todos os sumários semanais num único PDF formatado.
**Porquê interessante**: Três tipos de página (capa, sumário semanal, assinaturas) com branding consistente (paleta teal/dark/beige). SVG logo inline. Badges de validação por semana. Assinaturas embutidas a partir de Uint8Array. Footer constante com número de página. Server-side rendering via `renderToBuffer`.
```tsx
<Document>
  <Page size="A4" style={styles.page}>
    {/* Capa com info da escola, empresa, intervenientes, período */}
  </Page>
  {weeks.map(week => (
    <Page key={week.id}>
      {/* Conteúdo do sumário + badge de validação */}
    </Page>
  ))}
  <Page>
    {/* Página de assinaturas com blocos duplos */}
  </Page>
</Document>
```

---

## 7. Integração Avançada com Firebase

### 7.1 Chat em Tempo Real Completo
**Ficheiro**: `lib/chat/realtime-chat.ts:1`
**Relevância**: Sistema de chat completo sobre Firebase Realtime Database.
**Porquê interessante**: ~25 exports, incluindo: criação de conversas, envio/edição/eliminação/restauro de mensagens, blocos, reports, search de membros, typing indicators, marcação de leitura, anexos (3 ficheiros, 8MB cada), auto-conversação na atribuição de tutor, sync de org members, fallback para API quando client SDK falha. Verificações de permissão: tutor-student association verificada em RTDB + Firestore, professor-tutor via `userTutors` index.
```typescript
export async function ensureAutoConversationForTutorAssignment(studentId: string, professorId: string, tutorId: string) {
  // Cria conversa de grupo 3-pessoas automaticamente
}
```

### 7.2 Collection Group Queries para Notificações
**Ficheiro**: `app/api/notifications/route.ts` (conceito)
**Relevância**: Uso de collection group queries para inbox cross-estágio.
**Porquê interessante**: Em vez de cada estágio ter sua própria coleção de notificações (difícil de consultar), usa collection group indexado `notifications` com `userId + createdAt`. Índice dedicado em `firestore.indexes.json`.

### 7.3 Batch Operations com Firestore Transactions
**Ficheiro**: `app/api/empresas/[id]/fechos/route.ts:1`
**Relevância**: Transações Firestore para atomicidade em operações multi-documento.
**Porquê interessante**: Criação de fecho de empresa usa transação para prevenir duplicados (verifica existência + cria). Batch write para cancelar múltiplos schedule_change_requests ao remover fecho.

---

## 8. Testes Bem Construídos

### 8.1 Date Calc Tests — Fuzz Testing
**Ficheiro**: `tests/actions/date-calc.test.ts:1`
**Relevância**: ~560 linhas, ~30+ testes incluindo fuzz testing.
**Porquê interessante**: Compara implementação loop vs fórmula fechada com inputs aleatórios. Usa caso real (João da Ega: 400h, 247 realizadas, 5 ausências) como fixture. Testes de invariantes: `correctAcc` sempre em `[0, hpd)`. Edge cases: 0 horas, NaN, sem workdays, horas completas.
```typescript
for (let i = 0; i < 50; i++) {
  const randomHpd = Math.floor(Math.random() * 8) + 1;
  // ... comparar formulaResult com loopResult
}
```

### 8.2 Firestore Rules Tests — Cross-School Isolation
**Ficheiro**: `tests/firestore/school-isolation.rules.test.mjs:1`
**Relevância**: 669 linhas, ~28 testes de regras Firestore.
**Porquê interessante**: Testa isolamento cross-school: professor não pode ler/aprovar alunos de outra escola. Testa restrições de campos em updates (não pode mudar role, schoolId). Testa collection group queries (schedule_change_requests, notifications). Testa re-registo de utilizadores rejeitados/removidos. Setup com 2 escolas + múltiplos utilizadores por role + cursos + estágios + empresas.

---

## 9. Scripts de Migração

### 9.1 Fix Partial Hours — Correção de Bug com Dry-Run
**Ficheiro**: `scripts/fix-partial-hours.mjs:1`
**Relevância**: Script de correção de dados com múltiplas camadas de segurança.
**Porquê interessante**: Corrige bug onde `Number.isFinite()` causava ausências parciais a serem contadas como dia completo. Dry-run obrigatório (mostra diff antes de aplicar), `--apply` explícito, max 5 dias de pull-back, confirmação interativa. Replica lógica do `recalcularDataFimEstimada` com `calcularReplayAbsences`.

### 9.2 Audit Notification Links — Validação de Integridade
**Ficheiro**: `scripts/audit-notification-links.ts:1`
**Relevância**: Auditoria de links de notificações no Firestore.
**Porquê interessante**: Classifica links como `valido`/`invalido`/`suspeito`/`vazio` por matching contra rotas Next.js conhecidas. Output JSON + TXT. Útil para detetar notificações com links quebrados após alterações de routing.

---

## 10. UX e Detalhes de Interface

### 10.1 Assinatura Eletrónica com SignaturePad Canvas
**Ficheiro**: `components/estagios/signature-pad.tsx:1`
**Relevância**: Componente de assinatura com suporte a DPR-aware canvas.
**Porquê interessante**: ForwardRef + useImperativeHandle para expor API imperativa (`clear()`, `toDataUrl()`, `isEmpty()`). DPR-aware (devicePixelRatio) para assinaturas nítidas em ecrãs retina. Pointer events para suporte a touch + mouse. Stroke configurável (cor, espessura).

### 10.2 Calendar Color-Coded com Tooltips e Pedidos
**Ficheiro**: `components/estagios/calendario-tab.tsx:1`
**Relevância**: Calendário do estágio com código de cores, tooltips e ações contextuais.
**Porquê interessante**: 5 cores (verde=ok, amarelo=faltou, azul=hoje, roxo=feriado, anéis=pedidos). Tooltip ao hover mostra horas do dia + acumuladas + projeção. Clique em dia passado → cria justificação; clique em dia futuro → cria pedido de ausência. Banner de término antecipado com estados visuais.

### 10.3 Wizard de Registo com 3 Passos + Validações
**Ficheiro**: `app/register/aluno/page.tsx:1`
**Relevância**: Registo de aluno com máquina de estados e validações encadeadas.
**Porquê interessante**: Step machine: `school-selection → auth-selection → registration-form`. Cada step com validações próprias. Suporte a password + Google auth. Validação de domínio de email institucional por escola. Password strength meter. reCAPTCHA v3. Atomic rollback (elimina Auth user se Firestore write falhar).
