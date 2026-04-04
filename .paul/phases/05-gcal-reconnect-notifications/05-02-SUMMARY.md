---
phase: 05-gcal-reconnect-notifications
plan: 02
subsystem: ui
tags: [react, shadcn, google-calendar, admin, banner, dialog, oauth]

requires:
  - phase: 05-gcal-reconnect-notifications
    provides: GET /api/staff/calendar/all-statuses, POST /api/staff/:id/calendar/clear-reconnect, needsReconnect column

provides:
  - CalendarReconnectBanner component with "Fix This" modal
  - CalendarTab reconnect warning state
  - OAuth callback auto-clears needsReconnect
  - Per-staff calendar/status endpoint returns needsReconnect field

affects: []

tech-stack:
  added: []
  patterns:
    - Warning banner pattern (amber-50/amber-200 styling) for admin-wide alerts
    - Three-state CalendarTab (connected / needs-reconnect / disconnected)

key-files:
  created:
    - client/src/components/admin/CalendarReconnectBanner.tsx
  modified:
    - client/src/pages/Admin.tsx
    - client/src/components/admin/StaffManageDialog.tsx
    - server/routes/staff.ts

key-decisions:
  - "Banner uses refetchInterval: 60s for near-realtime status without excessive polling"
  - "Dismiss is local state only — re-shows on page reload to ensure visibility"
  - "OAuth callback auto-clears needsReconnect — no manual step required after reconnecting"

patterns-established:
  - "Admin-wide alert banner: place after AdminHeader, before content div, exclude chat section"

duration: ~15min
started: 2026-04-02T00:00:00Z
completed: 2026-04-02T00:00:00Z
---

# Phase 5 Plan 02: "Take Action" Banner + CalendarTab Reconnect State

**Admin-facing reconnect banner (mirrors GoHighLevel "Take Action" UX) with per-staff reconnect warning in CalendarTab and auto-clear on OAuth re-auth.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Tasks | 2 completed |
| Files created | 1 |
| Files modified | 3 |
| TypeScript errors introduced | 0 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Banner appears when any staff needs reconnect | Pass | Queries all-statuses, filters for needsReconnect, renders amber banner |
| AC-2: Modal lists disconnected staff with reconnect links | Pass | Table with Google icon + staff name + Reconnect anchor to OAuth flow |
| AC-3: CalendarTab shows reconnect warning state | Pass | Three-state render: needsReconnect > connected > disconnected |
| AC-4: OAuth callback auto-clears needsReconnect | Pass | `clearCalendarNeedsReconnect(staffId)` called after `exchangeCodeForTokens` |
| AC-5: Banner disappears when all reconnected | Pass | Component returns null when no disconnected staff in filtered list |

## Accomplishments

- CalendarReconnectBanner component: persistent amber banner + Dialog modal with staff table and direct reconnect links
- Wired into Admin.tsx after AdminHeader, excluded from chat section
- CalendarTab in StaffManageDialog now has three render states with amber warning for needsReconnect
- Per-staff `/calendar/status` endpoint now returns `needsReconnect` field
- OAuth callback handler auto-clears `needsReconnect` after successful token exchange

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `client/src/components/admin/CalendarReconnectBanner.tsx` | Created | Banner + modal component querying all-statuses |
| `client/src/pages/Admin.tsx` | Modified | Import + render banner after AdminHeader |
| `client/src/components/admin/StaffManageDialog.tsx` | Modified | CalendarStatus type + reconnect warning state in CalendarTab |
| `server/routes/staff.ts` | Modified | calendar/status returns needsReconnect; OAuth callback clears flag |

## Decisions Made

None — followed plan as specified.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Full v0.5 feature complete: backend detection + SMS + in-app banner + per-staff reconnect flow
- `npm run db:push` still required before deploying (from Plan 05-01)

**Concerns:**
- None

**Blockers:**
- None — milestone ready to close

---
*Phase: 05-gcal-reconnect-notifications, Plan: 02*
*Completed: 2026-04-02*
