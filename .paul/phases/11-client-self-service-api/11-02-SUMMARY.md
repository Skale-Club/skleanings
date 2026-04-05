---
phase: 11-client-self-service-api
plan: 02
subsystem: api
tags: [express, bookings, cancel, reschedule, availability, client-portal]

requires:
  - phase: 11-client-self-service-api
    plan: 01
    provides: server/routes/client.ts router skeleton + requireClient + ownership check pattern

provides:
  - POST /api/client/bookings/:id/cancel — ownership + status + date-window guarded cancel
  - POST /api/client/bookings/:id/reschedule — ownership + availability-checked reschedule

affects:
  - 11-03 (GHL sync + notifications wrap these two endpoints)
  - 12-03 (cancel/reschedule UX calls these endpoints)

tech-stack:
  added: []
  patterns:
    - "Date-window guard: bookingDate <= today string comparison (ISO YYYY-MM-DD sorts lexically)"
    - "Self-excluding availability check: checkAvailability(..., booking.id) prevents slot conflict with own booking"

key-files:
  modified:
    - server/routes/client.ts

key-decisions:
  - "No new storage methods — updateBookingStatus and updateBooking already cover cancel and reschedule"
  - "Zod validation runs before booking lookup in reschedule — 400 returned early on bad input shape"
  - "Date comparison uses lexical string compare on YYYY-MM-DD — correct and avoids timezone gotchas for date-only values"

patterns-established:
  - "Self-excluding availability: pass booking.id as excludeBookingId to checkAvailability on reschedule"

duration: ~8min
started: 2026-04-05T00:00:00Z
completed: 2026-04-05T00:00:00Z
---

# Phase 11 Plan 02: Cancel + Reschedule Endpoints — Summary

**Added client-owned cancel and reschedule endpoints with ownership, status, date-window, and availability guards — no new storage methods needed.**

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Cancel with all guards | Pass | Ownership → status → date-window → updateBookingStatus('cancelled') |
| AC-2: Reschedule with availability check | Pass | Zod → ownership → status → date → checkAvailability(excludeId) → updateBooking |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/routes/client.ts` | Modified | Added cancel + reschedule routes + checkAvailability import + rescheduleSchema |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Lexical date string compare | YYYY-MM-DD sorts correctly without Date parsing; avoids timezone shifts | Simpler and correct for date-only guard |
| Zod parse before booking lookup in reschedule | Fast-fail on invalid input without hitting DB | Consistent with other routes in codebase |

## Deviations from Plan

None.

## Next Phase Readiness

**Ready:**
- Cancel/reschedule endpoints functional — plan 11-03 wraps them with GHL + notifications
- No breaking changes to existing routes

**Blockers:**
- None
