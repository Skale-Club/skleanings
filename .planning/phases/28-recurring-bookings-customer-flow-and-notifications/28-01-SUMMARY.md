---
phase: 28-recurring-bookings-customer-flow-and-notifications
plan: "01"
subsystem: recurring-bookings
tags: [recurring-bookings, schema, storage, booking-flow, ui, drizzle, migration]
dependency_graph:
  requires: [recurring_bookings-table, RecurringBooking-types, bookings.recurringBookingId, IStorage-recurring-methods]
  provides: [intervalDays-on-serviceFrequencies, frequency-selector-UI, recurring-subscription-creation, advanceDate-shared-util]
  affects: [shared/schema.ts, server/storage.ts, server/routes/bookings.ts, client/src/pages/BookingPage.tsx]
tech_stack:
  added: []
  patterns: [drizzle-pgTable, useQuery-frequencies, useState-selectedFrequencyId, non-fatal-try-catch]
key_files:
  created:
    - supabase/migrations/20260511000003_add_recurring_bookings.sql
    - supabase/migrations/20260511000004_add_interval_days_to_service_frequencies.sql
    - server/lib/date-utils.ts
    - server/services/recurring-booking-generator.ts
  modified:
    - shared/schema.ts
    - server/storage.ts
    - server/routes/bookings.ts
    - client/src/pages/BookingPage.tsx
decisions:
  - "Phase 27 schema prerequisites (recurringBookings table, recurringBookingId on bookings) added in this worktree since dev branch changes were not present"
  - "Generator created directly with Phase 28 fix (real contact data) rather than placeholder-then-fix pattern"
  - "selectedFrequencyId threaded into cartItems[0] only; multi-service carts show no frequency selector (single-service only)"
  - "Recurring subscription creation is non-fatal — booking succeeds even if subscription creation fails"
  - "advanceDate extracted to server/lib/date-utils.ts for shared use by both generator and booking route"
  - "intervalDays uses NOT NULL DEFAULT 7 with backfill UPDATEs for week/bi/month name patterns"
metrics:
  duration: "45 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 8
---

# Phase 28 Plan 01: Recurring Bookings Customer Flow and intervalDays Foundation Summary

JWT-less recurring subscription checkout — frequency selector in step 3 sidebar creates a recurringBookings row with real contact data and intervalDays derived from the service_frequencies table.

## What Was Built

**Migration SQL** (`supabase/migrations/20260511000003_add_recurring_bookings.sql`):
- `CREATE TABLE recurring_bookings` with all required columns, status check constraint, indexes
- `ALTER TABLE bookings ADD COLUMN recurring_booking_id` nullable FK referencing recurring_bookings
- `CREATE UNIQUE INDEX idx_bookings_recurring_date_unique` partial index to prevent duplicate cron generation

**Migration SQL** (`supabase/migrations/20260511000004_add_interval_days_to_service_frequencies.sql`):
- `ALTER TABLE service_frequencies ADD COLUMN IF NOT EXISTS interval_days INTEGER NOT NULL DEFAULT 7`
- Backfill UPDATEs for week/bi/month name patterns

**Schema changes** (`shared/schema.ts`):
- `serviceFrequencies` table gets `intervalDays: integer("interval_days").notNull().default(7)`
- `recurringBookings` pgTable defined before `bookings` (required ordering for Drizzle FK)
- `insertRecurringBookingSchema`, `RecurringBooking`, `InsertRecurringBooking` exported
- `recurringBookingId` nullable FK column added to `bookings` table

**Shared date utility** (`server/lib/date-utils.ts`):
- Exports `advanceDate(currentDate, intervalDays)` — monthly uses calendar-month addition with end-of-month clamping; weekly/biweekly uses simple day addition

**Storage additions** (`server/storage.ts`):
- `getServiceFrequency(id)` added to IStorage interface and DatabaseStorage
- 5 recurring booking methods added: `createRecurringBooking`, `getRecurringBooking`, `getRecurringBookings`, `getActiveRecurringBookingsDueForGeneration`, `updateRecurringBooking`
- Imports for `recurringBookings`, `RecurringBooking`, `InsertRecurringBooking`, `insertRecurringBookingSchema`

