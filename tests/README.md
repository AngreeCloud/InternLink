# Testes

## Unitários (`tests/actions/`)

Testes de lógica pura com Vitest. Não precisam de Firebase.

```bash
pnpm test:unit            # todos os testes de actions
pnpm test:unit -- --reporter=verbose   # com output detalhado
pnpm test:unit -- tests/actions/date-calc.test.ts  # ficheiro específico
```

39 testes de `date-calc.ts`: recalcular data fim (com pipeline de ausências), calcular inicial, replay de aprovações.

18 testes de `schedule-change-requests-ext.ts`: `calcNewEndDate`, validações.

## Regras Firestore / Realtime (`tests/firestore/`, `tests/realtime/`)

Testes de segurança com emulador Firebase.

```bash
pnpm test:rules            # firebase emulators:exec + vitest
```

Requer emuladores Firebase instalados e portas disponíveis.

## Teste de integração — João da Ega

Faz fetch real do Firestore, corre `recalcularDataFimEstimada` + `calcularReplayAbsences`, imprime comparação lado a lado com as fixtures, valida invariante do último dia útil.

```bash
pnpm test:joao             # npx tsx scripts/test-estagio-joao.ts
```

Requer `.env.local` com `FIREBASE_SERVICE_ACCOUNT_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

Exit 0 = todas as asserções passam. Exit 1 = alguma falhou.

## Todos

```bash
pnpm test                  # test:unit + test:rules
```
