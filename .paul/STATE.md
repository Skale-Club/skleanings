# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-04)

**Core value:** Customers can book cleaning services with a specific professional, with a unified calendar that automatically resolves availability conflicts across staff members and their external Google Calendar events.
**Current focus:** v0.6 Unified Users & Roles — Phase 3

## Current Position

Milestone: v0.6 Unified Users & Roles
Phase: 3 of 3 (Staff Personal Settings Page) — Not started
Plan: Not started
Status: Ready to plan Phase 3
Last activity: 2026-04-04 — Phase 2 complete (unified users page + staff creation bridge)

Progress:
- Milestone: [██████░░░░] 67%

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Phase 2 complete — ready for Phase 3]
```

## Accumulated Context

### Decisions
| Decision | Context | Impact |
|----------|---------|--------|
| Conditional DB write on needsReconnect | Only update when currently false | Prevents duplicate SMS on repeated token failures |
| Notification path fully try/catch wrapped | Called from availability engine | Failure never breaks booking flow |
| Stripe Checkout (redirect) not Elements | Simpler PCI scope, Stripe handles card UI | No frontend card form needed |
| stripeSessionId on bookings | Links booking to Stripe Checkout session for verification | Webhook + verify endpoint can look up booking by sessionId |
| Post-login always redirects to /admin; Admin.tsx guard handles staff redirect | Avoids auth race condition — role fetched async | Admin.tsx always redirects staff; no timing issue |
| /staff route group isolated before /admin in Router() | Clean separation, same pattern as isAdminRoute | /staff/* paths never fall through to admin routes |
| linkStaffMemberToUser dedicated method | userId omitted from InsertStaffMember type; updateStaffMember can't accept it | create-then-link pattern for staff bridge |

### Deferred Issues
None.

### Blockers/Concerns
- `npm run db:push` required before deploying v0.6 (role + phone columns + userId FK on staffMembers)
- Stripe account and API keys needed for live testing (test mode keys fine for dev)

### Git State
Last commit: e52174a (Phase 1 commit)
Branch: feature/unified-users-roles

## Session Continuity

Last session: 2026-04-04
Stopped at: Phase 2 complete (06-03 + 06-04 unified)
Next action: /paul:plan for Phase 3 (Staff Personal Settings Page)
Resume file: .paul/ROADMAP.md

---
*STATE.md — Updated after every significant action*
