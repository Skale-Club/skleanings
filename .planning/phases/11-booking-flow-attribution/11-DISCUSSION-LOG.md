# Phase 11: Booking Flow Attribution — Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md.

**Date:** 2026-04-25
**Phase:** 11-booking-flow-attribution
**Areas discussed:** booking_started trigger, Stripe webhook gap, visitorId missing (all auto-recommended)

---

## booking_started Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| BookingPage mount | Fires when user lands on the booking form | ✓ |
| Form submit | Fires when user clicks "Book Now" | |

**Choice:** Recommended default — BookingPage mount.
**Notes:** Auto-selected. Mount captures early funnel entry; form submit would be redundant with booking_attempted/completed.

---

## Stripe Webhook Gap

| Option | Description | Selected |
|--------|-------------|----------|
| Null attribution acceptable | Record event with null attribution if utm_session_id missing | ✓ |
| Retry/delay write | Wait for utm_session_id to propagate before recording | |

**Choice:** Recommended default — null attribution acceptable.
**Notes:** Auto-selected. Rare edge case; preserving the event is more important than attribution accuracy.

---

## visitorId Missing Gracefully

| Option | Description | Selected |
|--------|-------------|----------|
| Silent skip | Omit visitorId, booking proceeds normally | ✓ |
| Return error | Block booking if no visitorId | |

**Choice:** Recommended default — silent skip.
**Notes:** Auto-selected. Attribution is never allowed to block a booking (EVENTS-04).

---

## Claude's Discretion

- `visitorId` passed outside `insertBookingSchema` (read from `req.body` directly)
- Server call order in `bookings.ts`: createBooking → contact upsert → linkBookingToAttribution → recordConversionEvent (all fire-and-forget)
- `POST /api/analytics/events` is the client-side event endpoint (booking_started, chat_initiated)

## Deferred Ideas

None.
