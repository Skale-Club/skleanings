# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-05)

**Core value:** Customers can book cleaning services with a specific professional, with a unified calendar that automatically resolves availability conflicts across staff members and their external Google Calendar events.
**Current focus:** v1.1 — Notification Log for Leads and Bookings

## Current Position

Milestone: v1.1 — Notification Log for Leads and Bookings
Phase: 14 of 3 (Backend — Instrumentation + API) — In progress
Plan: 14-01 complete — ready for Plan 14-02
Status: Plan 14-01 shipped — logNotification + Twilio + Telegram instrumented
Last activity: 2026-04-15 — Plan 14-01 complete

Progress:
- v1.1 Notification Log: [███░░░░░░░] 33%
- Phase 14: [██████░░░░░░] 50% (1 of 2 plans)

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ░     [APPLY complete — ready for UNIFY]
```

## Accumulated Context

### Decisions
| Decision | Context | Impact |
|----------|---------|--------|
| `client` role in role enum (not separate table) | Consistent with existing role model | Reuses all auth middleware patterns |
| `bookings.userId` nullable FK | Guest bookings must remain supported | Ownership is opt-in; backward compatible |
| `notificationLogs` rows are additive only | Log must never break notification send | logger.ts (Phase 14) always try/catch wraps DB insert |
| One row per recipient per send | Twilio/Telegram may have multiple recipients | Enables per-number filtering in the global log |
| `text` for channel/trigger/status (not pgEnum) | Matches all enum-like fields in codebase | No migration needed for new trigger types |
| `onDelete: set null` on FK columns | Log survives parent deletion | Historical audit trail preserved |

### Deferred Issues
- Verify if SCRAM error source is pooled URL only or shared across all DB URLs.
- Token in query param for OAuth appears in server logs — acceptable for internal use.
- Notification log retention/TTL — no TTL for now; table volume is low.
- Resend (failed notification) button in UI — deferred to v1.2 if failure rate warrants it.

### Blockers/Concerns
- Stripe account and API keys needed for live payment testing

### Git State
Last commit: 3994191
Branch: main

## Session Continuity

Last session: 2026-04-15
Stopped at: Plan 14-01 complete — logNotification helper + Twilio + Telegram instrumented
Next action: /paul:apply for Plan 14-02 (GHL instrumentation + API endpoints)
Resume file: .paul/phases/14-backend-instrumentation-api/14-02-PLAN.md

---
*STATE.md — Updated after every significant action*
