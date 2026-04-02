---
phase: 03-admin-payment-management
plan: 01
subsystem: ui
tags: [stripe, react, admin, payments]

requires:
  - phase: 01-stripe-schema-lib
    provides: stripeSessionId on Booking type, pending_payment paymentStatus value

provides:
  - pending_payment badge (amber/Awaiting Payment) in SharedBookingCard
  - Stripe dashboard link in card footer
  - pending_payment option in interactive payment dropdown

affects: []

tech-stack:
  added: []
  patterns: [test/live mode URL detection from session ID prefix]

key-files:
  modified: [client/src/components/admin/shared/SharedBookingCard.tsx]

key-decisions:
  - "Stripe dashboard URL: cs_test_ prefix → /test/payments/..., else /payments/... — handles both modes without env var"
  - "Session ID truncated to 20 chars in footer — full ID available via title tooltip"

patterns-established: []

duration: ~10min
completed: 2026-04-02T00:00:00Z
---

# Phase 3 Plan 01: Admin Payment Management Summary

**SharedBookingCard updated with pending_payment badge (amber), Stripe session dashboard link in footer, and Awaiting Payment dropdown option.**

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: pending_payment badge renders correctly | Pass | Amber color + "Awaiting Payment" in both readonly and interactive variants |
| AC-2: Stripe session link shown in footer | Pass | `stripeSessionId.slice(0,20)…` + ExternalLink icon, test/live URL auto-detected |
| AC-3: pending_payment in interactive dropdown | Pass | "Awaiting Payment" SelectItem with amber dot added |
| AC-4: TypeScript zero errors | Pass | `npm run check` — zero errors |

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `client/src/components/admin/shared/SharedBookingCard.tsx` | Modified | Badge 3-state, dropdown option, footer Stripe link |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| URL mode detection via `cs_test_` prefix | No env var available in frontend; session ID prefix is reliable | Works for both test and live Stripe accounts |
| Truncate to 20 chars + title tooltip | Footer is narrow; full ID readable on hover | Clean UI without losing data |

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

v0.3 Stripe Payments milestone is complete. All 3 phases shipped.
