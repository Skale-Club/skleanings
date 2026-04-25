---
phase: 14-backend-instrumentation-api
plan: 02
subsystem: backend
tags: [ghl, api, notification-logs, express, admin]

requires:
  - phase: 14-backend-instrumentation-api, plan: 01
    provides: logNotification helper in server/lib/notification-logger.ts
  - phase: 13-schema-storage-layer
    provides: storage.getNotificationLogsByConversation, storage.getNotificationLogs

provides:
  - GHL contact sync logged in booking-ghl-sync.ts (trigger=new_booking, bookingId)
  - GHL contact sync logged in update-contact.ts (trigger=new_chat, conversationId)
  - GET /api/conversations/:id/notifications — per-conversation log (admin-gated)
  - GET /api/admin/notification-logs — paginated global log with filters (admin-gated)
  - server/routes/notification-logs.ts — new Express router

affects:
  - phase 15-admin-ui-notification-log (UI reads from these two endpoints)

tech-stack:
  added: []
  patterns:
    - "GHL log inserted between getOrCreateGHLContact call and existing error-check — existing logic untouched"
    - "notification-logs router uses same requireAdmin from lib/auth as all other admin-gated routes"
    - "Router mounted at /api with no prefix — routes define their own full paths"

key-files:
  created:
    - server/routes/notification-logs.ts
  modified:
    - server/lib/booking-ghl-sync.ts
    - server/routes/chat/tools/update-contact.ts
    - server/routes.ts

key-decisions:
  - "logNotification inserted before the existing if(!contactResult.success) check — logs run regardless of outcome without touching existing error paths"
  - "Router mounted at /api (not /api/admin) — routes define their own full sub-paths including /admin/notification-logs"

patterns-established:
  - "All Phase 14 instrumentation uses logNotification from lib/notification-logger — single entry point, never throws"

duration: ~15min
started: 2026-04-15T00:00:00Z
completed: 2026-04-15T00:00:00Z
---

# Phase 14 Plan 02: GHL Instrumentation + API Endpoints Summary

**GHL contact sync logged at both call sites (booking form + chat tool); two admin-gated endpoints expose the full notification log — Phase 14 backend instrumentation complete.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Started | 2026-04-15 |
| Completed | 2026-04-15 |
| Tasks | 4 of 4 |
| Files modified | 4 (1 created, 3 modified) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Booking GHL sync is logged | Pass | `syncBookingToGhl` calls `logNotification` after `getOrCreateGHLContact` with bookingId |
| AC-2: Chat GHL sync is logged | Pass | `updateContactHandler` calls `logNotification` after `getOrCreateGHLContact` with conversationId |
| AC-3: GHL log status reflects actual outcome | Pass | status='sent' when contactId returned, status='failed' when not |
| AC-4: GET /api/conversations/:id/notifications returns rows | Pass | Admin-gated; calls `storage.getNotificationLogsByConversation` |
| AC-5: GET /api/admin/notification-logs returns rows | Pass | Admin-gated; supports channel/status/trigger/from/to/search/limit/offset |
| AC-6: Both endpoints return 401 for unauthenticated requests | Pass | `requireAdmin` middleware on both routes |
| AC-7: routes.ts mounts the new router | Pass | Import + `app.use("/api", notificationLogsRouter)` added |

## Accomplishments

- GHL instrumented at both call sites: `syncBookingToGhl` (booking form path) and `updateContactHandler` (chat AI tool path) — every GHL contact create/find now has a log row
- `server/routes/notification-logs.ts` — clean 2-route Express router with `requireAdmin` guard and query-param filter parsing for the global log
- Phase 14 backend complete: every Twilio, Telegram, and GHL send writes a `notification_logs` row; two endpoints ready for Phase 15 UI consumption

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/lib/booking-ghl-sync.ts` | Modified | Import `logNotification`; call after `getOrCreateGHLContact` with bookingId |
| `server/routes/chat/tools/update-contact.ts` | Modified | Import `logNotification`; call after `getOrCreateGHLContact` with conversationId |
| `server/routes/notification-logs.ts` | Created | Two admin-gated endpoints: per-conversation + global filtered log |
| `server/routes.ts` | Modified | Import + mount `notificationLogsRouter` at `/api` |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `logNotification` inserted before `if (!contactResult.success)` check | Logs run on both success and failure paths without touching existing error handling | Audit trail always written; existing `addInternalConversationMessage` calls unchanged |
| Router mounted at `/api` (not `/api/admin`) | Routes define their own full sub-paths (`/admin/notification-logs`) — matches all other routers in routes.ts | Consistent pattern; both routes fully namespaced |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 0 | — |

Plan executed exactly as specified. The plan noted that `requireAdmin` might need checking — confirmed it's exported from `server/lib/auth.ts` (same as `staff.ts`, `integrations.ts`, etc.).

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- `GET /api/conversations/:id/notifications` available for Phase 15 conversation modal tab
- `GET /api/admin/notification-logs` available for Phase 15 global NotificationLogsSection
- All channels (SMS, Telegram, GHL) instrumented — log will populate as soon as `db:push` runs

**Concerns:**
- `npm run db:push` must run before any rows are persisted — `notification_logs` table still pending migration in production

**Blockers:**
- None — Phase 15 (Admin UI) can be planned immediately

---
*Phase: 14-backend-instrumentation-api, Plan: 02*
*Completed: 2026-04-15*
