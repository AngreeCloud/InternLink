# Plano de Mock Data — InternLink

## 1. Personagens (Literatura/História Portuguesa)

| Role | Personagem | Origem | Razão |
|------|-----------|--------|-------|
| **Admin Escolar** | D. Afonso Henriques | História de Portugal | Imponência — primeiro rei, figura fundadora |
| **Professor (Turma 1)** | Eça de Queirós | *Os Maias* | Escritor, crítico social, orientador nato |
| **Tutor (Turma 1)** | João da Ega | *Os Maias* | Amigo de Carlos, boémio mas leal — tutor informal |
| **Aluno (Turma 1)** | Carlos da Maia | *Os Maias* | Estudante de Medicina, estagiário nato |
| **Professor (Turma 2)** | Fernando Pessoa | Heterónimos | Poeta multifacetado, orientador de comunicação |
| **Tutor (Turma 2)** | Bernardo Soares | *Livro do Desassossego* | Guarda-livros na Publicitas, tutor pragmático |
| **Aluno (Turma 2)** | Álvaro de Campos | Heterónimo de Pessoa | Engenheiro naval, estagiário de marketing |

---

## 2. Estruturas Firestore a Criar

### Ordem de criação (dependências):

```
1. Escolas        →  schools/{schoolId}
2. Utilizadores   →  users/{uid}         (Auth + Firestore)
3. Curso          →  courses/{courseId}
4. Empresa        →  empresas/{empresaId}
5. Estágio        →  estagios/{estagioId}
6. Presenças      →  estagios/{id}/presencas/{dateId}
```

---

### 2.1 `schools/{schoolId}` — Escola

**ID**: `uporto`
**Dados**:
| Campo | Valor |
|---|---|
| name | Universidade do Porto |
| shortName | UP |
| address | Praça Gomes Teixeira, s/n |
| localidade | Porto |
| codigoPostal | 4099-002 |
| distrito | Porto |
| pais | Portugal |
| emailDomain | @up.pt |
| requireInstitutionalEmail | false |
| educationLevel | Ensino Superior |
| contact | Telefone: 220 408 000 |

---

### 2.2 `users/{uid}` — Utilizadores

Cada user tem um documento em `users/{uid}` + conta Auth.

#### Admin Escolar — D. Afonso Henriques

| Campo | Valor |
|---|---|
| uid | `admin-esrp` (fixo) |
| email | `afonso.henriques@up.pt` |
| nome | D. Afonso Henriques |
| role | `admin_escolar` |
| schoolId | `uporto` |
| estado | `ativo` |
| password | `ReiDePortugal123!` |

#### Professor (Turma 1) — Eça de Queirós

| Campo | Valor |
|---|---|
| uid | `prof-eca` (fixo) |
| email | `eca.queiros@up.pt` |
| nome | Eça de Queirós |
| role | `professor` |
| schoolId | `uporto` |
| estado | `ativo` |
| courseId | `curso-turismo` |
| password | `OsMaias1888!` |

#### Tutor (Turma 1) — João da Ega

| Campo | Valor |
|---|---|
| uid | `tutor-ega` (fixo) |
| email | `joao.ega@ramada.pt` |
| nome | João da Ega |
| role | `tutor` |
| schoolId | `uporto` |
| empresa | Ramada & Associados |
| estado | `ativo` |
| password | `EgaBoemio!123` |

#### Aluno (Turma 1) — Carlos da Maia

| Campo | Valor |
|---|---|
| uid | `aluno-carlos` (fixo) |
| email | `carlos.maia@up.pt` |
| nome | Carlos da Maia |
| role | `aluno` |
| schoolId | `uporto` |
| courseId | `curso-turismo` |
| estado | `ativo` |
| password | `CarlosMedico!456` |

#### Professor (Turma 2) — Fernando Pessoa

| Campo | Valor |
|---|---|
| uid | `prof-pessoa` (fixo) |
| email | `fernando.pessoa@up.pt` |
| nome | Fernando Pessoa |
| role | `professor` |
| schoolId | `uporto` |
| estado | `ativo` |
| courseId | `curso-comunicacao` |
| password | `Heteronimos1925!` |

#### Tutor (Turma 2) — Bernardo Soares

