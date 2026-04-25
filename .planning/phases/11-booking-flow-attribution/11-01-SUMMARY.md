---
phase: 11-booking-flow-attribution
plan: "01"
subsystem: api
tags: [analytics, attribution, drizzle, postgres, conversion-events, visitor-sessions]

requires:
  - phase: 10-schema-capture-classification
    provides: visitorSessions and conversionEvents tables in shared/schema.ts, upsertVisitorSession storage function, POST /api/analytics/session endpoint, partial unique index on conversion_events

provides:
  - linkBookingToAttribution(bookingId, visitorId): links booking row to visitor session, increments total_bookings, sets converted_at on first conversion
  - recordConversionEvent(eventType, options): writes dual first_touch + last_touch rows to conversion_events with onConflictDoNothing
  - POST /api/analytics/events: public rate-limited endpoint for client-side booking_started and chat_initiated events

affects:
  - 11-02-booking-flow-wiring
  - 11-03-chat-wiring

tech-stack:
  added: []
  patterns:
    - Dual-row first_touch + last_touch write pattern for conversion_events (D-06)
    - Two-path session lookup (bookingId -> utm_session_id, or direct visitorId)
    - onConflictDoNothing for idempotent duplicate-safe conversion recording (ATTR-03)
    - Fire-and-forget analytics endpoint always returning 200 on unexpected errors

key-files:
  created: []
  modified:
    - server/storage/analytics.ts
    - server/routes/analytics.ts

key-decisions:
  - "linkBookingToAttribution silently no-ops when visitorId not found (D-03) — booking is never blocked"
  - "recordConversionEvent writes two rows per event — first_touch and last_touch — to support both attribution models in reports without SQL CASE branching"
  - "POST /api/analytics/events returns 200 on unexpected errors and 400 on ZodError — analytics must never surface failures to client (D-08)"
  - "Dual lookup path: bookingId->utm_session_id chain for server-side booking_completed calls; visitorId directly for client-side events (D-04, D-05)"

patterns-established:
  - "Dual-row write: insert first_touch + last_touch values in a single db.insert().values([...]) call"
  - "Null-safe attribution: session missing or null → all attributed fields are null, event is still written"
  - "Zod-based event validation with enum for allowed event types prevents arbitrary event pollution"

requirements-completed: [ATTR-01, EVENTS-01, EVENTS-02, EVENTS-03, EVENTS-04]

duration: 8min
completed: 2026-04-25
---

# Phase 11 Plan 01: Attribution Storage Functions and Events Endpoint Summary

**Server-side attribution layer: dual first/last-touch conversion recording via two new storage functions and a public POST /api/analytics/events endpoint**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-25T20:55:00Z
- **Completed:** 2026-04-25T21:03:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `linkBookingToAttribution(bookingId, visitorId)` exported from `server/storage/analytics.ts` — silently no-ops on unknown visitorId, sets utm_session_id on booking, increments total_bookings, sets converted_at on first conversion
- `recordConversionEvent(eventType, options)` exported — writes exactly two rows (first_touch + last_touch) with onConflictDoNothing idempotency; handles both bookingId-chain and direct visitorId lookup paths; preserves event with null attribution if no session found
- `POST /api/analytics/events` added to `server/routes/analytics.ts` — validates eventType enum (booking_started | chat_initiated), rate-limited at 60/IP/min, returns 200 on unexpected errors per fire-and-forget policy
- `npm run check` and `npm run build` both pass with zero errors

## Task Commits

1. **Task 1: Add linkBookingToAttribution and recordConversionEvent to storage/analytics** - `881e11a` (feat)
2. **Task 2: Add POST /api/analytics/events endpoint to routes/analytics** - `f0219b2` (feat)

## Files Created/Modified
- `server/storage/analytics.ts` - Added conversionEvents + bookings imports; appended linkBookingToAttribution and recordConversionEvent with RecordConversionEventOptions interface
- `server/routes/analytics.ts` - Appended eventSchema and router.post("/events") handler before export default

## Decisions Made
- Followed plan decisions D-03, D-04, D-05, D-06, D-08 exactly as specified in 11-CONTEXT.md
- Used two-step lookup for bookingId path (booking -> utm_session_id -> session) to match the Stripe webhook timing gap design (D-04)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Worktree branch was behind `dev` (Phase 10 analytics files missing). Resolved by merging `dev` into worktree branch via fast-forward — no conflicts.

## User Setup Required
None — no external service configuration required. DB migration for visitor_sessions/conversion_events tables is pre-existing (Phase 10, tracked as migration pending blocker in STATE.md).

## Next Phase Readiness
- `storage.linkBookingToAttribution` and `storage.recordConversionEvent` are available via storage spread in `server/storage/index.ts`
- `POST /api/analytics/events` is registered and live
- Phase 11 Plan 02 can now wire `visitorId` through booking creation paths and call these functions from `server/routes/bookings.ts` and `server/routes/payments.ts`
- Phase 11 Plan 03 can wire `chat_initiated` event from `ChatWidget.tsx`

---
*Phase: 11-booking-flow-attribution*
*Completed: 2026-04-25*
