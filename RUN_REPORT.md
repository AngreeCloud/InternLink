# RUN_REPORT — Empresas Issue Implementation

## Overview

Full audit + implementation pass on the 12-item empresas issue. All clear/safe/medium items implemented. Blocked items documented.

---

## Implemented Items

### 1. Contadores nos cards da listagem ✅
- **`app/api/empresas/route.ts`**: GET response now includes `estagioCount` (counted from estagios collection grouped by empresaId) and `tutorCount` (from `tutorIds.length`)
- **`components/empresas/empresas-page.tsx`**: Cards display estagio count (GraduationCap icon) + tutor count (Users icon)
- One extra query to estagios collection with `.select()` projection — acceptable perf for school-scale data
- Tests updated to include new fields in mock data

### 2. Filtros na listagem ✅
- **`components/empresas/empresas-page.tsx`**: Added status filter toggle (Todas / Ativas / Arquivadas) as pill buttons above empresa list
- Client-side filter preserves existing text search
- Test updated: "Arquivada" text now appears 2× (filter button + card badge)

### 3. Deteção de NIF duplicado + Formato ✅
- **`lib/validators/nif.ts`**: New Portuguese NIF validation with check-digit algorithm
  - Length check (9 digits)
  - No repeated digits
  - First digit 1-9
  - Check-digit modulo 11 validation
- **`components/empresas/empresas-create-form.tsx`**: Client-side NIF validation before submit
- **`components/empresas/empresas-edit-form.tsx`**: Client-side NIF validation before submit
- **`app/api/empresas/route.ts`**: Server-side format validation in POST (400 on invalid)
- **`app/api/empresas/[id]/route.ts`**: Server-side format validation in PATCH (400 on invalid)
- Uniqueness check already existed (409 on duplicate NIF per school)
- Fixed pre-existing bug: `optional()` helper used before `const` declaration (hoisting TS error)

### 4. Logo da empresa ✅
- **`storage.rules`**: Added `empresa-logos/{empresaId}` path with `isSchoolStaffActive()` guard (5 MB, image/*)
- **`components/empresas/empresas-detail.tsx`**: Logo display in header area with hover-to-upload overlay
  - Uploads to Firebase Storage via client SDK
  - Updates empresa doc with download URL via PATCH
- **`components/empresas/empresas-page.tsx`**: Card shows logo image if `logoUrl` present (falls back to Building2 icon)

### 5. Auditoria / histórico de alterações (metadata) ✅
- **`components/empresas/empresas-detail.tsx`**: New "Auditoria" section in InfoTab
  - Shows: created date + creator, last update date, archive date + archiver
  - Handles Firestore Timestamp objects and epoch numbers

### 6. Upload de fotos / galeria ✅
- **`storage.rules`**: Added `empresa-photos/{empresaId}` path (10 MB, image/*, delete allowed for staff)
- **`app/api/empresas/[id]/route.ts`**: PATCH handler now accepts `fotos` array in body
- **`components/empresas/empresa-photos.tsx`**: New gallery component with grid display, upload button, delete per photo
- **`components/empresas/empresas-detail.tsx`**: Added "Fotos" tab between Estágios and Acessos

### 7. Data migration script ✅
- **`scripts/migrate-estagios-empresa-snapshot.ts`**: Idempotent migration that adds `empresaSnapshot` to estagios missing it
  - Reads all schools, all estagios per school, skips if `empresaSnapshot` exists
  - Safe: never overwrites existing data
  - Usage: `npx tsx scripts/migrate-estagios-empresa-snapshot.ts`

### 8. Minor improvements
- **`lib/types/empresa.ts`**: Added missing `nifNormalizado?: string` field to Empresa interface
- Fixed pre-existing `optional()` before declaration bug in POST route

---

## Already Implemented (verified)

### 9. UI Arquivar/Desarquivar ✅
- Archive button in detail header with confirmation dialog
- "Arquivada" badge on list cards
- Restore button when archived
- Backend: PATCH sets `ativa`, `archivedAt`, `archivedBy`
- Firestore rules: `allow delete: if false`

### 10. Soft delete vs arquivação ✅
- Semantics consistent: `ativa` field, no delete UI, "Arquivar" language throughout
- Firestore rules block delete entirely

---

## Blocked / Not Implemented

### 11. PDF / snapshot histórico 🚫 Blocked
- `buildEmpresaSnapshot()` exists and works
- Whether to create PDF snapshots (vs data snapshots) is a product decision
- Snapshot migration script created (see #7)

### 12. Importação CSV/Excel 🚫 Blocked
- No CSV parser, no import infrastructure, no API routes
- XLSX only supported as document upload format (not data import)
- Requires: csv-parse or xlsx library, import API, validation, progress UI

### 13. Mapa / geolocalização 🚫 Blocked
- No geocoding service, no map library, no lat/lng fields
- Address fields are plain text only
- Requires: map library integration, geocoding API, coordinates on empresa model

---

## Test Results

- **343 tests passing** (43 test files)
- All 5 empresa-specific test files pass (26 tests)
- Firestore rules tests not run (require emulator, pre-existing)

---

## Decisions Still Open

1. **PDF snapshots**: Build full PDF historical snapshots, or is data-level snapshot sufficient?
2. **CSV import**: Implement with which library? Bulk import API design?
3. **Map/geolocation**: Which map provider? Geocoding service? Add lat/lng to Empresa type?
4. **Setor filter dropdown**: Extract unique setores from data for filter dropdown? Or hardcode list?
5. **NIF first-digit validation**: Current validation allows all first digits 1-9. Portuguese NIF ranges: 1-3 (person), 5 (company), 6 (public). Should we restrict by entity type? This would need empresa type field.
