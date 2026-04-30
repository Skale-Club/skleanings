---
phase: 19-receptionist-booking-flow-multi-staff-view
plan: 04
subsystem: ui
tags: [react, react-query, useQueries, booking-flow, staff-availability]

# Dependency graph
requires:
  - phase: 19-01
    provides: multi-staff admin calendar with By Staff view
  - phase: 19-02
    provides: drag-to-reassign and Quick Book modal
  - phase: 19-03
    provides: 30-second calendar polling

provides:
  - Per-staff availability display on customer-facing BookingPage step 3
  - useQueries fetching one availability query per staff member in parallel
  - staffBySlot map grouping available staff by time slot
  - Staff name badges rendered below time label in slot buttons (staffCount > 1 only)
  - isSlotsPending extended to cover per-staff loading state

affects: [booking-flow, BookingPage, availability, staff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useQueries for parallel per-staff availability fetch (one query per staff member)
    - staffBySlot Map built from perStaffAvailability results for O(1) slot lookups
    - staffCount > 1 guard ensures single-staff sites have no regression

key-files:
  created: []
  modified:
    - client/src/pages/BookingPage.tsx

key-decisions:
  - "useQueries runs one query per staff member in parallel; staffCount > 1 guard keeps single-staff sites unchanged"
  - "isSlotsPending extended to include isPerStaffLoading — reuses existing skeleton pulse animation without new loading UI"
  - "staffBySlot Map built outside JSX to avoid rebuilding on every render"

patterns-established:
  - "useQueries pattern: (staffList ?? []).map(member => ({ enabled: staffCount > 1, ... })) for conditional parallel queries"
  - "staffBySlot accumulator: forEach over perStaffAvailability results to build slot→staff[] map"

requirements-completed: [D-15, D-16, D-17]

# Metrics
duration: ~2min
completed: 2026-04-30
---

# Phase 19 Plan 04: Per-Staff Availability on Booking Step 3 Summary

**useQueries parallel per-staff availability fetch with staff name badges in slot buttons on customer BookingPage step 3**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-30T18:37:40Z
- **Completed:** 2026-04-30T18:39:41Z
- **Tasks:** 1 (Task 2 was auto-approved checkpoint)
- **Files modified:** 1

## Accomplishments
- Added `useQueries` import and parallel per-staff availability queries to BookingPage step 3
- Built `staffBySlot` map (time → StaffMember[]) from per-staff query results
- Augmented slot buttons to show staff first-name badges below time when `staffCount > 1`
- Extended `isSlotsPending` to cover `isPerStaffLoading` so skeleton shows during fetch
- `npm run check` and `npm run build` both pass with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add useQueries per-staff availability and augment slot display** - `dc09adb` (feat)
2. **Task 2: Human verification** - Auto-approved (auto_advance=true)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `client/src/pages/BookingPage.tsx` - Added useQueries, staffBySlot map, staff badges in slot buttons, extended isSlotsPending

## Decisions Made
- useQueries runs with `enabled: staffCount > 1` guard — single-staff sites skip all per-staff queries entirely, preserving existing behavior
- `isSlotsPending` extended with `isPerStaffLoading` so the existing skeleton pulse is shown while per-staff queries are fetching — no new loading UI needed
- `staffBySlot` built before JSX return to avoid per-render Map rebuilds

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — TypeScript check and build both passed cleanly on first attempt.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 19 is now fully complete (Plans 01-04 all done)
- Customer-facing booking step 3 shows per-staff availability for multi-staff sites
- Admin calendar has By Staff view, drag-to-reassign, Quick Book, and 30-second polling
- No blockers for next milestone or phase

---
*Phase: 19-receptionist-booking-flow-multi-staff-view*
*Completed: 2026-04-30*
