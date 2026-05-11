---
phase: 25-multiple-time-slots-per-day
plan: 02
subsystem: api
tags: [drizzle, postgresql, staff-availability, slot-generation, express]

requires:
  - phase: 25-01
    provides: range_order migration SQL file (schema column backing for rangeOrder field)

provides:
  - getStaffAvailability ordered by dayOfWeek + rangeOrder
  - PUT /api/staff/:id/availability accepts rangeOrder field, validates non-overlapping ranges
  - _generateSlots accepts prefetched bookings/busyTimes to avoid N+1 queries
  - getStaffAvailableSlots iterates all isAvailable ranges for a day and unions slot sets

affects: [25-03-frontend, booking-flow, staff-availability-tab]

tech-stack:
  added: []
  patterns:
    - "Hoist DB calls outside range loop (Promise.all before for..of) to avoid N+1"
    - "Union slot sets across ranges via Set<string>, return sorted array"
    - "Zod schema .default(0) for optional backward-compatible fields"
    - "Overlap validation: sort ranges by startTime, check adjacent endTime > nextStartTime"

key-files:
  created: []
  modified:
    - shared/schema.ts
    - server/storage.ts
    - server/routes/staff.ts
    - server/lib/staff-availability.ts

key-decisions:
  - "shared/schema.ts rangeOrder added in this plan (Plan 01 only committed the migration SQL, not the schema.ts update — fixed via Rule 3)"
  - "Overlap validation uses sort + adjacent comparison (O(n log n)), not all-pairs O(n^2)"
  - "prefetchedBookings/prefetchedBusyTimes are optional in SlotGenOptions so override branch (single range) needs no change"
  - "allSlots union uses Set<string> then spread+sort to eliminate duplicates at range boundaries"

patterns-established:
  - "Prefetch pattern: hoist Promise.all before any range loop that calls _generateSlots"
  - "Multi-range union: collect into Set<string>, return [...set].sort()"

requirements-completed: [SLOTS-01, SLOTS-03]

duration: 4min
completed: 2026-05-11
---

# Phase 25 Plan 02: Multiple-Time-Slots Backend Summary

**Storage, route schema, and slot-generation algorithm updated to support multiple ordered time-range rows per (staffMemberId, dayOfWeek) with N+1-free DB access**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-11T10:18:10Z
- **Completed:** 2026-05-11T10:22:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `getStaffAvailability` now orders by `dayOfWeek ASC, rangeOrder ASC`
- `PUT /api/staff/:id/availability` accepts optional `rangeOrder` field (default 0) and rejects overlapping same-day ranges with HTTP 400
- `_generateSlots` accepts prefetched booking and busy-time data to eliminate N+1 DB calls when looping ranges
- `getStaffAvailableSlots` weekly path replaces single `.find()` with `.filter()` loop, unions all isAvailable day-ranges into a sorted Set

## Task Commits

1. **Task 1: Update storage.ts + route schema** - `a0b624a` (feat)
2. **Task 2: Refactor staff-availability.ts for multi-range** - `ebe1105` (feat)

## Files Created/Modified

- `shared/schema.ts` - Added `rangeOrder: integer("range_order").notNull().default(0)` to staffAvailability table
- `server/storage.ts` - `getStaffAvailability` adds `asc(staffAvailability.rangeOrder)` second sort key
- `server/routes/staff.ts` - `availabilityItemSchema` adds `rangeOrder`; PUT route adds overlap validation
- `server/lib/staff-availability.ts` - `SlotGenOptions` extended with prefetch fields; weekly path refactored to multi-range loop

## Decisions Made

- `shared/schema.ts` rangeOrder added here (Rule 3 fix — Plan 01 only wrote migration SQL, skipped schema.ts update)
- Overlap detection uses sort by startTime + adjacent check (O(n log n)), sufficient for typical 2–4 ranges per day
- `prefetchedBookings/prefetchedBusyTimes` optional in interface so override branch (single range, no loop) needs zero changes
- `allSlots` as `Set<string>` deduplicates slots at range boundaries (e.g., 12:00 appearing in two adjacent windows)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added rangeOrder to shared/schema.ts (missed by Plan 01)**
- **Found during:** Task 1 (storage.ts getStaffAvailability update)
- **Issue:** Plan 01 commit `01fb959` only created the SQL migration file. `shared/schema.ts` still had no `rangeOrder` field, making `asc(staffAvailability.rangeOrder)` reference non-existent property and Plan 02 would fail TypeScript check.
- **Fix:** Added `rangeOrder: integer("range_order").notNull().default(0)` to `staffAvailability` pgTable definition in `shared/schema.ts`.
- **Files modified:** `shared/schema.ts`
- **Verification:** `npm run check` passes with no errors in schema.ts or storage.ts
- **Committed in:** `a0b624a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking)
**Impact on plan:** Required fix — without schema.ts update, TypeScript would reject the rangeOrder sort in storage.ts. No scope creep.

## Issues Encountered

- `npm run build` fails due to missing `express-rate-limit` package (pre-existing, not introduced by this plan). Logged as deferred item — out of scope.
- `npm run check` reports 5 errors in `server/index.ts` (pre-existing implicit-any + missing express-rate-limit types). All errors in files not modified by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend fully supports multiple time-range rows per staff+day
- Plan 03 (frontend) can now send payloads with multiple `rangeOrder`-indexed rows per dayOfWeek
- PUT endpoint contract: `{ dayOfWeek, startTime, endTime, isAvailable, rangeOrder? }[]` — rangeOrder defaults to 0 for backward compatibility

---
*Phase: 25-multiple-time-slots-per-day*
*Completed: 2026-05-11*
