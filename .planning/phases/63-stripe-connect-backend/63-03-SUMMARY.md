---
phase: 63-stripe-connect-backend
plan: 03
subsystem: payments
tags: [stripe, stripe-connect, webhooks, drizzle, express, multi-tenant]

# Dependency graph
requires:
  - phase: 63-stripe-connect-backend (63-01)
    provides: tenantStripeAccounts Drizzle schema + table
  - phase: 48-stripe-subscription-infrastructure
    provides: billingWebhookHandler signature verification + raw-body mount point
provides:
  - "Async sync of Stripe Connect capability flags into tenant_stripe_accounts"
  - "Cleanup on platform deauthorization (hard-delete row)"
  - "Defensive unknown-account handling (warn + 200 ack, no retry storm)"
affects: [63-04, stripe-connect-frontend, /api/admin/stripe/status]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Webhook event handling for Stripe Connect lifecycle (account.* events)"
    - "Top-level event.account field for resolving connected accounts on application-scoped events"

key-files:
  created: []
  modified:
    - server/routes/billing.ts

key-decisions:
  - "Use db directly (not res.locals.storage) — webhook is mounted before resolveTenantMiddleware so tenant context is not populated"
  - "Look up by stripeAccountId (inverse of subscription handler which looks up by stripeCustomerId)"
  - "Hard-delete on deauthorize — irreversible event, no soft-delete tombstone; reconnect creates a fresh Express account"
  - "Unknown stripeAccountId in either event => warn + 200 ack (matches Phase 48 defensive pattern, prevents Stripe retry storms)"
  - "For account.application.deauthorized, data.object is Stripe.Application not Stripe.Account — use top-level event.account to resolve the connected account id (Rule 1 deviation; plan had incorrect type assumption)"

patterns-established:
  - "Stripe Connect account event handling: account.updated mirrors capability flags; account.application.deauthorized removes the row"
  - "Defensive 200-ack on unknown account.id avoids cross-platform/orphan retry storms"

requirements-completed: [SC-05]

# Metrics
duration: 11min
completed: 2026-05-15
---

# Phase 63 Plan 03: Stripe Connect Webhook Account Lifecycle Summary

**Async webhook handlers for Stripe Connect `account.updated` and `account.application.deauthorized` that mirror capability flags into `tenant_stripe_accounts` and hard-delete on platform deauthorization.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-05-15T15:45:52Z
- **Completed:** 2026-05-15T15:56:33Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `billingWebhookHandler` now processes `account.updated` events by updating `chargesEnabled`/`payoutsEnabled`/`detailsSubmitted` on the matching `tenant_stripe_accounts` row.
- `billingWebhookHandler` now processes `account.application.deauthorized` events by hard-deleting the matching row (with `.returning({ tenantId })` for logging).
- Both branches defensively handle unknown account IDs (warn + normal 200 ack — never throw, never let Stripe retry-storm us).
- Existing subscription/trial handlers, signature verification, and 200-ack semantics fully preserved.

## Task Commits

1. **Task 1: Extend billingWebhookHandler with account.updated + account.application.deauthorized cases** — `7d8e253` (feat)

## Files Created/Modified

- `server/routes/billing.ts` — Added `tenantStripeAccounts` to the schema import; inserted two new `case` branches between the `trial_will_end` case and the `default` arm.

## Decisions Made

- **`db` directly, not `res.locals.storage`** — the webhook is mounted in `server/index.ts` with `express.raw({ type: 'application/json' })` BEFORE `resolveTenantMiddleware`, so `res.locals.tenant` and `res.locals.storage` are never populated. Matches Phase 48 architecture.
- **Lookup by `stripeAccountId`** — Stripe Connect events carry the account id; tenantId is unknown until we look it up. Inverse of subscription handler (which looks up by `stripeCustomerId`).
- **Hard-delete on deauthorize** — admin revoking platform access is irreversible; reconnection creates a brand-new Express account, so a soft-delete tombstone serves no purpose.
- **`?? false` defaults on capability flags** — Stripe SDK marks `charges_enabled`/`payouts_enabled`/`details_submitted` as optional even though they are always present in practice; nullish coalesce keeps Drizzle's `NOT NULL` happy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Wrong event payload type for `account.application.deauthorized`**

- **Found during:** Task 1 (npm run check)
- **Issue:** The plan instructed `const account = event.data.object as Stripe.Account;` for `account.application.deauthorized`. TypeScript correctly rejected this: for that event type, `data.object` is `Stripe.Application` (the platform OAuth app being deauthorized), not `Stripe.Account`. The error: `Conversion of type 'Application' to type 'Account' may be a mistake … Type 'Application' is missing the following properties from type 'Account': charges_enabled, details_submitted, email, payouts_enabled, type`.
- **Fix:** Resolve the connected account ID from `event.account` (top-level event field that Stripe Connect sets on account-scoped events) instead of `event.data.object.id`. Added a defensive guard: if `event.account` is missing, warn and break (still acks 200).
- **Files modified:** `server/routes/billing.ts`
- **Verification:** `npm run check` exits 0; lookup still uses `stripeAccountId` against `tenant_stripe_accounts`; semantics (hard-delete, returning, warn on unknown) preserved.
- **Committed in:** `7d8e253` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — wrong Stripe SDK type assumption in plan)
**Impact on plan:** Necessary correction; the alternative (`as unknown as Stripe.Account`) would have silently misread `application.id` as an `acct_xxx` and never matched any row. Using `event.account` is the documented Stripe Connect pattern.

## Issues Encountered

- TypeScript caught the `Application` vs `Account` type confusion described above; resolved by switching to `event.account`.

## User Setup Required

**External services require manual configuration.** Per the plan's `user_setup` block, the Stripe Dashboard webhook endpoint must be updated to subscribe to the two new events:

- Add `account.updated` to the existing webhook endpoint subscription (Stripe Dashboard → Developers → Webhooks → [endpoint] → Add events).
- Add `account.application.deauthorized` to the same endpoint subscription.

This is a Dashboard-only action; no code or env-var change is required.

## Next Phase Readiness

- Backend now keeps `tenant_stripe_accounts` in sync with Stripe Connect state asynchronously. `/api/admin/stripe/status` reads (Plan 63-04 or onwards) can rely on cached flags without a synchronous Stripe round-trip.
- Pending: Dashboard event subscription (see User Setup Required above) before this branch hits production.

---
*Phase: 63-stripe-connect-backend*
*Completed: 2026-05-15*

## Self-Check: PASSED

- FOUND: `.planning/phases/63-stripe-connect-backend/63-03-SUMMARY.md`
- FOUND: `server/routes/billing.ts`
- FOUND: commit `7d8e253` (Task 1)
