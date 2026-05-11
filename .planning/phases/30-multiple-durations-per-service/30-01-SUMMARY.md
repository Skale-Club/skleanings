---
phase: 30-multiple-durations-per-service
plan: "01"
subsystem: schema
tags: [migration, drizzle, schema, zod, duration]
dependency_graph:
  requires: []
  provides: [booking_items.duration_label, booking_items.duration_minutes, recurring_bookings.duration_minutes, cartItemSchema.selectedDurationId]
  affects: [server/routes/bookings.ts, client/src/context/CartContext.tsx]
tech_stack:
  added: []
  patterns: [drizzle-table-definition, supabase-migration, zod-schema-extension]
key_files:
  created:
    - supabase/migrations/20260511000006_add_duration_snapshot_columns.sql
  modified:
    - shared/schema.ts
    - server/storage.ts
decisions:
  - "recurringBookings.durationMinutes is nullable (null = use catalog default) — safe fallback for all pre-Phase 30 subscription rows"
  - "getRecurringBookingsWithDetails select list extended to include durationMinutes — required to satisfy RecurringBookingWithDetails type after schema update"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-11"
  tasks_completed: 2
  files_changed: 3
---

# Phase 30 Plan 01: Duration Snapshot Schema Foundation Summary

Duration snapshot columns added to `booking_items` and `recurring_bookings` via Supabase migration; `cartItemSchema` extended with `selectedDurationId` so Zod no longer silently strips the field.

## What Was Built

- **Migration** `20260511000006_add_duration_snapshot_columns.sql`: adds `duration_label TEXT` and `duration_minutes INTEGER` (both nullable) to `public.booking_items`, and `duration_minutes INTEGER` (nullable) to `public.recurring_bookings`.
- **Drizzle table definitions** in `shared/schema.ts`: `bookingItems` now declares `durationLabel` and `durationMinutes`; `recurringBookings` now declares `durationMinutes`.
- **cartItemSchema** in `shared/schema.ts`: `selectedDurationId: z.number().optional()` added — without this, Zod's `parse` strips the field before it reaches the booking route.
- **TypeScript** passes `npm run check` with exit code 0.

## Commits

| Hash | Message |
|------|---------|
| a68e41e | feat(30-01): add duration snapshot columns migration |
| 6bc4d87 | feat(30-01): update schema.ts with duration columns and cartItemSchema |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing durationMinutes in getRecurringBookingsWithDetails select**
- **Found during:** Task 2 (npm run check)
- **Issue:** Adding `durationMinutes` to the `recurringBookings` Drizzle table definition caused `RecurringBookingWithDetails` (which extends `RecurringBooking`) to require the field. The `getRecurringBookingsWithDetails` method in `server/storage.ts` uses an explicit column select list that did not include `durationMinutes`, causing a TS2322 error.
- **Fix:** Added `durationMinutes: recurringBookings.durationMinutes` to the select clause in `getRecurringBookingsWithDetails`.
- **Files modified:** `server/storage.ts`
- **Commit:** 6bc4d87

**2. [Note] recurring_bookings table not yet in DB**
- The `recurring_bookings` table does not exist in the remote DB (Phase 29 migrations `20260511000000`–`20260511000005` are pending). The `booking_items` columns were applied successfully. The `ALTER TABLE recurring_bookings ADD COLUMN` in migration `20260511000006` will execute correctly when Phase 29 migrations are applied (which create the table first). The `IF NOT EXISTS` guard ensures idempotent re-run safety.

## Known Stubs

None. The schema foundation is complete. Downstream plans (30-02, 30-03) wire the data flow through the booking route and CartContext.

## Self-Check: PASSED

- `supabase/migrations/20260511000006_add_duration_snapshot_columns.sql` — exists
- Commits a68e41e and 6bc4d87 — verified in git log
- `grep -n "durationLabel" shared/schema.ts` — returns line 505
- `grep -n "selectedDurationId" shared/schema.ts` — returns line 552
- `npm run check` — exits 0