**Recurring booking generator** (`server/services/recurring-booking-generator.ts`):
- `runRecurringBookingGeneration()` with atomic transaction per subscription
- Uses `advanceDate` from shared lib
- Phase 28 fix applied: uses real contact data (`contact?.name`, `contact?.phone`, `contact?.address`)

**BookingPage UI** (`client/src/pages/BookingPage.tsx`):
- `selectedFrequencyId` state (null = one-time, number = frequency ID)
- `useQuery` fetching `/api/services/:id/frequencies` for single-service carts only
- Frequency selector rendered in step 3 sidebar after date+time selected (frequencies.length > 0)
- `selectedFrequencyId` threaded into `cartItems[0]` in `onSubmit` payload

**Booking route** (`server/routes/bookings.ts`):
- After contact upsert: reads `validatedData.cartItems?.[0]?.selectedFrequencyId`
- Looks up frequency via `storage.getServiceFrequency(rawFrequencyId)`
- Creates `recurringBookings` row via `storage.createRecurringBooking`
- Links booking back via `storage.updateBooking(booking.id, { recurringBookingId: sub.id })`
- Entire block is non-fatal (try/catch — booking always succeeds)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Migration + schema + date-utils + storage | 403f80d | feat(28-01): migration, schema, date-utils, storage — recurring booking foundation + intervalDays |
| Task 2: Frequency selector UI + booking route | 15082b0 | feat(28-01): frequency selector UI + recurring subscription creation in POST /api/bookings |

## Deviations from Plan

**1. [Rule 3 - Blocking] Added Phase 27 schema prerequisites into this plan**
- **Found during:** Task 1 start
- **Issue:** This worktree branch is based on commit before Phase 27 was merged to dev. The `recurringBookings` table, storage methods, and cron generator were all missing.
- **Fix:** Created `supabase/migrations/20260511000003_add_recurring_bookings.sql`, added recurringBookings Drizzle table + types to schema.ts, added all 5 IStorage recurring booking methods with implementations, and created the generator service — all as prerequisites required for Phase 28 to compile.
- **Additional fix:** Generator created with Phase 28's real-contact-data fix already applied (no placeholder strings), so Phase 28 plan 01 objective is fully met.
- **Files modified:** supabase/migrations/20260511000003_add_recurring_bookings.sql, shared/schema.ts (recurringBookings + recurringBookingId), server/storage.ts (imports + interface + implementations), server/services/recurring-booking-generator.ts

## Known Stubs

None. All data paths are wired:
- Frequency selector fetches real frequencies from `/api/services/:id/frequencies`
- `selectedFrequencyId` flows from UI state → cartItems[0] → POST body → booking route
- Booking route creates real `recurringBookings` DB rows when frequency is selected
- Generator uses real contact data (not placeholders)

## Self-Check: PASSED

- [x] `supabase/migrations/20260511000003_add_recurring_bookings.sql` exists
- [x] `supabase/migrations/20260511000004_add_interval_days_to_service_frequencies.sql` exists
- [x] `grep -c "intervalDays" shared/schema.ts` returns 2 (serviceFrequencies + recurringBookings)
- [x] `grep -n "export const recurringBookings"` appears before `export const bookings`
- [x] `grep -n "advanceDate" server/lib/date-utils.ts` shows exported function
- [x] `grep -n "import.*date-utils" server/services/recurring-booking-generator.ts` shows import
- [x] `grep -n "contact?.name" server/services/recurring-booking-generator.ts` shows real data
- [x] `grep -n "selectedFrequencyId" client/src/pages/BookingPage.tsx` shows 4+ occurrences
- [x] `grep -n "createRecurringBooking" server/routes/bookings.ts` shows subscription creation
- [x] `grep -n "getServiceFrequency" server/routes/bookings.ts` shows frequency lookup
- [x] `npm run check` exits 0 — TypeScript clean
- [x] Commits 403f80d and 15082b0 verified in git log
