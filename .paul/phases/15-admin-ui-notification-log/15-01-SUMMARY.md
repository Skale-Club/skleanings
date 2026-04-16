---
phase: 15-admin-ui-notification-log
plan: 01
subsystem: ui
tags: [react, react-query, lucide, notifications, leads]

requires:
  - phase: 14-backend-instrumentation-api
    provides: GET /api/admin/notification-logs endpoint with conversationId per row

provides:
  - Inline notification channel indicators on every lead/conversation row in the admin chat list

affects: []

tech-stack:
  added: []
  patterns: [notification map derived client-side from global log fetch, passed as prop to list component]

key-files:
  modified:
    - client/src/components/chat/admin/AdminChatLayout.tsx
    - client/src/components/chat/admin/ConversationList.tsx

key-decisions:
  - "Scope corrected: inline icons per lead row, not a tabs UI or global section"
  - "Load all logs upfront (limit=500) and derive map client-side — avoids N+1 per-row fetches"
  - "notificationMap passed as optional prop — ConversationList stays pure/presentational"

patterns-established:
  - "Notification map pattern: useQuery + useMemo → Map<conversationId, Set<channel>> → prop-drilled"

duration: ~15min
started: 2026-04-15T00:00:00Z
completed: 2026-04-15T00:00:00Z
---

# Phase 15 Plan 01: Admin UI — Lead Notification Indicators Summary

**Inline channel icons (SMS, Telegram, GHL) appear on each lead row in the conversations list, showing at a glance which notifications fired for that lead.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15min |
| Tasks | 2 completed (+ 1 scope correction) |
| Files modified | 2 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| Channel icons visible per lead row | Pass | Phone/MessageCircle/Link2 shown when logs exist |
| Icons absent when no notifications sent | Pass | notificationMap.has() guard — no empty row clutter |
| SMS, Telegram, GHL each have distinct icon + color | Pass | emerald/sky/violet color coding |
| Authenticated fetch of notification logs | Pass | Bearer token via authenticatedRequest, admin endpoint |

## Accomplishments

- `AdminChatLayout.tsx` fetches `GET /api/admin/notification-logs?limit=500` once on mount (60s stale), builds `Map<conversationId, Set<channel>>` via `useMemo`, passes to both desktop and mobile `ConversationList` instances
- `ConversationList.tsx` renders 3-pixel channel icons inline below the last-message preview for any conversation that has notification log entries — zero rendering cost for conversations without logs
- No backend changes required — existing Phase 14 endpoint covered the data need entirely

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `client/src/components/chat/admin/AdminChatLayout.tsx` | Modified | Added notification logs query + useMemo map + notificationMap prop to both ConversationList instances |
| `client/src/components/chat/admin/ConversationList.tsx` | Modified | Added notificationMap prop, Phone/MessageCircle/Link2 imports, inline icon row per conversation |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Inline icons on lead row (not tabs/global section) | User corrected scope: admin needs at-a-glance view on lead list, not a separate log section | Simpler, faster, more useful |
| Fetch all logs once (limit=500) + derive map | Avoids N+1 queries (one per conversation). Cleaning company volume is low — 500 covers all time | Single request, O(n) map build, zero per-row cost |
| notificationMap as optional prop | Keeps ConversationList decoupled from auth/fetch logic | Easy to test, no prop required if feature is disabled |

## Deviations from Plan

| Type | Count | Impact |
|------|-------|--------|
| Scope correction | 1 | Major — original plan (ChatArea tabs + global section) was the wrong UX |
| Plan 15-02 cancelled | 1 | Global NotificationLogsSection not needed per user |

**Detail:** Original 15-01 plan specified a "Messages | Notifications" tab UI inside ChatArea, and 15-02 specified a new sidebar section. User corrected this to: inline channel icons per lead row only. Both original plans were superseded. 15-02-PLAN.md was written but not executed.

## Next Phase Readiness

**Ready:**
- v1.1 milestone goal fully achieved — all notification sends are logged and visible to admin
- Existing chat functionality unchanged

**Concerns:** None

**Blockers:** `npm run db:push` must be run against production DB to create the `notification_logs` table before any log rows are persisted in production.

---
*Phase: 15-admin-ui-notification-log, Plan: 01*
*Completed: 2026-04-15*
