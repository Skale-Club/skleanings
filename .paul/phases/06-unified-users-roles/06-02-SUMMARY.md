---
phase: 06-unified-users-roles
plan: 02
subsystem: auth
tags: [react, wouter, role-based-routing, auth]

requires:
  - phase: 06-01
    provides: role column on users table + AuthContext exposes role

provides:
  - Login page redirects by role (staff → /staff/settings, others → /admin)
  - Admin page blocks staff role with redirect guard
  - /staff/* route group with StaffSettings placeholder

affects: 06-05-staff-settings-page

tech-stack:
  added: []
  patterns: [role-based routing via useAdminAuth().role, route group isolation in Router()]

key-files:
  created: [client/src/pages/StaffSettings.tsx]
  modified: [client/src/pages/AdminLogin.tsx, client/src/pages/Admin.tsx, client/src/App.tsx]

key-decisions:
  - "Post-login always redirects to /admin first; Admin.tsx guard handles staff redirect to avoid auth race condition"
  - "Staff route group isolated before admin route block in Router() — same pattern as isAdminRoute"

patterns-established:
  - "Role-based redirect: useEffect on role + loading from useAdminAuth()"
  - "Route group isolation: isStaffRoute check before isAdminRoute in Router()"

duration: ~15min
started: 2026-04-04T00:00:00Z
completed: 2026-04-04T00:00:00Z
---

# Phase 1 Plan 02: Login Redirect by Role + Staff Route Guard Summary

**Role-based routing established: staff login lands on /staff/settings, admin/user lands on /admin; Admin page guards against staff access; /staff/* route group wired with placeholder.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Tasks | 1 completed |
| Files modified | 3 |
| Files created | 1 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Login redirects by role | Pass | AdminLogin.tsx useEffect: staff → /staff/settings, role truthy → /admin |
| AC-2: Admin page blocks staff role | Pass | AdminContent useEffect: role=staff → setLocation('/staff/settings') |
| AC-3: Staff route group exists | Pass | App.tsx isStaffRoute block with /staff/settings → StaffSettings placeholder |

## Accomplishments

- `AdminLogin.tsx` now routes already-authenticated users by role (staff vs admin/user)
- `Admin.tsx` now guards against staff reaching the admin dashboard
- `App.tsx` has an isolated `/staff/*` route group rendering a placeholder `StaffSettings` page
- TypeScript clean (pre-existing unrelated stripe module error excluded)

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `client/src/pages/AdminLogin.tsx` | Modified | Role-based redirect in already-authenticated useEffect |
| `client/src/pages/Admin.tsx` | Modified | Staff guard useEffect at top of AdminContent |
| `client/src/App.tsx` | Modified | isStaffRoute check + /staff route group + StaffSettings lazy import |
| `client/src/pages/StaffSettings.tsx` | Created | Placeholder page for /staff/settings (full impl in 06-05) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Post-login redirects to /admin; Admin.tsx guard handles staff | Avoids race condition — role is fetched async after auth, so redirect in handleLogin would fire before role is known | Admin.tsx always redirects staff; no timing issue |
| /staff route group isolated before /admin in Router() | Same pattern already used for admin routes; clean separation | /staff/* paths never fall through to admin or public route blocks |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Role-based routing foundation established for Phase 2 (Unified Users Page)
- /staff/settings route exists and renders — ready for full implementation in 06-05
- Admin dashboard still fully functional for admin/user roles

**Concerns:**
- `isAdmin` is still destructured but unused in AdminLogin.tsx after this change — harmless but slightly noisy

**Blockers:**
- None

---
*Phase: 06-unified-users-roles, Plan: 02*
*Completed: 2026-04-04*
