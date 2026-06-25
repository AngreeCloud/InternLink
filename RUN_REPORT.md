# RUN_REPORT.md

Started: 2026-06-23
Plan: PLAN.md (4 parts)

---

## Part 1 — UI: Remove inner Card wrapper + Maximize space

**Status:** completo

**Files changed:**
- `components/professor/estagios-section.tsx` — stripped Card/CardHeader/CardTitle/CardDescription wrapper; replaced with plain `<div className="space-y-4">`
- `components/professor/internship-manager.tsx` — added count badge (`rounded-full bg-muted px-3 py-1`) next to h1 heading

**Decisions/desvios:**
- Nenhum. Seguiu o plano à letra.
- `Briefcase` icon mantido porque também é usado no estado "Nenhum estágio criado" — removi e tive de repor após typecheck.

**Commit message proposta:**
```
feat(professor): remove Card wrapper from EstagiosSection, add count badge

- Strip inner Card/CardHeader/CardTitle from EstagiosSection (replaced with div)
- Add inline count badge next to h1 in InternshipManager
```

---

## Part 2 — UI: Edit opens maximized right panel (not modal)

**Status:** completo

**Files changed:**
- `components/estagios/edit-estagio-sheet.tsx` — **NEW** — right panel edit view
- `components/professor/internship-manager.tsx` — replaced `EditEstagioDialog` with `EditEstagioSheet`; replaced `editDialogOpen`/`editingScheduleEstagio` state with `editingSheetEstagio`

**Decisions/desvios:**
- Nenhum. Sheet usa `<div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl">` com overlay `fixed inset-0 z-40 bg-black/50`
- Lógica do form idêntica ao dialog original
- Sheet retorna `null` quando `open === false` (não renderiza nada)

**Commit message proposta:**
```
feat(professor): replace edit modal with maximized right panel

- Add EditEstagioSheet component (fixed right panel, sidebar uncovered)
- Replace EditEstagioDialog usage in InternshipManager with EditEstagioSheet
```

---

## Part 3 — Archive Soft-delete (UI + API)

**Status:** completo

**Files changed:**
- `app/api/estagios/[id]/route.ts` — added `"arquivado"` to allowed `estadoEstagio` array in PATCH
- `components/estagios/archive-estagio-button.tsx` — **NEW** — archive button with condition checks
- `components/professor/estagios-section.tsx` — added `<ArchiveEstagioButton>` per internship row; added `schoolId` prop
- `components/professor/internship-manager.tsx` — passes `schoolId` to EstagiosSection
- `components/estagios/estagio-detail-view.tsx` — added `<ArchiveEstagioButton>` in header for professor/director roles

**Decisions/desvios:**
- Archive button é disabled (com tooltip) se:
  - Relatório final ainda não foi submetido (consulta `/api/estagios/{id}/relatorio-final`)
  - Data fim estimada ainda não passou
  - Estágio já arquivado
- Archive chama `PATCH /api/estagios/[id]` com `{ estadoEstagio: "arquivado" }`
- Archive button hidden se `estado === "arquivado"`
- API route: `estado` field é atualizado para `"arquivado"` quando `estadoEstagio === "arquivado"`
- Não adicionadas regras firestore (sem ficheiro de testes encontrado)

**Commit message proposta:**
```
feat(estagios): add archive button with conditional enablement

- Allow "arquivado" in PATCH estadoEstagio
- ArchiveEstagioButton checks report submitted + past end date
- Visible in EstagiosSection and EstagioDetailView (professor/director)
```

---

## Part 4 — Delete logic: role-based + permission-gated + school-admin request

**Status:** completo

**Files changed:**
- `lib/audit/types.ts` — added `"delete_request"`, `"delete_approved"`, `"delete_rejected"` to `AuditAction` union
- `lib/audit/summaries.ts` — added summary strings for new audit actions
- `app/api/estagios/[id]/route.ts` — added `"eliminado"` to PATCH state list, soft-delete fields (`deletedAt`, `deletedBy`); DELETE now checks `directorCanDeleteEstagio` before proceeding
- `app/api/estagios/[id]/delete-request/route.ts` — **NEW** — POST creates delete request doc; PUT handles school-admin approve/reject
- `components/professor/internship-manager.tsx` — loads `courseDirectorMap` from Firestore; passes it to EstagiosSection; added request-delete dialog for director-without-permission
- `components/professor/estagios-section.tsx` — added `courseDirectorMap` prop, `onRequestDelete` callback; shows active/disabled delete button based on role + permission
- `components/school-admin/courses-manager.tsx` — added `directorCanDeleteEstagio` field to Course type, read from/written to Firestore, checkbox in edit form, indicator in read-only view
- `components/school-admin/active-professors.tsx` — added `directorCanDeleteEstagio` indicator badge per course
- `components/school-admin/delete-estagio-requests.tsx` — **NEW** — school-admin approval UI for pending/approved/rejected delete requests
- `app/school-admin/aprovacoes/page.tsx` — added `<DeleteEstagioRequestsSection />`

**Decisions/desvios:**
- Soft-delete: PATCH sets `estado: "eliminado"`, `deletedAt`, `deletedBy` — does not hard-delete the doc
- Director-with-permission uses existing DELETE endpoint (now soft-deletes)
- Non-director sees disabled button with tooltip "Apenas o Diretor do Curso pode eliminar estágios"
- Director-without-permission sees "Solicitar eliminação" button → creates request doc via `POST /api/estagios/[id]/delete-request`
- School-admin approves/rejects via `PUT /api/estagios/[id]/delete-request` → updates request status, soft-deletes on approve
- Delete requests stored in `schools/{schoolId}/deleteEstagioRequests/` subcollection
- Firestore rules not updated (no test file found for rules)
- Pre-existing errors in `empresas` routes (unrelated)

**Commit message proposta:**
```
feat(estagios): role-based delete with permission gate and school-admin approval

- Add directorCanDeleteEstagio field to courses (configurable in school-admin)
- EstagiosSection: hide/disable Eliminar based on director status + permission
- Director with permission: soft-delete via PATCH estado="eliminado"
- Director without permission: create delete request for school-admin approval
- School-admin: approve/reject delete requests in Aprovações page
- API: DELETE checks directorCanDeleteEstagio, new POST/PUT for request flow
```

