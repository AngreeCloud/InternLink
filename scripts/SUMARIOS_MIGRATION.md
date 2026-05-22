# Migração de Sumários - Números de Semana

## Contexto

O sistema foi recentemente alterado para calcular números de semana de forma **relativa ao `dataInicio` do estágio individual**, em vez de usar ISO week numbers.

Isto significa que os IDs dos sumários mudaram:
- **Antes**: `2026-W16` (ISO week format)
- **Depois**: `1-2026-04-13` (semana relativa - formato `{weekNumber}-{weekStartDate}`)

Se você tinha sumários salvos **antes** desta mudança, eles podem estar "orfãos" no Firestore com os IDs antigos.

## Como recuperar

### Passo 1: Diagnóstico (SEM fazer alterações)

```bash
# Certificar que tem as credenciais do Firebase
# Copie seu arquivo de chave do Firebase para: scripts/firebase-key.json
# OU configure variável de ambiente GOOGLE_APPLICATION_CREDENTIALS

node scripts/check-orphaned-sumarios.js
```

Este script:
- ✓ Procura sumários para "João da Ega"
- ✓ Mostra quais têm formato antigo (ISO week)
- ✓ Lista o conteúdo de cada um
- ✓ **Não faz nenhuma alteração**

### Passo 2: Migração (com as alterações)

Se o passo 1 confirmar que há sumários orfãos:

```bash
node scripts/migrate-sumarios-week-numbers.js
```

Este script:
- ✓ Encontra todos os sumários com IDs em formato antigo
- ✓ Calcula o novo `weekId` baseado em semana relativa
- ✓ **Cria novos documentos** com o novo ID
- ✓ **Não deleta** os antigos (você pode verificar antes de deletar manualmente)

Output esperado:
```
🔍 Migration: Buscando sumários com números de semana antigos...

Found X estágios

📋 João da Ega (estagioId123) - dataInicio: 2026-04-13
  └─ 5 sumários encontrados
     🔄 CANDIDATO: 2026-W16 (ISO week format)
        Old ID: 2026-W16
        New ID: 1-2026-04-13
        Semana relativa: 1
        ✅ Migrado com sucesso!
     ...

📊 RESUMO DA MIGRAÇÃO
============================================================
✅ Migrados com sucesso: 5
⏭️  Pulados: 0
❌ Erros: 0
```

### Passo 3: Verificação (opcional)

Após a migração, execute novamente o script de diagnóstico para confirmar:

```bash
node scripts/check-orphaned-sumarios.js
```

Agora todos os sumários devem ter o **novo formato**.

## Estrutura dos Arquivos

```
/estagios/{estagioId}/sumarios/{weekId}/
  - weekId: "1-2026-04-13" (novo) vs "2026-W16" (antigo)
  - weekStart: "2026-04-13"
  - weekEnd: "2026-04-19"
  - weekNumber: 1 (relativo ao dataInicio)
  - weekYear: 2026
  - content: "...texto do sumário..."
  - updatedAt: timestamp
  - updatedBy: userId
```

## Troubleshooting

### Erro: `Cannot find module 'firebase-admin'`

```bash
cd scripts
npm install firebase-admin
cd ..
```

### Erro: `PERMISSION_DENIED` ou `Could not load default credentials`

Configure o arquivo de chave:
```bash
# Opção 1: Coloque no scripts/firebase-key.json (gitignore-d)
cp ~/Downloads/serviceAccountKey.json scripts/firebase-key.json

# Opção 2: Use variável de ambiente
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
```

### Sumários não aparecem mesmo após migração?

1. Verifique que o Firestore tem os novos documentos:
   - Firebase Console → Database → estagios → {estagioId} → sumarios
   
2. Faça refresh da página da aplicação (clear cache se necessário)

3. Se ainda não aparecerem, verifique `weekStart` no documento antigo - pode estar em formato diferente

## Rollback (se necessário)

Se algo correr mal, você pode:

1. Restaurar de backup do Firestore (se disponível)
2. Manter ambos os IDs (antigo + novo) enquanto testa
3. Deletar manualmente os novos documentos problemativos:
   ```
   Firebase Console → Database → Delete Collection
   ```

## Código dos Scripts

- [`check-orphaned-sumarios.js`](./check-orphaned-sumarios.js) - Diagnóstico (read-only)
- [`migrate-sumarios-week-numbers.js`](./migrate-sumarios-week-numbers.js) - Migração (escreve novos docs)

---

**Nota**: Os scripts originais NÃO deletam os sumários antigos. Isto é intencional como medida de segurança. Verifique que tudo está funcionando antes de deletar manualmente os antigos.
