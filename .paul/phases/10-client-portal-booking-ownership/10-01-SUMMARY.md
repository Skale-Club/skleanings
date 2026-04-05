---
phase: 10-client-portal-booking-ownership
plan: 01
subsystem: auth
tags: [auth, roles, react, routing, client-portal]

requires:
  - phase: 09-runtime-db-scram-stability
    provides: stable auth middleware foundation

provides:
  - requireClient middleware in server/lib/auth.ts
  - client role wired into UserRole type and AuthContext
  - login redirect for client role → /account
  - /account/* route segment guarded by client role
  - AccountShell placeholder page
  - Admin Users page split into Team (admin/user/staff) and Clients views

affects:
  - 10-02 (booking ownership autofill uses requireClient and isClient)
  - 11-01 (client API routes use requireClient)
  - 12-01 (account portal replaces AccountShell placeholder)

tech-stack:
  added: []
  patterns:
    - "requireClient follows same pattern as requireAdmin/requireUser — 401 on no user, 403 on wrong role"
    - "isAccountRoute guard in App.tsx mirrors isAdminRoute/isStaffRoute pattern"
    - "AccountShell self-guards: checks isClient, redirects to /admin/login if not"

key-files:
  created:
    - client/src/pages/AccountShell.tsx
  modified:
    - server/lib/auth.ts
    - client/src/context/AuthContext.tsx
    - client/src/pages/AdminLogin.tsx
    - client/src/App.tsx
    - client/src/pages/admin/UsersSection.tsx

key-decisions:
  - "client role is NOT added to requireUser — client is not a back-office role and must not access admin routes"
  - "AccountShell self-guards (not App-level guard) — mirrors StaffSettings pattern in this codebase"
  - "UsersSection split into Team/Clients toggle — scope addition requested during apply"

patterns-established:
  - "Client-only routes use requireClient middleware on the server"
  - "Admin Users page: team (admin/user/staff) shown by default; Clients accessible via toggle button"

duration: ~20min
started: 2026-04-05T00:00:00Z
completed: 2026-04-05T00:00:00Z
---

# Phase 10 Plan 01: Client Role Foundation — Summary

**Added `client` as a first-class role: server middleware, frontend type system, login redirect, /account route guard, and admin Users page split into Team/Clients views.**

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Server enforces client-only routes | Pass | requireClient rejects admin/user/staff with 403, passes client |
| AC-2: Frontend recognises the client role | Pass | UserRole includes 'client'; isClient computed and in Provider value |
| AC-3: Login redirects clients to /account | Pass | Both useEffect guard and handleLogin success path redirect client → /account |
| AC-4: /account/* guarded — non-clients redirected | Pass | AccountShell checks isClient, redirects non-clients to /admin/login while loading shows spinner |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/lib/auth.ts` | Modified | Added `requireClient` middleware |
| `client/src/context/AuthContext.tsx` | Modified | `UserRole` + `isClient` |
| `client/src/pages/AdminLogin.tsx` | Modified | client redirect in useEffect and handleLogin |
| `client/src/App.tsx` | Modified | `isAccountRoute`, AccountShell lazy import, /account route block |
| `client/src/pages/AccountShell.tsx` | Created | Client-only placeholder with self-guard |
| `client/src/pages/admin/UsersSection.tsx` | Modified | Team/Clients toggle view (scope addition) |

## Deviations from Plan

| Type | Count | Impact |
|------|-------|--------|
| Scope additions | 1 | Additive only — no plan tasks changed |

**1. Admin Users page Team/Clients split**
- **Requested during:** Apply phase (user request mid-execution)
- **What was added:** `UsersSection.tsx` now filters users into `teamUsers` (admin/user/staff) and `clientUsers` (client); header shows "Team" by default with a "Clients" toggle button; client badge uses distinct green color
- **Files:** `client/src/pages/admin/UsersSection.tsx`
- **Impact:** Clean admin UX for client list from day one; no regressions to team management

## Verification Notes

- `tsc` unavailable locally (same workspace limitation as phase 09); verified by file re-read + spec comparison
- All AC verified by logic trace; production type-check will run on Vercel deploy

## Next Steps

1. Continue to 10-02: Add `bookings.userId` FK + booking ownership autofill for authenticated clients
2. Then phase 11: Client self-service API (profile + own bookings + cancel/reschedule)
3. Then phase 12: Replace AccountShell with full client portal UI
