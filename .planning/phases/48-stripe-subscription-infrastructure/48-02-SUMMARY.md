---
phase: 48-stripe-subscription-infrastructure
plan: 02
subsystem: api
tags: [stripe, subscription, super-admin, express, saas]

# Dependency graph
requires:
  - phase: 48-01
    provides: createTenantSubscription, getTenantSubscription, upsertTenantSubscription storage methods
provides:
  - POST /api/super-admin/tenants extended with Stripe customer creation
  - POST /api/super-admin/tenants/:id/subscribe endpoint for activating Stripe Subscriptions
affects:
  - 48-03 (webhook handler will call upsertTenantSubscription using same pattern)
  - 49-subscription-enforcement (subscription status accessible via GET /tenants for 402 guard)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Stripe SDK v21: use (stripeSub as any).current_period_end for runtime field access (TypeScript types dropped the field)
    - Non-fatal Stripe error pattern: inner try/catch for Stripe calls in tenant creation — tenant 201 is not blocked

key-files:
  created: []
  modified:
    - server/routes/super-admin.ts

key-decisions:
  - "Stripe import and module-level stripe client added to super-admin.ts — both POST /tenants and POST /tenants/:id/subscribe share the same client instance"
  - "Stripe customer creation failure is non-fatal: logged but does not block the 201 response — subscription row can be backfilled"
  - "STRIPE_SAAS_PRICE_ID read from process.env at call time (not module load) — allows env var to be set after server start without restart"
  - "Stripe SDK v21 TypeScript types dropped current_period_end from Subscription interface — runtime cast via (stripeSub as any).current_period_end with null fallback"

patterns-established:
  - "Non-fatal Stripe side-effect pattern: inner try/catch isolates Stripe failures from tenant creation success path"
  - "STRIPE_SAAS_PRICE_ID guard at route entry: returns 500 with clear message if not configured"

requirements-completed: [SB-01, SB-02]

# Metrics
duration: 5min
completed: 2026-05-14
---

# Phase 48 Plan 02: Stripe Subscription Infrastructure — Subscribe Endpoints Summary

**Stripe import added to super-admin.ts; POST /tenants extended to create Stripe customer + subscription row on tenant creation; new POST /tenants/:id/subscribe endpoint activates a Stripe Subscription for any tenant**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-14T14:19:57Z
- **Completed:** 2026-05-14T14:23:05Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `import Stripe from "stripe"` and module-level `stripe` client to `server/routes/super-admin.ts`
- Extended POST /tenants try block: after `seedTenantCompanySettings`, creates Stripe customer with tenant name + metadata, then calls `storage.createTenantSubscription(tenant.id, customer.id)` — Stripe failure is non-fatal (logged, tenant 201 not blocked)
- Added POST /tenants/:id/subscribe route: validates tenant id and `STRIPE_SAAS_PRICE_ID`, reads subscription row via `getTenantSubscription`, calls `stripe.subscriptions.create`, updates row via `upsertTenantSubscription`
- `npm run check` passes with 0 TypeScript errors across both tasks

## Task Commits

Each task was committed atomically:

1. **Task 1: Stripe import + extend POST /tenants** - `e658886` (feat)
2. **Task 2: Add POST /tenants/:id/subscribe endpoint** - `06af569` (feat)

## Files Created/Modified

- `server/routes/super-admin.ts` — Stripe import, module-level stripe client, extended POST /tenants handler, new POST /tenants/:id/subscribe handler

## Decisions Made

- Stripe customer creation failure is non-fatal: inner try/catch isolates it from the tenant creation success path — tenant 201 is always returned, subscription row backfilled if needed
- `STRIPE_SAAS_PRICE_ID` is read from `process.env` at call time (not module load) — validated per plan requirements
- Stripe SDK v21 TypeScript types dropped `current_period_end` from `Subscription` interface; accessed via `(stripeSub as any).current_period_end` with null fallback for type safety

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stripe v21 TypeScript types dropped `current_period_end` from Subscription interface**
- **Found during:** Task 2 verification (`npm run check`)
- **Issue:** `stripeSub.current_period_end` caused TS2339 — property does not exist on `Response<Subscription>` in Stripe SDK v21.0.1
- **Fix:** Access via `(stripeSub as any).current_period_end as number | undefined` with null-safe `Date` conversion — field still exists at runtime in Stripe API responses; only the TypeScript declaration was removed in v21
- **Files modified:** `server/routes/super-admin.ts`
- **Commit:** `06af569`

## Next Phase Readiness

- Phase 48-03 (webhook handler): storage methods ready; same `(sub as any).current_period_end` pattern will be needed in billing.ts
- Phase 49 (enforcement): tenant subscription status is queryable via `getTenantSubscription` — 402 guard can read `status` and `currentPeriodEnd`

---
*Phase: 48-stripe-subscription-infrastructure*
*Completed: 2026-05-14*
