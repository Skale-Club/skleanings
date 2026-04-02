# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-02)

**Core value:** Customers can book cleaning services with a specific professional, with a unified calendar that automatically resolves availability conflicts across staff members and their external Google Calendar events.
**Current focus:** v0.6 Unified Users & Roles — Phase 1

## Current Position

Milestone: v0.6 Unified Users & Roles
Phase: 1 of 3 (Schema + Auth + Role Middleware) — Discussion complete
Plan: 06-01 unified — ready to plan 06-02
Status: Ready for next PLAN
Last activity: 2026-04-02 — 06-01 unified: schema + auth + AuthContext role complete

Progress:
- Milestone: [░░░░░░░░░░] 0%

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
Stopped at: v0.6 discussion complete — CONTEXT.md written
Next action: /paul:plan for 06-02 (login redirect by role + staff route guard)
Resume file: .paul/phases/06-unified-users-roles/06-01-SUMMARY.md

---
*STATE.md — Updated after every significant action*
