---
phase: 25-multiple-time-slots-per-day
plan: 01
subsystem: database
tags: [postgres, drizzle, migration, staff-availability]

# Dependency graph
requires: []
provides:
  - range_order column in staff_availability table (via SQL migration)
  - rangeOrder field in staffAvailability Drizzle table definition
  - StaffAvailability TypeScript type now includes rangeOrder: number
affects:
  - 25-02 (storage layer ordered range lookups depend on range_order)
  - 25-03 (frontend availability UI uses rangeOrder payload field)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase CLI migrations only — no drizzle-kit push"
    - "ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS for idempotent migrations"

key-files:
  created:
    - supabase/migrations/20260511000000_add_staff_availability_range_order.sql
  modified:
    - shared/schema.ts

key-decisions:
  - "range_order DEFAULT 0 means existing single-range rows remain valid with no data backfill"
  - "No UNIQUE constraint on (staff_member_id, day_of_week) — confirmed from 20260402000000_add_staff_tables.sql, nothing to drop"
  - "Composite index (staff_member_id, day_of_week, range_order) added for ordered range lookups"

patterns-established:
  - "rangeOrder: integer('range_order').notNull().default(0) — Drizzle column pattern for ordered sub-rows"

requirements-completed:
  - SLOTS-01
  - SLOTS-04

# Metrics
duration: 2min
completed: 2026-05-11
---

# Phase 25 Plan 01: Multiple Time Slots Per Day — Schema Foundation Summary

**range_order INTEGER column added to staff_availability via idempotent migration + Drizzle schema updated so StaffAvailability type includes rangeOrder: number**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-11T10:17:36Z
- **Completed:** 2026-05-11T10:19:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Migration SQL file created adding `range_order INTEGER NOT NULL DEFAULT 0` with `ADD COLUMN IF NOT EXISTS` guard
- Composite index `staff_availability_staff_day_order_idx` on `(staff_member_id, day_of_week, range_order)` added for ordered lookups
- `staffAvailability` Drizzle table definition updated with `rangeOrder` field — `StaffAvailability` type auto-derives `rangeOrder: number`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration file adding range_order column** - `01fb959` (chore)
2. **Task 2: Add rangeOrder to staffAvailability table definition in shared/schema.ts** - `6861c80` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `supabase/migrations/20260511000000_add_staff_availability_range_order.sql` - Idempotent ALTER TABLE + CREATE INDEX for range_order column
- `shared/schema.ts` - Added `rangeOrder: integer("range_order").notNull().default(0)` to staffAvailability pgTable definition

## Decisions Made
- Used `DEFAULT 0` so all existing single-range rows stay valid without any data update required
- Confirmed no UNIQUE constraint on `(staff_member_id, day_of_week)` from original migration — nothing to drop
- Supabase CLI migration only — no drizzle-kit push used (per MEMORY.md constraint)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
Pre-existing TypeScript errors in `server/index.ts` (missing `express-rate-limit` types and implicit `any` parameters) are unrelated to this plan's changes and out of scope per deviation rules.

## User Setup Required
The migration SQL file must be applied to the live database via Supabase CLI:
```bash
supabase db push --db-url "$POSTGRES_URL_NON_POOLING"
```
This adds `range_order` to the `staff_availability` table. Existing rows gain `range_order = 0` automatically via the DEFAULT.

## Next Phase Readiness
- Plan 02 can now add storage layer ordered range lookups using `range_order` column
- Plan 03 can implement frontend availability UI with `rangeOrder` payload field
- `StaffAvailability` TypeScript type includes `rangeOrder: number` — no type-casting needed downstream

---
*Phase: 25-multiple-time-slots-per-day*
*Completed: 2026-05-11*
