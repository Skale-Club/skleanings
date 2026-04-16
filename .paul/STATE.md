# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-05)

**Core value:** Customers can book cleaning services with a specific professional, with a unified calendar that automatically resolves availability conflicts across staff members and their external Google Calendar events.
**Current focus:** v1.1 complete — defining next milestone

## Current Position

Milestone: v1.1 — Notification Log for Leads and Bookings — ✅ COMPLETE
Phase: 15 of 3 (Admin UI — Lead Notification Indicators) — ✅ Complete
Plan: 15-01 unified
Status: v1.1 milestone complete — ready for next milestone
Last activity: 2026-04-15 — Phase 15 unified, v1.1 milestone complete

Progress:
- v1.1 Notification Log: [████████████] 100% ✓
- Phase 15: [████████████] 100% ✓

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Milestone complete — ready for next milestone]
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
| Inline icons per lead row (not tabs/global section) | User corrected scope — at-a-glance visibility on list | Simpler, more useful UX |

### Deferred Issues
- Verify if SCRAM error source is pooled URL only or shared across all DB URLs.
- Token in query param for OAuth appears in server logs — acceptable for internal use.
- Notification log retention/TTL — no TTL for now; table volume is low.
- Resend (failed notification) button in UI — deferred to v1.2 if failure rate warrants it.

### Blockers/Concerns
- Stripe account and API keys needed for live payment testing

### Git State
Last commit: ade414f
Branch: main

## Session Continuity

Last session: 2026-04-15
Stopped at: v1.1 milestone complete — all 3 phases unified
Next action: /paul:milestone to start v1.2, or pause here
Resume file: .paul/ROADMAP.md

---
*STATE.md — Updated after every significant action*
