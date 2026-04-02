---
phase: 02-booking-flow-pay-online
plan: 01
subsystem: ui
tags: [stripe, react, checkout, payments]

requires:
  - phase: 01-stripe-schema-lib
    provides: POST /api/payments/checkout, GET /api/payments/verify/:sessionId, stripeSessionId on bookings

provides:
  - Pay Online radio enabled in booking flow
  - Stripe Checkout redirect on submit
  - Confirmation page with 3-state Stripe verification (loading / pending / paid)
  - Cancelled payment toast on /booking?cancelled=1

affects: 03-admin-payment-management

tech-stack:
  added: []
  patterns: [useMutation for non-idempotent fetch, window.location.href for external redirect, useQuery with staleTime:Infinity for one-time verification]

key-files:
  modified: [client/src/pages/BookingPage.tsx, client/src/pages/Confirmation.tsx]

key-decisions:
  - "Use window.location.href for Stripe redirect (not wouter setLocation) — external URL"
  - "Cancelled toast in BookingPage useEffect — cancel URL lands on /booking?cancelled=1"
  - "window.location.search for session_id param — wouter doesn't expose search params"

patterns-established:
  - "Stripe verification query: enabled:isStripeFlow + staleTime:Infinity — fire once, never refetch"

duration: ~20min
completed: 2026-04-02T00:00:00Z
---

# Phase 2 Plan 01: Booking Flow — Pay Online Summary

**Pay Online radio enabled end-to-end: booking → Stripe Checkout redirect → confirmation page with payment verification (loading/pending/paid states).**

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Pay Online radio enabled | Pass | `disabled` removed, `opacity-60` removed, subtitle → "Secure online payment" |
| AC-2: Submit calls checkout API + redirects | Pass | `checkoutMutation` → `POST /api/payments/checkout` → `window.location.href = sessionUrl` |
| AC-3: Submit button copy adapts | Pass | "Pay $X.XX with Stripe" / "Confirm Booking - $X.XX" based on `paymentMethod` watch |
| AC-4: Confirmation shows Stripe states | Pass | loading → pending (AlertCircle) → paid (CreditCard badge + "Payment Received") |
| AC-5: Cancelled → toast on /booking | Pass | `useEffect` detects `?cancelled=1`, shows destructive toast, cleans URL |
| AC-6: Pay on site confirmation unchanged | Pass | No session_id → existing "Booking Confirmed!" UI renders as before |
| AC-7: TypeScript zero errors | Pass | `npm run check` — zero errors |

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `client/src/pages/BookingPage.tsx` | Modified | Added `checkoutMutation`, branched `onSubmit`, enabled radio, updated button copy, added cancelled toast |
| `client/src/pages/Confirmation.tsx` | Modified | Added Stripe verification query + 3-state render (loading / pending / paid) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `window.location.href` for redirect | Stripe URL is external — wouter `setLocation` only handles internal routes | Correct redirect to Stripe Checkout page |
| Cancelled toast in BookingPage | Cancel URL is `/booking?cancelled=1` — confirmation page never sees it | BookingPage cleans up URL after showing toast |
| `window.location.search` in Confirmation | Wouter's `useLocation` doesn't expose search params reliably | No extra dependency needed |
| `staleTime: Infinity` on verify query | Payment status doesn't change retroactively — no need to refetch | Prevents redundant API calls on Confirmation mount |

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

**Ready:**
- Full Stripe payment flow functional end-to-end (booking → Stripe → confirmation)
- Pay on Site flow untouched and still functional
- `stripeSessionId` and `stripePaymentStatus` stored on bookings (Phase 1)

**Concerns:**
- None

**Blockers:**
- None (Phase 3 — Admin Payment Management — can proceed immediately)
