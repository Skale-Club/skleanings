---
phase: 06-unified-users-roles
plan: 03
subsystem: ui
tags: [react, role-based-ui, users-management, dialog]

requires:
  - phase: 06-01
    provides: role column on users table + UserRole type in AuthContext

provides:
  - Flat users list (no tabs) with role badges (admin/user/staff)
  - UserDialog with role Select instead of isAdmin Switch
  - user-routes PATCH/DELETE using role === 'admin' guard

affects: 06-04-staff-creation-bridge

tech-stack:
  added: []
  patterns: [role-gated Select options via currentUserIsAdmin, role badge variants per role]

key-files:
  modified:
    - client/src/components/admin/UnifiedUsersSection.tsx
    - client/src/pages/admin/UsersSection.tsx
    - client/src/pages/admin/UserDialog.tsx
    - server/routes/user-routes.ts

key-decisions:
  - "UserDialog formSchema: pick() specific fields + extend role — avoids exposing all DB columns in form"
  - "role default = 'staff' for new users — safest default, least privilege"

patterns-established:
  - "Role-gated UI options: {currentUserIsAdmin && <SelectItem value='admin'>}"
  - "Role badge variants: admin=default, user=secondary, staff=outline"

duration: ~10min
started: 2026-04-04T00:00:00Z
completed: 2026-04-04T00:00:00Z
---

# Phase 2 Plan 03: Flat Users List + Role Dialog Summary

**Replaced tabbed UnifiedUsersSection with a flat list; swapped isAdmin Switch for a role Select (admin-only 'Admin' option); updated route guards to use role === 'admin'.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10 min |
| Tasks | 3 completed |
| Files modified | 4 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Flat users list with role badges | Pass | Tabs removed; badges: admin=default, user=secondary, staff=outline |
| AC-2: Role picker in Add/Edit dialog | Pass | Select with admin/user/staff; Admin option gated by currentUserIsAdmin |
| AC-3: Role-based API guards | Pass | PATCH/DELETE use role === 'admin' + count check |

## Accomplishments

- `UnifiedUsersSection.tsx` stripped down to flat UsersSection render — no tabs, no StaffSection
- `UsersSection.tsx` role badges now driven by `user.role` string
- `UserDialog.tsx` formSchema scoped to just needed fields; role Select with least-privilege default ('staff')
- `user-routes.ts` guards migrated from `isAdmin` boolean to `role === 'admin'` string check

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `client/src/components/admin/UnifiedUsersSection.tsx` | Modified | Remove tabs, render UsersSection directly |
| `client/src/pages/admin/UsersSection.tsx` | Modified | Role badge from user.role instead of user.isAdmin |
| `client/src/pages/admin/UserDialog.tsx` | Modified | role Select replaces isAdmin Switch; formSchema scoped |
| `server/routes/user-routes.ts` | Modified | PATCH/DELETE guards use role === 'admin' |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| formSchema uses pick() + extend(role) | Avoids exposing all DB columns via insertUserSchema; explicit about what the form controls | Clean boundary between form data and DB schema |
| Default role = 'staff' for new users | Least privilege — admin must explicitly elevate to admin/user | New creates default to staff unless changed |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Users list shows all roles correctly
- Dialog creates/edits users with role field
- Foundation set for 06-04 staff bridge (when role=staff → auto-create staffMembers)

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 06-unified-users-roles, Plan: 03*
*Completed: 2026-04-04*
