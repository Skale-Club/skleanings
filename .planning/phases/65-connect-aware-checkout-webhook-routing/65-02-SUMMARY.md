---
phase: 65-connect-aware-checkout-webhook-routing
plan: 02
subsystem: payments
tags: [stripe, connect, checkout, application-fee, multi-tenant]
requires:
  - getStripeContextForTenant (from 65-01)
  - calculateApplicationFee (from 65-01)
  - StripeContext type (from 65-01)
  - tenant_stripe_accounts table (from v19.0)
  - res.locals.tenant + res.locals.storage (from 38-multi-tenant)
provides:
  - Connect-aware POST /api/payments/checkout endpoint
  - createCheckoutSession() extended to accept optional StripeContext + applicationFeeAmount
  - PF-01 routing (Stripe-Account header on Connect path)
  - PF-02 application_fee_amount integer-cent math
  - PF-03 402 mid-onboarding guard
  - PF-04 legacy backward-compat path
affects:
  - server/routes/payments.ts POST /checkout endpoint
  - All callers of createCheckoutSession (backward compat preserved)
tech-stack:
  added: []
  patterns:
    - Discriminated-union result handling (kind: connect | legacy | connect-incomplete | none)
    - Request-option threading for Stripe-Account header (NOT a global client option)
    - Source-of-truth recomputation of totals from line items
key-files:
  created: []
  modified:
    - server/lib/stripe.ts
    - server/routes/payments.ts
decisions:
  - Keep "none" and "connect-incomplete" as separate switch branches (different HTTP codes + messages)
  - Recompute totalCents from lineItems[] rather than validatedData.totalPrice (avoids string/number coercion)
  - Pass context: ctx on BOTH connect and legacy paths (applicationFeeAmount=0 for legacy)
  - Do not touch POST /webhook or GET /verify in this plan — owned by 65-03
metrics:
  duration_minutes: 4
  tasks_completed: 2
  commits: 2
  files_modified: 2
  completed_date: 2026-05-15
---

# Phase 65 Plan 02: Connect-Aware Checkout Endpoint Summary

Wired `POST /api/payments/checkout` to the Phase-65 Stripe context resolver so Connect-onboarded tenants charge through the platform with `application_fee_amount`, mid-onboarding tenants get a 402, and legacy-key tenants keep working unchanged.

## What Was Built

**`server/lib/stripe.ts`** — Extended `createCheckoutSession()`:

- Added two optional params on `CheckoutSessionParams`:
  - `context?: StripeContext` — when supplied, the helper uses `context.stripe` directly instead of calling `getStripeClient(storage)`.
  - `applicationFeeAmount?: number` — when `> 0` AND `context.stripeAccount` is defined, attaches `payment_intent_data.application_fee_amount` to the session params.
