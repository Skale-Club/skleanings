# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-02)

**Core value:** Customers can book cleaning services with a specific professional, with a unified calendar that automatically resolves availability conflicts across staff members and their external Google Calendar events.
**Current focus:** v0.3 Stripe Payments — Phase 3 (Admin Payment Management)

## Current Position

Milestone: v0.3 Stripe Payments
Phase: 3 of 3 (Admin Payment Management) — Not started
Plan: Not started
Status: Ready to plan Phase 3
Last activity: 2026-04-02 — Phase 2 complete (Booking Flow — Pay Online)

Progress:
- Milestone: [██████░░░░] 67%
- Phase 2: [██████████] 100% ✓

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Phase 2 complete — run /paul:plan for Phase 3]
```

## Accumulated Context

### Decisions
| Decision | Context | Impact |
|----------|---------|--------|
| Stripe Checkout (redirect) not Elements | Simpler PCI scope, Stripe handles card UI | No frontend card form needed |
| Stripe Connect OAuth (not manual key paste) | White-label: client connects own Stripe account via button — no copying keys | Plan 01-02 replaces credentials card with Connect button; platform uses STRIPE_CLIENT_ID + STRIPE_SECRET_KEY env vars; access_token + stripe_user_id stored in DB |
| apiKey=access_token, locationId=stripe_user_id, calendarId=webhook_secret | Reuses existing integrationSettings shape for Connect tokens | No schema change needed |
| stripeSessionId on bookings | Links booking to Stripe Checkout session for verification | Webhook + verify endpoint can look up booking by sessionId |
| pending_payment status | Booking created before redirect, awaiting Stripe confirmation | Webhook marks as paid; uncompleted sessions visible in admin |

### Deferred Issues
None.

### Blockers/Concerns
- Stripe account and API keys needed for live testing (test mode keys fine for dev)

## Session Continuity

Last session: 2026-04-02
Stopped at: Phase 2 complete — all plans unified, transitioned to Phase 3
Next action: /paul:plan for Phase 3 (Admin Payment Management — SharedBookingCard Stripe display)
Resume file: .paul/phases/02-booking-flow-pay-online/02-01-SUMMARY.md

---
*STATE.md — Updated after every significant action*
