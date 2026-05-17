---
phase: 59-plan-tier-foundation-super-admin-plan-management
plan: 03
subsystem: payments
tags: [stripe, webhook, super-admin, plan-tier, billing, drizzle, express]

# Dependency graph
requires:
  - phase: 59-01
    provides: stripe-plans helpers (PlanTier, isPlanTier, getPriceIdForTier, getTierForPriceId), tenant_subscriptions.plan_tier column
  - phase: 48
    provides: billingWebhookHandler skeleton, POST /super-admin/tenants/:id/subscribe pattern, Stripe SDK instantiation
provides:
  - Webhook reverse-mapping of Stripe priceId to PlanTier on customer.subscription.updated/.deleted
  - Conditional planTier persistence (unrecognized priceIds leave existing tier untouched)
  - PATCH /api/super-admin/tenants/:id/plan endpoint (validates tier, swaps Stripe item with prorations, persists DB)
  - 400/403/404/500 error handling for plan-change failure modes
affects: [phase-60, billing-ui, super-admin-tenants-table, plan-tier-dropdown]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional spread in Drizzle .set() to avoid overwriting valid state with null (`...(newTier ? { planTier: newTier } : {})`)"
    - "Optimistic DB write + webhook reconciliation: PATCH endpoint writes both planTier and planId immediately; webhook later confirms idempotently via where(tenant_id) filter"
    - "Stripe item swap with proration_behavior: 'create_prorations' for mid-cycle plan changes"

key-files:
  created: []
  modified:
    - server/routes/billing.ts
    - server/routes/super-admin.ts

key-decisions:
  - "Conditional spread (not nullish coalesce) on planTier in webhook .set() so unrecognized price IDs leave the column unchanged rather than overwriting with null"
  - "Warn-log (not error) on unrecognized priceId to aid operator debugging without failing the webhook"
  - "PATCH endpoint does NOT auto-create subscriptions (returns 404 instead) — matches PT-05 spec, forces operator to call POST /subscribe explicitly first"
  - "proration_behavior: 'create_prorations' set explicitly (matches Stripe default but readable for future maintainers)"
  - "isPlanTier type guard applied to req.body.planTier cast as unknown — never trust request body shape"
  - "Legacy POST /tenants/:id/subscribe endpoint left untouched — continues to use STRIPE_SAAS_PRICE_ID; new webhook mapping fires once subscription is updated by operator to a tier-aliased price"

patterns-established:
  - "Conditional Drizzle .set() spread for nullable enrichment fields that should never overwrite valid state"
  - "PATCH endpoints requiring Stripe item ID lookup: stripe.subscriptions.retrieve to grab items[0].id before stripe.subscriptions.update"

requirements-completed: [PT-04, PT-05]

# Metrics
duration: 4min
completed: 2026-05-15
---

# Phase 59 Plan 03: Webhook Reverse-Lookup + Super-Admin Plan PATCH Summary

**Backend plan-tier loop closed: webhook reverse-maps Stripe priceId to PlanTier on subscription updates, and super-admin can change tenant plan via PATCH /api/super-admin/tenants/:id/plan with prorations and DB persistence.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-15T13:08:19Z
- **Completed:** 2026-05-15T13:11:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- (PT-04) `billingWebhookHandler` now imports `getTierForPriceId` and writes `planTier` into `tenant_subscriptions` whenever the new Stripe priceId matches one of the 3 tier env vars; unrecognized priceIds emit a warn-log and leave `planTier` untouched
- (PT-05) New `PATCH /api/super-admin/tenants/:id/plan` endpoint guarded by `requireSuperAdmin`: validates tier via `isPlanTier`, retrieves Stripe subscription, swaps item price with `create_prorations`, and persists via `storage.upsertTenantSubscription`
- Full 400/403/404/500 error matrix: invalid tier → 400, missing super-admin session → 403 (from guard), missing subscription → 404, unset env var or no items → 500
- `npm run check` exits 0 — no regressions to existing webhook events (`trial_will_end`, `past_due` dunning) or legacy `POST /tenants/:id/subscribe`

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend webhook with reverse priceId→tier mapping (PT-04)** — `2519913` (feat)
2. **Task 2: PATCH /api/super-admin/tenants/:id/plan endpoint (PT-05)** — `67f2903` (feat)

