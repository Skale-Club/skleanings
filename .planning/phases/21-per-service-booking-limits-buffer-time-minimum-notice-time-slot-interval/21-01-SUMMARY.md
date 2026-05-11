---
phase: 21-per-service-booking-limits-buffer-time-minimum-notice-time-slot-interval
plan: 01
subsystem: database
tags: [postgres, drizzle, supabase, schema, migration]

# Dependency graph
requires: []
provides:
  - "services table has 4 new columns: buffer_time_before, buffer_time_after, minimum_notice_hours, time_slot_interval"
  - "shared/schema.ts Service type includes bufferTimeBefore, bufferTimeAfter, minimumNoticeHours, timeSlotInterval"
  - "insertServiceSchema accepts all 4 new fields (optional, with safe defaults)"
affects:
  - "21-02 backend booking limits logic (reads/writes new fields)"
  - "21-03 admin UI for configuring per-service limits"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase migration with ADD COLUMN IF NOT EXISTS for safe re-runs"
    - "Drizzle pgTable fields added; Service type and insertServiceSchema auto-updated via inference"

key-files:
  created:
    - "supabase/migrations/20260510000000_add_service_booking_limits.sql"
  modified:
    - "shared/schema.ts"

key-decisions:
  - "timeSlotInterval is nullable (null = use durationMinutes as slot interval) — avoids requiring a value for services that need no custom interval"
  - "buffer and notice columns are NOT NULL DEFAULT 0 — safe defaults mean all existing service rows are unaffected without an explicit UPDATE"

patterns-established:
  - "Schema-only plan: migration SQL + schema.ts update only, no logic or UI changes — downstream plans depend on this artifact"

requirements-completed:
  - BOOKING-LIMITS-01

# Metrics
duration: 2min
completed: 2026-05-10
---

# Phase 21 Plan 01: Per-Service Booking Limits Schema Summary

**Supabase migration + Drizzle schema adding 4 booking-limits columns (buffer times, minimum notice, slot interval) to the services table with safe NOT NULL defaults**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-10T07:33:14Z
- **Completed:** 2026-05-10T07:34:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `supabase/migrations/20260510000000_add_service_booking_limits.sql` with 4 ADD COLUMN IF NOT EXISTS statements
- Added `bufferTimeBefore`, `bufferTimeAfter`, `minimumNoticeHours`, `timeSlotInterval` to `services` pgTable in `shared/schema.ts`
- `Service` TypeScript type now includes all 4 new fields (via `typeof services.$inferSelect`)
- `insertServiceSchema` automatically accepts all 4 new fields as optional (via `createInsertSchema`)
- `npm run check` passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Write Supabase migration SQL for 4 new columns** - `556eb57` (chore)
2. **Task 2: Add four fields to services pgTable in shared/schema.ts** - `67f420f` (feat)

## Files Created/Modified
- `supabase/migrations/20260510000000_add_service_booking_limits.sql` - ALTER TABLE statements for 4 new columns with IF NOT EXISTS guard and correct defaults
- `shared/schema.ts` - 4 new Drizzle column definitions inside `services = pgTable(...)` block

## Decisions Made
- `timeSlotInterval` is nullable (null means "use durationMinutes"), avoiding the need to set a value on every existing service row
- All 3 non-nullable columns default to 0, keeping existing rows fully compatible without any data backfill

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Migration pending operator action.** The migration file at `supabase/migrations/20260510000000_add_service_booking_limits.sql` must be applied to the production database:

```bash
# Using Supabase CLI (requires POSTGRES_URL_NON_POOLING / direct connection port 5432):
supabase db push

# Or directly with psql:
psql "$POSTGRES_URL_NON_POOLING" -f supabase/migrations/20260510000000_add_service_booking_limits.sql
```

## Next Phase Readiness
- Schema foundation is complete; Plan 02 (backend booking limits logic) and Plan 03 (admin UI) can proceed
- Migration must be applied to DB before Plan 02 endpoints that read/write these columns will work in production

---
*Phase: 21-per-service-booking-limits-buffer-time-minimum-notice-time-slot-interval*
*Completed: 2026-05-10*
