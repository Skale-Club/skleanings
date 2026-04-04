---
phase: 01-stripe-schema-lib
plan: 03
type: summary
status: complete
completed: 2026-04-02
---

# Plan 01-03 Summary — Payment Routes

## What Was Built

Three payment API endpoints in `server/routes/payments.ts` + storage methods to support them.

### Endpoints

| Route | Purpose |
|-------|---------|
| `POST /api/payments/checkout` | Creates booking (pending_payment) + Stripe Checkout session → `{ sessionUrl, bookingId }` |
| `POST /api/payments/webhook` | Verifies Stripe signature, handles `checkout.session.completed` → marks booking paid |
| `GET /api/payments/verify/:sessionId` | Confirmation page poll → `{ paid, bookingId, booking }` |

### Storage Methods Added

- `getBookingByStripeSessionId(sessionId)` — looks up booking by `stripe_session_id` column
- `updateBookingStripeFields(bookingId, stripeSessionId, stripePaymentStatus?)` — atomically sets session ID + payment status

### Mount

`server/routes.ts` imports and mounts `paymentsRouter` at `/api/payments`.

## Acceptance Criteria Results

| AC | Result |
|----|--------|
| AC-1: POST /checkout creates booking + Stripe session | PASS |
| AC-2: POST /webhook marks booking paid | PASS |
| AC-3: GET /verify/:sessionId returns status | PASS |
| AC-4: Stripe not connected → 501 | PASS |
| AC-5: TypeScript zero errors | PASS |

## Decisions Made

- Webhook raw body: uses `req.rawBody` (captured globally in `server/index.ts`) — no special middleware needed
- Line item fallback: if no cart items, falls back to `totalPrice` as single "Cleaning Service" line item
- `STRIPE_SECRET_KEY` used for webhook verification (not the connected account's access_token)

## Deferred Issues

None.

## Files Modified

- `server/storage.ts` — added `getBookingByStripeSessionId` + `updateBookingStripeFields`
- `server/routes/payments.ts` — created (3 endpoints)
- `server/routes.ts` — added import + mount for paymentsRouter
