# REPORT_03_FLOWS_FOR_DIAGRAMS.md — Fluxos para Draw.io

> **Progresso**: 495/495 ficheiros inspecionados

---

## FLUXO 1: Login e Verificação de Role

```
[Utilizador não autenticado] → acede /login
  → preenche email + password (ou Google)
  → [Validação] reCAPTCHA v3 token obtido?
     ├── NÃO → bloqueia submit
     └── SIM → Firebase Auth signIn
         → [Verificação] email verificado?
            ├── NÃO → redireciona /verify-email
            └── SIM → POST /api/auth/session (idToken)
                → ensureUserClaims() — sincroniza role + estado das claims
                → [Verificação] claims atualizadas?
                   ├── SIM → HTTP 428 → cliente refresha token → re-tenta
                   └── NÃO → cria cookie internlink_session
                       → [Verificação] role + estado?
                          ├── aluno + ativo → /dashboard
                          ├── aluno + pendente → /waiting
                          ├── professor + ativo → /professor
                          ├── professor + pendente/recusado → /account-status
                          ├── tutor + ativo → /tutor
                          ├── tutor + inativo → /verify-email
                          ├── admin_escolar + ativo → /school-admin
                          ├── encarregado + ativo → /encarregado
                          ├── super_admin → /super-admin
                          └── support → /support
```

---

## FLUXO 2: Criação de Escola (Super Admin)

```
[Super Admin] → /super-admin/escolas
  → preenche formulário (nome escola, email admin, password)
  → [Validação] email válido? password ≥6 chars?
     ├── NÃO → erro no formulário
     └── SIM → POST /api/super-admin/schools
         → Firebase Admin: cria Auth user (admin)
         → Firebase Admin: set custom claims (role=admin_escolar, estado=ativo)
         → Firestore: cria school doc (schoolId = auth uid)
         → Firestore: cria user doc (role=admin_escolar, estado=ativo)
         → [Validação] tudo criado?
            ├── NÃO → rollback (não implementado rollback automático)
            └── SIM → resposta com credenciais { email, password, schoolId }
                → UI mostra cartão com credenciais + botão copiar
```

---

## FLUXO 3: Convite e Onboarding de Utilizador

### 3a. Registo de Aluno

```
[Aluno] → /register/aluno
  → Step 1: SchoolSelector — escolhe escola
  → Step 2: Escolhe método auth (email+password ou Google)
  → Step 3: Preenche dados (nome, email, password, data nascimento, telefone, curso)
  → [Validação] idade ≥13? email domínio institucional (se exigido)? password ≥6?
     ├── NÃO → erro no formulário
     └── SIM → POST /api/recaptcha/verify → registerAluno()
         → Firebase Auth: createUserWithEmailAndPassword
         → Firebase Auth: sendEmailVerification
         → Firestore: setDoc(users/{uid}, { role:"aluno", estado:"pendente", ... })
         → [Erro?] Firestore write falha?
            ├── SIM → rollbackAuthUser() — elimina Auth user
            └── NÃO → redireciona /verify-email
```

### 3b. Aprovação de Aluno pelo Professor

```
[Professor] → /professor/alunos
  → vê lista de alunos pendentes (query users where schoolId + role="aluno" + estado="pendente")
  → clica "Aprovar" num aluno
  → [Validação] professor está assigned ao curso do aluno?
     ├── NÃO → erro (Firestore rules bloqueiam)
     └── SIM → updateDoc(users/{alunoId}, { estado:"ativo" })
         → ensureUserClaims(alunoId) — sync custom claims
         → audit log: action="approve", entityType="user"
```

### 3c. Convite de Tutor

```
[Professor] → cria convite (tutorInvites collection)
  → Firestore: addDoc({ email, schoolId, professorId, ... })
  → [Tutor] recebe link → regista-se → /register/tutor
     → Firebase Auth: cria conta
     → Firestore: setDoc(users/{uid}, { role:"tutor", estado:"ativo"/"inativo", ... })
     → [Verificação] emailVerified?
        ├── SIM → estado="ativo" → /tutor
        └── NÃO → estado="inativo" → /verify-email
```

---

## FLUXO 4: Criação e Gestão de Estágio

