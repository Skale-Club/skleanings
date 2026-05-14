---
phase: 47-password-reset
plan: 01
subsystem: database
tags: [postgres, drizzle, supabase, password-reset, storage]

# Dependency graph
requires:
  - phase: 43-tenant-provisioning
    provides: password column on users table (nullable bcrypt hash)
  - phase: 38-schema-foundation
    provides: multi-tenant users table with tenantId FK
provides:
  - Supabase migration creating password_reset_tokens table
  - Drizzle schema declaration for passwordResetTokens table
  - IStorage interface methods for password reset token CRUD
  - DatabaseStorage implementation of all four methods
affects: [47-02, 47-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Password reset tokens store SHA-256 hash only — raw token never persisted"
    - "findPasswordResetToken is global (no tenantId filter); token user_id FK provides scoping"
    - "updateUserPassword is tenant-scoped via this.tenantId to prevent cross-tenant writes"

key-files:
  created:
    - supabase/migrations/20260516000000_phase47_password_reset_tokens.sql
  modified:
    - shared/schema.ts
    - server/storage.ts

key-decisions:
  - "password_reset_tokens has no tenant_id column — user_id FK is sufficient scope"
  - "findPasswordResetToken is NOT tenant-scoped; token hash is globally unique (UNIQUE constraint)"
  - "updateUserPassword IS tenant-scoped to prevent cross-tenant password writes"
  - "Token table uses plain timestamp (no withTimezone) consistent with rest of schema.ts"

patterns-established:
  - "Phase 47 token security: hash-only storage for single-use tokens"

requirements-completed: [PR-01, PR-02, PR-03]

# Metrics
duration: 3min
completed: 2026-05-14
---

# Phase 47 Plan 01: Password Reset Tokens Data Layer Summary

**SHA-256 hash-only password_reset_tokens table in Supabase plus Drizzle schema and four IStorage methods (create/find/markUsed/updatePassword)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-14T13:34:13Z
- **Completed:** 2026-05-14T13:37:30Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Created and applied Supabase migration for password_reset_tokens table (id, user_id FK with CASCADE, token_hash UNIQUE, expires_at, used_at) plus two indexes
- Added Drizzle pgTable declaration with type exports in shared/schema.ts
- Extended IStorage interface with createPasswordResetToken, findPasswordResetToken, markPasswordResetTokenUsed, updateUserPassword
- Implemented all four methods in DatabaseStorage with correct tenant scoping decisions

## Task Commits

Each task was committed atomically:

1. **Task 1: Supabase migration for password_reset_tokens** - `cf4b2dd` (chore)
2. **Task 2: Drizzle schema declaration for passwordResetTokens** - `bb2f884` (feat)
3. **Task 3: IStorage interface extension + DatabaseStorage implementation** - `2a98436` (feat)

## Files Created/Modified
- `supabase/migrations/20260516000000_phase47_password_reset_tokens.sql` - DDL for password_reset_tokens table with indexes; applied to remote Supabase DB
- `shared/schema.ts` - passwordResetTokens pgTable declaration plus PasswordResetToken and InsertPasswordResetToken types
- `server/storage.ts` - imports for new table/types, 4 IStorage method signatures, 4 DatabaseStorage method implementations

## Decisions Made
- `findPasswordResetToken` does NOT filter by tenantId — the UNIQUE token_hash already uniquely identifies the token globally, and token table has no tenant_id column
- `updateUserPassword` DOES filter by `this.tenantId` — prevents a compromised token from resetting a user's password in a different tenant
- Used plain `timestamp` (not `withTimezone`) for expiresAt and usedAt — consistent with all other timestamp columns in shared/schema.ts
- No InsertPasswordResetToken usage in storage.ts (values inlined in insert call) — type still exported for possible future route-layer use

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Supabase CLI not in PATH (bash); resolved by running `npx supabase db push` with SUPABASE_DB_PASSWORD env var extracted from DATABASE_URL — migration applied successfully

## User Setup Required
None - no external service configuration required beyond the DB migration already applied.

## Next Phase Readiness
- Data layer is complete and type-safe
- Plan 47-02 can import and call all four storage methods to implement forgot-password and reset-password API routes
- npm run check passes with zero TypeScript errors

---
*Phase: 47-password-reset*
*Completed: 2026-05-14*
