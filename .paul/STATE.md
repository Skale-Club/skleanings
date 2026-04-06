# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-05)

**Core value:** Customers can book cleaning services with a specific professional, with a unified calendar that automatically resolves availability conflicts across staff members and their external Google Calendar events.
**Current focus:** Awaiting next milestone

## Current Position

Milestone: Awaiting next milestone
Phase: None active
Plan: None
Status: v1.0 Client Portal & Self-Service Booking Management complete — ready for next
Last activity: 2026-04-05 — Milestone v1.0 complete and archived

Progress:
- v1.0 milestone: [████████████] 100% ✓

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ○        ○        ○     [Milestone complete — ready for next]
```

## Accumulated Context

### Decisions
| Decision | Context | Impact |
|----------|---------|--------|
| `client` role in role enum (not separate table) | Consistent with existing role model | Reuses all auth middleware patterns |
| `bookings.userId` nullable FK | Guest bookings must remain supported | Ownership is opt-in; backward compatible |
| Legacy bookings: email-match via two parallel queries | Avoids complex OR on nullable column | Set dedup is clean |
| Client router re-uses `req.user` from `requireClient` | Avoids double Supabase round-trip | Zero-cost re-auth in handlers |
| GHL/notification sync is fire-and-forget | Client HTTP response must not block | Background sync, failure logged |
| AlertDialog for cancel, Dialog for reschedule | Correct shadcn semantics per action type | Consistent UX conventions |
| onError: toast only, no onClose | User can retry without reopening | Better UX for transient errors |

### Deferred Issues
- Verify if SCRAM error source is pooled URL only or shared across all DB URLs.
- Token in query param for OAuth appears in server logs — acceptable for internal use.

### Blockers/Concerns
- Stripe account and API keys needed for live payment testing

### Git State
Last commit: 2e31fe9
Branch: main
Tag: v1.0.0

## Session Continuity

Last session: 2026-04-05
Stopped at: v1.0 milestone complete and archived
Next action: /paul:discuss-milestone or /paul:milestone
Resume file: .paul/MILESTONES.md

---
*STATE.md — Updated after every significant action*
