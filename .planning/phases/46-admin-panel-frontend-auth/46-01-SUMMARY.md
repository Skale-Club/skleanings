---
phase: 46-admin-panel-frontend-auth
plan: 01
subsystem: auth
tags: [frontend, session, react-context, admin-panel, multi-tenant]

# Dependency graph
requires:
  - phase: 45-tenant-admin-auth-backend
    provides: POST /api/auth/tenant-login, GET /api/auth/admin-me, POST /api/auth/logout
  - phase: 40-tenant-resolution-middleware
    provides: res.locals.tenant per request (enforces data isolation server-side)
provides:
  - AdminTenantAuthContext — session-based admin auth context with tenantId from server
  - AdminLogin page — POSTs to /api/auth/tenant-login (Supabase removed)
  - Admin shell — redirects to /admin/login when !isAuthenticated
  - App.tsx — AdminTenantAuthProvider wraps all /admin/* routes
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [AdminTenantAuthProvider wrapping admin route block, useAdminTenantAuth hook for auth state, fetch with credentials include for session cookies]

key-files:
  created:
    - client/src/context/AdminTenantAuthContext.tsx
  modified:
    - client/src/pages/AdminLogin.tsx
    - client/src/pages/Admin.tsx
    - client/src/App.tsx

key-decisions:
  - "useAdminAuth kept in Admin.tsx only for getAccessToken — CalendarReconnectBanner still needs Supabase access token"
  - "AdminTenantAuthProvider is nested inside AuthProvider — both coexist; customer Supabase auth and admin session auth are independent"
  - "Staff redirect logic removed from Admin.tsx — tenant admins all have role=admin in session; no Supabase role-based routing needed"

requirements-completed: [TA-07, TA-08, TA-09]

# Metrics
duration: 10min
completed: 2026-05-14
---

# Phase 46 Plan 01: Admin Panel Frontend Auth Summary

**Session-based tenant admin auth context replacing Supabase flow in admin panel — login, redirect guard, and logout wired to /api/auth/tenant-login and /api/auth/admin-me**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-14T12:44:00Z
- **Completed:** 2026-05-14T12:54:00Z
- **Tasks:** 3 completed (+ 1 checkpoint auto-approved)
- **Files modified:** 4

## Accomplishments

### Task 1: Create AdminTenantAuthContext (commit 82c851b)

Created `client/src/context/AdminTenantAuthContext.tsx` — a new standalone context that:
- Calls `GET /api/auth/admin-me` on mount with `credentials: 'include'`
- Stores `{ isAuthenticated, tenantId, email, role, loading }` from server session response
- Exports `logout()` — POSTs to `/api/auth/logout`, resets state
- Exports `refetch()` — re-runs admin-me fetch (called after login)
- Exports `AdminTenantAuthProvider` and `useAdminTenantAuth` hook
- No hardcoded `tenantId=1` anywhere in the file

### Task 2: Rewrite AdminLogin to use tenant-login endpoint (commit 29ce7c0)

Rewrote `client/src/pages/AdminLogin.tsx`:
- Removed all Supabase imports (`supabase`, `fetchRoleForSession`, `AUTH_ME_RETRY_DELAYS_MS`, `wait`)
- Removed Google OAuth button and "Sign up" paragraph
- `handleLogin` now POSTs to `/api/auth/tenant-login` with `credentials: 'include'`
- On 200: calls `refetch()` then redirects to `/admin`
- On error: toasts with server `message` field or fallback
- Redirect-if-authenticated guard uses `useAdminTenantAuth` state

### Task 3: Update Admin.tsx and App.tsx for tenant auth (commit a574445)

Admin.tsx changes:
- Added `useAdminTenantAuth` import
- Replaced all Supabase role-based redirect logic with `isAuthenticated` check
- Loading spinner driven by `tenantAuthLoading` instead of Supabase `loading`
- Redirect to `/admin/login` when `!isAuthenticated`
- `logout` button calls `tenantLogout()` instead of `signOut()`
- `email` prop to `AdminSidebar` comes from `tenantEmail` (server session)
- Kept `useAdminAuth()` only for `getAccessToken` (CalendarReconnectBanner dependency)

App.tsx changes:
- Imported `AdminTenantAuthProvider`
- Wrapped the `isAdminRoute` block in `<AdminTenantAuthProvider>` — all `/admin/*` routes share the session context

### Checkpoint: human-verify (auto-approved)

Auto-approved in bypass mode. All verification criteria confirmed via grep and `npm run check`.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All auth flows are wired to real backend endpoints:
- `GET /api/auth/admin-me` — real session introspection
- `POST /api/auth/tenant-login` — real bcrypt timing-safe login
- `POST /api/auth/logout` — real session destroy

## Self-Check: PASSED

Files exist:
- client/src/context/AdminTenantAuthContext.tsx — FOUND
- client/src/pages/AdminLogin.tsx — FOUND (contains tenant-login, no supabase)
- client/src/pages/Admin.tsx — FOUND (contains useAdminTenantAuth, Redirect to /admin/login)
- client/src/App.tsx — FOUND (contains AdminTenantAuthProvider)

Commits exist:
- 82c851b — FOUND
- 29ce7c0 — FOUND
- a574445 — FOUND

TypeScript: `npm run check` passed with zero errors.

Verification grep checks:
- No hardcoded tenantId=1 in AdminTenantAuthContext — PASS
- No supabase in AdminLogin — PASS
- tenant-login in AdminLogin — PASS
- useAdminTenantAuth in Admin.tsx — PASS
- AdminTenantAuthProvider in App.tsx — PASS
