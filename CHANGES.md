# CHANGES.md — Alterações ao InternLink

## Índice

- [Resumo das Alterações](#resumo-das-alterações)
- [1. Dashboard do Professor](#1-dashboard-do-professor)
- [2. Dashboard do Tutor](#2-dashboard-do-tutor)
- [3. Routing de Login Atualizado](#3-routing-de-login-atualizado)
- [4. Gestão de Estágios](#4-gestão-de-estágios)
- [5. Gestão de Documentos com Visibilidade](#5-gestão-de-documentos-com-visibilidade)
- [6. Assinatura Digital](#6-assinatura-digital)
- [7. Página de Perfil](#7-página-de-perfil)
- [8. Recuperação de Password](#8-recuperação-de-password)
- [9. CAPTCHA nos Formulários de Registo](#9-captcha-nos-formulários-de-registo)
- [10. Regras do Firestore](#10-regras-do-firestore)
- [Configuração e Variáveis de Ambiente](#configuração-e-variáveis-de-ambiente)
- [Instruções de Execução](#instruções-de-execução)
- [Estrutura de Ficheiros Adicionados](#estrutura-de-ficheiros-adicionados)

---

## Resumo das Alterações

Estas alterações adicionam funcionalidades novas à plataforma InternLink **sem modificar a lógica existente**. As principais adições são:

- **Dashboard do Professor** com aprovação de alunos, gestão de estágios e documentos
- **Dashboard do Tutor** (sem funcionalidades de admin) com visualização de documentos
- **Página de Perfil** para edição de informações opcionais (foto, telefone, localidade)
- **Recuperação de Password** via Firebase `sendPasswordResetEmail`
- **CAPTCHA** (Google reCAPTCHA v2) nos formulários de registo
- **Assinatura Digital** configurável ao carregar documentos
- **Novas coleções Firestore**: `estagios`, `documentos`, `tutorInvites`
- **Regras de segurança** atualizadas para as novas estruturas

---

## 1. Dashboard do Professor

**Rota:** `/professor`

O professor ativo tem agora a sua própria dashboard com:

- **Visão geral** — estatísticas de alunos pendentes, estágios e documentos
- **Aprovações de Alunos** (`/professor/aprovacoes`) — aprovar ou rejeitar alunos com acesso pendente
- **Gestão de Estágios** (`/professor/estagios`) — criar estágios associando alunos e tutores
- **Gestão de Documentos** (`/professor/documentos`) — carregar documentos com visibilidade configurável

### Ficheiros criados:
- `app/professor/` — páginas e layouts
- `components/layout/professor-layout.tsx` — layout com sidebar
- `components/professor/professor-dashboard-overview.tsx`
- `components/professor/pending-students-manager.tsx`
- `components/professor/internship-manager.tsx`
- `components/professor/document-manager.tsx`

---

## 2. Dashboard do Tutor

**Rota:** `/tutor`

O tutor ativo tem uma dashboard simplificada **sem funcionalidades de admin**:

- **Visão geral** — número de estágios associados e documentos disponíveis
- **Documentos** (`/tutor/documentos`) — visualização de documentos dos estágios associados

### Ficheiros criados:
- `app/tutor/` — páginas e layouts
- `components/layout/tutor-layout.tsx` — layout com sidebar (sem admin)
- `components/tutor/tutor-dashboard-overview.tsx`
- `components/tutor/tutor-document-viewer.tsx`

---

## 3. Routing de Login Atualizado

O formulário de login (`components/auth/login-form.tsx`) foi estendido para direcionar:

| Role | Estado | Destino |
|------|--------|---------|
| `admin_escolar` | qualquer | `/school-admin` |
| `aluno` | `pendente` | `/waiting` |
| `aluno` | `ativo` | `/dashboard` |
| `professor` | `ativo` | `/professor` |
| `tutor` | `ativo` | `/tutor` |
| outros | qualquer | `/account-status` |

> **Nota:** A lógica existente não foi alterada — apenas foram adicionadas duas novas condições.

---

## 4. Gestão de Estágios

**Coleção Firestore:** `estagios`

O professor pode criar um novo estágio associando:
- Um **aluno** (selecionado da lista de alunos ativos da escola)
- Um **tutor** (identificado por email)
- Uma **empresa**

### Estrutura do documento `estagios`:
```json
{
  "titulo": "Estágio em Desenvolvimento Web",
  "schoolId": "abc123",
  "professorId": "prof_uid",
  "alunoId": "aluno_uid",
  "alunoNome": "Ana Silva",
  "alunoEmail": "ana@email.com",
  "tutorEmail": "tutor@empresa.com",
  "tutorNome": "",
  "empresa": "TechCorp Lda",
  "estado": "ativo",
  "createdAt": "serverTimestamp"
}
```

### Convites de Tutor (`tutorInvites`):
O professor pode convidar tutores por email. Os convites ficam guardados na coleção `tutorInvites`.

---

## 5. Gestão de Documentos com Visibilidade

**Coleção Firestore:** `documentos`

Ao carregar um documento, o professor configura:
- **Estágio associado** — seleciona o estágio
- **Ficheiro** — PDF ou DOCX (validação no frontend)
- **Visibilidade**:
  - `todos` — visível para alunos e tutores
  - `tutores` — visível apenas para tutores

### Estrutura do documento `documentos`:
```json
{
  "nome": "Protocolo de Estágio",
  "estagioId": "estagio_123",
  "estagioTitulo": "Estágio em Dev Web",
  "schoolId": "abc123",
  "professorId": "prof_uid",
  "visibilidade": "todos",
  "requerAssinatura": true,
  "assinantes": ["professor", "aluno", "tutor"],
  "assinaturas": {},
  "tipo": "pdf",
  "fileName": "protocolo.pdf",
  "fileSize": 102400,
  "createdAt": "serverTimestamp"
}
```

> **Nota:** O upload efetivo para Firebase Cloud Storage está preparado mas ainda não implementado (apenas metadata é guardada no Firestore). A integração com Cloud Storage pode ser adicionada numa fase posterior.

---

## 6. Assinatura Digital

Ao carregar documentos, o professor pode ativar a opção **"Requer Assinatura Digital"** e selecionar quais intervenientes devem assinar:

- **Professor**
- **Aluno**
- **Tutor**

A configuração é guardada nos campos `requerAssinatura` e `assinantes` do documento. O campo `assinaturas` armazena o estado das assinaturas (quem já assinou).

O tutor vê na sua dashboard quais documentos requerem a sua assinatura, com um botão "Assinar" disponível.

> **Nota:** A assinatura digital propriamente dita (criptográfica) pode ser integrada com bibliotecas como `pdf-lib` ou serviços como DocuSign/HelloSign numa fase posterior. A infraestrutura de dados está preparada.

---

## 7. Página de Perfil

**Rota:** `/profile`

Todos os utilizadores podem editar:
- **Foto de perfil** — upload de imagem (máx. 2 MB), convertida para base64 e guardada no campo `photoURL` do Firestore
- **Nome**
- **Telefone**
- **Localidade**
- **Data de nascimento**

O **email não pode ser alterado** (campo desativado).

Acesso ao perfil disponível no dropdown do avatar em todas as dashboards (aluno, professor, tutor).

### Ficheiros criados:
- `app/profile/` — página e layout
- `components/profile/profile-editor.tsx`

---

## 8. Recuperação de Password

**Rota:** `/forgot-password`

Utiliza o serviço nativo do Firebase Authentication (`sendPasswordResetEmail`) para enviar um email de redefinição de password.

### Fluxo:
1. O utilizador clica em **"Esqueceu-se da password?"** no formulário de login
2. Insere o email associado à conta
3. O Firebase envia um email com link de redefinição
4. O utilizador redefine a password através do link

### Configuração:
O Firebase Authentication já inclui um serviço de email integrado. Para personalizar os templates de email:
1. Aceder à consola Firebase → Authentication → Templates
2. Personalizar o template "Password reset"

> **Nota:** O Firebase Authentication utiliza o seu próprio serviço de email gratuito para envio de emails de redefinição de password e verificação de email. Não é necessária configuração adicional de serviço de email externo.

### Verificação de Email:
A verificação de email já está implementada no registo (`sendEmailVerification` em `actions/register.ts`). O Firebase envia automaticamente um email de verificação quando uma conta é criada.

---

## 9. CAPTCHA nos Formulários de Registo

**Serviço:** Google reCAPTCHA v2

O CAPTCHA é **opcional** e ativado automaticamente quando a variável de ambiente `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` está definida.

### Formulários protegidos:
- Registo de Aluno (`/register/aluno`)
- Registo de Professor (`/register/professor`)
- Registo de Tutor (`/register/tutor`)

### Configuração:
1. Obter chaves em: https://www.google.com/recaptcha/admin
2. Selecionar **reCAPTCHA v2** → "I'm not a robot" Checkbox
3. Adicionar o domínio do site (ex: `internlink.vercel.app`, `localhost`)
4. Copiar a **Site Key** para o `.env.local`:
   ```
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6Le...sua_chave_aqui
   ```

### Ficheiros criados:
- `components/auth/captcha-widget.tsx` — componente reutilizável de CAPTCHA

> **Nota:** A verificação do token CAPTCHA no servidor (backend) deve ser implementada numa fase posterior para segurança completa. Atualmente, a verificação é apenas no frontend.

---

## 10. Regras do Firestore

O ficheiro `firestore.rules` foi atualizado com:

### Novas funções:
- `isProfessor()` — verifica se o utilizador é professor ativo
- `isProfessorFor(schoolId)` — verifica se é professor da escola

### Novas permissões:
- **Professores podem ler** utilizadores da sua escola
- **Professores podem aprovar/rejeitar** alunos da sua escola
- **Coleção `estagios`** — criação e gestão pelo professor
- **Coleção `documentos`** — criação e gestão pelo professor, leitura por participantes
- **Coleção `tutorInvites`** — criação e gestão pelo professor

### Deploy das regras:
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### Índices compostos necessários:
As queries do professor (listar alunos pendentes por escola) requerem um índice composto na coleção `users` nos campos `schoolId`, `role` e `estado`. O ficheiro `firestore.indexes.json` já contém esta configuração e será deployado automaticamente com o comando acima.

---

## Configuração e Variáveis de Ambiente

### `.env.local` (adicionar ao existente):

```env
# Google reCAPTCHA v2 (opcional — CAPTCHA desativado se vazio)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=

# As variáveis Firebase existentes mantêm-se inalteradas
```

### Credenciais necessárias:

| Serviço | Onde obter | Variável |
|---------|-----------|----------|
| Firebase | [Console Firebase](https://console.firebase.google.com/) | `NEXT_PUBLIC_FIREBASE_*` |
| reCAPTCHA v2 | [reCAPTCHA Admin](https://www.google.com/recaptcha/admin) | `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` |

---

## Instruções de Execução

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env.local
# Preencher com as credenciais Firebase e reCAPTCHA
```

### 3. Deploy das regras e índices Firestore
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 4. Executar em modo desenvolvimento
```bash
npm run dev
```

### 5. Build de produção
```bash
npm run build
npm start
```

### 6. Configurar templates de email (opcional)
Na consola Firebase → Authentication → Templates:
- Personalizar template de "Password reset"
- Personalizar template de "Email address verification"

---

## Estrutura de Ficheiros Adicionados

```
InternLink/
├── app/
│   ├── professor/                    # [NOVO] Dashboard do professor
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── aprovacoes/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── estagios/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── documentos/
│   │       ├── layout.tsx
│   │       └── page.tsx
│   ├── tutor/                        # [NOVO] Dashboard do tutor
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── documentos/
│   │       ├── layout.tsx
│   │       └── page.tsx
│   ├── profile/                      # [NOVO] Página de perfil
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── forgot-password/              # [NOVO] Recuperação de password
│       ├── layout.tsx
│       └── page.tsx
├── components/
│   ├── auth/
│   │   └── captcha-widget.tsx        # [NOVO] Componente CAPTCHA
│   ├── layout/
│   │   ├── professor-layout.tsx      # [NOVO] Layout do professor
│   │   └── tutor-layout.tsx          # [NOVO] Layout do tutor
│   ├── professor/                    # [NOVO] Componentes do professor
│   │   ├── professor-dashboard-overview.tsx
│   │   ├── pending-students-manager.tsx
│   │   ├── internship-manager.tsx
│   │   └── document-manager.tsx
│   ├── tutor/                        # [NOVO] Componentes do tutor
│   │   ├── tutor-dashboard-overview.tsx
│   │   └── tutor-document-viewer.tsx
│   └── profile/                      # [NOVO] Componentes do perfil
│       └── profile-editor.tsx
├── firestore.rules                   # [MODIFICADO] Novas regras
├── .env.example                      # [MODIFICADO] Nova variável reCAPTCHA
└── CHANGES.md                        # [NOVO] Este ficheiro
```

### Ficheiros existentes modificados (sem alterar lógica):
- `components/auth/login-form.tsx` — adicionadas rotas professor/tutor + link "Esqueceu-se da password?"
- `components/layout/dashboard-layout.tsx` — adicionado link para perfil no dropdown
- `app/register/aluno/page.tsx` — adicionado CAPTCHA
- `app/register/professor/page.tsx` — adicionado CAPTCHA
- `app/register/tutor/page.tsx` — adicionado CAPTCHA
- `firestore.rules` — novas coleções e permissões
- `firebase.json` — adicionada referência ao ficheiro de índices
- `.env.example` — nova variável `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`

### Ficheiros de configuração adicionados:
- `firestore.indexes.json` — índices compostos para queries do professor
