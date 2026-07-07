# PLAN: Validação de Horas + PDF Presenças + Transição "concluido"

## 1. Visão Geral

### O que precisa ser feito

| # | Tarefa | Onde |
|---|--------|------|
| A | Botão "Validar presenças" no separador Horários (tutor) | `horario-tab.tsx` |
| B | API route para validar presenças + transição estado | Novo: `app/api/estagios/[id]/presencas/validar/route.ts` |
| C | PDF de presenças em tabela (dia, mês, horas) | Novo: `app/api/estagios/[id]/presencas/export/route.ts` |
| D | Painel de export (pré-visualização/download) | Novo: `components/estagios/presencas-export-panel.tsx` |
| E | Notificação push ao tutor quando pode validar | Novo: `app/api/estagios/[id]/presencas/notify-tutor/route.ts` |
| F | Transição automática "ativo" → "concluido" | Dentro da route de validação + na route de término antecipado |
| G | Regras Firestore para permitir validação pelo tutor | `firestore.rules` |

---

## 2. A — Validação pelo Tutor no Separador Horários

### Ficheiro: `components/estagios/horario-tab.tsx`

**O que muda:**
- Detetar se o utilizador é `tutor` (`currentUserRole === "tutor"`, já existe para `sumarios-tab.tsx`)
- Mostrar botão "Validar presenças" quando TODAS as condições se verificam:
  1. Total de horas atingido (`totalRealizado >= totalHoras` — 400h)
     **OU** faltam menos de 2 dias de trabalho para completar as horas
     (`restante < horasDiarias * 2 && restante > 0`)
  2. Tutor ainda não validou (novo campo `presencasValidatedByTutor` no estágio)
- Ao clicar, abrir `AlertDialog` de confirmação (igual ao `sumarios-tab.tsx`)
- Chamar `PATCH /api/estagios/{id}/presencas/validar`

**Estado adicional no componente:**
```typescript
const [validating, setValidating] = useState(false);
const [validateDialogOpen, setValidateDialogOpen] = useState(false);
```

**Cálculo de dias restantes:**
- `restante = totalHoras - totalRealizado`
- `horasPorDia = horasDiarias`
- Se `restante < horasDiarias * 2` → menos de 2 dias
- Mostrar indicador visual no summary cards

### Ficheiro: `lib/estagios/presencas.ts` (NOVO)

Lógica pura para validação de presenças:

```typescript
export type PresencasValidationResult = {
  podeValidar: boolean;
  motivo?: string;
  totalRealizado: number;
  totalPrevisto: number;
  diasRestantes: number;
};

export function checkPresencasCanValidate(
  totalRealizado: number,
  totalPrevisto: number,
  horasPorDia: number
): PresencasValidationResult {
  const restante = Math.max(0, totalPrevisto - totalRealizado);
  const diasRestantes = horasPorDia > 0 ? Math.ceil(restante / horasPorDia) : 0;
  const horasCompletas = totalRealizado >= totalPrevisto;
  const faltamMenosDe2Dias = restante > 0 && restante < horasPorDia * 2;

  if (!horasCompletas && !faltamMenosDe2Dias) {
    return {
      podeValidar: false,
      motivo: `Ainda faltam ${diasRestantes} dias de trabalho (${restante}h).`,
      totalRealizado,
      totalPrevisto,
      diasRestantes,
    };
  }

  return { podeValidar: true, totalRealizado, totalPrevisto, diasRestantes };
}
```

---

## 3. B — API Route: `PATCH /api/estagios/{id}/presencas/validar`

### Ficheiro: `app/api/estagios/[id]/presencas/validar/route.ts` (NOVO)

**Comportamento:**
1. Verificar sessão: `assertEstagioAccess(id, "member")` + garantir que `role === "tutor"`
2. Buscar o estágio e as presenças do Firestore
3. Calcular `totalRealizado` (soma de `hoursWorked`)
4. Verificar se pode validar (usa `checkPresencasCanValidate`)
5. Se aprovado:
   - Atualizar campo `presencasValidatedByTutor: true` + `presencasValidatedAt` + `presencasValidatedBy`
   - Se `totalRealizado >= totalHoras` OU término antecipado aprovado:
     - Mudar `estadoEstagio: "concluido"`, `estado: "concluido"`
6. Escrever audit log
7. Retornar `{ ok: true, estadoTransicionado: boolean }`

**Sobre a transição "concluido":**

A transição só acontece se:
- **`totalRealizado >= totalHoras`** (400h cumpridas) **OU**
- **Término antecipado aprovado** (`termino_antecipado` existe com `estado: "aprovado"`)

A transição é:
- `estadoEstagio: "em_curso" → "concluido"`
- `estado: "ativo" → "concluido"`

Arquivar continua a ser manual (botão "Arquivar" existente com `checkCanArchive()`).

---

## 4. C — PDF Export: `GET /api/estagios/{id}/presencas/export`

### Ficheiro: `app/api/estagios/[id]/presencas/export/route.ts` (NOVO)

**Reutiliza o padrão existente de `sumarios/export/route.ts`** (pdf-lib, mesma palette, mesmas funções auxiliares).

