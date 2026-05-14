---
phase: 48-stripe-subscription-infrastructure
plan: 03
subsystem: billing
tags: [stripe, webhook, express, saas, subscription]

# Dependency graph
requires:
  - phase: 48-01
    provides: tenant_subscriptions table + upsertTenantSubscription IStorage method
provides:
  - POST /api/billing/webhook handler (billingWebhookHandler)
  - Stripe signature verification (express.raw + constructEvent)
  - customer.subscription.updated / customer.subscription.deleted event processing
affects:
  - server/index.ts (webhook mounted before express.json)
  - .env.example (documents STRIPE_SAAS_PRICE_ID, STRIPE_WEBHOOK_SECRET)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Billing webhook mounted before express.json() using express.raw({ type 'application/json' }) — raw body Buffer preserved for Stripe signature verification
    - Global registry db-direct lookup by stripeCustomerId (no tenantId at handler entry — cross-tenant operation)
    - Stripe SDK v21 pattern: current_period_end is on SubscriptionItem.current_period_end, not Subscription

key-files:
  created:
    - server/routes/billing.ts
  modified:
    - server/index.ts
    - .env.example

key-decisions:
  - "Webhook bypasses resolveTenantMiddleware — mounted directly on app in index.ts, NOT in registerRoutes()"
  - "Tenant lookup by stripeCustomerId uses db directly — handler has no tenantId at entry point (global registry pattern)"
  - "Stripe SDK v21: current_period_end moved from Subscription to SubscriptionItem; access via sub.items.data[0].current_period_end"
  - "Unknown stripeCustomerId returns 200 (acknowledge) — not a processing error from Stripe's perspective"

requirements-completed: [SB-03, SB-04]

# Metrics
duration: 20min
completed: 2026-05-13
---

# Phase 48 Plan 03: Stripe Subscription Infrastructure — Billing Webhook Handler Summary

**Stripe webhook handler in server/routes/billing.ts mounted in server/index.ts BEFORE express.json() using express.raw() to preserve raw body for signature verification; handles subscription.updated and subscription.deleted events**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-13T00:00:00Z
- **Completed:** 2026-05-13T00:20:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Created `server/routes/billing.ts` exporting `billingWebhookHandler` named function
- Stripe signature verification via `stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret)` — invalid signature returns 400
- Handles `customer.subscription.updated` — updates status, planId, currentPeriodEnd in tenant_subscriptions
- Handles `customer.subscription.deleted` — sets status to "canceled" regardless of Stripe's sub.status
- Unknown stripeCustomerId returns 200 (acknowledge without processing error)
- Tenant lookup by stripeCustomerId uses `db` directly (global registry, cross-tenant)
- Mounted `app.post("/api/billing/webhook", express.raw(...), billingWebhookHandler)` in `server/index.ts` at line 37, BEFORE `express.json()` at line 40
- NOT added to `registerRoutes()` — bypasses `resolveTenantMiddleware`
- Added `STRIPE_SAAS_PRICE_ID` and `STRIPE_WEBHOOK_SECRET` to `.env.example` with setup comments
- `npm run check` passes with 0 TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create server/routes/billing.ts with Stripe webhook handler** - `51accf9` (feat)
2. **Task 2: Mount webhook in server/index.ts BEFORE express.json() + update .env.example** - `b10762f` (feat)

## Files Created/Modified

- `server/routes/billing.ts` — billingWebhookHandler with signature verification and subscription event processing
- `server/index.ts` — import + mount webhook before express.json() body-parser
- `.env.example` — STRIPE_SAAS_PRICE_ID and STRIPE_WEBHOOK_SECRET documented with comments

## Decisions Made

- Webhook mounted directly on `app` in `server/index.ts` (not in `registerRoutes()`) — ensures it bypasses `resolveTenantMiddleware` entirely
- Cross-tenant lookup: at handler entry, only `stripeCustomerId` is known; `db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.stripeCustomerId, ...))` retrieves tenantId
- Stripe SDK v21 changed: `current_period_end` moved from `Subscription` to `SubscriptionItem` — fix applied automatically (deviation Rule 1)
- Unknown customer acknowledged with 200 to prevent Stripe retry storms on stale/test data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stripe SDK v21 removed `current_period_end` from Subscription**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** Plan referenced `sub.current_period_end` but Stripe SDK v21 moved this property to `SubscriptionItem.current_period_end`; accessing it on `Subscription` causes TS error TS2339
- **Fix:** Changed to `sub.items.data[0]?.current_period_end` with null guard for missing items
- **Files modified:** `server/routes/billing.ts` (line 64)
- **Commit:** `51accf9`

## Self-Check: PASSED

- [x] `server/routes/billing.ts` exists
- [x] Commits `51accf9` and `b10762f` present in git log
- [x] `npm run check` exits 0
- [x] Webhook mounted at line 37, express.json() at line 40 (correct order)
- [x] `billing` not present in `server/routes.ts` (bypasses resolveTenantMiddleware)
- [x] `.env.example` contains STRIPE_SAAS_PRICE_ID and STRIPE_WEBHOOK_SECRET

---
*Phase: 48-stripe-subscription-infrastructure*
*Completed: 2026-05-13*