| Campo | Valor |
|---|---|
| uid | `tutor-soares` (fixo) |
| email | `bernardo.soares@publicitas.pt` |
| nome | Bernardo Soares |
| role | `tutor` |
| schoolId | `uporto` |
| empresa | Publicitas Portuguesa, Lda. |
| estado | `ativo` |
| password | `LivroDesassossego!` |

#### Aluno (Turma 2) — Álvaro de Campos

| Campo | Valor |
|---|---|
| uid | `aluno-campos` (fixo) |
| email | `alvaro.campos@up.pt` |
| nome | Álvaro de Campos |
| role | `aluno` |
| schoolId | `uporto` |
| courseId | `curso-comunicacao` |
| estado | `ativo` |
| password | `Tabacaria1928!` |

---

### 2.3 Cursos

#### Turma 1 — `curso-turismo`

| Campo | Valor |
|---|---|
| nome | Técnico de Turismo |
| schoolId | `uporto` |
| courseDirectorId | `prof-eca` |
| teacherIds | `["prof-eca"]` |
| reportMinHours | 300 |
| reportWaitDays | 5 |
| directorCanDeleteEstagio | true |

#### Turma 2 — `curso-comunicacao`

| Campo | Valor |
|---|---|
| nome | Técnico de Comunicação e Marketing |
| schoolId | `uporto` |
| courseDirectorId | `prof-pessoa` |
| teacherIds | `["prof-pessoa"]` |
| reportMinHours | 300 |
| reportWaitDays | 5 |
| directorCanDeleteEstagio | true |

---

### 2.4 Empresas

#### Ramada & Associados — `ramada-associados`

| Campo | Valor |
|---|---|
| nome | Ramada & Associados |
| nomeNormalizado | ramada-e-associados |
| nif | 500123456 |
| setor | Turismo e Hotelaria |
| morada | Avenida dos Descobrimentos, 15 |
| codigoPostal | 4490-050 |
| localidade | Póvoa de Varzim |
| distrito | Porto |
| emailGeral | info@ramada.pt |
| telefone | 252 987 654 |
| schoolId | `uporto` |
| tutorIds | `["tutor-ega"]` |
| empresaGrants | `{ "prof-eca": "write" }` |
| ativa | true |

#### Publicitas Portuguesa — `publicitas-portuguesa`

| Campo | Valor |
|---|---|
| nome | Publicitas Portuguesa, Lda. |
| nomeNormalizado | publicitas-portuguesa |
| nif | 500654321 |
| setor | Comunicação e Publicidade |
| morada | Rua do Alecrim, 48 |
| codigoPostal | 1200-018 |
| localidade | Lisboa |
| distrito | Lisboa |
| emailGeral | contacto@publicitas.pt |
| telefone | 213 456 789 |
| schoolId | `uporto` |
| tutorIds | `["tutor-soares"]` |
| empresaGrants | `{ "prof-pessoa": "write" }` |
| ativa | true |

---

### 2.5 Estágios

#### Estágio Carlos da Maia — `estagio-carlos`

| Campo | Valor |
|---|---|
| titulo | Estágio Carlos da Maia — Ramada & Associados |
| alunoId | `aluno-carlos` |
| professorId | `prof-eca` |
| tutorId | `tutor-ega` |
| cursoNome | Técnico de Turismo |
| empresa | Ramada & Associados |
| dataInicio | 2026-01-05 |
| totalHoras | 400 |
| horasRealizadas | 280 |
| horasDiarias | 8 |
| diasSemana | seg-sex |
| estado | ativo |

#### Estágio Álvaro de Campos — `estagio-campos`

| Campo | Valor |
|---|---|
| titulo | Estágio Álvaro de Campos — Publicitas Portuguesa |
| alunoId | `aluno-campos` |
| professorId | `prof-pessoa` |
| tutorId | `tutor-soares` |
| cursoNome | Técnico de Comunicação e Marketing |
| empresa | Publicitas Portuguesa, Lda. |
| dataInicio | 2026-02-02 |
| totalHoras | 400 |
| horasRealizadas | 112 |
| horasDiarias | 7 |
| diasSemana | seg-sex |
| estado | ativo |

---

### 2.6 `estagios/{estagioId}/presencas/{dateId}` — Presenças

