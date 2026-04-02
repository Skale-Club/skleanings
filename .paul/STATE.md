# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-02)

**Core value:** Customers can book cleaning services with a specific professional, with a unified calendar that automatically resolves availability conflicts across staff members and their external Google Calendar events.
**Current focus:** v0.5 Google Calendar Reconnect Notifications — Plan 05-02

## Current Position

Milestone: v0.5 Google Calendar Reconnect Notifications
Phase: 1 of 1 (Reconnect Detection & Notifications) — In Progress (1/2 plans complete)
Plan: 05-01 unified — ready to plan 05-02
Status: Ready for next PLAN
Last activity: 2026-04-02 — 05-01 unified: backend reconnect detection + SMS complete

Progress:
- Milestone: [█████░░░░░] 50%
- Phase 1: [█████░░░░░] 50%

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete — ready for next PLAN]
```

## Accumulated Context

### Decisions
| Decision | Context | Impact |
|----------|---------|--------|
| Conditional DB write on needsReconnect | Only update when currently false | Prevents duplicate SMS on repeated token failures |
| Notification path fully try/catch wrapped | Called from availability engine | Failure never breaks booking flow |
| Stripe Checkout (redirect) not Elements | Simpler PCI scope, Stripe handles card UI | No frontend card form needed |
| stripeSessionId on bookings | Links booking to Stripe Checkout session for verification | Webhook + verify endpoint can look up booking by sessionId |

### Deferred Issues
None.

### Blockers/Concerns
- `npm run db:push` required before deploying v0.5 (needsReconnect + lastDisconnectedAt columns)
- Stripe account and API keys needed for live testing (test mode keys fine for dev)

## Session Continuity

Last session: 2026-04-02
Stopped at: Plan 05-01 unified — backend reconnect detection complete
Next action: /paul:plan for 05-02 (TakeActionBanner + admin wiring)
Resume file: .paul/phases/05-gcal-reconnect-notifications/05-01-SUMMARY.md

---
*STATE.md — Updated after every significant action*
