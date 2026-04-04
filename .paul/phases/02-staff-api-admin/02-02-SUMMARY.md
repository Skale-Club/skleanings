---
phase: 02-staff-api-admin
plan: 02
subsystem: admin-ui
tags: [react, admin, staff, crud, dnd-kit, dialog, shadcn]

requires:
  - phase: 02-staff-api-admin/02-01
    provides: all staff API endpoints

provides:
  - Admin UI for staff CRUD at /admin/staff
  - DnD drag-to-reorder (PUT /api/staff/reorder)
  - Create/Edit dialog with photo upload
  - isActive toggle per staff member
  - Delete with confirmation

affects:
  - 02-03 (service assignment + availability grid — next plan)
  - 05-xx (booking flow — staff selector hidden when count ≤ 1)

tech-stack:
  added: []
  patterns:
    - "StaffAvatar: inline component — initials fallback when no profileImageUrl"
    - "Photo upload: uploadFileToServer from shared/utils + hidden file input"
    - "Reorder uses PUT /api/staff/reorder with { updates } body (not individual PUTs)"

key-files:
  created:
    - client/src/components/admin/StaffSection.tsx
  modified:
    - client/src/components/admin/shared/types.ts
    - client/src/pages/Admin.tsx

key-decisions:
  - "Reorder mutation uses single PUT /api/staff/reorder — not individual per-item PUTs like FaqsSection"
  - "StaffAvatar inline (not extracted) — only used in this file"

patterns-established:
  - "Photo URL field + upload button side by side — consistent with other media fields"

duration: ~10min
started: 2026-04-02T00:00:00Z
completed: 2026-04-02T00:00:00Z
---

# Phase 2 Plan 02: Staff Admin UI Summary

**StaffSection component created. Staff management accessible at /admin/staff in the admin dashboard.**

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: DnD list with reorder | Pass | Uses dnd-kit, calls PUT /api/staff/reorder |
| AC-2: Create/Edit dialog | Pass | All fields + photo upload via uploadFileToServer |
| AC-3: Delete confirmation | Pass | AlertDialog pattern identical to FaqsSection |
| AC-4: TypeScript compilation | Pass | Zero errors |
| AC-5: Staff in admin nav | Pass | Users2 icon, wired in menuItems + render |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `client/src/components/admin/StaffSection.tsx` | Created (~340 lines) | Full staff CRUD admin UI |
| `client/src/components/admin/shared/types.ts` | +1 line | Added 'staff' to AdminSection union |
| `client/src/pages/Admin.tsx` | +4 lines | Import, menu item, render |

## Deviations from Plan
None.

## Next Phase Readiness
**Ready:** Plan 02-03 can now add service assignment and availability grid tabs inside the edit dialog or as a separate detail view.

---
*Phase: 02-staff-api-admin, Plan: 02 — Completed: 2026-04-02*