```
[Professor/Diretor] → /professor/estagios
  → clica "Criar Estágio" → CreateEstagioDialog
  → seleciona aluno (lista de alunos ativos do curso)
  → [opcional] seleciona tutor (search na escola)
  → [opcional] seleciona empresa (debounced search 250ms ou texto livre)
  → define dataInicio, totalHoras, horasDiarias, diasSemana
  → [cálculo automático] calcularDataFimEstimada() → mostra preview
  → submete → POST /api/estagios
     → [Validação] aluno existe + ativo + mesma escola + tem curso?
     → [Validação] professor é courseDirector do aluno?
        ├── NÃO → 403
        └── SIM → continua
     → Firestore: cria estagio doc
     → Firestore: seed 12 template documentos (ESTAGIO_TEMPLATES)
     → Firestore: calcula dataFimEstimada
     → Realtime DB: ensureUserTutorsIndex (student→tutor)
     → Chat: ensureAutoConversationForTutorAssignment (cria grupo 3-pessoas)
     → audit log: action="create", entityType="estagio"
     → resposta { ok, id, dataFimEstimada, diasUteis }
```

---

## FLUXO 5: Ciclo de Vida de um Documento

```
[Professor/Diretor] → Upload Wizard (3 passos)
  Step 1: Upload PDF (valida MIME, size ≤25MB)
  Step 2: Posicionar caixas de assinatura sobre PDF
          → pdfjs-dist renderiza páginas
          → fabric canvas para desenhar retângulos
          → coordenadas normalizadas (0-1) guardadas
  Step 3: Atribuir roles a cada caixa (aluno/professor/tutor)
  → submete → POST /api/estagios/{id}/documentos (ou PATCH doc existente)
     → storage: upload para estagios/{id}/documentos/{docId}/v1.pdf
     → Firestore: cria/atualiza documento (currentVersion=1, estado="aguarda_assinatura")
     → versões: cria versoes/1 imutável

[Signatário] → clica "Assinar" num documento
  → SignDialog abre com preview do PDF
  → [Verificação] canSignDoc(userRole, doc)?
     ├── NÃO → botão desabilitado
     └── SIM → desenha assinatura (SignaturePad) ou usa saved signature
         → POST /api/estagios/{id}/documentos/{docId}/assinar
            → [Validação] permissão + não dupla assinatura
            → carrega PDF atual
            → pdf-lib: desenha assinatura nas caixas do role
            → storage: upload nova versão
            → Firestore: cria versoes/{n+1}
            → Firestore: atualiza documento (currentVersion++, signedBy++, signedByRoles++)
            → Firestore: cria assinaturas/{uid} (hash SHA-256 da imagem)
            → [Verificação] todas as caixas preenchidas?
               ├── SIM → estado="assinado", notifica participantes
               └── NÃO → mantém estado atual
            → resposta { ok, allSigned, signaturesCount, totalRequired }

[Leitor] → clica documento → GET /api/estagios/{id}/documentos/{docId}
  → [Verificação] canReadDoc(userRole, doc)?
  → API carrega PDF da versão atual
  → API gera página de assinaturas dinâmica (pdf-lib):
     → lista todas as assinaturas recolhidas
     → renderiza imagem + nome + role + data por signatário
     → anexa ao PDF original
  → resposta: PDF binary (Content-Disposition: inline ou attachment)
  → [opção] ?raw=true → PDF original sem página de assinaturas
```

---

## FLUXO 6: Avaliação (Tutor → Professor → Nota Final)

```
[School Admin] → configura avaliação no curso
  → PATCH /api/courses/{id}/avaliacao-datas
  → define: disponibilidadePreenchimento (janela tutor), publicacaoNotaFinal (data)
  → define: autoArquivarNaPublicacao

[Configuração de parâmetros] → School Admin
  → AvaliacaoConfigDialog: define método (soma/média), escala (0-20, etc.), parâmetros
  → validateConfig() — coerência matemática
     → soma: numParams × scaleMax === expectedFinalMax
     → média: scale === finalScale

[Tutor] → /tutor/estagios/{schoolId}/{estagioId} → tab Avaliação
  → [Verificação] isAvaliacaoAvailableForTutor() — data dentro da janela?
     ├── NÃO → mensagem "fora do período"
     └── SIM → TutorEvaluationForm
         → preenche parâmetros (0-scaleMax por cada)
         → [opcional] comentários
         → desenha assinatura (SignaturePad)
         → [Validação] validateNotasTutor() — todos parâmetros preenchidos? valores na escala?
            ├── NÃO → erro
            └── SIM → POST /api/estagios/{id}/avaliacao/tutor
                → Firestore: setDoc(avaliacao/tutor, { estado:"assinado", assinadoEm, ... })
                → Notificações: professor + diretor curso
                → audit log: action="sign_avaliacao"

[Professor] → tab Avaliação → vê avaliação do tutor
  → [Verificação] canProfessorAssignNotaFinal() — tutor já assinou?
     ├── NÃO → mensagem "aguarda tutor"
     └── SIM → ProfessorEvaluationView
         → preenche parâmetros + notaFinal
         → desenha assinatura
         → [Validação] validateNotaFinal() — coerente com config?
            └── SIM → POST /api/estagios/{id}/avaliacao/professor
                → Firestore: setDoc(avaliacao/professor, { estado:"assinado", notaFinal, ... })
                → copia assinatura prof para doc tutor
                → Notificações: tutor + diretor curso
                → [se autoArquivar] verifica condições de archive

[Aluno] → tab Avaliação
  → [Verificação] isNotaFinalAvailableForAluno() — data publicação? nota assinada?
     ├── NÃO → mensagem "nota indisponível"
     └── SIM → AlunoEvaluationView — mostra nota final, parâmetros, assinaturas
         → botão download PDF → GET /api/estagios/{id}/avaliacao/pdf/nota-final
```