280h realizadas em 35 dias (média 8h/dia). Dias úteis desde `2026-01-05`.

**Padrão de preenchimento**:
- Janeiro: 15 dias × 8h = 120h
- Fevereiro: 15 dias × 8h = 120h  
- Março: 5 dias × 8h = 40h
- **Total: 280h**

Cada presença doc:
```typescript
{
  date: "2026-01-05",
  hoursWorked: 8,
  hoursScheduled: 8,
  updatedAt: Timestamp,
  updatedBy: "aluno-carlos",
  updatedByRole: "aluno",
}
```

---

## 3. Script `scripts/seed-mock-data.js`

Ficheiro único Node.js com Firebase Admin SDK.

### Estrutura

```
1. Config / Constantes
2. Personagens (objeto com dados de cada user)
3. Funções auxiliares:
   - buildCredential()
   - ensureInitialized()
   - seedEscola()
   - seedCurso()
   - seedUsers()          → cria Auth user + Firestore doc
   - seedEmpresa()
   - seedEstagio()
   - seedPresencas()
4. run() — execução sequencial
```

### Execução

```bash
node scripts/seed-mock-data.js
```

### Notas

- UIDs fixos (`admin-esrp`, `prof-eca`, `tutor-ega`, `aluno-carlos`, `estagio-carlos`)
- Permite re-execução (upsert com `{ merge: true }`)
- Presenças calculadas por dia útil, saltando fins-de-semana
- Password definida em variáveis ou hardcoded (só para dev/mock)
- Horas restantes: 120h (400 - 280) — tutor pode validar? Faltam 120h / 8 = 15 dias → ainda não, mas próximo
- `dataFimEstimada` calculada com `calcularDataFimEstimada()` importada

---

## 4. Dados Adicionais — Notificações, Chat, Pedidos

Após seed base, alimentar o ecossistema com dados que geram alerts/badges na UI.

### 4.1 `estagios/{id}/schedule_change_requests/` — 3 Pedidos

| # | Tipo | Data | Estado | Criado por |
|---|------|------|--------|-----------|
| 1 | `future_absence` | 2026-03-20 | `approved` (prof+tutor) | Aluno |
| 2 | `past_absence_justification` | 2026-02-10 | `pending_professor` | Aluno |
| 3 | `company_closure` | 2026-03-25 | `approved` (tutor direto) | Tutor |

Cada pedido com `reason` + `comments[]` realistas.

### 4.2 `estagios/{id}/notifications/{notifId}` — 10 Notificações

Distribuídas entre os 4 participantes, algumas lidas outras não:

| # | userId | type | title | read? |
|---|--------|------|-------|-------|
| 1 | prof-eca | schedule_change_request | "Nova justificação de falta" | ❌ |
| 2 | tutor-ega | schedule_change_request | "Pedido aprovado pelo professor" | ❌ |
| 3 | aluno-carlos | schedule_change_request | "Falta futura aprovada" | ❌ |
| 4 | tutor-ega | presencas_ready | "Presenças prontas para validação" | ❌ |
| 5 | aluno-carlos | doc_signed | "Documento assinado" | ✅ |
| 6 | prof-eca | termino_antecipado | "Pedido de término antecipado" | ❌ |
| 7 | admin-esrp | schedule_change_request | "Comunicado de empresa" | ✅ |
| 8 | tutor-ega | avaliacao_tutor_assinada | "Avaliação do tutor pendente" | ❌ |
| 9 | aluno-carlos | relatorio_submitted | "Relatório final submetido" | ✅ |
| 10 | prof-eca | doc_awaits_signature | "Documento aguarda assinatura" | ❌ |

### 4.3 Chat (Realtime Database) — Conversa Grupo

Conversa `type: "group"` entre aluno-carlos, prof-eca, tutor-ega com 6 mensagens:

| # | De | Texto | Timestamp (relativo) |
|---|----|-------|---------------------|
| 1 | prof-eca | "Bom dia a ambos. Espero que o estágio esteja a correr bem." | -7d |
| 2 | aluno-carlos | "Bom dia, professor. Está a correr muito bem, já aprendi o sistema de reservas." | -6d |
| 3 | tutor-ega | "O Carlos está a evoluir bem. Já faz atendimento autónomo." | -5d |
| 4 | aluno-carlos | "Obrigado, tutor! Esta semana ajudei na organização de um seminário." | -3d |
| 5 | prof-eca | "Excelente. Não te esqueças de ir escrevendo os sumários." | -2d |
| 6 | aluno-carlos | "Já escrevi até à semana 6. Falta a 7 e 8." | -1d |

