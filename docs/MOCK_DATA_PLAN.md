# Plano de Mock Data — InternLink

## 1. Personagens (Literatura/História Portuguesa)

| Role | Personagem | Origem | Razão |
|------|-----------|--------|-------|
| **Admin Escolar** | D. Afonso Henriques | História de Portugal | Imponência — primeiro rei, figura fundadora |
| **Professor** | Eça de Queirós | *Os Maias* | Escritor, crítico social, orientador nato |
| **Tutor** | João da Ega | *Os Maias* | Amigo de Carlos, boémio mas leal — tutor informal |
| **Aluno** | Carlos da Maia | *Os Maias* | Estudante de Medicina, estagiário nato |

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
| schoolId | `esrp` |
| estado | `ativo` |
| password | `ReiDePortugal123!` |

#### Professor — Eça de Queirós

| Campo | Valor |
|---|---|
| uid | `prof-eca` (fixo) |
| email | `eca.queiros@up.pt` |
| nome | Eça de Queirós |
| role | `professor` |
| schoolId | `esrp` |
| estado | `ativo` |
| courseId | `curso-turismo` |
| password | `OsMaias1888!` |

#### Tutor — João da Ega

| Campo | Valor |
|---|---|
| uid | `tutor-ega` (fixo) |
| email | `joao.ega@ramada.pt` |
| nome | João da Ega |
| role | `tutor` |
| schoolId | `esrp` |
| empresa | Ramada & Associados |
| estado | `ativo` |
| password | `EgaBoemio!123` |

#### Aluno — Carlos da Maia

| Campo | Valor |
|---|---|
| uid | `aluno-carlos` (fixo) |
| email | `carlos.maia@up.pt` |
| nome | Carlos da Maia |
| role | `aluno` |
| schoolId | `esrp` |
| courseId | `curso-turismo` |
| estado | `ativo` |
| password | `CarlosMedico!456` |

---

### 2.3 `courses/{courseId}` — Curso

**ID**: `curso-turismo`

| Campo | Valor |
|---|---|
| nome | Técnico de Turismo |
| schoolId | `esrp` |
| courseDirectorId | `prof-eca` |
| teacherIds | `["prof-eca"]` |
| supportingTeacherIds | `[]` |
| reportMinHours | 300 |
| reportWaitDays | 5 |
| directorCanDeleteEstagio | true |

---

### 2.4 `empresas/{empresaId}` — Empresa

**ID**: `ramada-associados`

| Campo | Valor |
|---|---|
| nome | Ramada & Associados |
| nomeNormalizado | ramada-e-associados |
| nif | 500123456 |
| nifNormalizado | 500123456 |
| setor | Turismo e Hotelaria |
| morada | Avenida dos Descobrimentos, 15 |
| codigoPostal | 4490-050 |
| localidade | Póvoa de Varzim |
| concelho | Póvoa de Varzim |
| distrito | Porto |
| pais | Portugal |
| emailGeral | info@ramada.pt |
| telefone | 252 987 654 |
| schoolId | `esrp` |
| tutorIds | `["tutor-ega"]` |
| empresaGrants | `{ "prof-eca": "write" }` |
| ativa | true |
| createdBy | `admin-esrp` |
| website | https://ramada.pt |

---

### 2.5 `estagios/{estagioId}` — Estágio

**ID**: `estagio-carlos`

| Campo | Valor |
|---|---|
| titulo | Estágio Carlos da Maia — Ramada & Associados |
| alunoId | `aluno-carlos` |
| alunoNome | Carlos da Maia |
| alunoEmail | carlos.maia@esrp.pt |
| alunoCourseId | `curso-turismo` |
| professorId | `prof-eca` |
| professorNome | Eça de Queirós |
| tutorId | `tutor-ega` |
| tutorNome | João da Ega |
| tutorEmail | joao.ega@ramada.pt |
| tutorEmpresa | Ramada & Associados |
| cursoNome | Técnico de Turismo |
| schoolId | `esrp` |
| courseId | `curso-turismo` |
| empresa | Ramada & Associados |
| empresaId | `ramada-associados` |
| entidadeAcolhimento | Ramada & Associados |
| empresaSnapshot | Cópia dos dados da empresa |
| dataInicio | `2026-01-05` (primeira seg-feira de Janeiro) |
| totalHoras | 400 |
| horasRealizadas | 280 |
| horasDiarias | 8 |
| diasSemana | `{ seg: true, ter: true, qua: true, qui: true, sex: true }` |
| dataFimEstimada | Calculada pelo script |
| estado | `ativo` |
| estadoEstagio | `em_curso` |
| presencasValidatedByTutor | false |

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
