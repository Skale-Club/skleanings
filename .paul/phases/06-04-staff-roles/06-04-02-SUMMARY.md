---
phase: 06-04-staff-roles
plan: 02
subsystem: ui
tags: [roles, sidebar, calendar, useMe]

provides:
  - useMe() hook — fetches /api/me, returns role/staffMemberId/isAdmin/isStaff
  - Admin sidebar filtered to dashboard+calendar for staff role
  - AppointmentsCalendarSection accepts staffMemberId prop for client-side filtering

key-files:
  created:
    - client/src/hooks/useMe.ts
  modified:
    - client/src/pages/Admin.tsx
    - client/src/components/admin/AppointmentsCalendarSection.tsx

key-decisions:
  - "useMe defaults isAdmin=true while loading — prevents sidebar flicker for existing admin"
  - "useAdminAuth().isAdmin conflicts with useMe().isAdmin — renamed to roleIsAdmin in Admin.tsx"
  - "Staff calendar filter is client-side — no new API needed"

duration: ~5min
completed: 2026-04-09T00:00:00Z
---

# Phase 4 Plan 02: Frontend Role-Aware Sidebar

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: useMe returns role data | Pass | Safe defaults while loading |
| AC-2: Admin sees all sidebar items | Pass | isStaff=false → full sectionsOrder |
| AC-3: Staff sees only dashboard+calendar | Pass | sectionsOrder filtered by STAFF_ALLOWED_SECTIONS |
| AC-4: Staff calendar pre-filtered | Pass | filterStaffMemberId prop on AppointmentsCalendarSection |

---
*Phase: 06-04-staff-roles, Plan: 02 — Completed: 2026-04-09*
