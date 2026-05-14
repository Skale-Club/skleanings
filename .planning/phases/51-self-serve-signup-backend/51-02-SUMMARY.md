---
phase: 51-self-serve-signup-backend
plan: 02
subsystem: billing/webhooks
tags: [stripe, webhooks, billing, trial, tenant-subscriptions]
provides:
  - billingWebhookHandler handles customer.subscription.trial_will_end event
  - tenant_subscriptions row updated with trialing status when trial ends in 3 days
affects: [billing, stripe-webhooks, tenant-subscriptions]
tech-stack:
  added: []
  patterns: [switch/case webhook routing, db.update global registry pattern]
key-files:
  created: []
  modified:
    - server/routes/billing.ts
key-decisions:
  - Separate case block for trial_will_end (not merged with updated/deleted) for explicit observability via console.warn
  - status set to sub.status ("trialing") not forced to any fixed value — matches Stripe's actual subscription state
duration: 5min
completed: 2026-05-14
requirements: [SS-05, SS-06]
---

# Phase 51 Plan 02: Billing Webhook trial_will_end Handler Summary

**Added `customer.subscription.trial_will_end` case to `billingWebhookHandler`, keeping trial subscription status in sync when Stripe fires its 3-day trial-ending warning.**

## Performance
- **Duration:** ~5 min
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Extended `billingWebhookHandler` switch statement with a dedicated `customer.subscription.trial_will_end` case that looks up the tenant by `stripeCustomerId` and updates `tenant_subscriptions` with the refreshed status, planId, and currentPeriodEnd
- ROADMAP.md Phase 51 plan count was already correct (updated by parallel agent 51-01) — no change needed

## Task Commits
1. **Task 1: Add customer.subscription.trial_will_end case** - `41d58f3`
2. **Task 2: Update ROADMAP.md Phase 51 plan count** - already correct, no commit needed

## Files Created/Modified
- `server/routes/billing.ts` - Added `case "customer.subscription.trial_will_end"` block (lines 77-108): looks up tenant by stripeCustomerId, updates status/planId/currentPeriodEnd, logs console.warn

## Deviations from Plan
None — plan executed exactly as written. ROADMAP.md task was a no-op because agent 51-01 had already updated it in the same parallel wave.

## Known Stubs
None.

## Next Phase Readiness
Phase 51 complete. Phase 52 (Self-Serve Signup Frontend) can proceed.

## Self-Check: PASSED
- `server/routes/billing.ts` exists and contains 3 occurrences of `trial_will_end`
- Commit `41d58f3` exists in git log
- TypeScript compiles clean (`npm run check` exits 0)
