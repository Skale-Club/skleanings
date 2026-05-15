---
phase: 65-connect-aware-checkout-webhook-routing
plan: 03
subsystem: payments
tags: [stripe, stripe-connect, webhooks, application-fee, multi-tenant]

# Dependency graph
requires:
  - phase: 65-01
    provides: platformFeeAmount + tenantNetAmount columns on bookings; STRIPE_WEBHOOK_SECRET_CONNECT env var documented
provides:
  - IStorage.setBookingPaymentBreakdown tenant-scoped writer
  - Dual-secret webhook signature verification (Connect first, legacy fallback)
  - retrieveCheckoutSessionForAccount helper (account-scoped session retrieve with payment_intent expand)
  - Connect-aware checkout.session.completed handler persisting platform fee + tenant net split
affects: [66-payments-reporting, future-stripe-connect-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-pass webhook signature verification (try Connect secret first, fall back to per-tenant secret without ever parsing unverified payload)"
    - "Account-scoped Stripe API calls via { stripeAccount } request options for Connect events"
    - "Error-isolated fee persistence — Stripe API hiccups during retrieve must not block conversion event or booking status update"

key-files:
  created: []
  modified:
    - server/storage.ts
    - server/lib/stripe.ts
    - server/routes/payments.ts

key-decisions:
  - "Two-pass signature verification (Connect-first, legacy-fallback) — refuses to parse unverified payload to detect event.account"
  - "setBookingPaymentBreakdown as a separate IStorage method (not an extension of updateBookingStripeFields) — different lifecycle: session ID written at checkout-creation, fee breakdown only at paid-confirmation"
  - "Fee-persist block wrapped in its own try/catch — Stripe API failure during retrieveCheckoutSessionForAccount cannot block conversion event or booking status update; webhook still returns 200 to prevent Stripe retry storms"
  - "Legacy events leave platformFeeAmount + tenantNetAmount NULL (no event.account → block skipped) — matches PF-04/PF-05 semantics"

patterns-established:
  - "Webhook dual-secret routing: try platform-level Connect webhook secret first; on signature mismatch, fall back to per-tenant secret stored in integrationSettings.stripe.calendarId (legacy field name predating Phase 65)"
  - "Connect API access pattern: stripe.X.Y(id, expandParams, { stripeAccount }) — third positional argument is request options carrying the Stripe-Account header"

requirements-completed: [PF-05, PF-06]

# Metrics
duration: 6min
completed: 2026-05-15
---

# Phase 65 Plan 03: Connect-Aware Webhook with Fee Breakdown Persistence Summary

**Webhook now routes Connect events through STRIPE_WEBHOOK_SECRET_CONNECT, retrieves the expanded session from the connected account, and persists application_fee_amount + tenantNetAmount on bookings — legacy events untouched.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-15T17:15:09Z
- **Completed:** 2026-05-15T17:20:44Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- IStorage gained `setBookingPaymentBreakdown(bookingId, platformFeeAmount, tenantNetAmount)` — tenant-scoped DB writer for the Phase 65 fee split columns
- `verifyWebhookEvent` is now dual-secret aware: tries `STRIPE_WEBHOOK_SECRET_CONNECT` first, falls back to legacy per-tenant secret in `integrationSettings.stripe.calendarId`
- New `retrieveCheckoutSessionForAccount(sessionId, stripeAccount)` helper exposes account-scoped session retrieval with `expand: ['payment_intent']` so callers can read `application_fee_amount`
- `POST /api/payments/webhook` now reads `event.account` post-verification; for Connect events on `checkout.session.completed`, it fetches the expanded session and persists `platformFeeAmount + tenantNetAmount` via the new storage method
- Backward compatibility preserved: legacy events (no `event.account`) flow through exactly as before — breakdown columns stay NULL

## Task Commits

Each task was committed atomically:

1. **Task 1: Add setBookingPaymentBreakdown to IStorage + DatabaseStorage** — `b573cd8` (feat)
2. **Task 2: Extend verifyWebhookEvent + add retrieveCheckoutSessionForAccount** — `381e832` (feat)
3. **Task 3: Update POST /api/payments/webhook to persist fee breakdown for Connect events** — `47df733` (feat)

## Files Created/Modified
- `server/storage.ts` — added `setBookingPaymentBreakdown` to `IStorage` interface (line 218) + `DatabaseStorage` implementation (line ~1066), both tenant-scoped via `this.tenantId` in WHERE clause
- `server/lib/stripe.ts` — rewrote `verifyWebhookEvent` body to try Connect secret first then fall back to legacy; added exported `retrieveCheckoutSessionForAccount` helper for account-scoped retrieve with `payment_intent` expand
- `server/routes/payments.ts` — added `retrieveCheckoutSessionForAccount` to the `../lib/stripe` import; webhook handler now reads `event.account` post-verification and persists fee breakdown for Connect events inside a locally-caught block

## Decisions Made

**Two-pass signature verification (Connect-first, legacy-fallback) — never parse unverified payload.**
Stripe's `webhooks.constructEvent` is the only safe way to know which secret signed an event. Pre-parsing the body to read `event.account` and then verifying with the matching secret would mean the parser ran on attacker-controllable bytes before signature validation — rejected. Instead we try the more specific (Connect) secret first and catch the mismatch to fall through to legacy. Both `try` blocks reuse the same `Stripe` client; the legacy path only loads `integrationSettings.stripe.calendarId` if the Connect secret is missing or doesn't match.

**Why setBookingPaymentBreakdown is a separate IStorage method instead of extending updateBookingStripeFields.**
The two writes happen at different lifecycle points: `stripeSessionId` is written at checkout-creation time (no fee data exists yet — `application_fee_amount` lives on the PaymentIntent, not the Session), while the breakdown can only be computed at paid-confirmation time after retrieving the expanded session. Conflating them would force every checkout-creation call site to pass `null, null` for fees, and would tempt future maintainers to read those columns before they're populated. Separation makes the lifecycle explicit.

**Fee-persist block is wrapped in its own try/catch — error isolation per Phase 53 convention.**
A Stripe API hiccup during `retrieveCheckoutSessionForAccount` (rate limit, transient 503, account permissions blip) must NOT block the conversion event or the booking status update — those already happened successfully. The block matches the `recordConversionEvent` error-isolation pattern (also in this handler). Webhook still returns 200 so Stripe doesn't retry; the missing breakdown can be backfilled offline if needed.

**Legacy events leave platformFeeAmount + tenantNetAmount NULL by design.**
Legacy bookings predate Connect routing and have no `application_fee_amount` — they were charged directly on a per-tenant Stripe account with no platform cut. Writing 0 would be misleading (implies a fee was computed and was zero); NULL correctly signals "this booking was not Connect-routed."

## Deviations from Plan

None - plan executed exactly as written.

The plan's action blocks were precise about file locations, signatures, and error-handling patterns. All three edits applied cleanly. `npm run check` passed after each task.

## Issues Encountered

**Worktree path resolution during initial edits.** First two Edit calls accidentally targeted the main repo path (`C:\Users\Vanildo\Dev\skleanings\server\storage.ts`) instead of the worktree path (`C:\Users\Vanildo\Dev\skleanings\.claude\worktrees\agent-a236a155ad18311f2\server\storage.ts`). Detected immediately when `git commit` reported "nothing to commit" despite Edit success. Reverted the main repo changes and reapplied the edit explicitly to the worktree path. No code lost, no behavior change — pure mechanical recovery.

## User Setup Required

Pending human actions (carry-overs from Phase 65 foundation — already documented in 65-01-SUMMARY but worth re-stating here so this plan's verifier can confirm runtime readiness):

1. **Apply the migration** added by Plan 65-01: `supabase db push` to apply `supabase/migrations/20260524000000_phase65_booking_payment_breakdown.sql` (adds `platform_fee_amount` and `tenant_net_amount` integer columns to `bookings`). Without this, `setBookingPaymentBreakdown` will fail at runtime with "column does not exist."
2. **Set `STRIPE_WEBHOOK_SECRET_CONNECT`** in `.env` (and Vercel env vars). Without it, `verifyWebhookEvent` skips the Connect path entirely and only the legacy per-tenant secret is tried — Connect events will fail signature verification.
3. **Configure the Connect webhook endpoint in Stripe Dashboard.** In the Stripe Dashboard → Developers → Webhooks, create a Connect endpoint (NOT account-specific) pointing at `https://<your-domain>/api/payments/webhook` listening for at least `checkout.session.completed`. Copy the resulting signing secret into `STRIPE_WEBHOOK_SECRET_CONNECT`.

**Note for future maintainers:** the legacy webhook secret is stored in `integrationSettings.stripe.calendarId` — a misleading field name predating Phase 65 (it was repurposed from an early Google Calendar sync field). Renaming it is not in scope for Phase 65; documented here so a future grep doesn't go on a wild goose chase.

## Next Phase Readiness

- **Plan 65-02 (Connect-aware checkout creation)** still pending — Plan 65-03 was authorized to ship in parallel because it only depends on 65-01 (DB columns + env var). Once 65-02 lands, the end-to-end flow is: Plan 65-02 wires `createCheckoutSession` to use the connected-account Stripe context AND attach `application_fee_amount`; this plan (65-03) persists what 65-02 produced.
- **Webhook idempotency unchanged.** Multiple deliveries of the same `checkout.session.completed` event re-write the same fee/net values harmlessly. `recordConversionEvent` has its own idempotency guard per Phase 10 ATTR-03 in `storage/analytics.ts`.
- **No new env vars introduced by this plan.** Plan 65-01 already documented `STRIPE_WEBHOOK_SECRET_CONNECT` in `.env.example`.

---
*Phase: 65-connect-aware-checkout-webhook-routing*
*Completed: 2026-05-15*

## Self-Check: PASSED

Verified:
- `server/storage.ts` contains `setBookingPaymentBreakdown` (interface line 218, impl line ~1066)
- `server/lib/stripe.ts` contains `STRIPE_WEBHOOK_SECRET_CONNECT` and `retrieveCheckoutSessionForAccount`
- `server/routes/payments.ts` contains `retrieveCheckoutSessionForAccount`, `setBookingPaymentBreakdown`, and `connectAccount`
- Commits exist: `b573cd8` (Task 1), `381e832` (Task 2), `47df733` (Task 3)
- `npm run check` exits 0