### Layout do PDF

```
┌──────────────────────────────────────┐
│      TOP BAR (InternLink)            │  ← igual ao sumários
├──────────────────────────────────────┤
│                                      │
│   REGISTO DE PRESENÇAS               │
│                                      │
│   CURSO: [nome do curso]             │
│                                      │
│   ┌────────────┬────────┬───────┐    │
│   │ Dia        │ Mês    │ Horas │    │  ← Cabeçalho da tabela
│   ├────────────┼────────┼───────┤    │
│   │ 01/01/2026 │ Janeiro│ 8.00  │    │
│   │ 02/01/2026 │ Janeiro│ 7.50  │    │
│   │ ...        │ ...    │ ...   │    │
│   ├────────────┼────────┼───────┤    │
│   │            │ TOTAL  │ 400.00│    │  ← Linha de total
│   └────────────┴────────┴───────┘    │
│                                      │
│   Informação do estágio:             │
│   Aluno, Tutor, Empresa, Período     │
│                                      │
│   Assinaturas (se mode=signed)       │
│                                      │
└──────────────────────────────────────┘
```

### Dados

- Buscar `estagios/{id}/presencas` — todas as presenças com `hoursWorked > 0`
- Ordenar por `date` ascendente
- Agrupar por mês (para a coluna "Mês")
- Calcular total de horas
- Excluir dias com 0 horas

### Mês (nome português)

```typescript
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril",
  "Maio", "Junho", "Julho", "Agosto",
  "Setembro", "Outubro", "Novembro", "Dezembro",
];
```

### Número de páginas

Se houver mais de ~40 linhas, paginar com cabeçalho repetido e footer.

### URL params

- `mode=signed|unsigned` — controla se inclui assinaturas (igual sumários)
- Preflight check: `GET /api/estagios/{id}/presencas/export/preflight`

### Ficheiro: `app/api/estagios/[id]/presencas/export/preflight/route.ts` (NOVO)

Verificar:
- Existem presenças com horas > 0?
- Se mode=signed: tutor já validou as presenças? Aluno tem assinatura? Tutor tem assinatura?
- School tem endereço?

---

## 5. D — Painel de Export (UI)

### Ficheiro: `components/estagios/presencas-export-panel.tsx` (NOVO)

Análogo ao `sumarios-export-panel.tsx`:
- Requisitos (checklist)
- Botão download sem assinaturas
- Botão download com assinaturas (desbloqueado quando tutor validou)
- Botão pré-visualizar

### Integrar no `horario-tab.tsx`

Adicionar no final, condicional a `hasAnyPresenca && presencasValidatedByTutor` (igual ao `sumarios-tab.tsx` que mostra o `SumariosExportPanel`).

---

## 6. E — Notificação Push ao Tutor + Modal de Assinatura

### Disparo da notificação

Quando o aluno guarda uma presença que faz com que as condições de validação sejam atingidas, o cliente dispara:

```
POST /api/estagios/{id}/presencas/notify-tutor
```

**Trigger no frontend** (`horario-tab.tsx`): após `handleSave()` com sucesso, verificar se o tutor pode agora validar (mesma lógica de `checkPresencasCanValidate`). Se sim, chamar o endpoint.

### Ficheiro: `app/api/estagios/[id]/presencas/notify-tutor/route.ts` (NOVO)

**Comportamento:**
1. Verificar sessão via `assertEstagioAccess`
2. Confirmar que `currentUserRole === "aluno"` (só o aluno regista horas)
3. Calcular `totalRealizado` das presenças
4. Verificar se o tutor **ainda não** validou (`presencasValidatedByTutor !== true`)
5. Verificar se as condições estão satisfeitas (`checkPresencasCanValidate`)
6. Escrever notificação em `estagios/{id}/notifications/`:
```typescript
{
  userId: tutorId,                    // APENAS o tutor
  type: "presencas_ready",
  title: "Presenças prontas para validação",
  body: "O formando {alunoNome} já completou as horas previstas. Valide as presenças no separador Horários.",
  readAt: null,
  createdAt: FieldValue.serverTimestamp(),
  estagioId: id,
  href: `/estagios/${id}?tab=horarios`,  // link direto para a tab
}
```
7. Garantir que apenas UMA notificação é criada (verificar se já existe uma não lida do mesmo tipo para o mesmo userId e estagioId)
8. Retornar `{ ok: true }`

### Reutilizar no save de presença

Em `horario-tab.tsx:handleSave()`, após o `setDoc` bem-sucedido, adicionar:

```typescript
// Notificar tutor se pode validar (non-blocking)
if (currentUserRole === "aluno") {
  const { podeValidar } = checkPresencasCanValidate(totalRealizado + v.value, totalHoras, horasDiarias);
  if (podeValidar && !estagio.presencasValidatedByTutor) {
    fetch(`/api/estagios/${estagioId}/presencas/notify-tutor`, {
      method: "POST",
    }).catch(() => {});
  }
}
```

### Modal de confirmação (já previsto na secção A)

