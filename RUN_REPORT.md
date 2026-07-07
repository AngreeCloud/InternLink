# RUN_REPORT — Validação de Presenças + PDF Export + Transição "concluido"

## Commits (português)

### 1. `lib/estagios/presencas.ts` — Lógica pura validação presenças
- `checkPresencasCanValidate()`: verifica se `totalRealizado >= totalPrevisto` OU `restante < horasPorDia * 2`
- Retorna `podeValidar`, `motivo`, `diasRestantes`

### 2. `lib/estagios/estagio-status.ts` — Lógica transição estado
- `checkShouldTransitionToConcluido()`: retorna `true` se horas cumpridas OU término antecipado aprovado

### 3. `app/api/estagios/[id]/presencas/notify-tutor/route.ts` — Notificação push tutor
- `POST` endpoint, só aluno pode disparar
- Verifica condições via `checkPresencasCanValidate`
- Escreve em `estagios/{id}/notifications/` com `type: "presencas_ready"`, `userId: tutorId`
- Deduplica: não cria se já existe notificação não lida do mesmo tipo

### 4. `app/api/estagios/[id]/presencas/validar/route.ts` — Validação pelo tutor
- `PATCH` endpoint, só tutor
- Soma presenças no servidor (seguro, não confia no cliente)
- Verifica `checkPresencasCanValidate`
- Marca `presencasValidatedByTutor: true` + timestamp + nome
- Se `totalRealizado >= totalHoras` OU término antecipado aprovado → `estado: "concluido"`, `estadoEstagio: "concluido"`
- Audit log

### 5. `components/estagios/horario-tab.tsx` — UI validação + trigger notificação
- **Botão "Validar presenças"** no card resumo, visível só p/ tutor quando condições satisfeitas
- **Badge** "Presenças validadas pelo tutor" após validação
- **AlertDialog** confirmação com declaração, total realizado, dias registados
- **Trigger notificação**: após `handleSave()` bem-sucedido, se `checkPresencasCanValidate` retorna `podeValidar` e tutor ainda não validou, chama `POST /api/estagios/{id}/presencas/notify-tutor`
- **Export panel** integrado no final (condicional a `totalRealizado > 0`)

### 6. `app/api/estagios/[id]/presencas/export/route.ts` — PDF export
- Reutiliza `pdf-lib` (mesma palette, fontes, helpers do export sumários)
- Cover page: título "REGISTO DE PRESENÇAS", curso, formando, tutor, orientador, período
- **Tabela paginada**: colunas `Dia | Mês | Horas`, linhas alternadas (bege/branco)
- Dias com 0h excluídos
- Linha total (fundo verde) no fim
- Páginas de assinaturas (opcional, mode=signed)
- Até ~32 linhas/página, header repete em cada página

### 7. `app/api/estagios/[id]/presencas/export/preflight/route.ts` — Preflight
- Verifica: existem presenças? Tutor já validou? Aluno/tutor têm assinatura?
- Retorna `canExportSigned`, `schoolHasAddress`

### 8. `components/estagios/presencas-export-panel.tsx` — UI export
- Checklist requisitos: validação tutor, assinaturas
- Botões download c/ e s/ assinaturas
- Pré-visualização
- Mesmo padrão do `sumarios-export-panel.tsx`

### 9. `app/api/estagios/[id]/termino-antecipado/[docId]/aprovar/route.ts` — Transição concluido
- Após aprovar término antecipado, verifica se deve transitar para `concluido`
- Usa `checkShouldTransitionToConcluido()`

---

## Riscos / Notas

| Risco | Mitigação |
|-------|-----------|
| Concorrência: aluno regista horas enquanto tutor valida | Validação servidor-side soma presenças no momento, não confia no `totalRealizado` do cliente |
| Múltiplas notificações duplicadas | Deduplicação: verifica existência de notificação não lida do mesmo tipo antes de criar |
| Presenças com 0h entram no cômputo de `totalRealizado` | Já excluídas: `if (horas <= 0) return` no export; soma inclui zeros mas são neutros |
| Nome do mês no PDF (português vs data ISO) | `mesFromIso()` extrai mês do ISO e mapeia para array `MESES` PT |
| `EstagioAccessSession.user` não existe | Corrigido: usar `session.displayName` em vez de `session.user?.nome` |
| `AuditAction` type não inclui `"presencas_validated"` | Corrigido: usar `"update"` com metadata descritivo |
| Firestore rules não precisam de alteração | API routes usam admin SDK (bypass rules). Client-side writes mantêm-se só p/ presenças (já permitido) |

## Ficheiros (agrupados)

### NOVOS (6 ficheiros)
```
lib/estagios/presencas.ts
lib/estagios/estagio-status.ts
app/api/estagios/[id]/presencas/notify-tutor/route.ts
app/api/estagios/[id]/presencas/validar/route.ts
app/api/estagios/[id]/presencas/export/route.ts
app/api/estagios/[id]/presencas/export/preflight/route.ts
components/estagios/presencas-export-panel.tsx
```

### MODIFICADOS (2 ficheiros)
```
components/estagios/horario-tab.tsx
app/api/estagios/[id]/termino-antecipado/[docId]/aprovar/route.ts
```
