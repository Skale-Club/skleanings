---
phase: 06-04-staff-roles
plan: 03
subsystem: ui
tags: [roles, users, staff-link, dialog]

provides:
  - UserDialog: role dropdown (admin/staff/viewer) + staff-link dropdown (when role=staff)
  - UsersSection: role badge with color coding (blue=admin, green=staff, gray=viewer)
  - v0.6 milestone complete

key-files:
  modified:
    - client/src/pages/admin/UserDialog.tsx
    - client/src/pages/admin/UsersSection.tsx
    - .paul/STATE.md
    - .paul/ROADMAP.md

key-decisions:
  - "Role + staff-link saved in onSuccess of main mutation to ensure userId exists before linking"
  - "UsersSection role badge falls back to isAdmin field if role is null (backward compat)"

duration: ~5min
completed: 2026-04-09T00:00:00Z
---

# Phase 4 Plan 03: Users Section Role + Staff Linking UI

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Role dropdown in UserDialog | Pass | Select with admin/staff/viewer options |
| AC-2: Staff link dropdown | Pass | Shown when role=staff, calls /staff-link endpoint |
| AC-3: Role badge in users list | Pass | Color-coded, falls back to isAdmin for legacy rows |

---
*Phase: 06-04-staff-roles, Plan: 03 — Completed: 2026-04-09*
