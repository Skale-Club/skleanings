---
phase: 14-backend-instrumentation-api
plan: 01
subsystem: backend
tags: [twilio, telegram, notification-logs, instrumentation, logger]

requires:
  - phase: 13-schema-storage-layer
    provides: notificationLogs table + storage.createNotificationLog + InsertNotificationLog type

provides:
  - server/lib/notification-logger.ts — logNotification() helper (never throws, truncates to 5000 chars)
  - twilio.ts: sendNewChatNotification logs one row per phone (trigger=new_chat, conversationId, Twilio SID)
  - twilio.ts: sendCalendarDisconnectNotification logs one row per phone (trigger=calendar_disconnect)
  - twilio.ts: sendBookingNotification logs one row per phone (trigger=new_booking, bookingId when caller provides it)
  - telegram.ts: sendMessageToAll logs one row per chatId when logContext provided
  - telegram.ts: sendTelegramTestMessage produces zero log rows (no logContext passed)

affects:
  - plan 14-02 (logNotification helper available for GHL instrumentation)
  - phase 15-admin-ui-notification-log (all SMS + Telegram sends now in notification_logs)

tech-stack:
  added: []
  patterns:
    - "logNotification wraps storage write in try/catch — never throws, logs error to console only"
    - "Twilio: per-phone try/catch inside outer loop; re-throw preserves outer catch behavior"
    - "Telegram: optional logContext param on sendMessageToAll; callers opt-in; test sends skip logging"
    - "bookingId optional param appended to sendBookingNotification on both Twilio + Telegram"

key-files:
  created:
    - server/lib/notification-logger.ts
  modified:
    - server/integrations/twilio.ts
    - server/integrations/telegram.ts
    - server/routes/bookings.ts
    - server/routes/chat/tools/create-booking.ts

key-decisions:
  - "Re-throw per-phone errors in Twilio — outer try/catch still catches, preserving { success: false } return"
  - "logContext on sendMessageToAll (not on each sendNewChatNotification/sendBookingNotification) — avoids duplicating loop; test sends naturally get no logContext"

patterns-established:
  - "logNotification is fire-and-forget: caller awaits it but it can never propagate an exception"
  - "bookingId appended as last optional param — all existing call sites require no change"

duration: ~20min
started: 2026-04-15T00:00:00Z
completed: 2026-04-15T00:00:00Z
---

# Phase 14 Plan 01: Notification Logger Helper + Twilio + Telegram Instrumentation Summary

**`logNotification` helper + instrumented Twilio (3 functions) + Telegram (per-chatId via optional logContext) — every SMS and Telegram send now writes a row to `notification_logs`.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~20 min |
| Started | 2026-04-15 |
| Completed | 2026-04-15 |
| Tasks | 3 of 3 |
| Files modified | 5 (1 created, 4 modified) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: logNotification never throws | Pass | try/catch wraps createNotificationLog; error goes to console.error only |
| AC-2: Twilio sendNewChatNotification logs per phone | Pass | Per-phone try/catch; sent branch captures Twilio SID; failed branch re-throws |
| AC-3: Twilio sendCalendarDisconnectNotification logs per phone | Pass | Same pattern; trigger=calendar_disconnect; no conversationId/bookingId |
| AC-4: Twilio sendBookingNotification logs per phone | Pass | Optional bookingId param added; both call sites pass booking.id |
| AC-5: Telegram sendMessageToAll logs per chatId | Pass | logContext optional param; logs after each sendTelegramMessage call |
| AC-6: sendTelegramTestMessage creates no rows | Pass | Calls sendMessageToAll without 4th arg — logContext is undefined, no writes |
| AC-7: TypeScript compiles | Pass (inspection) | All new params optional; imports resolve; no breaking changes at call sites |

## Accomplishments

- New `server/lib/notification-logger.ts` — single-responsibility helper that fire-and-forgets a log write, truncates preview to 5000 chars, never propagates exceptions
- Twilio: all 3 send functions now wrap `client.messages.create()` in per-phone try/catch, capturing the Twilio SID on success; outer function behavior unchanged
- Telegram: `sendMessageToAll` gains optional `logContext`; the existing chatId loop logs each recipient independently; `sendTelegramTestMessage` automatically excluded by omitting logContext

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/lib/notification-logger.ts` | Created | `logNotification()` helper — try/catch wrapper around storage write |
| `server/integrations/twilio.ts` | Modified | Import + per-phone instrumentation in all 3 functions; `bookingId?` param on `sendBookingNotification` |
| `server/integrations/telegram.ts` | Modified | Import + optional `logContext` on `sendMessageToAll`; `bookingId?` param on `sendBookingNotification`; logContext passed from `sendNewChatNotification` and `sendBookingNotification` |
| `server/routes/bookings.ts` | Modified | Pass `booking.id` as 5th arg to both Twilio and Telegram `sendBookingNotification` |
| `server/routes/chat/tools/create-booking.ts` | Modified | Pass `booking.id` as 5th arg to both Twilio and Telegram `sendBookingNotification` |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Re-throw per-phone Twilio errors | Preserves existing `{ success: false, message }` return to callers — no behavior change | Outer catch still fires; existing error logging unchanged |
| logContext on `sendMessageToAll` (not on high-level callers) | Avoids duplicating the chatId loop in callers; test sends automatically skip logging | Clean separation — test path unchanged, no new params in test call |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 0 | — |

Plan executed exactly as specified.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `npm run check` unavailable in shell | Verified by code inspection: all imports resolve, optional param positions are backward-compatible, no call site breaks |

## Next Phase Readiness

**Ready:**
- `logNotification` available for Plan 14-02 GHL instrumentation
- All SMS and Telegram sends now produce notification_logs rows (after `db:push` runs)
- Plan 14-02 can proceed: GHL instrumentation + API endpoints

**Concerns:**
- `npm run db:push` must execute before any log rows are written to DB — table still pending migration

**Blockers:**
- None — Plan 14-02 can be executed immediately

---
*Phase: 14-backend-instrumentation-api, Plan: 01*
*Completed: 2026-04-15*
