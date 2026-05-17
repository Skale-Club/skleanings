---
phase: 49-subscription-enforcement
plan: 02
subsystem: super-admin
tags: [stripe, billing, super-admin, react, typescript]

# Dependency graph
requires:
  - phase: 48-01
    provides: tenant_subscriptions table + Drizzle schema
  - phase: 48-02
    provides: createTenantSubscription called on tenant creation
affects:
  - server/routes/super-admin.ts (GET /tenants now LEFT JOINs tenant_subscriptions)
  - client/src/hooks/useSuperAdmin.ts (TenantListItem extended with billing fields)
  - client/src/pages/SuperAdmin.tsx (TenantsSection table has Billing Status column)
provides:
  - GET /api/super-admin/tenants returns billingStatus, billingPlanId, billingCurrentPeriodEnd per tenant
  - Super-admin panel shows color-coded billing status badge + renewal date per tenant row

# Tech tracking
tech-stack:
  added: []
  patterns:
    - LEFT JOIN tenant_subscriptions on tenant.id — null fields when no subscription row exists (new tenant, Stripe creation failed)
    - Color-coded billing badge: green=active/trialing, yellow=past_due, red=canceled, gray=none/unknown

key-files:
  created: []
  modified:
    - server/routes/super-admin.ts
    - client/src/hooks/useSuperAdmin.ts
    - client/src/pages/SuperAdmin.tsx

key-decisions:
  - "LEFT JOIN (not INNER JOIN) for tenant_subscriptions — some tenants may not have a subscription row if Stripe customer creation failed at provision time; null billing fields render as dash in UI"
  - "billingCurrentPeriodEnd rendered as date string — API returns ISO timestamp, frontend formats via toLocaleDateString()"
  - "Badge color covers active, trialing, past_due, canceled, and unknown (gray fallback) — covers all Stripe subscription status values"

requirements-completed: [SB-06]

# Metrics
duration: 2min
completed: 2026-05-14
---

# Phase 49 Plan 02: Subscription Enforcement — Billing Status in Tenant List Summary

**GET /api/super-admin/tenants extended with LEFT JOIN on tenant_subscriptions; TenantListItem type updated; TenantsSection renders color-coded Billing Status column with status badge and renewal date**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-14T14:44:14Z
- **Completed:** 2026-05-14T14:46:31Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `tenantSubscriptions` to import in `server/routes/super-admin.ts`
- Extended GET /tenants Drizzle query: `.leftJoin(tenantSubscriptions, eq(tenantSubscriptions.tenantId, tenants.id))` — selects `billingStatus`, `billingPlanId`, `billingCurrentPeriodEnd` alongside existing tenant/domain columns
- Extended `TenantListItem` interface in `useSuperAdmin.ts` with three nullable billing fields
- Added "Billing" column header to TenantsSection table
- Billing cell renders: color-coded Badge (green=active/trialing, yellow=past_due, red=canceled, gray=none) + small date line for `currentPeriodEnd` when available; dash when no subscription row exists
- `npm run check` passes with 0 TypeScript errors after both tasks

## Task Commits

1. **Task 1: Extend GET /tenants to include billing columns** - `8159115` (feat)
2. **Task 2: Add Billing Status column to TenantsSection UI** - `ce5df80` (feat)

## Files Created/Modified

- `server/routes/super-admin.ts` — tenantSubscriptions import + LEFT JOIN + billing column selects in GET /tenants
- `client/src/hooks/useSuperAdmin.ts` — TenantListItem extended with billingStatus, billingPlanId, billingCurrentPeriodEnd
- `client/src/pages/SuperAdmin.tsx` — Billing column header + color-coded status badge cell with renewal date

## Decisions Made

- LEFT JOIN used (not INNER JOIN) — tenants without a subscription row (Stripe creation failed) still appear in the list with null billing fields rendered as dash
- Badge color logic covers all known Stripe subscription statuses plus gray fallback for unknown values

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — billing data is live from the tenant_subscriptions table via LEFT JOIN.

## Self-Check: PASSED

- [x] `server/routes/super-admin.ts` modified with tenantSubscriptions LEFT JOIN
- [x] `client/src/hooks/useSuperAdmin.ts` TenantListItem has billing fields
- [x] `client/src/pages/SuperAdmin.tsx` has Billing column in TenantsSection
- [x] Commits `8159115` and `ce5df80` present in git log
- [x] `npm run check` exits 0

---
*Phase: 49-subscription-enforcement*
*Completed: 2026-05-14*
