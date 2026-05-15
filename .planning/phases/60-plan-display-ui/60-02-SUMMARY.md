---
phase: 60-plan-display-ui
plan: 02
subsystem: ui
tags: [super-admin, react-query, shadcn, select, stripe, plan-tier]

# Dependency graph
requires:
  - phase: 59-plan-tier-foundation-super-admin-plan-management
    provides: "PATCH /api/super-admin/tenants/:id/plan endpoint + planTier column on tenant_subscriptions"
  - phase: 49
    provides: "tenantSubscriptions LEFT JOIN already in GET /tenants projection"
provides:
  - "planTier field on GET /api/super-admin/tenants response"
  - "useUpdateTenantPlan mutation hook with React Query invalidation"
  - "Plan column with Select dropdown (Basic/Pro/Enterprise) in super-admin Tenants table"
  - "TenantListItem.planTier: string | null typing for client consumers"
affects: [super-admin, billing, tenant-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook-level fetch wrapper reuse (superAdminFetch) for consistent error handling"
    - "Conditional UI gating to avoid firing endpoint when prerequisite (Stripe sub) is missing"

key-files:
  created: []
  modified:
    - server/routes/super-admin.ts
    - client/src/hooks/useSuperAdmin.ts
    - client/src/pages/SuperAdmin.tsx

key-decisions:
  - "Hide Select for tenants with planTier === null instead of disabling — prevents firing PATCH that would 404 server-side"
  - "Reuse superAdminFetch wrapper so errors (404 no-sub, 500 missing price-id) surface with proper message extraction"
  - "Surface PATCH errors via alert() rather than crashing the table — matches existing toggleStatus pattern"

patterns-established:
  - "Plan-tier display: planTier resolves through LEFT JOIN, null when no subscription row exists"
  - "Optimistic invalidation: PATCH onSuccess invalidates /api/super-admin/tenants query for full row refresh"

requirements-completed: [PT-07]

# Metrics
duration: 8min
completed: 2026-05-15
---

# Phase 60 Plan 02: Surface planTier in Super-Admin Tenants Table Summary

**Super-admin Tenants table now shows a Plan column with a Basic/Pro/Enterprise Select per tenant that PATCHes the existing tier endpoint and re-renders on invalidation.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-15T13:23:51Z
- **Completed:** 2026-05-15T13:31:41Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Backend now returns `planTier` per tenant via the existing tenantSubscriptions LEFT JOIN (no new queries)
- Client gets a typed `useUpdateTenantPlan` mutation hook that invalidates the tenants list on success
- Operator-facing Plan column with shadcn Select dropdown wired to the Phase 59-03 PATCH endpoint
- Null-safe UI: tenants without a Stripe subscription show em-dash, preventing accidental 404s

## Task Commits

Each task was committed atomically:

1. **Task 1: Add planTier to GET /api/super-admin/tenants** — `f2862d3` (feat)
2. **Task 2: Add planTier to TenantListItem and useUpdateTenantPlan hook** — `27f7ea3` (feat)
3. **Task 3: Add Plan column with Select dropdown to TenantsSection** — `cc87630` (feat)

**Plan metadata:** _pending final docs commit_

## Files Created/Modified
- `server/routes/super-admin.ts` — Added `planTier: tenantSubscriptions.planTier` to the GET /tenants select projection
- `client/src/hooks/useSuperAdmin.ts` — Added `planTier: string | null` to `TenantListItem`; added new `useUpdateTenantPlan` mutation hook using `superAdminFetch` with query invalidation
- `client/src/pages/SuperAdmin.tsx` — Added Select imports, instantiated `useUpdateTenantPlan` in `TenantsSection`, added Plan `<TableHead>` and matching `<TableCell>` with conditional Select rendering between Status and Primary Domain columns

## Decisions Made
- Used `superAdminFetch` wrapper in `useUpdateTenantPlan` (matching surrounding hooks) rather than a hand-rolled `fetch` — consistent status/message extraction
- Rendered an em-dash placeholder instead of a disabled Select when `planTier === null` — cleaner UX and structurally impossible to trigger the endpoint's 404 path
- Used `alert(err.message)` for error surfacing — matches the existing `toggleStatus` pattern in the same component

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial Edit operations were inadvertently performed on the parent `C:\Users\Vanildo\Dev\skleanings\` checkout instead of the worktree path. Reverted those edits and re-applied them inside the worktree before staging. No code outcome affected; just an operator-side path correction.

## User Setup Required

None - no external service configuration required. The PATCH endpoint (Phase 59-03) already validates `STRIPE_SAAS_PRICE_ID_<TIER>` env vars and surfaces a 500 with a descriptive message if any are unset.

## Next Phase Readiness
- PT-07 closed: super-admin can promote/demote any tenant between Basic/Pro/Enterprise from one screen
- All success criteria met:
  - GET /api/super-admin/tenants returns planTier per tenant
  - useUpdateTenantPlan mutation hook exists with React Query invalidation
  - TenantsSection table has Plan column with Select (basic/pro/enterprise)
  - TenantListItem type includes planTier
  - npm run check passes
- No blockers for downstream phases consuming planTier on the client

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/phases/60-plan-display-ui/60-02-SUMMARY.md`
- All three task commits present: `f2862d3`, `27f7ea3`, `cc87630`
- `server/routes/super-admin.ts` contains `planTier: tenantSubscriptions.planTier` (1 occurrence in GET /tenants projection)
- `client/src/hooks/useSuperAdmin.ts` exports `useUpdateTenantPlan`
- `client/src/pages/SuperAdmin.tsx` imports and uses `useUpdateTenantPlan`
- `npm run check` passes

---
*Phase: 60-plan-display-ui*
*Completed: 2026-05-15*