- Pass `{ stripeAccount }` as the SECOND argument of `stripe.checkout.sessions.create(params, options)` — Stripe's SDK treats this as a per-request override, equivalent to setting the `Stripe-Account` header. We only attach it when `stripeAccount` is defined so the legacy path doesn't accidentally route through a non-existent connected account.
- Backward-compat: existing callers (`retrieveCheckoutSession`, `verifyWebhookEvent`, Plan 65-03's webhook handler) still compile and behave identically — the new params are optional.

**`server/routes/payments.ts`** — Rewrote `POST /checkout`:

- Defensive `if (!tenant) -> 503` guard before reaching for `tenant.id`.
- Replaced the inline `getIntegrationSettings("stripe")` lookup with `getStripeContextForTenant(tenant.id, storage)`.
- Four-state switch on `result.kind`:
  - `"none"` -> 501 with the existing "Stripe not connected" message (preserved verbatim).
  - `"connect-incomplete"` -> 402 with the **exact PF-03 message** including the `→` (U+2192) arrow.
  - `"connect"` -> compute `totalCents` from line items, derive `applicationFeeAmount` via `calculateApplicationFee(totalCents, ctx.applicationFeePercent)`, hand `context: ctx` + `applicationFeeAmount` to `createCheckoutSession`.
  - `"legacy"` -> same `createCheckoutSession` call but `applicationFeeAmount: 0`. The helper sees no `stripeAccount` on the context (per 65-01 it's `undefined` for the legacy branch) and skips the application-fee block.
- Availability check, booking creation, attribution linking, line-item construction, and the trailing `updateBookingStripeFields(booking.id, session.id)` are all byte-identical to the previous version. D-05 and D-07 inline comments preserved.

## Why the Four-State Switch Stays Split

The plan asks why `"none"` and `"connect-incomplete"` are separate branches even though both return early before any Stripe API call. Three reasons:

1. **HTTP semantics differ.** `none` is 501 ("Not Implemented" — Stripe isn't wired up at all for this tenant). `connect-incomplete` is 402 ("Payment Required" — there IS an integration, but it's not ready to accept charges). Collapsing them would force a single status code that lies about one of the two cases.
2. **Operator-facing message differs.** `none` points the admin to `Admin → Integrations` (the legacy settings page). `connect-incomplete` points to `Admin → Payments` (the Connect onboarding card from v19.0). Different remediation, different message.
3. **Future telemetry.** Phase 65-03 (or a later phase) may want to emit a `connect_onboarding_incomplete_charge_attempt` event on the 402 branch specifically — splitting now keeps that hook obvious.

## Why totalCents Is Recomputed from lineItems

`validatedData.totalPrice` comes off the Zod schema as a `numeric` PostgreSQL column expressed as a string (Drizzle leaves `numeric` as `string` to preserve precision). Multiplying `Number(validatedData.totalPrice) * 100` and rounding adds a coercion+rounding step that can disagree with the sum of `lineItems[i].amountCents * lineItems[i].quantity` — especially when one cart item rounds up and another rounds down. Since `lineItems` is the exact array we hand to Stripe, the application-fee math MUST be computed from that same array; otherwise PF-02's invariant ("`application_fee_amount` is derived from the booking total") becomes ambiguous about which total. Using `lineItems` as the single source of truth removes that ambiguity.

## Webhook Handler Intentionally Untouched

`POST /api/payments/webhook` still calls `verifyWebhookEvent(storage, ...)` against the per-tenant `integrationSettings.stripe.calendarId` (legacy webhook secret). That's fine — Plan 65-03 owns the webhook rewrite (platform endpoint secret + `event.account` for Connect events). Touching it here would have created a half-migrated webhook that doesn't verify Connect events correctly. Leaving it alone keeps the legacy webhook path working for any tenant still on per-tenant keys.

`GET /api/payments/verify/:sessionId` is similarly untouched — it currently uses `retrieveCheckoutSession(storage, sessionId)` which falls back to `getStripeClient(storage)` on the legacy path. For Connect-routed sessions the retrieve call would need a `{ stripeAccount }` request option, but that's Plan 65-03's territory.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed on the first attempt with `npm run check` passing.

## Verification

```bash
$ npm run check
> rest-express@1.0.0 check
> tsc
# exit 0

$ grep -q "getStripeContextForTenant" server/routes/payments.ts && echo OK
OK
$ grep -q "Stripe Connect onboarding incomplete" server/routes/payments.ts && echo OK
OK
$ grep -q "calculateApplicationFee" server/routes/payments.ts && echo OK
OK
$ grep -q "Finish onboarding in Admin → Payments" server/routes/payments.ts && echo OK
OK
```

## Commits

- `df64513` — feat(65-02): extend createCheckoutSession with optional Connect context
- `98ef546` — feat(65-02): rewire POST /checkout to use Connect-aware Stripe context

## Requirements Status

- **PF-01** — POST /checkout now routes through `ctx.stripe` + `{ stripeAccount }` request options when `kind === "connect"`.
- **PF-02** — `applicationFeeAmount = calculateApplicationFee(totalCents, ctx.applicationFeePercent)` attached to `payment_intent_data` on the Connect path only.
- **PF-03** — 402 with the byte-exact message `"Stripe Connect onboarding incomplete. Finish onboarding in Admin → Payments."` returned before any Stripe SDK call.
- **PF-04** — `kind === "legacy"` reaches `createCheckoutSession` with `applicationFeeAmount: 0` and a context whose `stripeAccount` is undefined, so the helper skips both `application_fee_amount` and the request-option branch — identical to the pre-65 behavior.

## Self-Check: PASSED

- `server/lib/stripe.ts` — modified, contains `StripeContext` import + extended `CheckoutSessionParams`.
- `server/routes/payments.ts` — modified, contains `getStripeContextForTenant` + `calculateApplicationFee` imports + four-state switch.
- Commit `df64513` — present in `git log`.
- Commit `98ef546` — present in `git log`.
- No stubs introduced. No new untracked files. No deferred items.
