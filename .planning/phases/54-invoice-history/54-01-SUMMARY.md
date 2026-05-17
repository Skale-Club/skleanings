---
phase: 54-invoice-history
plan: 01
subsystem: api
tags: [stripe, billing, invoices, express]

# Dependency graph
requires:
  - phase: 50-billing-self-service
    provides: billingRouter with /status and /portal routes; stripe instance; requireAdmin guard
provides:
  - GET /api/billing/invoices endpoint on billingRouter returning last 10 Stripe invoices per tenant
affects: [billing-ui, invoice-history-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [billingRouter route pattern with tenant guard + stripeCustomerId null check + try/catch 500]

key-files:
  created: []
  modified:
    - server/routes/billing.ts

key-decisions:
  - "Return { invoices: [] } (not 404) when stripeCustomerId absent — consistent with GET /status pattern for new tenants"
  - "amount field uses amount_paid ?? amount_due fallback — invoices may be open (not yet paid) so amount_due is the correct fallback"
  - "No new imports needed — stripe, requireAdmin, res.locals patterns already present in billing.ts"

patterns-established:
  - "Billing route pattern: tenant guard -> getTenantSubscription -> stripeCustomerId null check -> Stripe API call -> map to clean shape -> try/catch 500"

requirements-completed: [BH-06]

# Metrics
duration: 5min
completed: 2026-05-14
---

# Phase 54 Plan 01: Invoice History Summary

**GET /api/billing/invoices on billingRouter: returns last 10 Stripe invoices mapped to {id, date, amount, currency, status, invoiceUrl} with empty-array fallback for tenants without a Stripe customer**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-14T19:15:00Z
- **Completed:** 2026-05-14T19:20:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added GET /api/billing/invoices to billingRouter, guarded by requireAdmin
- Returns { invoices: [] } for tenants with no stripeCustomerId (non-fatal, consistent with /status pattern)
- Maps Stripe.Invoice fields to clean shape: id, date (ISO), amount (amount_paid ?? amount_due), currency, status, invoiceUrl
- Wrapped in try/catch returning 500 on Stripe errors without crashing process

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GET /api/billing/invoices to billingRouter** - `0eee714` (feat)

## Files Created/Modified
- `server/routes/billing.ts` - Appended GET /invoices route after existing POST /portal route

## Decisions Made
- Return `{ invoices: [] }` not 404 when no stripeCustomerId — new tenants have no Stripe customer yet, empty list is correct UX
- `amount: inv.amount_paid ?? inv.amount_due` — open invoices haven't been paid yet so amount_due is the right fallback
- No new imports required — stripe instance, requireAdmin, and res.locals patterns were already imported at the top of billing.ts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GET /api/billing/invoices is ready for the frontend Invoice History table to consume
- No blockers — endpoint follows the exact same pattern as /status and /portal

---
*Phase: 54-invoice-history*
*Completed: 2026-05-14*
