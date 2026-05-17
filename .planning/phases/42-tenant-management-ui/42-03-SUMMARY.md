---
phase: 42-tenant-management-ui
plan: 03
subsystem: ui
tags: [react, react-query, shadcn-ui, super-admin, tenant-management, typescript]

# Dependency graph
requires:
  - phase: 42-02
    provides: Six Express routes for tenant/domain CRUD under /api/super-admin/*
  - phase: 42-01
    provides: IStorage global-registry methods (createTenant, addDomain, updateTenantStatus, getTenantDomains, removeDomain)
provides:
  - useSuperAdminTenants hook: GET list + createTenant POST + toggleStatus PATCH mutations
  - useSuperAdminTenantDomains hook: GET domains per tenant + addDomain POST + removeDomain DELETE
  - TenantsSection component: tenants table with inline CRUD actions
  - ManageDomainsDialog component: per-tenant domain management
affects:
  - 42-04 (future plans consuming tenant UI patterns)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - React Query hooks with enabled flag guard for super-admin authenticated context
    - Inline 409 error surfacing via mutation onError callback (no alert() for expected errors)
    - Primary domain guard client-side via disabled button on isPrimary=true rows
    - Dialog state driven by TenantListItem | null (null = closed, value = open for that tenant)

key-files:
  created: []
  modified:
    - client/src/hooks/useSuperAdmin.ts
    - client/src/pages/SuperAdmin.tsx

key-decisions:
  - "useSuperAdminTenants takes enabled boolean matching existing hook pattern — avoids fetching before auth check completes"
  - "Create Tenant 409 errors surfaced inline via setCreateError (not alert()) — consistent with plan must_haves"
  - "ManageDomainsDialog driven by domainsTarget state (TenantListItem | null) — single state drives both open and which tenant"
  - "TenantsSection mounted FIRST inside Dashboard div — above Platform Stats per plan spec"

requirements-completed: [TO-01, TO-02, TO-03, TO-04]

# Metrics
duration: 12min
completed: 2026-05-14
---

# Phase 42 Plan 03: Tenant Management UI — React Hooks + UI Summary

**React Query hooks and TenantsSection component giving super-admin full tenant/domain CRUD via shadcn Table and Dialog without page reloads**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-14T00:45:00Z
- **Completed:** 2026-05-14T00:57:00Z
- **Tasks:** 2 auto + 1 human-verify (auto-approved)
- **Files modified:** 2

## Accomplishments

- Added `TenantListItem` and `DomainRow` exported interfaces to useSuperAdmin.ts
- Implemented `useSuperAdminTenants(enabled)`: useQuery for GET /api/super-admin/tenants, createTenant useMutation (POST), toggleStatus useMutation (PATCH) — all invalidate `["/api/super-admin/tenants"]` on success
- Implemented `useSuperAdminTenantDomains(tenantId, enabled)`: useQuery for domains, addDomain useMutation (POST), removeDomain useMutation (DELETE) — enabled guard requires `tenantId !== null`
- Added Table and Dialog shadcn/ui imports to SuperAdmin.tsx
- Built `ManageDomainsDialog`: lists domains with Primary badge, hostname add form, Remove button disabled for isPrimary rows
- Built `TenantsSection`: tenants table with name/slug/status Badge/primaryDomain/createdAt columns + "Add Tenant" dialog (inline 409 error) + per-row "Domains" and Activate/Deactivate buttons
- Wired `<TenantsSection />` as FIRST section in Dashboard (above Platform Stats)
- `npm run check` passes with zero TypeScript errors

## Task Commits

1. **Task 1: useSuperAdminTenants and useSuperAdminTenantDomains hooks** — `285633d`
2. **Task 2: TenantsSection wired into Dashboard** — `e40a673`

## Files Created/Modified

- `client/src/hooks/useSuperAdmin.ts` — Added TenantListItem, DomainRow interfaces + useSuperAdminTenants + useSuperAdminTenantDomains (114 lines added)
- `client/src/pages/SuperAdmin.tsx` — Added shadcn Table/Dialog imports + ManageDomainsDialog + TenantsSection + wired into Dashboard (301 lines added)

## Decisions Made

- useSuperAdminTenants takes enabled boolean matching existing hook pattern — avoids fetching before auth check completes.
- Create Tenant 409 errors surfaced inline via setCreateError (not alert()) — consistent with plan must_haves.
- ManageDomainsDialog driven by domainsTarget state (TenantListItem | null) — single state drives both open and which tenant.
- TenantsSection mounted FIRST inside Dashboard div — above Platform Stats per plan spec.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — UI connects to API routes built in Plan 42-02; no new env vars or migrations required.

## Known Stubs

None — all hooks wire to real API endpoints; all table data comes from live queries.

## Next Phase Readiness

- Phase 42 complete (all 3 plans done)
- Phase 43 (Tenant Provisioning) can now be implemented — tenant list UI is live
- No blockers

---
*Phase: 42-tenant-management-ui*
*Completed: 2026-05-14*