---

## FLUXO 7: Ciclo de Vida de uma Notificação

```
[Evento ocorre] — ex: professor aprova pedido de alteração
  → POST /api/estagios/{id}/schedule-change-requests/{reqId}/professor-decision
  → servidor chama buildNotification() — gera payload { type, title, body, link, userId }
  → Firestore: addDoc(estagios/{id}/notifications, { ...payload, createdAt, read: false })

[Cliente] — useEstagioNotifications() hook
  → polling a cada 30s → GET /api/notifications
     → query collectionGroup("notifications") where userId + orderBy createdAt desc
  → estado local: notifications[], unreadCount
  → ações: markAsRead(id), removeNotification(id), markAllRead(), clearAll()
     → PATCH/DELETE /api/notifications

[UI] — NotificationsInbox dropdown
  → badge com unreadCount no topo
  → lista lazy-render (25 + scroll-load +20)
  → clicar → redireciona para link da notificação + markAsRead
```

---

## FLUXO 8: Chat / Mensagem

```
[Utilizador] → ChatInterface (InternalChatHub)
  → onAuthStateChanged → carrega perfil do utilizador
  → subscribeUserConversations(uid) → Realtime DB listener
     → userConversations/{uid}/* → lista de conversas (ordenado por lastMessageAt desc)
  → seleciona conversa → subscribeConversationMessages(convId)
     → messages/{convId}/* → mensagens ordenadas por createdAt

[Enviar mensagem]
  → escreve texto (max 2000 chars)
  → [opcional] anexa ficheiros (max 3, 8MB cada) → upload Storage
  → [Verificação] bloqueado pelo destinatário?
     ├── SIM → mensagem de erro
     └── NÃO → sendMessage() → Realtime DB transaction:
         → push mensagem em messages/{convId}
         → update lastMessage em conversations/{convId}
         → update userConversations/{uid}/{convId} (lastMessageText, lastMessageAt)
         → increment unreadCount para outros participantes

[Otimista] → ChatMessageView com tempId + deliveryState:"sending"
  → onComplete → deliveryState:"sent" (ou "failed" + retry)

[Editar] → senderId === auth.uid → editMessage() → editedAt timestamp
[Apagar] → senderId === auth.uid → deleteMessage() → deleted=true + deletedAt
[Restaurar] → senderId === auth.uid → restoreDeletedMessage() → deleted=false

[Notificações de chat] → useChatNotifications() hook
  → escuta novas mensagens em userConversations
  → sessionStorage dedup (já notificadas esta sessão?)
  → ToastContainer mostra toast com preview + avatar
```

---

## FLUXO 9: Eliminação de Estágio com Aprovação

```
[Qualquer membro do estágio] → botão "Eliminar Estágio"
  → POST /api/estagios/{id}/delete-request
     → body: { motivo? }
     → Firestore: addDoc(schools/{schoolId}/deleteEstagioRequests, {
         estagioId, requestedBy, requestedByName, motivo, status:"pendente", createdAt
       })
     → resposta { ok, requestId }

[School Admin] → /school-admin/aprovacoes → DeleteEstagioRequests
  → vê lista de pedidos pendentes
  → clica "Aprovar" ou "Rejeitar"
  → PUT /api/estagios/{id}/delete-request
     → body: { requestId, decisao: "aprovado"|"recusado" }
     → [Validação] pedido ainda "pendente"?
        ├── NÃO → 409 (já processado)
        └── SIM:
           ├── aprovado → update estagio: { estado:"eliminado", estadoEstagio:"eliminado", deletedAt, deletedBy }
           └── recusado → update request: { status:"recusado" }
     → audit log
```

---

## FLUXO 10: Arquivo de Estágio

