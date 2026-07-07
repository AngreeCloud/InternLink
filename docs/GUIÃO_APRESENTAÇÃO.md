# Guião de Apresentação — InternLink

## Setup

```
Credenciais de login:

  Admin:     afonso.henriques@up.pt / ReiDePortugal123!
  Professor: fernando.pessoa@up.pt / Heteronimos1925!
  Tutor:     joao.ega@ramada.pt / EgaBoemio!123
  Aluno:     carlos.maia@up.pt / CarlosMedico!456
```

Abrir 2 separadores: um com o ecrã do **professor** (aberto em fernando.pessoa), outro com o **aluno** (carlos.maia).

---

## 1. Landing Page (30s)

> Apenas se for para público não técnico.

**Mostrar:** `https://internlink.vercel.app`
**Guião:** "Plataforma de gestão de estágios curriculares — conecta escolas, alunos e entidades de acolhimento."

---

## 2. Login + Dashboard do Professor (2 min)

**Ação:** Login como **Fernando Pessoa** (`fernando.pessoa@up.pt`)

### Dashboard
**Mostrar:** `/professor`
- Cartões de resumo: estágios ativos, alunos pendentes
- Duas turmas: "Técnico de Turismo" (Eça orienta) e "Técnico de Comunicação e Marketing" (Pessoa orienta)

**Guião:** "O professor vê uma visão geral dos seus estágios e alunos. Cada curso tem os seus orientandos."

---

## 3. Vista de Estágio — Abas (5 min)

**Ação:** Clicar no estágio do **Carlos da Maia** (Turismo, Ramada & Associados)

### 3a. Overview
**Mostrar:** `/estagios/{estagio-carlos}?tab=overview`
- Informação geral: aluno, tutor, empresa, datas
- Estado "Em curso", badge verde
- Progresso: 280h / 400h (70%)

**Guião:** "Cada estágio tem uma vista detalhada com 6 abas. A primeira dá um resumo geral."

### 3b. Horários + Validação do Tutor (★ NOVIDADE)
**Mostrar:** `?tab=horarios`
- Calendário semanal com horas registadas
- Resumo: 280h realizadas, barra de progresso
- Badge "Presenças validadas pelo tutor" (semanas 1-3 já validadas)

**Ação:** Fazer login como **João da Ega** (`joao.ega@ramada.pt`) noutro separador
- Abrir o mesmo estágio > tab Horários
- Mostrar botão "Validar presenças" (ativo porque 280h já foram registadas)
- Clicar → AlertDialog → Confirmar

**Guião:** "O tutor recebe uma notificação quando o aluno atinge as horas ou faltam menos de 2 dias. Pode validar as presenças com um clique. Isto dispara a transição do estágio para 'concluído'."

### 3c. Sumários Semanais
**Mostrar:** `?tab=sumarios`
- 8 semanas listadas
- 5 primeiras com badge "Arquivado" (validadas pelo tutor)
- 3 últimas com badge "Preenchido" (por validar)

**Ação:** Abrir uma semana arquivada — mostrar conteúdo bloqueado (cadeado)
**Ação:** Abrir uma semana pendente — mostrar texto editável

**Guião:** "O aluno escreve sumários semanais. O tutor valida cada um. Depois de validados, ficam bloqueados e podem ser exportados em PDF."

### 3d. Export PDF Sumários
**Mostrar:** Botão "Exportar Registo de Presenças" no final da tab Horários
- Clicar "Pré-visualizar PDF"
- Mostrar: capa com escola + empresa, tabela Dia/Mês/Horas (ex: "7h 30min")

**Guião:** "Geramos PDF profissional com tabela de presenças, paginado, com assinaturas opcionais."

### 3e. Calendário
**Mostrar:** `?tab=calendario`
- Calendário codificado por cores (verde=trabalhado, amarelo=falta, roxo=feriado)
- Tooltips ao hover com horas

**Guião:** "Vista calendário com código de cores. Dias com presença, faltas justificadas, feriados. Clique num dia para criar justificação."

### 3f. Avaliação 
**Mostrar:** `?tab=avaliacao`
- Parâmetros de avaliação pré-preenchidos (média 0-20)
- Nota do tutor + nota do professor
- Estado "Pendente de assinatura"

**Guião:** "Sistema de avaliação configurável por escola. Tutor avalia parâmetros, professor atribui nota final. Média dos parâmetros."

---

## 4. Painel do Tutor + Notificações (3 min)

**Ação:** Já estamos como **João da Ega**

### Inbox
**Mostrar:** `/tutor/inbox`
- Lista de notificações: pedidos de ausência, presenças prontas, avaliação pendente
- Algumas lidas, outras não

**Guião:** "O tutor recebe notificações de todas as ações relevantes: pedidos de falta, presenças para validar, sumários para assinar."

### Solicitações de Horário
**Mostrar:** `/tutor/solicitacoes-horario`
- Pedido de falta futura (aprovado pelo professor, aguarda tutor)
- Justificação de falta passada (pendente do professor)

**Guião:** "O aluno pede alterações de horário. O professor aprova primeiro, depois o tutor. Fluxo completo com comentários."

---

## 5. Admin Escolar — Visão Global (2 min)

**Ação:** Login como **D. Afonso Henriques** (`afonso.henriques@up.pt`)

**Mostrar:** `/school-admin`
- Lista de todos os estágios da escola
- Aprovações pendentes
- Gestão de cursos e empresas
- Configuração de avaliação (parâmetros 0-20, média)

**Mostrar:** Auditoria → `/school-admin/historico`
- 20+ registos de auditoria visíveis

**Guião:** "O administrador escolar vê tudo. Cria cursos, aprova registos, configura avaliações e consulta o histórico de todas as ações."

---

## 6. Chat em Tempo Real (1 min)

**Ação:** Com qualquer sessão ativa, abrir `/dashboard/chat` (aluno) ou `/tutor/chat` (tutor)

**Mostrar:** Conversa grupo "Carlos da Maia / Eça / João da Ega"
- 6 mensagens com timestamps
- Aluno, professor e tutor num único chat

**Guião:** "Chat integrado com Firebase Realtime Database. Mensagens instantâneas entre todos os intervenientes do estágio."

---

## 7. Documentos + Assinaturas (2 min)

**Mostrar:** `?tab=documentos` no estágio do Carlos
- Lista de documentos (Planos, Relatórios, etc.)
- Badges de estado: "Assinado", "Aguarda assinatura"

**Guião:** "Documentos de estágio com upload, versões e assinaturas eletrónicas posicionais. Cada signatário assina no seu retângulo."

---

## Ordem Lógica (resumo)

```
1. Login Professor → Dashboard (visão geral)
2. Estágio → Overview (contexto)
3. Estágio → Horários (presenças + validação) 
4. Estágio → Sumários (export PDF)
5. Estágio → Calendário (visão temporal)
6. Estágio → Avaliação (notas) 
7. Trocar para Tutor → Notificações + Solicitações
8. Trocar para Admin → Gestão global + Auditoria
9. Chat (tempo real)
10. Documentos (assinaturas)
```

**Duração estimada:** 15-20 minutos