### 4.4 `estagios/{id}/sumarios/_state` — Estado Agregado

```typescript
{ allPreenchidos: true, allAssinados: false }
```

(Pois semanas 6-8 estão preenchidas mas não assinadas pelo tutor)

---

## 5. Script `scripts/seed-mock-data-extra.js`

Ficheiro separado do seed base para não o poluir. Executa depois.

### Estrutura

```
1. Conexão Firebase Admin
2. seedScheduleChangeRequests()  → 3 pedidos
3. seedNotifications()           → 10 notificações
4. seedChatConversation()        → 1 conversa grupo + 6 mensagens
5. seedSumariosState()           → _state doc
```

### Execução

```bash
node scripts/seed-mock-data-extra.js
```

Re-executável: apaga docs existentes com os mesmos IDs antes de recriar (para notificações e pedidos usa IDs fixos).

---

## 6. Avaliação

### 6.1 Config (`schools/uporto.avaliacaoConfig`)

| Campo | Valor |
|---|---|
| parâmetros | Assiduidade e Pontualidade, Iniciativa e Autonomia, Qualidade do Trabalho, Relacionamento Interpessoal, Capacidade de Aprendizagem |
| escala | 0-20 |
| método | média |
| notaFinalEsperada | 0-20 |
| permitirTutorVerNotaFinal | true |

### 6.2 Datas (`courses/curso-turismo/settings/avaliacao_datas`)

| Data | Valor |
|------|-------|
| disponibilidadePreenchimento | 2026-03-09 |
| publicacaoNotaFinal | 2026-03-29 |

### 6.3 Tutor (`estagios/estagio-carlos/avaliacao/tutor`)

| Parâmetro | Nota |
|-----------|------|
| Assiduidade e Pontualidade | 17 |
| Iniciativa e Autonomia | 15 |
| Qualidade do Trabalho | 16 |
| Relacionamento Interpessoal | 18 |
| Capacidade de Aprendizagem | 14 |
| **Média** | **16** |
| estado | pendente |

### 6.4 Professor (`estagios/estagio-carlos/avaliacao/professor`)

| Parâmetro | Nota |
|-----------|------|
| Assiduidade e Pontualidade | 16 |
| Iniciativa e Autonomia | 15 |
| Qualidade do Trabalho | 17 |
| Relacionamento Interpessoal | 18 |
| Capacidade de Aprendizagem | 15 |
| **Nota Final** | **16 valores** |
| estado | pendente |

---

## 7. Scripts

| Script | O quê | Ordem |
|--------|-------|-------|
| `scripts/seed-mock-data.js` | Escola + users + curso + empresa + estágio + presenças + sumários (Turma 1) | 1º |
| `scripts/seed-mock-data-extra.js` | Schedule requests + notificações + chat + sumários _state | 2º |
| `scripts/seed-mock-audit.js` | 20 registos de auditoria | 3º |
| `scripts/seed-mock-avaliacao.js` | Config avaliação + notas tutor + notas professor | 4º |
| `scripts/seed-mock-turma2.js` | Turma 2 (Pessoa): curso + users + empresa + estágio + presenças + sumários | 5º |

---

## 8. Credenciais de Login

| Personagem | Email | Password |
|-----------|-------|----------|
| D. Afonso Henriques (admin) | afonso.henriques@up.pt | ReiDePortugal123! |
| Eça de Queirós (professor) | eca.queiros@up.pt | OsMaias1888! |
| João da Ega (tutor) | joao.ega@ramada.pt | EgaBoemio!123 |
| Carlos da Maia (aluno) | carlos.maia@up.pt | CarlosMedico!456 |
| Fernando Pessoa (professor) | fernando.pessoa@up.pt | Heteronimos1925! |
| Bernardo Soares (tutor) | bernardo.soares@publicitas.pt | LivroDesassossego! |
| Álvaro de Campos (aluno) | alvaro.campos@up.pt | Tabacaria1928! |
