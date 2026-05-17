---
phase: 50-tenant-billing-self-service
plan: 01
subsystem: billing
tags: [stripe, billing, self-service, router, requireAdmin]

# Dependency graph
requires:
  - phase: 49-subscription-enforcement
    provides: 402 enforcement, billingStatus columns
  - phase: 48-stripe-subscription-infrastructure
    provides: tenant_subscriptions table, getTenantSubscription storage method, Stripe customer IDs
provides:
  - GET /api/billing/status (returns subscription row for current tenant)
  - POST /api/billing/portal (creates Stripe Customer Portal session, returns { url })
affects:
  - tenant admin frontend (billing page can now fetch status and redirect to Stripe portal)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - billingRouter: named Router export from billing.ts, mounted after resolveTenantMiddleware
    - requireAdmin guard: session-based fast-path + cross-tenant check on both billing routes
    - Stripe billingPortal.sessions.create: tenant self-service portal redirect pattern

key-files:
  created: []
  modified:
    - server/routes/billing.ts
    - server/routes.ts

key-decisions:
  - "billingRouter mounted after resolveTenantMiddleware — res.locals.tenant and res.locals.storage are populated for both routes"
  - "billingWebhookHandler kept unchanged — still mounted pre-body-parser in server/index.ts (raw body required)"
  - "SITE_URL env var used for portal return_url with req.hostname fallback"

requirements-completed: [SB-07, SB-08]

# Metrics
duration: 3min
completed: 2026-05-14
---

# Phase 50 Plan 01: Tenant Billing Self-Service Summary

**GET /api/billing/status and POST /api/billing/portal added to billingRouter in billing.ts, mounted at /api/billing after resolveTenantMiddleware in routes.ts — enables tenant admin to view subscription status and redirect to Stripe self-service portal**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-14T15:00:00Z
- **Completed:** 2026-05-14T15:03:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `Router` and `requireAdmin` imports to `server/routes/billing.ts`
- Exported `billingRouter` (Express Router) from `billing.ts` after the existing `billingWebhookHandler`
- `GET /status` handler: calls `res.locals.storage!.getTenantSubscription(tenant.id)`, returns `{ status, planId, currentPeriodEnd, stripeCustomerId }` or `{ status: "none", ... }` for new tenants
- `POST /portal` handler: fetches subscription row, calls `stripe.billingPortal.sessions.create({ customer, return_url })`, returns `{ url }`
- Both routes guarded by `requireAdmin` (session fast-path + cross-tenant check)
- `billingWebhookHandler` export unchanged — pre-body-parser mount in `server/index.ts` unaffected
- Added `billingRouter` import to `server/routes.ts`
- Mounted `app.use("/api/billing", billingRouter)` after `resolveTenantMiddleware` (line 36) at line 100
- `npm run check` passes with 0 TypeScript errors after both tasks

## Task Commits

1. **Task 1: Refactor billing.ts — add billingRouter with GET /status and POST /portal** - `b5ee61e` (feat)
2. **Task 2: Mount billingRouter in server/routes.ts** - `05dfa6c` (feat)

## Files Modified

- `server/routes/billing.ts` — Router + requireAdmin imports, billingRouter export with /status and /portal handlers (57 lines added)
- `server/routes.ts` — billingRouter import + mount at /api/billing after resolveTenantMiddleware (5 lines added)

## Decisions Made

- `billingRouter` mounted after `resolveTenantMiddleware` — ensures `res.locals.tenant` and `res.locals.storage` are always populated when routes execute
- `billingWebhookHandler` left completely unchanged — it is mounted in `server/index.ts` before `express.json()` using `express.raw()` to preserve raw body for Stripe signature verification
- `SITE_URL` env var drives the portal `return_url` with `https://${req.hostname}` as fallback

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- server/routes/billing.ts: FOUND (export const billingRouter, export async function billingWebhookHandler, billingPortal.sessions.create, getTenantSubscription — all present)
- server/routes.ts: FOUND (billingRouter import at line 28, mount at line 100 after resolveTenantMiddleware at line 36)
- .planning/phases/50-tenant-billing-self-service/50-01-SUMMARY.md: FOUND (this file)
- Commit b5ee61e (Task 1): FOUND
- Commit 05dfa6c (Task 2): FOUND

---
*Phase: 50-tenant-billing-self-service*
*Completed: 2026-05-14*
