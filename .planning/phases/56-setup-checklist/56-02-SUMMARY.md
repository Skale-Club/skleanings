---
phase: 56
plan: "02"
subsystem: frontend
tags: [setup-checklist, react-query, admin-ui, onboarding]
dependency_graph:
  requires: [56-01]
  provides: [setup-checklist-ui, useSetupStatus-hook]
  affects: [client/src/pages/Admin.tsx]
tech_stack:
  added: []
  patterns: [react-query-useQuery, shadcn-card, lucide-icons]
key_files:
  created:
    - client/src/hooks/useSetupStatus.ts
    - client/src/components/SetupChecklist.tsx
  modified:
    - client/src/pages/Admin.tsx
decisions:
  - React fragment wrapper used in dashboard condition to support SetupChecklist + DashboardSection siblings
  - staleTime set to 10s for setup-status query — live enough without server hammering
metrics:
  duration: "~8 minutes"
  completed: "2026-05-14"
  tasks_completed: 2
  files_changed: 3
---

# Phase 56 Plan 02: Setup Checklist Frontend Summary

Setup checklist UI with React Query hook fetching live DB state and a dismissable card rendered above the admin dashboard.

## What Was Built

- `useSetupStatus` hook queries `/api/admin/setup-status` with 10s staleTime via React Query
- `SetupChecklist` card shows three completion indicators (CheckCircle green / Circle gray) and a Dismiss button
- Card hides when `dismissed=true` OR when all three items (`hasService && hasStaff && hasAvailability`) are true
- Dismiss POSTs to `/api/admin/setup-dismiss` and immediately invalidates the query so the card disappears
- `Admin.tsx` imports and renders `<SetupChecklist />` above `<DashboardSection />` inside the `activeSection === 'dashboard'` branch

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | useSetupStatus hook + SetupChecklist component | 8cfe3f6 | useSetupStatus.ts, SetupChecklist.tsx |
| 2 | Wire SetupChecklist into Admin.tsx dashboard section | 24c6169 | Admin.tsx |

## Verification

- `npm run check` passes with zero TypeScript errors (confirmed twice)
- `client/src/hooks/useSetupStatus.ts` exists, exports `useSetupStatus`
- `client/src/components/SetupChecklist.tsx` exists, exports `SetupChecklist`
- `Admin.tsx` imports `SetupChecklist` and renders it before `DashboardSection` in the dashboard section
- Card hides when dismissed or all items complete

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all three checklist items link to live admin routes (`/admin/services`, `/admin/staff`, `/admin/availability`).

## Self-Check: PASSED

- client/src/hooks/useSetupStatus.ts: FOUND
- client/src/components/SetupChecklist.tsx: FOUND
- Admin.tsx contains SetupChecklist import and render: FOUND
- Commits 8cfe3f6 and 24c6169: FOUND
