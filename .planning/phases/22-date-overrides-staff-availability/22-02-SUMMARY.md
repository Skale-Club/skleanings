---
phase: 22-date-overrides-staff-availability
plan: 02
subsystem: api
tags: [express, drizzle, postgres, staff, availability, overrides]

# Dependency graph
requires:
  - phase: 22-01
    provides: staffAvailabilityOverrides table, StaffAvailabilityOverride type, InsertStaffAvailabilityOverride type
provides:
  - GET /api/staff/:id/availability-overrides endpoint
  - POST /api/staff/:id/availability-overrides endpoint (upsert semantics)
  - DELETE /api/staff/:id/availability-overrides/:overrideId endpoint
  - getStaffAvailabilityOverrides, getStaffAvailabilityOverridesByDate, createStaffAvailabilityOverride, deleteStaffAvailabilityOverride storage methods
  - Override-priority logic in getStaffAvailableSlots (isUnavailable=true blocks day; startTime+endTime overrides weekly hours)
affects:
  - 22-03 (UI for managing overrides calls these endpoints)
  - booking slot flow (getStaffAvailableSlots now respects date overrides)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Override priority: check date-specific override before weekly schedule in slot generation"
    - "Slot generation extracted into _generateSlots helper called from both override and weekly-schedule paths"
    - "Upsert via delete-then-insert on POST for same-date override replacement"

key-files:
  created: []
  modified:
    - server/storage.ts
    - server/routes/staff.ts
    - server/lib/staff-availability.ts

key-decisions:
  - "Upsert implemented as delete-then-insert (not ON CONFLICT) to avoid Drizzle uniqueIndex conflict complexity in the route layer"
  - "_generateSlots extracted as private async function to eliminate duplicate slot-generation loop between override and weekly-schedule paths"
  - "Override with isUnavailable=false and no startTime/endTime is treated as no-op (falls through to weekly schedule) for forward compatibility"

patterns-established:
  - "Override check pattern: call getStaffAvailabilityOverridesByDate before getStaffAvailability for date-specific priority"

requirements-completed:
  - OVR-03
  - OVR-04
  - OVR-05

# Metrics
duration: 12min
completed: 2026-05-10
---

# Phase 22 Plan 02: Staff Availability Override Backend Summary

**Three REST endpoints for override CRUD plus override-priority logic in getStaffAvailableSlots — isUnavailable=true blocks day, startTime+endTime replaces weekly hours**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-10T00:10:00Z
- **Completed:** 2026-05-10T00:22:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added 4 storage methods (getStaffAvailabilityOverrides, getStaffAvailabilityOverridesByDate, createStaffAvailabilityOverride, deleteStaffAvailabilityOverride) to IStorage interface and DatabaseStorage implementation
- Registered GET/POST/DELETE /api/staff/:id/availability-overrides routes with Zod validation and admin auth guard
- Refactored getStaffAvailableSlots to extract _generateSlots private helper and add override check before weekly schedule lookup
- TypeScript check and build both pass with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add storage methods for override CRUD** - `d1a6f6b` (feat)
2. **Task 2: Add REST endpoints + override logic in getStaffAvailableSlots** - `e2a9640` (feat)

## Files Created/Modified
- `server/storage.ts` - IStorage interface + DatabaseStorage: 4 override CRUD methods, staffAvailabilityOverrides import
- `server/routes/staff.ts` - GET/POST/DELETE /api/staff/:id/availability-overrides routes with Zod schema and upsert logic
- `server/lib/staff-availability.ts` - Extracted _generateSlots helper; added override check at top of getStaffAvailableSlots

## Decisions Made
- POST uses delete-then-insert upsert (not ON CONFLICT UPDATE) because the uniqueIndex in Drizzle requires specifying the conflict target, which is more complex; delete-then-insert is simpler and the route already fetches the existing row to check
- The `_generateSlots` refactor eliminates code duplication between the override path (custom hours) and the weekly schedule path — both call the same function with resolved dayStartMins/dayEndMins
- An override with `isUnavailable=false` but no `startTime`/`endTime` is treated as no-op and falls through to the weekly schedule, ensuring forward compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no new external service configuration required. The migration from 22-01 covers the table creation.

## Next Phase Readiness
- All backend endpoints are live and type-safe
- 22-03 (UI) can immediately wire up to GET/POST/DELETE /api/staff/:id/availability-overrides
- No blockers

---
*Phase: 22-date-overrides-staff-availability*
*Completed: 2026-05-10*
