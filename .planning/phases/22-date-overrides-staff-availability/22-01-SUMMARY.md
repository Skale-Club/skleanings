---
phase: 22-date-overrides-staff-availability
plan: 01
subsystem: database
tags: [drizzle, postgres, supabase, schema, staff, availability]

# Dependency graph
requires: []
provides:
  - staffAvailabilityOverrides Drizzle table with uniqueIndex on (staffMemberId, date)
  - insertStaffAvailabilityOverrideSchema Zod schema
  - StaffAvailabilityOverride TypeScript type
  - InsertStaffAvailabilityOverride TypeScript type
  - Supabase SQL migration with CREATE TABLE IF NOT EXISTS and index
affects:
  - 22-02 (backend storage methods and routes import these types)
  - 22-03 (UI imports these types for override management)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pgTable with uniqueIndex callback for compound unique constraint"
    - "Migration SQL with IF NOT EXISTS guards for idempotency"

key-files:
  created:
    - supabase/migrations/20260510000001_add_staff_availability_overrides.sql
  modified:
    - shared/schema.ts

key-decisions:
  - "uniqueIndex used (not unique constraint in table body) to match Drizzle ORM pattern for named unique indexes"
  - "date column uses Drizzle date() type (YYYY-MM-DD string) consistent with existing slot date handling"
  - "StaffAvailabilityOverride type placed after InsertStaffGoogleCalendar to maintain staff types grouping"

patterns-established:
  - "Override pattern: date-specific row beats weekly schedule; isUnavailable=true = full block, startTime+endTime = custom hours"

requirements-completed:
  - OVR-01
  - OVR-02

# Metrics
duration: 8min
completed: 2026-05-10
---

# Phase 22 Plan 01: Date Overrides Schema Summary

**staffAvailabilityOverrides Drizzle table with UNIQUE (staff_member_id, date) constraint and Supabase migration — schema contract for backend and UI plans**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-10T00:00:00Z
- **Completed:** 2026-05-10T00:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created idempotent Supabase SQL migration with CREATE TABLE IF NOT EXISTS, UNIQUE constraint, and index
- Added staffAvailabilityOverrides pgTable to shared/schema.ts with uniqueIndex callback pattern
- Exported all 4 required artifacts: table, insertSchema, StaffAvailabilityOverride, InsertStaffAvailabilityOverride
- TypeScript check passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Write Supabase migration SQL** - `30f5860` (chore)
2. **Task 2: Add Drizzle table definition and types to shared/schema.ts** - `9ec7125` (feat)

## Files Created/Modified
- `supabase/migrations/20260510000001_add_staff_availability_overrides.sql` - DDL for staff_availability_overrides table with UNIQUE constraint and index
- `shared/schema.ts` - Added staffAvailabilityOverrides table, insertStaffAvailabilityOverrideSchema, StaffAvailabilityOverride type, InsertStaffAvailabilityOverride type

## Decisions Made
- Used `uniqueIndex` (named index in table callback) rather than `.unique()` on column, to match Drizzle ORM convention for named compound unique indexes
- The `date` column uses Drizzle's `date()` type which maps to PostgreSQL DATE and is represented as a YYYY-MM-DD string — consistent with how dates are passed in the slot booking flow

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
**MIGRATION PENDING** — `supabase/migrations/20260510000001_add_staff_availability_overrides.sql` must be applied via Supabase CLI with a direct (non-pooling) connection:
```
supabase db push --db-url "$POSTGRES_URL_NON_POOLING"
```

## Next Phase Readiness
- shared/schema.ts exports all types needed by plan 22-02 (storage methods) and 22-03 (UI)
- No blockers for 22-02 execution

---
*Phase: 22-date-overrides-staff-availability*
*Completed: 2026-05-10*
