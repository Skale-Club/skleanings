---
phase: 12-client-portal-ui
plan: 01
subsystem: ui
tags: [react, wouter, auth, client-portal, routing]

requires:
  - phase: 11-client-self-service-api
    provides: all /api/client/* endpoints; requireClient middleware; isClient role in AuthContext

provides:
  - ClientLogin page at /account/login (email+password, client-role only)
  - AccountShell — real portal shell with header, tab nav (Profile / My Bookings), auth guard
  - /account/login route wired in App.tsx before AccountShell catch-all

affects:
  - 12-02 (profile + bookings sections render inside AccountShell's content area)
  - 12-03 (cancel/reschedule flows open within the bookings section of AccountShell)

tech-stack:
  added: []
  patterns:
    - "Client portal login: separate ClientLogin.tsx — same Supabase auth pattern as AdminLogin but client-role-only with error toast for wrong role"
    - "AccountShell URL-based tabs: isProfileActive = location === '/account'; isBookingsActive = location.startsWith('/account/bookings') — no state needed, URL is source of truth"
    - "Account area auth guard: !role → /account/login; role !== 'client' → /admin — mirrors staff guard pattern"

key-files:
  created:
    - client/src/pages/ClientLogin.tsx
  modified:
    - client/src/pages/AccountShell.tsx
    - client/src/App.tsx

key-decisions:
  - "ClientLogin is independent from AdminLogin — copied pattern, not imported; different copy, no Google OAuth, wrong-role signs out immediately"
  - "Unknown /account/* paths redirect to /account — prevents dead ends when navigating to unimplemented sub-routes"
  - "Non-client roles (admin/staff/user) visiting /account are redirected to /admin — clean separation, no content leakage"

patterns-established:
  - "Role-based portal shell: useAdminAuth loading → spinner; !role → /account/login; role !== X → redirect; role === X → render. Reusable pattern for any role-specific area."

duration: ~15min
started: 2026-04-05T00:00:00Z
completed: 2026-04-05T00:00:00Z
---

# Phase 12 Plan 01: Client Login + Account Shell — Summary

**Replaced the AccountShell stub with a real client portal shell (header, URL-based tab nav, role guard) and added a dedicated `/account/login` page for client-role users.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Tasks | 2 completed |
| Files modified | 3 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Client login page at /account/login | Pass | Form renders with email + password + company branding |
| AC-2: Client login redirects to /account on success | Pass | role=client → /account; other role → signOut + error toast |
| AC-3: Unauthenticated /account → /account/login | Pass | useEffect guard replaces previous /admin/login redirect |
| AC-4: AccountShell renders tab navigation for client | Pass | Header + Profile/My Bookings tabs; active tab from URL |
| AC-5: Non-client roles redirected out of account area | Pass | role !== 'client' → /admin |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `client/src/pages/ClientLogin.tsx` | Created | Client-facing login page at /account/login |
| `client/src/pages/AccountShell.tsx` | Rewritten | Real portal shell replacing "coming soon" stub |
| `client/src/App.tsx` | Modified | Added ClientLogin lazy import + /account/login route |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| ClientLogin independent from AdminLogin | Different copy, no Google OAuth, role validation differs | No coupling between admin and client auth flows |
| Wrong-role login: signOut + error toast | Non-client who signs in shouldn't stay authenticated | Prevents admin/staff from accidentally entering account area via /account/login |
| URL-based tab state (not React state) | Deep-linkable, browser back/forward works, React Query cache keys align with URL | 12-02 can use URL for refetch keys without extra coordination |

## Deviations from Plan

None — executed exactly as specified.

## Next Phase Readiness

**Ready:**
- AccountShell shell layout established; 12-02 fills in ProfileSection and BookingsSection content
- Tab routing fully wired: /account → profile content, /account/bookings → bookings content
- Auth guard in place; 12-02 can add data fetching without worrying about auth

**Blockers:**
- None
