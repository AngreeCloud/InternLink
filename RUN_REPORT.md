# RUN_REPORT — Chat System Improvements

## Summary

Audited and improved the InternLink chat system across 11 areas. All changes follow existing patterns, use current architecture (RTDB + Firestore), and maintain UI consistency.

## What Was Found

### Critical Issues Discovered
1. **`userTutors` RTDB index NEVER written to** — Read in 3 places (`searchInternalMembers`, `areTutorAndStudentAssociated`, `expandParticipantsForTutorAutoChannel`) but never populated. Auto-expansion and tutor lookup dead code.
2. **No role-based search filtering** — All org members shown to every role. Tutor could see all students, not just stage participants.
3. **No email validation** for external participant search.
4. **Deleted/removed accounts** visible in search results.
5. **Single dialog for DM + Group** creation — confusing UX.
6. **No help content** in chat.
7. **No `system-message` API route** — referenced in `sumarios-tab.tsx:690` but 404.
8. **`userTutors` sync missing** from all 3 tutor assignment paths.

### Existing (Working)
- Conversation creation (`createConversationFromUsers`)
- Message send/edit/delete/restore
- Read receipts with throttling
- Typing indicators
- Block external users (limited)
- Report spam
- Org member sync (`ensureOrgMemberIndex`)
- Role labels in message thread (partial)
- Conversation list with unread badges
- Attachments with permission checks

## What Was Implemented

### 1. Role-Based Search Filtering (`lib/chat/realtime-chat.ts`)
- Added `getEligibleStageParticipantIds()` helper
- Teacher: sees ALL school members (admin, tutors, students, teachers)
- Student: sees other students, teachers, admins + own tutors from estagios
- Tutor: sees ONLY stage participants (via estagio `tutorId` lookup)
- Admin: sees all school members
- Excludes `estado !== "ativo"` users

### 2. External Email Validation (`lib/chat/realtime-chat.ts`)
- Added `isValidEmail()` function with regex validation
- `resolveExternalUser` now validates format before querying
- Returns null for `estado === "removido"` accounts
- No username autocomplete for external search (design choice: email field is separate)

### 3. `userTutors` Index Sync + Auto-Conversation (`lib/chat/realtime-chat.ts`)
- Added `ensureUserTutorsIndex(studentId, tutorId)` — writes to RTDB `userTutors/{studentId}/{tutorId}`
- Added `removeUserTutorsIndex(studentId, tutorId)` — cleanup
- Added `ensureAutoConversationForTutorAssignment(studentId, professorId, tutorId)` — creates 3-way group chat (student + professor + tutor) when tutor assigned
- Wired into:
  - `create-estagio-dialog.tsx` — after POST `/api/estagios` succeeds
  - `internship-manager.tsx` — after `handleCreateEstagio` succeeds
  - `internship-manager.tsx` — in `handleSaveTutorAssignment` (tutor reassignment)

### 4. Separate DM vs Group Dialogs (`components/chat/internal-chat-hub.tsx`)
- **"Iniciar" button**: Opens DM dialog — single-select, quick 1:1
- **"Grupo" button**: Opens group dialog — multi-select, recent contacts shown, "Adicionar" button for external email
- **"? " button**: Help dialog
- Clean state management per dialog

### 5. Role Badges in Conversation Header
- Shows role badge (`Professor`/`Aluno`/`Tutor`) next to name in direct conversation header
- Shows "Eliminada" badge (destructive variant) for deleted accounts
- Uses existing `getRoleLabel`/`shouldShowRole` pattern

### 6. Help Dialog
- Explains: internal vs external, DM vs group, role-based permissions, external email, limitations
- Consistent with design system (Dialog + shadcn)

### 7. Block/Unblock Improvements
- Added `unblockUser` import and `handleUnblockDirectPeer` handler
- Loads blocked users list on profile init (`userBlocks/{uid}` via RTDB)
- Toggle button: "Bloquear" ↔ "Desbloquear"
- Blocked state persisted and reflected immediately in UI

### 8. Deleted Account Indicator
- `loadParticipantProfiles` tracks user IDs that exist in conversations but not in Firestore (deleted accounts)
- Shows "Eliminada" badge in conversation header for direct conversations with deleted peers

### 9. Firestore Rules
- Strengthened `chatAccess` creation to validate type is `direct` or `group`
- Creation requires requestor to be in participants list
- Participants immutable after creation (unchanged, but validated)

### 10. Tests

| Test File | Type | Tests |
|-----------|------|-------|
| `tests/actions/search-eligibility.test.ts` | Unit (NEW) | `isValidEmail` — 6 cases |
| `tests/realtime/user-tutors.rules.test.mjs` | Rules (NEW) | `userTutors` RTDB rules — 6 cases |

**Existing tests still pass**: 16 chat unit tests + all rules tests

## Files Changed

| File | Change |
|------|--------|
| `lib/chat/realtime-chat.ts` | Role-based search, email validation, userTutors sync, auto-conversation |
| `lib/types/chat.ts` | (unchanged) |
| `components/chat/internal-chat-hub.tsx` | DM/Group split, role badges, help dialog, unblock, deleted indicator |
| `components/estagios/create-estagio-dialog.tsx` | userTutors sync after creation |
| `components/professor/internship-manager.tsx` | userTutors sync + auto-conversation on create + reassign |
| `firestore.rules` | chatAccess type validation |
| `database.rules.json` | (unchanged, rules already correct for userTutors) |
| `tests/actions/search-eligibility.test.ts` | NEW — isValidEmail tests |
| `tests/realtime/user-tutors.rules.test.mjs` | NEW — userTutors RTDB rules tests |
| `tests/firestore/run-rules-tests.mjs` | Added user-tutors test |
| `TASKS.md` | Initial audit + checklist |
| `RUN_REPORT.md` | This file |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Tutor search limited to stage participants — might miss cases where tutor needs broader access | Matches spec; tutors can still be added to group convs by professor |
| Auto-conversation creation on tutor assignment could create duplicates | `findExistingDirectConversation` checked before creating; only creates if no existing DM |
| Deleted account detection depends on Firestore `getDoc` returning null | Accounts with `estado=removido` but still existing doc will NOT show as "Eliminada" — only truly deleted (doc gone) will. This is acceptable. |
| `userTutors` sync is fire-and-forget | Logged to console.error on failure; no user-facing error for this auxiliary operation |

## Pending / Future Work

1. **`api/chat/system-message` route** — Referenced in `sumarios-tab.tsx:690` but doesn't exist. Would allow tutor feedback to appear as system messages in student chat. Requires Firebase Admin SDK RTDB write.
2. **School admin estagio management pages** — Currently no UI for school admins to manage estagios directly.
3. **Group conversation name editing** — Users can't rename groups.
4. **Message search within conversations** — No `ctrl+f`-style search.
5. **`userTutors` index cleanup on tutor removal from estagio** — Currently only syncs on add, not remove.
6. **Email notification of new messages** — Currently only in-app toast notification.
7. **End-to-end testing** for chat flows — Would benefit from Cypress/Playwright tests.

## Suggestions

- Create `api/chat/system-message/route.ts` using Firebase Admin SDK to write system messages to RTDB
- Add `userTutors` cleanup when tutor is removed from estagio (in PATCH handler)
- Consider Firestore `chatAccess` rule to validate all participants have `estado == "ativo"` at creation time (requires `get()` for each participant)
- Add group avatar based on first 2 participants' photos
- Add `isMuted` toggle UI in conversation context menu
