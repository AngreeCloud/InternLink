# Setup local do InternLink

Este guia descreve a configuração pessoal do projeto, mantendo credenciais em `.env.local`.

## 1) Pré-requisitos

- Node.js 20+
- npm 10+ (ou pnpm, se preferires)
- Projeto Firebase ativo (Auth + Firestore + Storage)

## 2) Instalar dependências

```bash
npm install
```

## 3) Configurar variáveis de ambiente

1. Copia o ficheiro de exemplo:

```bash
cp .env.example .env.local
```

2. Preenche o `.env.local` com os dados do teu projeto Firebase:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

3. (Opcional) Ativa seed local de admin escolar:

- `NEXT_PUBLIC_ENABLE_SEED_ADMIN=true`

## 4) Regras Firestore

As regras estão em `firestore.rules` e o `firebase.json` já referencia esse ficheiro.

Deploy das regras:

```bash
firebase deploy --only firestore:rules
```

## 5) Executar em desenvolvimento

```bash
npm run dev
```

## 6) Conta pendente e acesso

- Aluno só acede ao dashboard quando `estado == "ativo"`.
- Enquanto pendente, fica em `/waiting`.
- Ativação é manual pela escola/professor (não por verificação de email).

## 7) Problemas comuns

- **Missing or insufficient permissions**: confirma se as regras foram publicadas com `firebase deploy --only firestore:rules`.
- **Firebase config em falta**: verifica se o `.env.local` foi preenchido e reinicia o servidor dev.
- **Múltiplos cliques no registo**: já existe lock de submissão nos formulários.
