# Chat System Audit & Tasks — Status: COMPLETED

> Última atualização: UX/UI melhorias (v2)

## Audit Summary

### Architecture
- Next.js 16 + React 18 (App Router)
- Firebase Auth (email/password + Google) + JWT session cookies
- RTDB for real-time chat (conversations, messages, userConversations, typing, blocks, reports)
- Firestore for users, estagios, empresas, courses, chatAccess mirror
- Chat UI: `components/chat/internal-chat-hub.tsx` (1329 lines) — monolithic component

### Current State

| Area | Status | Notes |
|------|--------|-------|
| Conversation creation | ✅ Fixed | Split DM/Group into separate dialogs |
| Internal member search | ✅ Fixed | Role-based filtering implemented |
| External email search | ✅ Fixed | Format validation + no suggestions for external |
| Role badges | ✅ Fixed | Added to conversation header |
| Block user | ✅ Fixed | Unblock now available |
| Report spam | ✅ Existing | Via `reportUserBySpam` |
| Help button | ✅ Added | Help dialog with explanations |
| Tutor auto-conversation | ✅ Fixed | `userTutors` index sync + auto 3-way group creation |
| `userTutors` sync | ✅ Fixed | Written to on tutor assignment (3 paths) |
| system-message API route | ❌ Still missing | Referenced in `sumarios-tab.tsx:690` — no file |
| EE (encarregado) chat | ✅ Fixed | Removed accounts excluded from search |
| Deleted user handling | ✅ Added | Visual indicator in conversation header |
| Firestore rules (chatAccess) | ✅ Strengthened | Type validation + participant check |
| School-admin estagio mgmt | ❌ Still missing | No school-admin pages for estagios |

### Key Issues Discovered & Fixed

1. **`userTutors` RTDB index was NEVER written to.** — FIXED: Now synced on tutor assignment.
2. **`searchInternalMembers` showed all school members.** — FIXED: Role-based filtering.
3. **External email search had no validation.** — FIXED: Format check + deleted account filter.
4. **Deleted/removed users appeared in search.** — FIXED: `estado !== "ativo"` filtered out.
5. **No DM vs Group UX distinction.** — FIXED: Separate dialogs.
6. **No help content.** — FIXED: Help dialog added.
7. **Tutor assignment didn't sync `userTutors`.** — FIXED: All 3 paths now sync.
8. **No deleted account indicator.** — FIXED: "Eliminada" badge shown.

## Completed Checklist

- [x] 1. Audit complete
- [x] 2. Role-based search filtering
  - [x] Teacher: sees all school members
  - [x] Tutor: sees only stage participants
  - [x] Student: sees other students, teachers, admins + own tutors
  - [x] Filter out `estado != ativo`
- [x] 3. External email validation
  - [x] Validate email format
  - [x] No autocomplete for external
  - [x] Separate input from internal search
  - [x] Filter deleted accounts
- [x] 4. Sync `userTutors` index + auto-conversation
  - [x] POST `/api/estagios` path
  - [x] PATCH `/api/estagios/[id]` path
  - [x] Client-side `handleSaveTutorAssignment`
  - [x] Auto 3-way group creation (student + professor + tutor)
- [x] 5. Separate DM vs Group creation
  - [x] DM: simple single-search, quick 1:1
  - [x] Group: multi-select, recent contacts, add external by email
  - [x] Clear labels/distinction
- [x] 6. Role badges in conversation header
  - [x] Role label visible
  - [x] Deleted account indicator
- [x] 7. Help button with modal
  - [x] Explanations for all flows
- [x] 8. Block improvements
  - [x] Unblock option
  - [x] Block state loaded on init
- [x] 9. Firestore rules reinforcement
  - [x] Validate chatAccess creation
- [x] 10. Tests
  - [x] Search eligibility unit tests
  - [x] userTutors RTDB rules tests
  - [x] All existing tests still pass

## UX/UI Improvements (v2)

- [x] 1. Empty state for conversations without messages (icon + "Escreva sua primeira mensagem")
- [x] 2. Role badge (Aluno/Professor/Tutor) in sidebar conversation list
- [x] 3. Spotlight search button (lupa icon) before help button
- [x] 4. Spotlight popup — central search dialog with keyboard navigation
  - [x] Esc and X close the popup
  - [x] Focus auto no input
  - [x] Seta cima/baixo + Enter para navegar/abrir
  - [x] Abre conversa existente ou cria nova diretamente

## Pending
- `api/chat/system-message` route (server-side)
- School admin estagio management pages
- Group conversation name editing
- `userTutors` cleanup on tutor removal
