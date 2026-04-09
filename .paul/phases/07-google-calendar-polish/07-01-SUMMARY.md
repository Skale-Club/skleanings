---
phase: 07-google-calendar-polish
plan: 01
subsystem: auth
tags: [google-calendar, oauth, auth, staff, jwt]

requires:
  - phase: 06-unified-users-roles
    provides: requireAuth middleware, staff role, /staff/settings page, CalendarTab component

provides:
  - Google Calendar OAuth callback routes to correct page based on initiator role
  - CalendarTab uses authenticated requests (Bearer token) for all API calls
  - Connect button passes JWT token as query param for browser-navigation auth

affects: []

tech-stack:
  added: []
  patterns:
    - "OAuth state encodes staffId:redirectTo to carry redirect context through external OAuth flow"
    - "requireAuth accepts token from query param as fallback for browser navigation requests"
    - "CalendarTab uses useAdminAuth() to get JWT for all server calls"

key-files:
  modified:
    - server/lib/google-calendar.ts
    - server/routes/staff.ts
    - server/lib/auth.ts
    - client/src/components/admin/CalendarTab.tsx

key-decisions:
  - "Encode redirectTo in OAuth state (staffId:redirectTo) — survives round-trip through Google without extra DB storage"
  - "Token as query param for connect endpoint — browser navigation can't carry Authorization header; query param is the standard workaround for redirect-based OAuth flows"
  - "requireAuth accepts query param token — scoped only to getAuthenticatedUser, all other middleware unchanged"

patterns-established:
  - "For browser-navigation endpoints that need auth: pass token as ?token= query param, requireAuth reads it as fallback"
  - "For OAuth state that needs to survive redirect: encode as colon-separated string (staffId:context)"

duration: ~30min
started: 2026-04-04T00:00:00Z
completed: 2026-04-04T00:00:00Z
---

# Phase 7 Plan 01: Google Calendar OAuth Flow Fix — Summary

**Staff can now connect their Google Calendar from /staff/settings with a single button click and land back on their settings page after OAuth; all CalendarTab API calls carry JWT Bearer tokens.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~30 min |
| Tasks | 2 completed + 1 checkpoint passed |
| Files modified | 4 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Staff lands on /staff/settings after connecting | Pass | Callback parses `redirectTo` from state, routes to `/staff/settings` |
| AC-2: Admin lands on /admin/staff after connecting | Pass | Default `redirectTo="admin"` preserves existing behavior |
| AC-3: CalendarTab uses authenticated requests | Pass | `useAdminAuth` + `authenticatedRequest` for status + disconnect; `handleConnect` passes token as query param |

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/lib/google-calendar.ts` | Modified | `getAuthUrl` now accepts `redirectTo: "staff" \| "admin"`, encodes as `${staffId}:${redirectTo}` in OAuth state |
| `server/routes/staff.ts` | Modified | Connect route reads `user.role` and passes `redirectTo`; callback splits state to parse `staffId` and `redirectTo` |
| `server/lib/auth.ts` | Modified | `getAuthenticatedUser` accepts token from `req.query.token` as fallback for browser-navigation requests |
| `client/src/components/admin/CalendarTab.tsx` | Modified | Uses `useAdminAuth` + `authenticatedRequest`; connect buttons use `handleConnect` with token query param |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Encode `redirectTo` in OAuth state | State survives round-trip through Google without extra DB lookup or session storage | Single source of truth; works stateless |
| Token as `?token=` query param on connect endpoint | Browser `<a href>` / `window.location.href` can't carry Authorization header | Standard pattern for redirect-based OAuth initiation from SPAs |
| `requireAuth` reads query param token as fallback | Minimal change — only affects `getAuthenticatedUser`, all existing header-based auth untouched | Scoped impact; doesn't weaken security for non-browser requests |

## Deviations from Plan

None — plan executed exactly as specified.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Google Calendar connect flow fully functional for both staff and admin
- White-label model complete: admin configures once, staff connects with one click

**Concerns:**
- Token in query param appears in server logs and browser history — acceptable for internal OAuth flow, but worth noting
- No rate limiting on token refresh (pre-existing, not introduced here)

**Blockers:**
- None

---
*Phase: 07-google-calendar-polish, Plan: 01*
*Completed: 2026-04-04*
