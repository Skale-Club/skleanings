---
phase: 24-manual-confirmation-flow-per-service
plan: "01"
subsystem: schema
tags: [schema, migration, services, confirmation-flow]
dependency_graph:
  requires: []
  provides: [services.requiresConfirmation, migration-20260510000003]
  affects: [shared/schema.ts, Service type]
tech_stack:
  added: []
  patterns: [drizzle-boolean-column, supabase-migration-IF-NOT-EXISTS]
key_files:
  created:
    - supabase/migrations/20260510000003_add_service_requires_confirmation.sql
  modified:
    - shared/schema.ts
decisions:
  - requiresConfirmation added as NOT NULL with default false — safe for existing rows, no backfill needed
  - IF NOT EXISTS in SQL migration ensures re-run safety
  - No SQL enum change required — bookings.status is a text column; awaiting_approval validated at app layer
metrics:
  duration: 76s
  completed: "2026-05-10"
  tasks_completed: 2
  files_changed: 2
---

# Phase 24 Plan 01: Schema — requiresConfirmation on services table Summary

**One-liner:** Added `requiresConfirmation` boolean column (default false, NOT NULL) to the services table via Drizzle schema and Supabase migration, enabling the manual booking approval flow.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write Supabase migration for requires_confirmation column | 66bfd52 | supabase/migrations/20260510000003_add_service_requires_confirmation.sql |
| 2 | Add requiresConfirmation to Drizzle services table in shared/schema.ts | 66bfd52 | shared/schema.ts |

## What Was Built

- **Migration file** `supabase/migrations/20260510000003_add_service_requires_confirmation.sql`: ALTER TABLE using `ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN NOT NULL DEFAULT false` — idempotent and safe to re-run.
- **Drizzle schema** `shared/schema.ts`: `requiresConfirmation: boolean("requires_confirmation").default(false).notNull()` added as the last column in the `services` pgTable definition, immediately after `timeSlotInterval`.
- **Type propagation**: `Service` type (via `typeof services.$inferSelect`) and `insertServiceSchema` (via `createInsertSchema`) automatically include the new field — no manual type changes needed.
- `npm run check` passes with no TypeScript errors.

## Decisions Made

- `requiresConfirmation` is NOT NULL with default false — existing service rows in the database automatically get false without any backfill, and new services default to not requiring confirmation.
- No bookings table changes: `bookings.status` is already a `text` column (not a PostgreSQL enum), so `awaiting_approval` is a valid string accepted at the code level with no SQL migration needed.
- `IF NOT EXISTS` guards the migration from errors on re-run (idempotent pattern matching Phase 21 precedent).

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: supabase/migrations/20260510000003_add_service_requires_confirmation.sql
- FOUND: shared/schema.ts with requiresConfirmation column
- FOUND: commit 66bfd52
