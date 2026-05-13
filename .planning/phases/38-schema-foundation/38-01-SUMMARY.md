---
phase: 38-schema-foundation
plan: 01
subsystem: database
tags: [postgres, supabase, migrations, multi-tenant, sql]

# Dependency graph
requires: []
provides:
  - tenants global registry table (id, name, slug, status, created_at, updated_at)
  - domains global registry table with tenant_id FK and unique hostname constraint
  - user_tenants join table with composite PK (user_id text, tenant_id integer)
  - tenant_id integer NOT NULL DEFAULT 1 column on all 40 business tables
  - Idempotent migration pair safe to run multiple times
affects: [39-storage-refactor, 40-tenant-resolution-middleware]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Supabase CLI migration pair (DDL + seed) for multi-tenant schema bootstrap
    - DO $$ FOREACH loop with IF EXISTS guard for idempotent ALTER TABLE across N tables
    - ON CONFLICT (id) DO NOTHING + setval() pattern for deterministic seed inserts

key-files:
  created:
    - supabase/migrations/20260515000000_phase38_multi_tenant_foundation.sql
    - supabase/migrations/20260515000001_phase38_seed_skleanings_tenant.sql
  modified: []

key-decisions:
  - "user_tenants.user_id is text NOT NULL (not integer/uuid column type) because users.id is stored as text UUID string"
  - "Business table tenant_id FKs omit ON DELETE — default RESTRICT prevents accidental tenant deletion; registry table FKs use ON DELETE CASCADE"
  - "NOT NULL DEFAULT 1 in a single ADD COLUMN statement fills existing rows atomically — no separate UPDATE required"
  - "sessions table intentionally excluded from tenant_id scope (infra table, not tenant data)"
  - "setval() in seed migration advances serial sequence past id=1 to prevent unique constraint failure on future auto-increment inserts"

patterns-established:
  - "Idempotent migration: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS + ON CONFLICT DO NOTHING"
  - "DO $$ FOREACH loop with information_schema.tables guard tolerates tables absent in some environments (schema drift safety)"

requirements-completed: [MT-01, MT-02, MT-03, MT-04, MT-05]

# Metrics
duration: 2min
completed: 2026-05-13
---

# Phase 38 Plan 01: Schema Foundation Summary

**Idempotent Supabase CLI migration pair creating tenants/domains/user_tenants registry tables and adding tenant_id integer NOT NULL DEFAULT 1 to all 40 business tables via a DO $$ FOREACH loop**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-13T19:40:21Z
- **Completed:** 2026-05-13T19:42:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- DDL migration creates three global registry tables (tenants, domains, user_tenants) with proper FKs, indexes, and IF NOT EXISTS guards
- FOREACH loop adds tenant_id integer NOT NULL DEFAULT 1 REFERENCES tenants(id) to all 40 business tables with per-table existence check
- Seed migration inserts Skleanings (id=1) and localhost domain idempotently with serial sequence advancement to prevent future insert conflicts
- TypeScript check passes — SQL-only changes, no application code touched

## Task Commits

Each task was committed atomically:

1. **Task 1: DDL migration — registry tables + tenant_id on all 40 business tables** - `7f3dd69` (feat)
2. **Task 2: Seed migration — Skleanings tenant (id=1) and localhost domain** - `f954168` (feat)

**Plan metadata:** (pending — docs commit)

## Files Created/Modified
- `supabase/migrations/20260515000000_phase38_multi_tenant_foundation.sql` - DDL: tenants, domains, user_tenants tables + tenant_id on 40 tables
- `supabase/migrations/20260515000001_phase38_seed_skleanings_tenant.sql` - Seed: tenant id=1, localhost domain, serial sequence advance

## Decisions Made
- user_tenants.user_id declared as `text NOT NULL REFERENCES users(id)` because users.id is stored as text UUID string, not integer
- Business table tenant_id FKs omit ON DELETE (default RESTRICT) — tenants must not be casually deleted; registry table FKs use ON DELETE CASCADE
- sessions table intentionally excluded (infra table, not tenant data)
- setval() call in seed migration ensures the tenants serial sequence is advanced past id=1 before any future auto-increment insert runs

## Deviations from Plan

None - plan executed exactly as written. `supabase db push` not run per orchestrator instruction (requires live DB connection — human action).

## Issues Encountered
None.

## User Setup Required

**`supabase db push` required before Phase 39 begins.** Run from project root:

```bash
supabase db push
```

Then verify:
```bash
supabase db execute --sql "SELECT id, slug, name, status FROM tenants WHERE id = 1;"
supabase db execute --sql "SELECT tenant_id, hostname, is_primary FROM domains WHERE hostname = 'localhost';"
supabase db execute --sql "SELECT column_name FROM information_schema.columns WHERE column_name = 'tenant_id' AND table_schema = 'public' ORDER BY table_name;"
```

Expected: 40 rows from the third query (one per business table).

## Next Phase Readiness
- Phase 39 (Storage Refactor) can begin once `supabase db push` is applied to the live DB
- All 40 business tables will have tenant_id available for per-tenant query isolation
- Blocker: supabase db push (human action) must complete before Phase 39 storage queries can use tenant_id

---
*Phase: 38-schema-foundation*
*Completed: 2026-05-13*