```
[Professor/Diretor] → EstagioDetailView → botão "Arquivar"
  → ArchiveEstagioButton verifica condições:
     → [Verificação 1] estado não é "arquivado" nem "eliminado"?
     → [Verificação 2] dataFimEstimada no passado?
     → [Verificação 3] relatório final submetido + 2+ assinaturas?
        → GET /api/estagios/{id}/relatorio-final → verifica report + allSigned
     → [Verificação 4] todos os sumários preenchidos + assinados?
        → Firestore: getDoc(sumarios/_state) → allPreenchidos + allAssinados
     → [Verificação 5] avaliação tutor assinada?
        → Firestore: getDoc(avaliacao/tutor) → estado === "assinado"
     → [Verificação 6] avaliação professor assinada?
        → Firestore: getDoc(avaliacao/professor) → estado === "assinado"
  → [Resultado] checkCanArchive() → { canArchive, reasons[] }
     ├── NÃO → diálogo mostra razões pendentes
     └── SIM → confirmação → tryAutoArchiveEstagio()
         → Firestore: update estagio: { estado:"arquivado", arquivadoEm, arquivadoPor }
         → audit log: action="archive", entityType="estagio"

[Auto-archive]
  → triggered após professor assinar avaliação (se autoArquivarNaPublicacao=true)
  → mesmas verificações → tryAutoArchiveEstagio({ triggeredBy: "auto" })
```

---

## FLUXO 11: Término Antecipado

```
[Aluno] → CalendarioTab → banner "Dispensa do último dia"
  → [Verificação] checkEligibility() — horas restantes > 0 && < 5 dias?
     ├── NÃO → banner não aparece
     └── SIM → mostra botão "Solicitar Dispensa"
         → POST /api/estagios/{id}/termino-antecipado
            → calcula horas trabalhadas (presencas)
            → validateSubmission() → { valid, reason? }
            → calculateProjection() → dias até completar, dia dispensável
            → Firestore: cria doc termino_antecipado (estado:"pendente")
            → Firestore: cria schedule_change_request (type:"early_termination", status:"acknowledged")
            → Notificações: tutor (decisão), aluno (confirmação), prof + EE (read-only)

[Tutor] → vê pedido no dashboard/inbox
  → [opção A] Aprovar
     → PATCH /api/estagios/{id}/termino-antecipado/{docId}/aprovar
        → validateApproval() → set estado:"aprovado"
        → Notificações: aluno (dia dispensa + dias a cumprir), prof, EE
  → [opção B] Recusar
     → PATCH /api/estagios/{id}/termino-antecipado/{docId}/recusar
        → body: { motivoRecusa } (obrigatório)
        → set estado:"recusado", motivoRecusa
        → Notificações: aluno, prof

[Invalidação automática]
  → se aluno falta no dia dispensado (horas < esperado)
  → qualquer membro pode disparar:
     → PATCH /api/estagios/{id}/termino-antecipado/invalidar
        → body: { dataPresenca, horasTrabalhadas, horasPrevistasNoDia }
        → checkInvalidation() → estado:"invalidado_por_incumprimento"
        → Notificações: todas as partes
```

---

## FLUXO 12: Criação de Fecho de Empresa

```
[Tutor] → /tutor/estagios/{schoolId} → seleciona empresa → botão "Fecho"
  → TutorFechoEmpresaModal:
     → seleciona data do fecho
     → define âmbito (todos / meus / aluno específico)
     → submete → POST /api/empresas/{id}/fechos
        → [Validação] tutor está nos tutorIds da empresa?
        → Transaction: verifica não existe fecho para mesma data (409 se duplicado)
        → Cria fecho doc
        → Para cada estágio ativo da empresa (filtrado por âmbito):
           → cria schedule_change_request (type:"company_closure", status:"approved")
           → recalcula dataFimEstimada via calcNewEndDate()
        → resposta { ok, affectedCount }

[Remover fecho]
  → DELETE /api/empresas/{id}/fechos/{targetDate}
     → [Validação] tutor é criador?
     → Batch: cancela todos os SCR associados (status→"cancelled") + delete fecho
```

---

## FLUXO 13: Recalcular Data Fim

```
[Trigger] — após guardar presenças, aprovar ausência, criar/remover fecho
  → POST /api/estagios/{id}/recalcular-data-fim
     → lê presencas (horas realizadas)
     → lê schedule_change_requests (ausências aprovadas, fechos)
     → expira company_closures passados (status→"expired")
     → calcularDataFimEstimada() — walk dia a dia, acumulando horas
     → calcularDataFimComAusencias() — mesmo walk mas considera ausências
     → calcularReplayAbsences() — corrige horasAusenciaAcumuladas
     → [Verificação] algo mudou?
        ├── NÃO → resposta { ok, recalculado: false }
        └── SIM → update estagio: { dataFimEstimada, horasAusenciaAcumuladas, diasUteis }
            → resposta { ok, recalculado: true, dataFimEstimada, ... }
```