**Plan metadata:** _(pending — final docs commit)_

## Files Created/Modified
- `server/routes/billing.ts` — Added `getTierForPriceId` import; in the `customer.subscription.updated`/`.deleted` case, compute `newTier` from `firstItem.price.id` and conditionally include `planTier` in the `.set()` payload (15 insertions, 1 deletion)
- `server/routes/super-admin.ts` — Added `getPriceIdForTier`, `isPlanTier`, `PlanTier` imports; new PATCH `/tenants/:id/plan` endpoint with full validation + Stripe item swap + DB upsert (70 insertions)

## Decisions Made
- **Conditional spread over nullish coalesce for planTier:** `...(newTier ? { planTier: newTier } : {})` is preferred because writing `planTier: newTier ?? subRow.planTier` would still issue a column write (wasteful) and require an additional read of the existing row. The spread elegantly omits the key entirely when there's no recognized tier.
- **Warn-log on unrecognized priceId:** Operators alias legacy `STRIPE_SAAS_PRICE_ID` → `STRIPE_SAAS_PRICE_ID_BASIC` per Phase 59-01; if they forget, the warn-log surfaces the unrecognized priceId in their logs so they can fix the env var. Failing the webhook would risk Stripe retries cascading.
- **PATCH endpoint does NOT auto-subscribe:** 404 with a hint pointing the operator at `POST /tenants/:id/subscribe`. Keeps responsibilities split: subscribe = create, plan = change.
- **proration_behavior set explicitly:** `'create_prorations'` is the Stripe default, but writing it explicitly documents intent for future readers and protects against Stripe changing the default.
- **Optimistic DB write + webhook reconciliation:** PATCH writes `planTier` and `planId` to the DB immediately, accepting that the webhook will fire shortly after and write the same values (idempotent via `where(tenant_id)`). This avoids a UX where the super-admin clicks "change plan" and the UI shows the old tier until Stripe's webhook arrives.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The `upsertTenantSubscription` signature widening from Phase 59-01 (`Partial<Omit<InsertTenantSubscription, ...>>`) auto-accepted the new `planTier` field with zero changes to storage layer — exactly as Phase 59-01's [decision log](.../59-01-SUMMARY.md) predicted.

## User Setup Required

External services require manual configuration (carry-over from Phase 59):
- `STRIPE_SAAS_PRICE_ID_BASIC`, `STRIPE_SAAS_PRICE_ID_PRO`, `STRIPE_SAAS_PRICE_ID_ENTERPRISE` must be set in `.env` with valid Stripe Price IDs before the webhook reverse-lookup or PATCH endpoint can resolve tiers
- `supabase db push` must be run to apply the `tenant_subscriptions.plan_tier` migration from Phase 59-01

No NEW external setup is required for Phase 59-03 — it consumes the env vars and migration that Phase 59-01 introduced.

## Next Phase Readiness
- Phase 60-02 can wire a `<Select>` dropdown in the super-admin Tenants table directly to `PATCH /api/super-admin/tenants/:id/plan` — the endpoint accepts JSON body `{ planTier: 'basic' | 'pro' | 'enterprise' }` and returns 200 with `{ message, planTier, subscription }`
- Phase 60-01 can rely on `GET /api/billing/status` (and forthcoming `features` field) being eventually consistent with whatever the super-admin PATCHes, thanks to optimistic write + webhook reconciliation
- No blockers — both PT-04 and PT-05 closed, Phase 59 backend feature surface complete

## Self-Check: PASSED

Verified post-write:
- `server/routes/billing.ts` exists with `getTierForPriceId` import (line 17) and call (line 70), plus `planTier` conditional spread (line 85)
- `server/routes/super-admin.ts` exists with PATCH /tenants/:id/plan handler (line 354), `isPlanTier`/`getPriceIdForTier` import (line 14), and Stripe item swap with `proration_behavior: "create_prorations"` (lines 390-393)
- Commit `2519913` present in `git log`
- Commit `67f2903` present in `git log`
- `npm run check` exits 0

---
*Phase: 59-plan-tier-foundation-super-admin-plan-management*
*Completed: 2026-05-15*
