---
phase: 57-staff-invitation-backend
plan: 01
subsystem: database
tags: [staff-invitations, drizzle, supabase, storage-layer, multi-tenant]

# Dependency graph
requires:
  - phase: 38-multi-tenant-foundation
    provides: tenants table + tenant_id FK pattern
  - phase: 47-password-reset
    provides: token_hash + SHA-256 hashing pattern
  - phase: 55-email-verification
    provides: createEmailVerificationToken pattern (raw token returned, hash persisted)
provides:
  - staff_invitations table (Supabase migration)
  - staffInvitations Drizzle table + StaffInvitation/InsertStaffInvitation types
  - 5 IStorage methods: createStaffInvitation, findStaffInvitation, markInvitationAccepted, revokeStaffInvitation, getPendingInvitations
  - DatabaseStorage implementations for all 5 methods (global registry pattern — uses db directly)
affects: [57-02 invite/validate/accept API routes, 57-03 buildInviteEmail, 58 staff invitation frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global-registry token pattern: tenant_id FK column, methods use db directly (not this.tenantId)"
    - "Token issuance: crypto.randomBytes(32).toString('hex') raw token returned, only SHA-256 hash persisted"
    - "Active-row filter: combined acceptedAt IS NULL + expiresAt > now() in findStaffInvitation"

key-files:
  created:
    - supabase/migrations/20260520000000_phase57_staff_invitations.sql
  modified:
    - shared/schema.ts
    - server/storage.ts

key-decisions:
  - "48-hour expiry for staff invitations (vs 24h for email verification) — invites typically processed asynchronously by the recipient"
  - "tokenHash NOT marked .unique() in Drizzle schema — cryptographic randomness of 256-bit tokens makes collisions infeasible; index handles lookup performance"
  - "Hard delete on revokeStaffInvitation (not soft-delete via revokedAt) — pending invitations are ephemeral; once revoked, the row carries no audit value"
  - "Global-registry pattern: methods use db directly (no this.tenantId scope) so the accept-invite flow can resolve cross-tenant tokens before the requesting context has a tenantId"

patterns-established:
  - "Staff invitation lifecycle: pending (acceptedAt IS NULL, expiresAt > now) → accepted (acceptedAt set) — no separate status column needed"
  - "findStaffInvitation returns StaffInvitation | null (not undefined) to make pending/missing distinction explicit at call sites"

requirements-completed: [SF-02]

# Metrics
duration: 2min
completed: 2026-05-15
---

# Phase 57 Plan 01: Staff Invitation Backend — Storage Foundation Summary

**staff_invitations table (Supabase migration) + Drizzle schema + 5 IStorage methods (create returns raw token, find filters active-only, accept/revoke/list pending) wired through DatabaseStorage**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-15T02:07:22Z
- **Completed:** 2026-05-15T02:09:19Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Supabase migration creates `staff_invitations` table with tenant_id FK, token_hash, expires_at, accepted_at + 2 indexes
- `staffInvitations` Drizzle table mirrors `emailVerificationTokens` pattern with `tenant_id` added (global registry with tenant scope)
- 5 IStorage methods declared and implemented with full type safety
- `createStaffInvitation` generates a 256-bit hex token and persists only the SHA-256 hash (48h expiry)
- `findStaffInvitation` excludes accepted (acceptedAt IS NOT NULL) and expired (expiresAt <= now) rows in a single query
- `npm run check` passes cleanly — no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Supabase migration + Drizzle schema** — `83738d4` (feat)
2. **Task 2: IStorage interface + DatabaseStorage implementation** — `1ca4c41` (feat)

## Files Created/Modified
- `supabase/migrations/20260520000000_phase57_staff_invitations.sql` — DDL for staff_invitations table + 2 indexes (token_hash, tenant_id)
- `shared/schema.ts` — staffInvitations Drizzle table + StaffInvitation/InsertStaffInvitation type exports (inserted between emailVerificationTokens and tenantSubscriptions)
- `server/storage.ts` — staffInvitations import, 5 IStorage method signatures (after signupTenant), 5 DatabaseStorage implementations (after signupTenant impl)

## Decisions Made
- Followed plan exactly as written. Decisions documented in frontmatter `key-decisions` for inheritance by downstream plans.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

**MIGRATION PENDING** — `supabase db push` must be run before plan 02/03 API routes can write to staff_invitations:
```bash
supabase db push
```
This applies `20260520000000_phase57_staff_invitations.sql` to create the table. The Drizzle types compile without the table existing, but runtime queries will fail until the migration is applied.

No environment variables required.

## Next Phase Readiness
- Plan 57-02 (invite + revoke endpoints) can consume `createStaffInvitation`, `getPendingInvitations`, `revokeStaffInvitation` immediately.
- Plan 57-03 (validate + accept endpoints) can consume `findStaffInvitation`, `markInvitationAccepted` immediately.
- Plan 58 (frontend) blocked on plans 02/03 — no direct dependency on this storage plan.

## Self-Check: PASSED

- FOUND: supabase/migrations/20260520000000_phase57_staff_invitations.sql
- FOUND: staffInvitations export in shared/schema.ts (3 references)
- FOUND: createStaffInvitation in server/storage.ts (2 references: interface + impl)
- FOUND: commit 83738d4 (Task 1)
- FOUND: commit 1ca4c41 (Task 2)
- npm run check: PASSED (exit 0, no errors)

---
*Phase: 57-staff-invitation-backend*
*Completed: 2026-05-15*
