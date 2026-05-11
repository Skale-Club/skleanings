---
phase: 27-recurring-bookings-schema-and-cron
plan: "02"
subsystem: database
tags: [recurring-bookings, storage, drizzle, IStorage]

requires:
  - phase: 27-01
    provides: [recurringBookings table, RecurringBooking types, InsertRecurringBooking types]

provides:
  - IStorage interface with 5 recurring-booking method signatures
  - DatabaseStorage implementations for all 5 methods
  - Cron-ready getActiveRecurringBookingsDueForGeneration query with status + date + end_date guards

affects:
  - server/cron (Plan 27-03 calls these storage methods)
  - Phase 29 admin panel

tech-stack:
  added: []
  patterns: [drizzle-select-where-and-lte-isNull, recurring-subscription-data-access]

key-files:
  created: []
  modified:
    - server/storage.ts

key-decisions:
  - "5 methods added to IStorage plus DatabaseStorage — createRecurringBooking, getRecurringBooking, getRecurringBookings, getActiveRecurringBookingsDueForGeneration, updateRecurringBooking"
  - "getActiveRecurringBookingsDueForGeneration uses lte(nextBookingDate, asOfDate) AND (endDate IS NULL OR endDate > nextBookingDate) guard"
  - "updateRecurringBooking always stamps updatedAt: new Date() regardless of what data fields are passed"
  - "Cherry-picked 27-01 schema commits (db83755, 57cca5e) into worktree before implementing storage methods — worktree was on dev branch without main's 27-01 changes"

requirements-completed: [RECUR-01, RECUR-02]

duration: 12min
completed: 2026-05-11
---

# Phase 27 Plan 02: Recurring Bookings Storage Methods Summary

Five IStorage interface methods and DatabaseStorage implementations for recurring booking subscription data access — enabling the Plan 27-03 cron generator and future admin panel.

## Performance

- **Duration:** ~12 minutes
- **Completed:** 2026-05-11
- **Tasks:** 2/2
- **Files modified:** 1 (server/storage.ts)

## Accomplishments

**IStorage interface additions** (server/storage.ts lines 373-377):
- `createRecurringBooking(data: InsertRecurringBooking): Promise<RecurringBooking>` — insert and return new row
- `getRecurringBooking(id: number): Promise<RecurringBooking | undefined>` — fetch single by id
- `getRecurringBookings(statusFilter?: string): Promise<RecurringBooking[]>` — list all or filter by status, ordered by createdAt desc
- `getActiveRecurringBookingsDueForGeneration(asOfDate: string): Promise<RecurringBooking[]>` — cron entry point
- `updateRecurringBooking(id, data): Promise<RecurringBooking>` — update status/date fields, always stamps updatedAt

**DatabaseStorage implementations** (server/storage.ts lines ~1963-2013):
- All 5 methods implemented following existing Drizzle ORM patterns in the class
- `getActiveRecurringBookingsDueForGeneration` filters: `status = 'active'` AND `nextBookingDate <= asOfDate` AND `(endDate IS NULL OR endDate > nextBookingDate)` — prevents expired subscriptions from generating bookings
- `getRecurringBookings` with optional `statusFilter` uses conditional Drizzle where clause

**Import additions**:
- `recurringBookings`, `type RecurringBooking`, `type InsertRecurringBooking`, `insertRecurringBookingSchema` imported from `@shared/schema`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Cherry-pick 27-01 migration | 3f33fd8 | feat(27-01): add recurring_bookings migration SQL |
| Cherry-pick 27-01 schema | 2f35db9 | feat(27-01): add recurringBookings Drizzle table and FK to bookings |
| Task 1: Interface + imports | d27a372 | feat(27-02): add recurring-booking imports and IStorage interface methods |
| Task 2: Implementations | 8c1344f | feat(27-02): implement recurring-booking methods in DatabaseStorage |

## Deviations from Plan

**1. [Rule 3 - Blocking] Cherry-picked 27-01 schema commits into worktree**

- **Found during:** Task 1 setup — `shared/schema.ts` had no `recurringBookings` table
- **Issue:** Worktree is on `dev` branch; 27-01 schema changes were only on `main` branch
- **Fix:** Cherry-picked commits `db83755` (migration SQL) and `57cca5e` (schema types) from main into the worktree
- **Files modified:** `shared/schema.ts`, `supabase/migrations/20260511000003_add_recurring_bookings.sql`
- **Commits:** 3f33fd8, 2f35db9

## Known Stubs

None. This plan is a pure storage/data-access layer plan. No UI or data flows are wired.

## Self-Check: PASSED

- [x] `grep -c "recurringBookings," server/storage.ts` — returns 1 (import line)
- [x] `grep "type RecurringBooking," server/storage.ts` — returns match
- [x] 5 methods in IStorage interface (lines 373-377)
- [x] 5 async methods in DatabaseStorage (grep count = 5)
- [x] `grep "getActiveRecurringBookingsDueForGeneration" server/storage.ts` — returns 2 matches (interface + implementation)
- [x] `npm run check` — only pre-existing errors in server/index.ts (express-rate-limit types, untyped params); no new errors from this plan
- [x] `grep -c "RecurringBooking" server/storage.ts` = 15 (>= 10 per plan verification criteria)
- [x] Commits d27a372 and 8c1344f verified in git log
