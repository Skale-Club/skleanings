---
phase: 49-subscription-enforcement
plan: 01
subsystem: middleware
tags: [stripe, subscription, enforcement, middleware, super-admin]

# Dependency graph
requires:
  - phase: 48-stripe-subscription-infrastructure
    provides: tenant_subscriptions table, getTenantSubscription storage method
provides:
  - 402 enforcement in resolveTenantMiddleware (canceled + past_due grace period)
  - Billing columns in GET /api/super-admin/tenants response
affects:
  - all tenant API requests (402 gate in resolveTenantMiddleware)
  - super-admin tenants UI (billingStatus, billingPlanId, billingPeriodEnd now in response)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 402 enforcement: db-direct query in middleware before res.locals is set
    - 3-day grace period: GRACE_MS constant guards past_due tenants
    - Billing lookup map: Promise.all extended with billingRows, O(1) map per tenant

key-files:
  created: []
  modified:
    - server/middleware/tenant.ts
    - server/routes/super-admin.ts

key-decisions:
  - "402 guard uses db directly — res.locals.storage does not exist yet when middleware runs"
  - "No subRow (no tenant_subscriptions row) => pass through; only blocked when row exists with lapsed status"
  - "billingRows query has no groupBy/WHERE — fetches all subscription rows in single scan; billingMap keyed by tenantId"

requirements-completed: [SB-05, SB-06]

# Metrics
duration: 2min
completed: 2026-05-14
---

# Phase 49 Plan 01: Subscription Enforcement Summary

**402 enforcement guard in resolveTenantMiddleware (canceled + past_due grace period) plus billingStatus/billingPlanId/billingPeriodEnd columns in GET /api/super-admin/tenants via Promise.all extension**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-14T14:37:26Z
- **Completed:** 2026-05-14T14:39:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `tenantSubscriptions` import to `server/middleware/tenant.ts`
- Inserted subscription enforcement block after the 503 inactive guard using `db` directly (not res.locals.storage)
- 3-day grace period logic: `past_due` with `currentPeriodEnd < now - 3 days` returns 402; within grace period passes through
- Tenants with no `tenant_subscriptions` row pass through unblocked (new tenant onboarding path)
- Added `tenantSubscriptions` import to `server/routes/super-admin.ts`
- Extended `Promise.all` in GET /tenants with `billingRows` query (no WHERE, full table scan keyed by tenantId)
- Built `billingMap` lookup and extended result mapping with `billingStatus`, `billingPlanId`, `billingPeriodEnd` (null when no row)
- `npm run check` passes with 0 TypeScript errors after both tasks

## Task Commits

1. **Task 1: 402 guard in resolveTenantMiddleware** - `44b3fa1` (feat)
2. **Task 2: Extend GET /tenants with billing columns** - `ce60d19` (feat)

## Files Modified

- `server/middleware/tenant.ts` — tenantSubscriptions import, 402 enforcement block (25 lines added)
- `server/routes/super-admin.ts` — tenantSubscriptions import, billingRows in Promise.all, billingMap build, result mapping extension (25 lines added)

## Decisions Made

- `db` used directly in middleware: `res.locals.storage` is not yet set when middleware executes — global registry pattern consistent with Phase 48 arch decision
- Grace period constant `GRACE_MS = 3 * 24 * 60 * 60 * 1000` is inline in the guard block for readability
- No `subRow` (missing row in tenant_subscriptions) means new tenant — always passes through, matching the "none" status design from Phase 48-01

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- server/middleware/tenant.ts: FOUND
- server/routes/super-admin.ts: FOUND
- .planning/phases/49-subscription-enforcement/49-01-SUMMARY.md: FOUND
- Commit 44b3fa1 (Task 1): FOUND
- Commit ce60d19 (Task 2): FOUND

---
*Phase: 49-subscription-enforcement*
*Completed: 2026-05-14*
