---
phase: 21-per-service-booking-limits-buffer-time-minimum-notice-time-slot-interval
plan: "02"
subsystem: api
tags: [availability, booking-limits, buffer-time, minimum-notice, time-slot-interval, typescript]

# Dependency graph
requires:
  - phase: 21-01
    provides: "New schema columns: bufferTimeBefore, bufferTimeAfter, minimumNoticeHours, timeSlotInterval on services table"
provides:
  - "Availability logic that reads and applies per-service booking limits at runtime"
  - "BookingLimits interface and shiftHHMM helper exported from staff-availability.ts"
  - "Buffer-aware conflict check in both staff and legacy availability paths"
  - "Configurable slot step (timeSlotInterval ?? durationMinutes) replacing hardcoded 30-min grid"
  - "Minimum notice filtering using timezone-correct tzNow cutoff in both paths"
affects:
  - "server/lib/availability.ts consumers (routes/availability.ts no-staff path)"
  - "server/lib/staff-availability.ts consumers (routes/availability.ts staff path)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BookingLimits interface: single source of truth for buffer/notice/interval params"
    - "shiftHHMM helper: HH:MM arithmetic for buffer-aware occupancy windows"
    - "Total-minutes-based slot loop (slotMins += step) replacing nested hour/minute loops"
    - "Limits loaded before staffId fast-path in getSlotsForServices"

key-files:
  created: []
  modified:
    - server/lib/staff-availability.ts
    - server/lib/availability.ts
    - server/routes/availability.ts

key-decisions:
  - "Import BookingLimits and shiftHHMM into availability.ts from staff-availability.ts (no duplication; no circular dependency risk)"
  - "Limits loaded BEFORE staffId fast-path in getSlotsForServices so the fast-path receives populated limits"
  - "getAvailabilityRange (month-view) left unchanged per plan — month-view limits are out of scope for this phase"
  - "noticeMs = minimumNoticeHours * 60 * 60 * 1000 (hours to ms), cutoffTs = tzNow.getTime() + noticeMs for TZ-correct minimum notice"

patterns-established:
  - "Buffer occupancy window: occupiedStart = shiftHHMM(b.startTime, -bufBefore), occupiedEnd = shiftHHMM(b.endTime, bufAfter)"
  - "Slot step: limits?.timeSlotInterval ?? durationMinutes (null interval falls back to service duration)"

requirements-completed:
  - BOOKING-LIMITS-02

# Metrics
duration: 4min
completed: "2026-05-11"
---

# Phase 21 Plan 02: Apply Booking Limits in Availability Logic Summary

**Buffer-aware conflict checks, configurable slot intervals, and minimum-notice filtering applied in both staff and legacy availability paths using per-service limit fields**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-11T02:57:44Z
- **Completed:** 2026-05-11T03:01:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Replaced hardcoded 30-min slot grid with `timeSlotInterval ?? durationMinutes` step in both `getStaffAvailableSlots` and `getAvailabilityForDate`
- Implemented buffer-aware conflict check: existing bookings expand their blocked window by `bufferTimeBefore` before and `bufferTimeAfter` after
- Minimum-notice filtering using `tzNow.getTime() + noticeMs` cutoff (timezone-correct) in both availability paths
- Limits-loading block placed before the `staffId` fast-path in `getSlotsForServices` so fast-path passes limits through
- `routes/availability.ts` no-staff day-view branch now loads and passes limits to `getAvailabilityForDate`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add booking limits to getStaffAvailableSlots and getSlotsForServices** - `edc7bf7` (feat)
2. **Task 2: Apply booking limits to legacy getAvailabilityForDate and wire in routes** - `3096534` (feat)

## Files Created/Modified
- `server/lib/staff-availability.ts` - Added BookingLimits interface, shiftHHMM helper, total-minutes loop, buffer conflict check, limits param, limits-before-staffId ordering
- `server/lib/availability.ts` - Imported BookingLimits/shiftHHMM, replaced 30-min nested loop, added limits param, buffer conflict check, tzNow-based cutoff
- `server/routes/availability.ts` - Load limits from primary service and pass to getAvailabilityForDate in no-staff day-view branch

## Decisions Made
- Used `import { type BookingLimits, shiftHHMM }` in availability.ts rather than re-declaring to avoid duplication; confirmed no circular dependency
- `noticeMs` computed as `minimumNoticeHours * 60 * 60 * 1000` (hours to milliseconds)
- Legacy today-filtering (past slot skipping without limits) preserved via `if (isToday && limits === undefined)` guard

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript check passed on first attempt for both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Per-service booking limits are now fully applied at runtime for both staff and no-staff availability paths
- Month-view (getAvailabilityRange) does not apply limits — this is an explicit out-of-scope decision per plan
- Ready for Plan 03 (admin UI for editing the limit fields)

---
*Phase: 21-per-service-booking-limits-buffer-time-minimum-notice-time-slot-interval*
*Completed: 2026-05-11*
