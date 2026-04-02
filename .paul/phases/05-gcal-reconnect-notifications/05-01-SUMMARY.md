---
phase: 05-gcal-reconnect-notifications
plan: 01
subsystem: api
tags: [google-calendar, twilio, sms, oauth, storage, drizzle]

requires:
  - phase: 03-google-calendar-oauth
    provides: staffGoogleCalendar table with accessToken/refreshToken/tokenExpiresAt

provides:
  - markCalendarNeedsReconnect storage method
  - clearCalendarNeedsReconnect storage method
  - getAllCalendarStatuses storage method
  - Auto-mark on token refresh failure + SMS notification
  - GET /api/staff/calendar/all-statuses endpoint
  - POST /api/staff/:id/calendar/clear-reconnect endpoint

affects: [05-02-banner-component, admin-ui, staff-management]

tech-stack:
  added: []
  patterns:
    - Non-throwing notification side-effects (catch-wrapped SMS path)
    - Conditional DB write (only update needsReconnect when currently false)

key-files:
  created: []
  modified:
    - shared/schema.ts
    - server/storage.ts
    - server/lib/google-calendar.ts
    - server/integrations/twilio.ts
    - server/routes/staff.ts

key-decisions:
  - "Only mark needsReconnect when currently false — prevents duplicate SMS on repeated failures"
  - "Notification path fully wrapped in try/catch — never blocks availability engine"

patterns-established:
  - "SMS disconnect alert: sendCalendarDisconnectNotification(staffName, twilioSettings)"

duration: ~20min
started: 2026-04-02T00:00:00Z
completed: 2026-04-02T00:00:00Z
---

# Phase 5 Plan 01: Storage, Token Health Check & SMS Notification

**Backend reconnect detection layer: expired Google Calendar tokens auto-mark as `needsReconnect`, trigger SMS via Twilio, and expose status endpoint for the frontend banner.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~20 min |
| Tasks | 3 completed |
| Files modified | 5 |
| TypeScript errors introduced | 0 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Token refresh failure marks needsReconnect | Pass | catch block in `getValidAccessToken` calls `markCalendarNeedsReconnect` |
| AC-2: SMS sent on first disconnection | Pass | Only fires when `needsReconnect` was false; fully non-throwing |
| AC-3: all-statuses endpoint returns connection state | Pass | LEFT JOIN staffMembers + staffGoogleCalendar; returns correct shape |
| AC-4: clear-reconnect resets the flag | Pass | `POST /:id/calendar/clear-reconnect` calls `clearCalendarNeedsReconnect` |

## Accomplishments

- Storage layer extended with 3 methods covering the full reconnect lifecycle (mark, clear, query all)
- `getValidAccessToken` now auto-detects token failure and notifies admin silently — availability engine unaffected
- New Twilio function `sendCalendarDisconnectNotification` follows existing pattern, fires per-staff targeted message
- Two new admin-only API endpoints registered before `/:id` param routes to avoid Express capture conflicts

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `shared/schema.ts` | Modified (prior task) | `needsReconnect` + `lastDisconnectedAt` columns on `staffGoogleCalendar` |
| `server/storage.ts` | Modified | 3 new methods in IStorage interface + DatabaseStorage implementation |
| `server/lib/google-calendar.ts` | Modified | catch block marks DB + fires SMS; import added |
| `server/integrations/twilio.ts` | Modified | `sendCalendarDisconnectNotification` export added |
| `server/routes/staff.ts` | Modified | `GET /calendar/all-statuses` + `POST /:id/calendar/clear-reconnect` |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Conditional DB write (`needsReconnect === false` gate) | Prevents redundant writes and duplicate SMS on repeated availability checks | Admin gets one alert per disconnection event, not one per availability query |
| Notification path fully try/catch wrapped | Token refresh is called from the availability engine; any throw here would break booking flow | Safe to deploy; worst case is silent notification failure, not booking failure |
| `sendCalendarDisconnectNotification` takes `staffName` not `staffId` | Avoids extra DB lookup inside twilio.ts; caller (google-calendar.ts) already fetches the member | Keeps twilio.ts stateless and reusable |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Pre-existing `stripe` module TS error in `server/lib/stripe.ts` | Pre-existing, unrelated to this plan — confirmed by isolating errors; zero new errors introduced |

## Next Phase Readiness

**Ready:**
- All backend infrastructure for reconnect detection is complete
- `GET /api/staff/calendar/all-statuses` is live and ready to be consumed by the frontend banner
- `POST /api/staff/:id/calendar/clear-reconnect` is live for use after successful OAuth re-auth

**Concerns:**
- `db:push` must be run before deploying — schema has 2 new columns (`needsReconnect`, `lastDisconnectedAt`)

**Blockers:**
- None for Plan 05-02 (frontend banner)

---
*Phase: 05-gcal-reconnect-notifications, Plan: 01*
*Completed: 2026-04-02*
