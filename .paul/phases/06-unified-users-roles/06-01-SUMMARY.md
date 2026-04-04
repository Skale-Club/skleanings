---
phase: 06-unified-users-roles
plan: 01
subsystem: auth
tags: [drizzle, supabase, auth, middleware, roles, react-context]

requires:
  - phase: none
    provides: existing users + staffMembers tables

provides:
  - role column on users table (admin/user/staff)
  - phone column on users table
  - userId FK on staffMembers → users.id
  - requireAdmin, requireUser, requireAuth middlewares (DB role-based)
  - GET /api/auth/me endpoint
  - AuthContext exposes role, isUser, isStaff

affects: [06-02-login-redirect, 06-03-unified-users-page, 06-04-staff-bridge, 06-05-staff-settings]

tech-stack:
  added: []
  patterns:
    - DB-driven role check replaces ADMIN_EMAIL env var
    - getAuthenticatedUser helper validates token + looks up DB user
    - AuthContext fetches role from /api/auth/me after Supabase auth resolves

key-files:
  created:
    - supabase/migrations/20260402300000_add_user_roles.sql
  modified:
    - shared/schema.ts
    - server/lib/auth.ts
    - server/routes/auth-routes.ts
    - client/src/context/AuthContext.tsx
    - client/src/components/admin/StaffSection.tsx

key-decisions:
  - "role column default='admin' — existing user keeps working without migration"
  - "userId omitted from insertStaffMemberSchema — set directly in storage when bridging"
  - "Auth middleware uses DB lookup by email, not ADMIN_EMAIL env var"

duration: ~15min
started: 2026-04-02T00:00:00Z
completed: 2026-04-02T00:00:00Z
---

# Phase 06 Plan 01: Schema + Auth + Role Middleware

**Users table gets role column (admin/user/staff), staffMembers gets userId FK, auth middleware refactored to DB-driven role checks, AuthContext exposes role to frontend.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Tasks | 3 completed |
| Files modified | 6 |
| TypeScript errors introduced | 0 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Users table has role column | Pass | `text("role").notNull().default("admin")` + `phone` column |
| AC-2: StaffMembers has userId FK | Pass | `text("user_id").references(() => users.id)` nullable |
| AC-3: Auth middleware checks role from DB | Pass | `requireAdmin` checks `role === 'admin'` via `getAuthenticatedUser` |
| AC-4: Three middleware levels exist | Pass | `requireAuth` (any), `requireUser` (admin+user), `requireAdmin` (admin) |
| AC-5: Frontend AuthContext exposes role | Pass | Fetches from `/api/auth/me`, exposes `role`, `isUser`, `isStaff` |

## Accomplishments

- Schema extended: `role` + `phone` on users, `userId` FK on staffMembers
- Auth middleware fully refactored from email-check to DB role-check
- `GET /api/auth/me` endpoint returns user profile with role
- AuthContext fetches role after Supabase auth resolves, derives `isAdmin`/`isUser`/`isStaff`
- StaffSection.tsx fix: createStaff mutation omits `userId` to avoid type error
- Supabase migration pushed successfully

## Deviations from Plan

- **StaffSection.tsx fix** — not in original plan scope but required to fix TS error caused by adding userId to staffMembers. Minimal change (added `'userId'` to Omit type).

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `createInsertSchema` made `userId` required in insert type | Omitted `userId` from `insertStaffMemberSchema`; will set directly in storage |
| StaffSection createStaff mutation typed against `Omit<StaffMember>` | Added `'userId'` to the Omit list |

## Next Phase Readiness

**Ready:**
- Role infrastructure complete — all subsequent plans can use `requireUser`, role checks, AuthContext.role
- Migration pushed to Supabase

**Concerns:**
- `isAdmin` boolean column still exists on users table (deprecated, not yet removed)

**Blockers:**
- None

---
*Phase: 06-unified-users-roles, Plan: 01*
*Completed: 2026-04-02*
