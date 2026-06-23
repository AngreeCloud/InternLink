# PLAN: Estágios Page — UI Overhaul + Archive/Delete Logic

## Part 1 — UI: Remove inner Card wrapper + Maximize space

### Problem
`EstagiosSection` wraps content in `<Card>` with `<CardTitle>"Estágios"</CardTitle>`.
Page header already says **"Estágios"**. Redundant heading. Card also imposes horizontal padding (`px-4 sm:px-6 lg:px-8` nested inside layout's same padding) = double padding + waste.

### Current structure (simplified)

```
+-- ProfessorLayout (px-4 sm:px-6 lg:px-8) ---------+
|                                                     |
|   +-- InternshipManager (space-y-6) --------------+ |
|   |   h1: "Estágios"    p: subtitle              | |
|   |   [Novo Estágio] button                      | |
|   |                                               | |
|   |   +-- EstagiosSection ----------------------+ | |
|   |   |   +-- Card ----------------------------+ | | |
|   |   |   |   CardHeader: "Estágios" (dup)     | | | |
|   |   |   |   CardContent: filters + list      | | | |
|   |   |   +------------------------------------+ | | |
|   |   +------------------------------------------+ | |
|   |                                               | |
|   |   EditEstagioDialog (modal)                   | |
|   +-----------------------------------------------+ |
+-----------------------------------------------------+
```

### Proposed structure

```
+-- ProfessorLayout (px-4 sm:px-6 lg:px-8) ---------+
|                                                     |
|   +-- InternshipManager (space-y-6, px-0) --------+ |
|   |   h1: "Estágios"    p: subtitle               | |
|   |   [Novo Estágio]  [N estágio(s)] count chip   | |
|   |                                               | |
|   |   filters toolbar (full width)                | |
|   |   grouped internship list (full width)        | |
|   |                                               | |
|   |   EditEstagioSheet (right panel, see Part 2)  | |
|   +-----------------------------------------------+ |
+-----------------------------------------------------+
```

### Changes

**File: `components/professor/estagios-section.tsx`**

1. Strip `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardDescription>` wrapper.
   - Remove `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription` imports.
2. Keep all filter/sort/list logic exactly as-is.
3. Remove redundant "Estágios" heading (page-level h1 in `InternshipManager` already exists).
4. Return only:
   ```
   <div className="space-y-4">
     <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3"> // toolbar
     <div className="space-y-3"> // grouped list
   </div>
   ```

**File: `components/professor/internship-manager.tsx`**

1. Add a **count badge/chip** next to the heading or in the header row:
   ```tsx
   <div className="flex items-center gap-3">
     <h1 className="text-3xl font-bold text-foreground">Estágios</h1>
     <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
       {estagios.length} estágio(s)
     </span>
   </div>
   ```
   (This replaces `CardDescription` count that was inside `EstagiosSection`.)

2. Pass **no container class** to `EstagiosSection` so it renders flush.

From `estagios-section.tsx`, line 162-175:
```tsx
// REMOVE this entire wrapper:
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Briefcase className="h-5 w-5" />
      Estágios
    </CardTitle>
    <CardDescription>
      {loading ? "A carregar..." : ...}
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
```

Replace with:
```tsx
<div className="space-y-4">
```

And at the end, replace `</CardContent></Card>` with `</div>`.

---

## Part 2 — UI: Edit opens maximized right panel (not modal)

### Problem
`EditEstagioDialog` is a centered modal popup (Dialog). User wants maximized view on the right side, not covering sidebar.

### Solution: `EditEstagioSheet` — a full-height right panel

Replace `EditEstagioDialog` with a custom component that renders as a **fixed right panel** (like shadcn Sheet but custom-styled). 
- Width: ~50% or `max-w-2xl` of the remaining content area (right of sidebar).
- Uses `fixed right-0 top-0 h-full` but offset by sidebar width.
- Has a "Voltar" (back) button in header.
- Does NOT cover the sidebar.
- All edit fields same as current dialog (titulo, empresa, data, etc.)

### Layout calculation

```
+-- Sidebar (collapsed: 72px, expanded: 288px) ----+
|                                                    |
+----------------------------------------------------+
| Top bar (h-16)                                     |
+-- Main content area (right of sidebar) ------------+
|                                                     |
|   InternshipManager content (blurred/disabled)     |
|                                                     |
|   +-- EditEstagioSheet (fixed, right side) -------+ |
|   |   +-- header: [Voltar] "Editar Estágio"      | |
|   |   +-- form fields (same as current dialog)   | |
|   |   +-- footer: [Cancelar] [Guardar]           | |
|   +-----------------------------------------------+ |
|                                                     |
+-----------------------------------------------------+
```

### CSS approach

```tsx
// Overlay behind the sheet
{/* Dark overlay only over right content, not sidebar */}

<div className="fixed inset-0 z-40 bg-black/50" onClick={() => onOpenChange(false)} />

// Sheet panel
<div className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl border-l bg-background shadow-xl overflow-y-auto">
  {/* Header */}
  <div className="flex items-center justify-between border-b px-6 py-4">
    <button onClick={() => onOpenChange(false)} className="flex items-center gap-2 text-sm">
      <ArrowLeft className="h-4 w-4" />
      Voltar
    </button>
    <h2 className="text-lg font-semibold">Editar Estágio</h2>
    <div /> {/* spacer */}
  </div>
  {/* Content */}
  <div className="space-y-6 p-6">
    ... same fields as EditEstagioDialog ...
  </div>
</div>
```

### File changes

1. **New file: `components/estagios/edit-estagio-sheet.tsx`**
   - Copy logic from `edit-estagio-dialog.tsx`
   - Replace Dialog wrapper with Sheet layout
   - Same props interface: `estagio`, `open`, `onOpenChange`, `onSaved`
   - Same save logic (PATCH `/api/estagios/${id}`)

2. **`components/professor/internship-manager.tsx`**
   - Replace `EditEstagioDialog` import with `EditEstagioSheet`
   - Replace `<EditEstagioDialog>` with `<EditEstagioSheet>`
   - Remove `editDialogOpen`, `editingScheduleEstagio` state (sheet manages own visibility via props)

3. **`components/professor/estagios-section.tsx`**
   - The "Editar" button `onClick={() => onOpenEdit(estagio)}` stays the same.
   - No changes needed — `onOpenEdit` still triggers sheet open via parent.

### Verify existing pattern
`FullscreenDocumentViewer` uses `fixed inset-0 z-50 flex flex-col bg-background overflow-hidden` (file: `components/estagios/documentos/fullscreen-document-viewer.tsx`). This confirms the pattern is established. Our sheet only differs by not covering the sidebar.

---

## Part 3 — Archive button for internships

### Functional requirements

1. Only clickable (enabled) when **both conditions met**:
   - **Condition A**: Relatório Final (relatorio_final) has been submitted by the student
   - **Condition B**: Current time > `dataFimEstimada` (estimated end date) of the internship
2. Otherwise: button is **disabled** with tooltip explaining why.
3. Archiving action:
   - Sets `estadoEstagio: "arquivado"`, `estado: "arquivado"` or creates a new state
   - Writes to audit log (action: `"archive"`, entity: `"estagio"`)
   - Optionally sets `archivedAt`, `archivedBy` fields
4. Can only be done by **professor** or **course director**

### State verification

#### Condition A — Report submitted
- Report is stored in `estagios/{id}/documentos` with `templateCode === "RELATORIO_FINAL"`
- Report document has `estado: "pendente"` after submission and `estado: "aprovado"` after tutor validates
- Check exists via `/api/estagios/${id}/relatorio-final` GET endpoint (returns `report` object with `submittedAt`)
- The `report` object being non-null = report has been submitted
- Could also check directly in Firestore: query `estagios/{id}/documentos` where `templateCode == "RELATORIO_FINAL"`

#### Condition B — Past estimated end time
- `estagio.dataFimEstimada` is stored as ISO date string (YYYY-MM-DD)
- Compare: `new Date(estagio.dataFimEstimada) < new Date()` (strictly past)

#### Combined
```typescript
const canArchive = reportSubmitted && 
  estagio.dataFimEstimada && 
  new Date(estagio.dataFimEstimada) < new Date();
```

### UI placement
- Button in **EstagiosSection** per-internship card, alongside "Editar", "Eliminar" buttons.
- Or in **EstagioDetailView** (overview tab) for a more detailed action area.
- For this plan: **Add to both** — quick action in list view + detailed in detail view.

### Permission check
Only professors or course directors see this button.
- In `EstagiosSection` (professor view), the professor is the creator, so permission is implicit.
- In `EstagioDetailView`, check `effectiveRole === "diretor" || effectiveRole === "professor"`.

### Audit
Use existing audit infra (`lib/audit/write.ts`):
```typescript
import { writeAuditLog } from "@/lib/audit/write";
await writeAuditLog(db, schoolId, {
  action: "archive",
  entityType: "estagio",
  entityId: estagio.id,
  userId: currentUser.uid,
  metadata: { estado: "arquivado", alunoNome: estagio.alunoNome },
});
```

### Files to create/modify

**New: `components/estagios/archive-estagio-button.tsx`**
- Props: `estagioId`, `schoolId`, `estado`, `dataFimEstimada`, `onArchived`
- On mount, fetch report status from `/api/estagios/${estagioId}/relatorio-final`
- Compute `canArchive` 
- Render button with tooltip explaining why disabled
- On click: confirmation dialog → patch estagio → write audit → callback

**Modify: `components/professor/estagios-section.tsx`**
- Add archive button to each internship row (between Editar and Eliminar)
- Pass necessary props (estagio.id, dataFimEstimada)

**Modify: `components/estagios/overview-tab.tsx` (or `estagio-detail-view.tsx`)**
- Add archive button in detail view for professors/directors

---

## Part 4 — Delete logic: role-based + permission-gated + school-admin request

### Current behavior (file: `components/professor/internship-manager.tsx` lines 473-488)
- Anyone (professor) can delete via `DELETE /api/estagios/${id}`
- Straight deletion, no audit, no approval

### Proposed behavior

```
                    +-------------------+
                    | User clicks       |
                    | "Eliminar"        |
                    +--------+----------+
                             |
                    +--------v----------+
                    | Is course director?|
                    +--------+----------+
                             |
             +---------------+---------------+
             |                               |
     +-------v-------+             +---------v--------+
     | Has delete     |             | Non-director     |
     | permission?    |             | professor        |
     +---+--------+---+             | cannot delete    |
         |        |                 +---------+--------+
    +----v--+ +--v------+                    |
    | Auto  | | Send to |             [Show message:
    | delete| | school- |              "Only course
    | +     | | admin   |              director can
    | audit | | approval|              delete"]
    +-------+ +---------+
```

### Details

#### 4a. Sub-role check: Course Director
Already exists: `getUserRoleInEstagio()` returns `"diretor"` when `course.courseDirectorId === uid` and `course.id === estagio.courseId`.
Already computed in `EstagioDetailView` (line 199: `canManage`).

For `EstagiosSection` / `InternshipManager`, need to add this check.
- Load course data for each internship OR batch.
- Or: `InternshipManager` already loads courses via broadcast-courses API — can derive director status.

#### 4b. School-admin configurable permission: "director can delete autonomously"

**New field on `courses` document:**
```
directorCanDeleteEstagio: boolean  // default: false
```

Where to configure:
- **School-admin → Cursos → Edit course dialog** (file: `components/school-admin/courses-manager.tsx`)
- Add a checkbox/switch in the edit panel: "Diretor do Curso pode eliminar estágios autonomamente"
- When saving, PATCH the course document with `directorCanDeleteEstagio: true/false`

#### 4c. Delete flow for course director

If `directorCanDeleteEstagio === true`:
1. Show confirmation dialog with warning
2. On confirm: 
   - PATCH estagio: set `estado: "eliminado"`, `deletedAt`, `deletedBy`
   - Write audit log (action: `"delete"`, entityType: `"estagio"`)
   - Optionally actually delete or just mark as deleted
3. Remove from local list

If `directorCanDeleteEstagio === false` (or non-director):
1. Show dialog: "Pedido de eliminação será enviado ao administrador da escola"
2. On confirm:
   - Create document in `schools/{schoolId}/pendingActions` or `estagios/{id}/deleteRequests`
   - With fields: `estagioId`, `solicitadoPor`, `solicitadoEm`, `estado: "pendente"`, `motivo?`
3. School-admin sees pending requests in `/school-admin/aprovacoes` section
4. School-admin can: approve (delete) or reject
5. On approve: actual delete + audit log
6. On reject: update request state + notify professor

#### 4d. School-admin approval UI

**Modify: `app/school-admin/aprovacoes/page.tsx`**
- Add new section component: `DeleteEstagioRequests`
- Queries `schools/{schoolId}/estagiosDeleteRequests` where `estado === "pendente"`
- Shows: student name, course, professor who requested, date
- Actions: [Aprovar eliminação] [Recusar]

**New component: `components/school-admin/delete-estagio-requests.tsx`**

### Data model for delete requests

```
schools/{schoolId}/deleteEstagioRequests/{requestId}
{
  estagioId: string,
  estagioTitulo: string,
  alunoNome: string,
  courseId: string,
  professorId: string,
  professorName: string,
  motivo: string,
  estado: "pendente" | "aprovado" | "recusado",
  createdAt: Timestamp,
  decidedAt?: Timestamp,
  decidedBy?: string,
}
```

Non-director professors see: "Apenas o Diretor do Curso pode eliminar estágios. Contacte o diretor ou administrador."

### Files to modify

| File | Change |
|------|--------|
| `components/professor/estagios-section.tsx` | Hide "Eliminar" if user not course director; show disabled with tooltip |
| `components/professor/internship-manager.tsx` | Update delete handler to check director status; route to approval flow |
| `components/school-admin/courses-manager.tsx` | Add `directorCanDeleteEstagio` toggle in edit course panel |
| `components/school-admin/active-professors.tsx` | Optional: show permission indicator |
| `app/school-admin/aprovacoes/page.tsx` | Add `DeleteEstagioRequestsSection` |
| `components/school-admin/delete-estagio-requests.tsx` | **New** — approval UI for school admin |
| `app/api/estagios/[id]/route.ts` | PATCH: handle soft-delete, DELETE: check permissions |
| `lib/audit/write.ts` | Already compatible; just use action: "delete", entityType: "estagio" |

### Firestore rules impact

Need to allow:
- Professor to CREATE in `schools/{schoolId}/deleteEstagioRequests`
- School-admin to READ and UPDATE in same collection
- School-admin to read `directorCanDeleteEstagio` on courses

---

## Summary of all files changed

### Part 1 (UI — remove Card)
- `components/professor/estagios-section.tsx` — strip Card wrapper, remove duplicate title
- `components/professor/internship-manager.tsx` — add count badge, remove redundant description

### Part 2 (UI — Edit sheet)
- `components/estagios/edit-estagio-sheet.tsx` — **NEW**, right panel edit view
- `components/professor/internship-manager.tsx` — replace `EditEstagioDialog` with `EditEstagioSheet`

### Part 3 (Archive)
- `components/estagios/archive-estagio-button.tsx` — **NEW**, archive with condition checks
- `components/professor/estagios-section.tsx` — add archive button
- `components/estagios/overview-tab.tsx` — add archive button in detail view
- `app/api/estagios/[id]/route.ts` — handle archive PATCH

### Part 4 (Delete logic)
- `components/professor/estagios-section.tsx` — conditionally hide/disable Eliminar
- `components/professor/internship-manager.tsx` — update delete handler
- `components/school-admin/courses-manager.tsx` — add `directorCanDeleteEstagio` toggle
- `components/school-admin/delete-estagio-requests.tsx` — **NEW** school-admin approval UI
- `app/school-admin/aprovacoes/page.tsx` — add delete requests section
- `app/api/estagios/[id]/route.ts` — permission check on delete
- `firestore.rules` — new collection rules

### Non-functional
- `lib/audit/write.ts` — no changes needed, already supports `"delete"` and `"archive"` actions
