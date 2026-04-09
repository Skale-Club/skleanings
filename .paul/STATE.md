# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-04)

**Core value:** Customers can book cleaning services with a specific professional, with a unified calendar that automatically resolves availability conflicts across staff members and their external Google Calendar events.
**Current focus:** v0.7 Google Calendar Polish — COMPLETE

## Current Position

Milestone: v0.8 Production DB Stability — **COMPLETE**
Phase: 1 of 1 (Database Connection Fix) — Complete
Plan: 08-01 unified
Status: Milestone complete — ready for next milestone
Last activity: 2026-04-04 — v0.8 complete

Progress:
- Milestone: [████████████] 100%

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [v0.8 milestone complete]
```

## Accumulated Context

### Decisions
| Decision | Context | Impact |
|----------|---------|--------|
| Conditional DB write on needsReconnect | Only update when currently false | Prevents duplicate SMS on repeated token failures |
| Notification path fully try/catch wrapped | Called from availability engine | Failure never breaks booking flow |
| Stripe Checkout (redirect) not Elements | Simpler PCI scope, Stripe handles card UI | No frontend card form needed |
| Post-login always redirects to /admin; Admin.tsx guard handles staff redirect | Avoids auth race condition — role fetched async | Admin.tsx always redirects staff; no timing issue |
| /staff route group isolated before /admin in Router() | Clean separation, same pattern as isAdminRoute | /staff/* paths never fall through to admin routes |
| linkStaffMemberToUser dedicated method | userId omitted from InsertStaffMember type; updateStaffMember can't accept it | create-then-link pattern for staff bridge |
| requireAuth on calendar endpoints (not requireAdmin) | Staff manage own calendar from /staff/settings | Staff can connect/disconnect Google Calendar |
| OAuth state encodes staffId:redirectTo | Survives round-trip through Google without DB storage | Stateless redirect routing |
| Token as query param for connect endpoint | Browser navigation can't carry Authorization header | Standard workaround for redirect-based OAuth from SPAs |

### Deferred Issues
None.

### Blockers/Concerns
- `npm run db:push` required before deploying v0.6 schema changes (role + phone + userId FK)
- Stripe account and API keys needed for live testing (test mode keys fine for dev)
- Token in query param appears in server logs — acceptable for internal OAuth, worth noting

### Git State
Last commit: c7ec19b
Branch: main

## Session Continuity

Last session: 2026-04-04
Stopped at: v0.8 milestone complete
Next action: Create next milestone or ship
Resume file: .paul/ROADMAP.md

---
*STATE.md — Updated after every significant action*
