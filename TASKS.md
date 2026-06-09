# TASKS — Empresas Issue Audit & Implementation

## Status Legend
- ✅ Done — verified working
- 🚫 Blocked — needs product decision or infrastructure

---

### 1. UI Arquivar/Desarquivar
**State:** ✅ Done  
**Evidence:**
- `empresas-detail.tsx:733-767` — Archive button + confirmation dialog
- `empresas-detail.tsx:657-676` — Restore button when archived
- `empresas-page.tsx:128` — "Arquivada" badge on inactive cards
- API `PATCH /api/empresas/[id]` sets `ativa`, `archivedAt`, `archivedBy`

### 2. Contadores nos cards da listagem
**State:** ✅ Done  
**Implementation:**
- `GET /api/empresas` now returns `estagioCount` + `tutorCount`
- Cards display both with GraduationCap + Users icons
- Implementation: single extra estagios query with `.select("empresaId")` projection

### 3. Filtros na listagem
**State:** ✅ Done  
**Implementation:**
- ✅ Client text search: nome, nif, localidade, setor
- ✅ Status filter toggle: Todas / Ativas / Arquivadas (pill buttons above list)
- ❌ No setor filter dropdown (minor, low impact)

### 4. Upload de fotos / galeria
**State:** ✅ Done  
**Implementation:**
- `storage.rules`: `empresa-photos/{empresaId}` path (10 MB, image/*)
- `empresa-photos.tsx`: Gallery component with upload + delete
- Added "Fotos" tab to empresa detail view

### 5. Logo da empresa
**State:** ✅ Done  
**Implementation:**
- `storage.rules`: `empresa-logos/{empresaId}` path (5 MB, image/*)
- Hover-to-upload overlay on logo area in detail header
- Logo display in list cards (falls back to Building2 icon)

### 6. Deteção de NIF duplicado + Formato
**State:** ✅ Done  
**Implementation:**
- `lib/validators/nif.ts`: Portuguese NIF validation (check-digit algorithm)
- Client-side: create form + edit form validate before submit
- Server-side: POST + PATCH routes validate format (400) and uniqueness (409)
- `nifNormalizado` added to Empresa TypeScript interface

### 7. Data migration de campos em falta nos estágios
**State:** ✅ Done  
**Implementation:**
- `scripts/migrate-estagios-empresa-snapshot.ts`: Idempotent, safe, no overwrite
- Usage: `npx tsx scripts/migrate-estagios-empresa-snapshot.ts`

### 8. PDF / snapshot histórico
**State:** 🚫 Blocked — needs product decision  
**Context:**
- `buildEmpresaSnapshot()` used for historical consistency
- Whether to build PDF snapshots or rely on data snapshots is a product decision
- Migration script created for missing data snapshots

### 9. Soft delete vs arquivação
**State:** ✅ Done — aligned  
**Evidence:**
- `ativa` field with `archivedAt`/`archivedBy`
- Firestore rules: `allow delete: if false`
- UI consistently uses "Arquivar" / "Restaurar" language
- No delete UI exposed

### 10. Auditoria / histórico de alterações (metadata)
**State:** ✅ Done  
**Implementation:**
- "Auditoria" section in InfoTab shows: created date + creator, last update, archive date + archiver
- Handles Firestore Timestamp + epoch number formats

### 11. Importação CSV/Excel
**State:** 🚫 Blocked — no infrastructure  
**Context:** No CSV parser, no import API, no bulk insert capability.

### 12. Mapa / geolocalização
**State:** 🚫 Blocked — no infrastructure  
**Context:** No geocoding, no map library, no lat/lng fields.

---

## Decisions Still Open
1. PDF snapshots: build full PDF or data-level is enough?
2. CSV import: which library? Bulk API design?
3. Map/geolocation: which provider? Add coordinates to Empresa?
4. Setor filter dropdown: extract from data or hardcode?
5. NIF first-digit restriction: restrict by entity type? Need empresa type field.