O `AlertDialog` para o tutor assinar:
- Título: "Validar presenças do estágio"
- Corpo: mostra resumo (total realizado / total previsto, dias registados)
- Declaração: *"Declaro que verifico e confirmo as horas registadas pelo formando..."*
- Botões: "Cancelar" | "Confirmar validação"
- Após assinar: badge verde "Validado por si" + timestamp (igual aos sumários)

### Badge de estado (no `horario-tab.tsx`)

Após validação, mostrar no card de resumo:
```typescript
{estagio.presencasValidatedByTutor && (
  <div className="sm:col-span-4 flex items-center gap-2 text-xs text-emerald-600">
    <CheckCircle2 className="h-4 w-4" />
    Presenças validadas pelo tutor {estagio.presencasValidatedByName} • {formatDate(estagio.presencasValidatedAt)}
  </div>
)}
```

---

## 7. F — Transição "ativo" → "concluido"

### Onde e quando a transição ocorre

| Momento | Descrição |
|---------|-----------|
| Validação das presenças pelo tutor | Se `totalRealizado >= totalHoras`, transita para `concluido` |
| Aprovação do término antecipado | Na route de aprovação, se aprovar, transita para `concluido` |

### Ficheiro: `app/api/estagios/[id]/termino-antecipado/[requestId]/approve/route.ts`

Adicionar lógica: após aprovar o término antecipado, mudar estado para `concluido`.

### Ficheiro: `lib/estagios/estagio-status.ts` (NOVO)

```typescript
export function checkShouldTransitionToConcluido(params: {
  totalHoras: number;
  totalRealizado: number;
  hasTerminoAprovado: boolean;
}): boolean {
  return params.totalRealizado >= params.totalHoras || params.hasTerminoAprovado;
}
```

### NOTA: O arquivamento continua manual

A transição "concluido" não arquiva automaticamente. O arquivamento mantém-se uma ação manual do diretor/professor, com as validações existentes em `checkCanArchive()`.

---

## 8. G — Firestore Rules

Adicionar regras para:
- Permitir escrita em `estagios/{id}/presencasValidatedByTutor` apenas para tutor do estágio
- `presencas` subcoleção: manter regras existentes
- `presencas/export`: controlar acesso via API (server-side, já protegido por `assertEstagioAccess`)

---

## 9. Resumo de Ficheiros a Criar/Modificar

### NOVOS

| Ficheiro | Propósito |
|----------|-----------|
| `lib/estagios/presencas.ts` | Lógica de validação de presenças (pure functions) |
| `lib/estagios/estagio-status.ts` | Lógica de transição de estado (pure functions) |
| `app/api/estagios/[id]/presencas/validar/route.ts` | API: tutor valida presenças |
| `app/api/estagios/[id]/presencas/notify-tutor/route.ts` | API: notifica tutor que pode validar |
| `app/api/estagios/[id]/presencas/export/route.ts` | API: gera PDF de presenças |
| `app/api/estagios/[id]/presencas/export/preflight/route.ts` | API: preflight check |
| `components/estagios/presencas-export-panel.tsx` | UI: painel de export |

### MODIFICADOS

| Ficheiro | O que muda |
|----------|------------|
| `components/estagios/horario-tab.tsx` | Botão validação do tutor + notificação ao guardar + painel export |
| `app/api/estagios/[id]/termino-antecipado/[requestId]/approve/route.ts` | Transição para concluido após aprovação |
| `firestore.rules` | Regras para o novo campo de validação |

---

## 10. Fluxo Completo

```
Aluno regista horas
  ↓
Após save, cliente verifica condições:
  totalRealizado >= totalHoras OU restante < horasDiarias*2
  ↓
Se sim → POST /api/estagios/{id}/presencas/notify-tutor
  ↓
Notificação escrita em estagios/{id}/notifications/
  (apenas para o tutor, com href para a tab Horários)
  ↓
Tutor recebe notificação (badge no sino / inbox)
  ↓
Tutor abre separador Horários (vê badge "Pronto para validar")
  ↓
Botão "Validar presenças" fica ativo
  ↓
Tutor clica → AlertDialog confirma
  ↓
PATCH /api/estagios/{id}/presencas/validar
  ↓
Backend: marca validado + se 400h → estado="concluido"
  ↓
UI reflete: badge verde "Validado por si"
  ↓
Painel "Exportar Registo de Presenças" aparece
  ↓
Download PDF (tabela dia/mês/horas)
```

---

## 11. Notas Técnicas

- **PDF library**: `pdf-lib` (já em uso no projeto, sem dependências novas)
- **Sem assinaturas de terceiros**: reutilizar `@react-pdf/renderer` não é necessário; `pdf-lib` dá mais controlo no layout tabelar
- **Paginação**: para muitas presenças (>1 mês), partir em várias páginas com cabeçalho repetido
- **Nome do ficheiro**: `Registo_Presencas_{alunoNome}.pdf`
- **Sanitização de texto**: reutilizar `sanitze()` do export de sumários
- **Testes**: lógica pura em `lib/estagios/presencas.ts` e `lib/estagios/estagio-status.ts` testável com vitest
