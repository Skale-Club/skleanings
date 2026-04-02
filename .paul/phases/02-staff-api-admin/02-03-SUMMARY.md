---
phase: 02-staff-api-admin
plan: 03
subsystem: admin-ui
tags: [react, admin, staff, services, availability, tabs, shadcn]

requires:
  - phase: 02-staff-api-admin/02-02
    provides: StaffSection with CRUD UI

provides:
  - Settings button per staff row → StaffManageDialog
  - Services tab: assign/unassign services per staff member
  - Availability tab: 7-day weekly schedule with time inputs

affects:
  - 04-xx (availability engine reads staff_availability and staff_service_abilities)
  - 05-xx (booking flow uses assigned services for staff filtering)

tech-stack:
  added: []
  patterns:
    - "StaffManageDialog: separate file to keep StaffSection focused"
    - "Tabs (shadcn) for multi-concern settings dialogs"
    - "useEffect syncs query data into local form state"
    - "Availability defaults: Mon–Fri available 09:00–17:00, Sat–Sun unavailable"

key-files:
  created:
    - client/src/components/admin/StaffManageDialog.tsx
  modified:
    - client/src/components/admin/StaffSection.tsx

key-decisions:
  - "Manage dialog is a separate file (not inline) — StaffSection was already 340 lines"
  - "Availability always saves all 7 days — simpler than partial upserts"

duration: ~10min
started: 2026-04-02T00:00:00Z
completed: 2026-04-02T00:00:00Z
---

# Phase 2 Plan 03: Staff Services + Availability UI Summary

**StaffManageDialog created. Settings button on each staff row opens tabbed dialog for service assignment and weekly availability.**

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Manage button opens tabbed dialog | Pass | Settings icon button → StaffManageDialog |
| AC-2: Services tab | Pass | Checkboxes, pre-checked from API, saves with PUT /api/staff/:id/services |
| AC-3: Availability tab | Pass | 7-day grid, time inputs disabled when unavailable, saves 7-item array |
| AC-4: TypeScript compilation | Pass | Zero errors |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `client/src/components/admin/StaffManageDialog.tsx` | Created (~210 lines) | Tabbed settings dialog |
| `client/src/components/admin/StaffSection.tsx` | +~15 lines | managingMember state, Settings button, dialog render |

## Deviations from Plan
None.

## Next Phase Readiness
**Phase 2 complete.** Phase 3 (Google Calendar OAuth per staff) can begin. Phase 4 (Smart Availability Engine) can also begin independently.

---
*Phase: 02-staff-api-admin, Plan: 03 — Completed: 2026-04-02*
