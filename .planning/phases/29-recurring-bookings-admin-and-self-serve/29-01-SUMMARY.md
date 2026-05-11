---
phase: 29-recurring-bookings-admin-and-self-serve
plan: "01"
subsystem: recurring-bookings
tags: [schema, storage, migration, recurring, uuid, self-serve]
dependency_graph:
  requires: [phase-27-recurring-bookings-foundation, phase-28-recurring-email-reminders]
  provides: [manage_token-column, getRecurringBookingByToken, getRecurringBookingsWithDetails]
  affects: [server/storage.ts, shared/schema.ts, supabase/migrations]
tech_stack:
  added: []
  patterns: [drizzle-uuid-default, drizzle-join-select, supabase-cli-migration]
key_files:
  created:
    - supabase/migrations/20260511000005_add_manage_token_to_recurring_bookings.sql
  modified:
    - shared/schema.ts
    - server/storage.ts
decisions:
  - manageToken uses uuid() Drizzle type with sql`gen_random_uuid()` default to match migration
  - manageToken added to insertRecurringBookingSchema omit list — always DB-generated, never set by callers
  - getRecurringBookingsWithDetails uses explicit column select (not spread) to satisfy Drizzle join result type
  - Phase 28 files (recurringBookings schema, storage, routes, services) synced into worktree before adding Phase 29 changes
metrics:
  completed_date: "2026-05-11"
  tasks_completed: 3
  files_changed: 3
---

# Phase 29 Plan 01: Recurring Bookings — manage_token Column and Storage Foundation Summary

## One-liner

Added manage_token UUID column to recurring_bookings via Supabase migration, mirrored in Drizzle schema with RecurringBookingWithDetails interface, and extended storage with getRecurringBookingByToken + getRecurringBookingsWithDetails JOIN query.

## What Was Built

**Task 1 — Migration:** Created `supabase/migrations/20260511000005_add_manage_token_to_recurring_bookings.sql` with:
- `ALTER TABLE recurring_bookings ADD COLUMN IF NOT EXISTS manage_token UUID NOT NULL DEFAULT gen_random_uuid()`
- `CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_bookings_manage_token`
- Backfill `UPDATE recurring_bookings SET manage_token = gen_random_uuid() WHERE manage_token IS NULL`

**Task 2 — Schema:** Updated `shared/schema.ts`:
- Added `manageToken: uuid("manage_token").notNull().default(sql\`gen_random_uuid()\`)` to recurringBookings table
- Added `manageToken: true` to `insertRecurringBookingSchema` omit list
- Exported new `RecurringBookingWithDetails` interface extending `RecurringBooking` with `contactName`, `serviceName`, `customerEmail` fields

**Task 3 — Storage:** Updated `server/storage.ts`:
- Imported `RecurringBookingWithDetails` from `@shared/schema`
- Declared `getRecurringBookingByToken(token: string)` and `getRecurringBookingsWithDetails()` in IStorage interface
- Implemented both methods in DatabaseStorage: token lookup by `manage_token` column; details query with `leftJoin(contacts)` + `innerJoin(services)` ordered by `createdAt DESC`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Phase 28 files missing from worktree**
- **Found during:** Task 1 — attempted TypeScript check and found `recurringBookings` table not in schema.ts
- **Issue:** Worktree branch was based on phase 24 commit `04d0b90`, missing phases 25-28 work (recurringBookings table, storage methods, routes, services, lib files)
- **Fix:** Copied shared/schema.ts, server/storage.ts, server/routes.ts, server/routes/bookings.ts, server/routes/recurring-bookings.ts, server/services/recurring-booking-generator.ts, server/services/recurring-booking-reminder.ts, server/services/cron.ts, server/lib/date-utils.ts, server/lib/email.ts, server/lib/email-templates.ts from main branch (phase 29 state) into worktree before applying plan changes
- **Files modified:** 11 files synced
- **Commit:** fa26c79

## Commits

| Commit | Message | Task |
|--------|---------|------|
| fa26c79 | chore(29-01): sync phase 28 foundation — recurringBookings schema, storage, routes, and services | pre-req sync |
| 2c1e4b2 | chore(29-01): add manage_token migration for recurring_bookings | Task 1 |
| b2e4fa0 | feat(29-01): add manageToken column and RecurringBookingWithDetails to schema | Task 2 |
| dc5831c | feat(29-01): add getRecurringBookingByToken and getRecurringBookingsWithDetails to storage | Task 3 |

## Known Stubs

None. All deliverables are functional foundation code (migration SQL, schema column, storage methods) — no UI stubs or placeholder data.

## Self-Check: PASSED

- [x] `supabase/migrations/20260511000005_add_manage_token_to_recurring_bookings.sql` exists
- [x] `shared/schema.ts` contains `manageToken` (column def + omit) and `RecurringBookingWithDetails` interface
- [x] `server/storage.ts` has 4 matches for the two methods (2 interface + 2 impl)
- [x] `npm run check` exits 0
