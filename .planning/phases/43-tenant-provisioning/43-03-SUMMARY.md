---
phase: 43-tenant-provisioning
plan: 03
subsystem: ui
tags: [super-admin, provisioning, react, dialog, react-query, mutation]

# Dependency graph
requires:
  - phase: 43-02
    provides: POST /api/super-admin/tenants/:id/provision endpoint returning one-time credentials
  - phase: 42-tenant-management-ui
    provides: useSuperAdminTenants hook + TenantListItem type + TenantsSection component
provides:
  - ProvisionResult type exported from useSuperAdmin.ts
  - useSuperAdminProvision mutation hook (POST /api/super-admin/tenants/:id/provision)
  - ProvisionDialog component: email form -> one-time credentials display with Copy buttons
  - Provision Admin button wired into each tenant row in TenantsSection
affects: [44-isolation-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "provision.reset() on dialog close clears mutation data — password gone from state after dialog closes"
    - "provisionTarget state (TenantListItem | null) drives both open and which tenant, matching domainsTarget pattern"
    - "ProvisionResult type cast in Copy onClick handlers to satisfy TypeScript non-null check on mutation data"

key-files:
  created: []
  modified:
    - client/src/hooks/useSuperAdmin.ts
    - client/src/pages/SuperAdmin.tsx

key-decisions:
  - "provision.reset() called when dialog closes — not just on success — ensures password is always wiped from React Query cache on any close"
  - "ProvisionDialog placed before TenantsSection function (not inside) — avoids re-creation on each TenantsSection render"
  - "409 Conflict error surfaced via onError callback into local error state — no crash, dialog stays open for correction"

patterns-established:
  - "Dialog driven by target state (TenantListItem | null): open={target !== null}, onOpenChange clears state — consistent with ManageDomainsDialog"

requirements-completed: [TO-05]

# Metrics
duration: 8min
completed: 2026-05-14
---

# Phase 43 Plan 03: Provision Admin UI Summary

**ProvisionDialog with one-time credentials display + Provision Admin button in each tenant row of /superadmin Tenants table**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-05-14
- **Tasks:** 2 (+ 1 checkpoint auto-approved in auto-advance mode)
- **Files modified:** 2

## Accomplishments

- Added `ProvisionResult` interface and `useSuperAdminProvision` mutation hook to `client/src/hooks/useSuperAdmin.ts` — calls POST /api/super-admin/tenants/:id/provision via `superAdminFetch`
- Added `ProvisionDialog` component to `client/src/pages/SuperAdmin.tsx` — two-phase: email input form -> one-time credentials display with Copy buttons for email and generated password
- Password cleared from React Query mutation cache when dialog closes (`provision.reset()`) — cannot be retrieved after close
- 409 Conflict (duplicate email) surfaces as inline error message in the dialog form, not a crash
- Added `Provision Admin` button to each tenant row in TenantsSection (between Domains and Activate/Deactivate)
- Wired `provisionTarget` state and `ProvisionDialog` into `TenantsSection`, matching the existing `domainsTarget`/`ManageDomainsDialog` pattern
- TypeScript check passes with zero errors

## Task Commits

1. **Task 1: ProvisionResult type + useSuperAdminProvision hook** - `1c0c1b1` (feat)
2. **Task 2: ProvisionDialog component + Provision Admin button** - `add84ce` (feat)

## Files Created/Modified

- `client/src/hooks/useSuperAdmin.ts` - Added `ProvisionResult` interface and `useSuperAdminProvision` mutation hook (24 lines)
- `client/src/pages/SuperAdmin.tsx` - Added `ProvisionDialog` component, `provisionTarget` state, button per row, dialog wiring (132 lines)

## Decisions Made

- `provision.reset()` called in `handleClose` unconditionally (not just on success) — any dialog close wipes the password from state
- `ProvisionDialog` defined as a top-level function component, not inside `TenantsSection` — avoids re-creation on TenantsSection renders
- 409 errors land in local `error` state via `onError` callback — form stays open, user can try a different email

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `client/src/hooks/useSuperAdmin.ts` exists and contains `export interface ProvisionResult` and `export function useSuperAdminProvision`
- `client/src/pages/SuperAdmin.tsx` contains `ProvisionDialog`, `useSuperAdminProvision`, `provisionTarget`, `Provision Admin`, `provision.data.password`
- Commits `1c0c1b1` and `add84ce` verified in git log
- `npm run check` exits 0

## Next Phase Readiness

- Phase 43 complete: DB migration + provision endpoint (43-01, 43-02) + UI (43-03) all shipped
- Phase 44 Isolation Verification can proceed — provisioning flow enables creating test tenant admin users without direct DB access
- Pending human actions before live testing: `supabase db push` for Phase 38 multi-tenant schema migrations and Phase 43 password column migration

---
*Phase: 43-tenant-provisioning*
*Completed: 2026-05-14*
