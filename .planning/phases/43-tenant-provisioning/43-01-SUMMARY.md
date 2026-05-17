---
phase: 43-tenant-provisioning
plan: 01
subsystem: database
tags: [postgres, drizzle, bcrypt, multi-tenant, supabase]

# Dependency graph
requires:
  - phase: 42-tenant-management-ui
    provides: tenants/domains tables and global registry pattern in DatabaseStorage
  - phase: 39-storage-refactor
    provides: DatabaseStorage.forTenant() factory and IStorage interface
provides:
  - Nullable password column migration for users table (20260515000002)
  - password field on users Drizzle schema
  - IStorage.provisionTenantAdmin method declaration
  - IStorage.seedTenantCompanySettings method declaration
  - DatabaseStorage.provisionTenantAdmin: atomic users + user_tenants insert via db.transaction
  - DatabaseStorage.seedTenantCompanySettings: idempotent companySettings seed via onConflictDoNothing
affects: [43-02, 44-isolation-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global registry methods on DatabaseStorage use db directly (no this.tenantId) — provisioning is cross-tenant by design"
    - "crypto.randomUUID() as global (Node 18+) — no import needed"
    - "onConflictDoNothing for idempotent companySettings seed"

key-files:
  created:
    - supabase/migrations/20260515000002_phase43_users_password.sql
  modified:
    - shared/schema.ts
    - server/storage.ts

key-decisions:
  - "password column is nullable — OAuth-only users never have a password; only provisioned tenant admins do"
  - "provisionTenantAdmin uses db.transaction (not this.tenantId) — global registry operation, cross-tenant by design"
  - "seedTenantCompanySettings uses onConflictDoNothing for idempotency — safe to call multiple times"
  - "crypto.randomUUID() used as global (Node 18+) — no import statement required"

patterns-established:
  - "Global registry provisioning methods use db directly (not this.tenantId) — same pattern as createTenant, addDomain"

requirements-completed: [TO-05, TO-06]

# Metrics
duration: 10min
completed: 2026-05-14
---

# Phase 43 Plan 01: Tenant Provisioning Foundation Summary

**Nullable password column migration + provisionTenantAdmin/seedTenantCompanySettings storage methods enabling atomic tenant admin creation via db.transaction**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-14T01:10:00Z
- **Completed:** 2026-05-14T01:20:54Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created Supabase migration adding nullable `password text` column to users table (not yet applied — pending manual supabase db push)
- Added `password` field to users pgTable in shared/schema.ts with bcrypt hash comment
- Added `userTenants` import to server/storage.ts
- Declared `provisionTenantAdmin` and `seedTenantCompanySettings` in IStorage interface
- Implemented both methods in DatabaseStorage: atomic transaction for user provisioning, onConflictDoNothing for idempotent settings seed
- TypeScript check passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration — add password column to users** - `0a6b3b3` (chore)
2. **Task 2: Schema update + IStorage + DatabaseStorage implementations** - `1e579f1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `supabase/migrations/20260515000002_phase43_users_password.sql` - ALTER TABLE users ADD COLUMN IF NOT EXISTS password text
- `shared/schema.ts` - password field added to users pgTable definition
- `server/storage.ts` - userTenants import, IStorage interface additions, DatabaseStorage method implementations

## Decisions Made
- password column is nullable — OAuth-only users (Supabase auth) never have a password hash; only provisioned tenant admins do
- provisionTenantAdmin uses db directly (not this.tenantId) — global registry pattern, cross-tenant by design, same as createTenant/addDomain
- crypto.randomUUID() used as global in Node 18+ — no import statement required

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added userTenants import to server/storage.ts**
- **Found during:** Task 2 (IStorage + DatabaseStorage implementations)
- **Issue:** Plan said to verify userTenants was imported; it was not present in storage.ts imports
- **Fix:** Added userTenants to the destructured import from @shared/schema
- **Files modified:** server/storage.ts
- **Verification:** TypeScript check passes (npm run check exits 0)
- **Committed in:** 1e579f1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (missing import — Rule 2)
**Impact on plan:** Required for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the missing userTenants import (auto-fixed per Rule 2).

## User Setup Required
**MIGRATION PENDING** — `supabase db push` must be run to apply `20260515000002_phase43_users_password.sql` to the live database. This is a pre-existing pending item in STATE.md along with Phase 38 migrations.

## Next Phase Readiness
- Plan 43-02 can now call `storage.provisionTenantAdmin()` and `storage.seedTenantCompanySettings()` from route handlers
- Both methods are fully typed and TypeScript-verified
- Migration file is ready for `supabase db push` when the pending Phase 38 migrations are also applied

---
*Phase: 43-tenant-provisioning*
*Completed: 2026-05-14*
