---
phase: 65-connect-aware-checkout-webhook-routing
plan: 01
subsystem: payments
tags: [stripe, stripe-connect, drizzle, supabase, typescript]

# Dependency graph
requires:
  - phase: 63-stripe-connect-backend
    provides: tenant_stripe_accounts table + IStorage.getTenantStripeAccount() helper
provides:
  - platform_fee_amount + tenant_net_amount nullable INTEGER columns on bookings (DB + Drizzle schema)
  - server/lib/stripe-context.ts with getStripeContextForTenant() discriminated union (connect | legacy | connect-incomplete | none)
  - calculateApplicationFee() helper for PF-02 fee math (floor, min 1 cent)
  - STRIPE_PLATFORM_FEE_PERCENT + STRIPE_WEBHOOK_SECRET_CONNECT documented in .env.example
affects: [65-02-checkout-routing, 65-03-webhook-routing, 66-revenue-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated union for tenant payment routing decisions"
    - "Per-phase Supabase migration timestamp convention (one day after prior phase)"

key-files:
  created:
    - supabase/migrations/20260524000000_phase65_booking_payment_breakdown.sql
    - server/lib/stripe-context.ts
  modified:
    - shared/schema.ts
    - .env.example

key-decisions:
  - "Discriminated union with 4 kinds rather than nullable result — caller must explicitly handle connect-incomplete state (PF-03) at compile time"
  - "Connect path takes precedence over legacy when a tenant has both — enables automatic migration from legacy per-tenant API key to Connect onboarding"
  - "calculateApplicationFee enforces minimum 1 cent because Stripe rejects application_fee_amount=0 on Connect charges"
  - "Helper returns kind:'none' (not throw) when STRIPE_SECRET_KEY is missing despite a Connect row — caller surfaces clean 501/402 instead of 500"

patterns-established:
  - "Pattern: Single decision-point helper returning a discriminated union for multi-path Stripe routing"
  - "Pattern: Connect-first precedence with legacy fallback inside the helper, not duplicated at each call site"

requirements-completed: [PF-04, PF-05]

# Metrics
duration: 3min
completed: 2026-05-15
---

# Phase 65 Plan 01: Connect Routing Foundation Summary

**Discriminated-union Stripe context helper + booking fee-breakdown columns laying groundwork for Connect-aware checkout and webhook routing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-15T17:08:55Z
- **Completed:** 2026-05-15T17:11:51Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments
- Added `platform_fee_amount` + `tenant_net_amount` nullable INTEGER columns to the `bookings` table (Supabase migration + Drizzle schema), ready to receive webhook-derived values without touching the live payment path.
- Introduced `server/lib/stripe-context.ts` exporting `getStripeContextForTenant()` returning a 4-kind discriminated union (`connect` / `legacy` / `connect-incomplete` / `none`) so Plans 65-02 and 65-03 share a single routing decision point.
- Exposed `calculateApplicationFee()` implementing PF-02 fee math: `Math.max(1, Math.floor(totalCents * percent / 100))`.
- Documented `STRIPE_PLATFORM_FEE_PERCENT` (default 5) and `STRIPE_WEBHOOK_SECRET_CONNECT` in `.env.example`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Supabase migration for booking payment breakdown columns** — `257336d` (feat)
2. **Task 2: Add platformFeeAmount + tenantNetAmount to Drizzle bookings table** — `6011532` (feat)
3. **Task 3: Create stripe-context.ts helper with discriminated union** — `e8be701` (feat)
4. **Task 4: Document new env vars in .env.example** — `9978c18` (docs)

## Files Created/Modified
- `supabase/migrations/20260524000000_phase65_booking_payment_breakdown.sql` — DDL: nullable `platform_fee_amount` + `tenant_net_amount` INTEGER columns on bookings.
- `shared/schema.ts` — Added matching `platformFeeAmount` + `tenantNetAmount` columns to the `bookings` pgTable (camelCase TS / snake_case DB), inserted between `stripePaymentStatus` and `contactId`.
- `server/lib/stripe-context.ts` — New file (87 lines) exporting `getStripeContextForTenant`, `calculateApplicationFee`, plus the `StripeContext` interface and `StripeContextResult` discriminated union. Uses the same Stripe API version (`2026-03-25.dahlia`) as `server/lib/stripe.ts` for consistency.
- `.env.example` — Appended Phase 65 section documenting `STRIPE_PLATFORM_FEE_PERCENT=5` and `STRIPE_WEBHOOK_SECRET_CONNECT=whsec_...` with comments explaining the separate Connect webhook endpoint requirement.

## Decisions Made

**Why a 4-kind discriminated union vs nullable result?**

A nullable return forces every caller to remember the connect-incomplete vs none distinction and to construct a Stripe client conditionally. Encoding all four states in the type makes the compiler enforce that callers handle `connect-incomplete` (PF-03 → 402 with "complete Stripe onboarding" message) distinctly from `none` (501 "Stripe not configured"). It also means the helper never constructs a Stripe client for incomplete-Connect tenants — saves one needless `new Stripe()` per request and keeps the failure path crash-free.

**Why Connect precedence over legacy?**

A tenant may have both a (deprecated) `integrationSettings.stripe.apiKey` row AND a fresh `tenant_stripe_accounts` Connect row mid-migration. By checking Connect first, the moment a tenant completes Connect onboarding their new payments route through the platform with application fees, without any explicit code path to delete legacy credentials. Plan 65-04 (if we add one) can clean up legacy rows once all tenants are on Connect.

**Why minimum 1 cent fee?**

Stripe rejects `application_fee_amount=0` on Connect charges with `400 Bad Request`. The floor at 1 cent makes the helper safe for arbitrarily small bookings without callers needing to know that constraint.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — all four tasks compiled and verified on first attempt. `npm run check` exits 0.

## User Setup Required

**Deferred human action** (already tracked in STATE.md Pending Items):
- Run `supabase db push` (or equivalent) to apply `20260524000000_phase65_booking_payment_breakdown.sql` to the live database before Plan 65-03's webhook handler writes to the new columns.
- Add `STRIPE_PLATFORM_FEE_PERCENT` and `STRIPE_WEBHOOK_SECRET_CONNECT` to the runtime environment before deploying Plan 65-03.
- Create a Connect-level webhook endpoint in Stripe Dashboard → Connect → Webhooks (separate from the existing platform webhook) and copy its signing secret into `STRIPE_WEBHOOK_SECRET_CONNECT`.

## Next Phase Readiness

- Plan 65-02 (Connect-aware checkout endpoint) can now consume `getStripeContextForTenant()` and `calculateApplicationFee()` directly. Discriminated-union surface enables `switch` statements that the TS compiler exhaustively checks.
- Plan 65-03 (webhook routing) can read `event.account` to decide which signing secret to verify against, then use the same helper to recover tenant context and persist `platformFeeAmount` / `tenantNetAmount`.
- No behavioral change to the running app yet — no production code path imports `stripe-context.ts` (it is dead until 65-02 wires it into the checkout endpoint).

## Self-Check: PASSED

Verified files exist:
- FOUND: `supabase/migrations/20260524000000_phase65_booking_payment_breakdown.sql`
- FOUND: `server/lib/stripe-context.ts`
- FOUND: modifications in `shared/schema.ts` (platformFeeAmount/tenantNetAmount columns)
- FOUND: Phase 65 section in `.env.example`

Verified commits exist:
- FOUND: 257336d (Task 1)
- FOUND: 6011532 (Task 2)
- FOUND: e8be701 (Task 3)
- FOUND: 9978c18 (Task 4)

Verified `npm run check` exits 0 after all four tasks.

---
*Phase: 65-connect-aware-checkout-webhook-routing*
*Completed: 2026-05-15*
