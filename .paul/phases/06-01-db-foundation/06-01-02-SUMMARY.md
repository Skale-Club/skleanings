---
phase: 06-01-db-foundation
plan: 02
subsystem: auth
tags: [postgres, drizzle, roles, users, staff, auth]

requires:
  - phase: 06-01-01
    provides: contacts table + UserRole type (imported from schema)
provides:
  - users.role field ('admin' | 'staff' | 'viewer', default 'viewer')
  - staffMembers.userId FK linking staff to user accounts
  - updateUserRole + linkStaffToUser storage methods
  - GET /api/me endpoint returning role + staffMemberId
  - Migration SQL for both columns
affects:
  - 06-04-staff-roles (builds role-scoped middleware on top of this foundation)

tech-stack:
  added: []
  patterns:
    - /api/me: standard identity endpoint — email → dbUser → linked staff lookup

key-files:
  created:
    - supabase/migrations/20260409100000_add_user_role_staff_userid.sql
  modified:
    - shared/schema.ts
    - server/storage.ts
    - server/routes/auth-routes.ts
    - client/src/components/admin/StaffSection.tsx

key-decisions:
  - "getUserByEmail already existed — only added updateUserRole + linkStaffToUser"
  - "/api/me placed in auth-routes.ts (mounted at /api) — cleanest fit given existing structure"
  - "isAdmin kept as-is — not removed for backward compat"

patterns-established:
  - "Role system: text column with default 'viewer' — no enum, easy to extend"

duration: ~10min
started: 2026-04-09T00:00:00Z
completed: 2026-04-09T00:00:00Z
---

# Phase 1 Plan 02: users.role + staffMembers.userId + /api/me

**Role field on users, userId FK on staffMembers, and `/api/me` endpoint — schema foundation for Phase 4 staff-scoped access.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10 min |
| Tasks | 4 of 4 completed |
| Files modified | 5 |
| TypeScript errors | 0 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: users.role in schema | Pass | text, default 'viewer', not null |
| AC-2: staffMembers.userId in schema | Pass | text nullable FK → users.id |
| AC-3: /api/me returns role + staffMemberId | Pass | Added to auth-routes.ts at GET /api/me |
| AC-4: requireAdmin unchanged | Pass | No changes to auth.ts — ADMIN_EMAIL logic untouched |
| AC-5: Migration adds columns without data loss | Pass | SQL created, ready to apply |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `shared/schema.ts` | Modified | Added `users.role`, `staffMembers.userId`, extended `insertStaffMemberSchema` |
| `server/storage.ts` | Modified | Added `UserRole` import, `updateUserRole` + `linkStaffToUser` to interface + DatabaseStorage |
| `server/routes/auth-routes.ts` | Modified | Added `GET /api/me` route with requireAdmin guard |
| `client/src/components/admin/StaffSection.tsx` | Modified | Excluded `userId` from createStaff mutation type |
| `supabase/migrations/20260409100000_add_user_role_staff_userid.sql` | Created | Adds role + user_id columns |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `/api/me` in auth-routes.ts | Mounted at `/api` — cleaner than adding to user-routes (mounted at `/api/users`) | Accessible at `/api/me` as intended |
| `getUserByEmail` already existed | Pre-existing implementation — only added updateUserRole + linkStaffToUser | No duplication |
| `insertStaffMemberSchema` extended with optional userId | Prevents TS error in StaffSection.tsx form — form doesn't supply userId | Staff creation form unaffected |

## Deviations from Plan

| Type | Detail |
|------|--------|
| Auto-fix | `StaffSection.tsx` mutation type updated (`Omit` extended with `userId`) — TypeScript error surfaced by adding `userId` to `StaffMember` type |
| Scope reduction | `getUserByEmail` was already in IStorage + DatabaseStorage — skipped re-implementation |

## Next Phase Readiness

**Ready:**
- Phase 1 DB Foundation complete — both migrations ready to apply
- `contacts`, `users.role`, `staffMembers.userId` all in schema + storage
- `/api/me` available for frontend role-aware routing (Phase 4)

**Blockers:**
- Run `npx supabase db push` to apply both migrations before testing

---
*Phase: 06-01-db-foundation, Plan: 02*
*Completed: 2026-04-09*
