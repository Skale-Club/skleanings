---
phase: 03-google-calendar
plan: 01
subsystem: api + lib + admin-ui
tags: [google-calendar, oauth2, google-auth-library, staff, availability]

provides:
  - server/lib/google-calendar.ts: OAuth2 client, getAuthUrl, exchangeCodeForTokens, getValidAccessToken, getStaffBusyTimes
  - GET /api/staff/:id/calendar/connect — initiates OAuth flow
  - GET /api/staff/calendar/callback — stores tokens after OAuth
  - DELETE /api/staff/:id/calendar — disconnect
  - GET /api/staff/:id/calendar/status — connection state
  - Google Calendar busy times wired into getStaffAvailableSlots
  - Admin UI: Calendar tab in StaffManageDialog (connect/disconnect)

env-vars-required:
  - GOOGLE_CLIENT_ID
  - GOOGLE_CLIENT_SECRET
  - GOOGLE_REDIRECT_URI (must point to /api/staff/calendar/callback)

key-decisions:
  - "state param encodes staffId — no session needed for OAuth callback"
  - "prompt: consent forces refresh_token on every connect"
  - "getStaffBusyTimes returns [] silently on any error — graceful degradation"
  - "Google busy times filter in getStaffAvailableSlots alongside booking conflicts"
  - "Connect button is a plain <a> href — causes full navigation to Google OAuth"

duration: ~15min
started: 2026-04-02T00:00:00Z
completed: 2026-04-02T00:00:00Z
---

# Phase 3: Google Calendar OAuth — Complete

## What Was Built

| File | Change |
|------|--------|
| `server/lib/google-calendar.ts` | Created — OAuth client, token exchange, refresh, freebusy fetcher |
| `server/routes/staff.ts` | +4 endpoints (connect, callback, disconnect, status) |
| `server/lib/staff-availability.ts` | Google busy times wired into getStaffAvailableSlots |
| `client/src/components/admin/StaffManageDialog.tsx` | +Calendar tab with connect/disconnect UI |

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| AC-1: Redirect to Google OAuth | Pass |
| AC-2: Callback stores tokens | Pass |
| AC-3: Disconnect removes record | Pass |
| AC-4: Status endpoint | Pass |
| AC-5: TypeScript zero errors | Pass |

---
*Phase: 03-google-calendar — Completed: 2026-04-02*
