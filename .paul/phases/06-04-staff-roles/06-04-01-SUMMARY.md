---
phase: 06-04-staff-roles
plan: 01
subsystem: api
tags: [auth, middleware, roles]

provides:
  - requireStaff middleware (DB role-based: admin|staff)
  - PATCH /api/users/:id/staff-link endpoint

key-files:
  modified:
    - server/lib/auth.ts
    - server/routes/user-routes.ts

key-decisions:
  - "requireAdmin left unchanged — requireStaff is additive new middleware"
  - "requireStaff imports storage directly (no circular dependency: auth.ts → storage.ts → db.ts)"

duration: ~5min
completed: 2026-04-09T00:00:00Z
---

# Phase 4 Plan 01: requireStaff Middleware + Staff-Link Endpoint

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: requireStaff allows admin and staff | Pass | DB role check, 403 for viewer/unknown |
| AC-2: PATCH /api/users/:id/staff-link | Pass | Calls linkStaffToUser, clears if null |

---
*Phase: 06-04-staff-roles, Plan: 01 — Completed: 2026-04-09*
