# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-05)

**Core value:** Customers can book cleaning services with a specific professional, with a unified calendar that automatically resolves availability conflicts across staff members and their external Google Calendar events.
**Current focus:** v1.0 Client Portal & Self-Service Booking Management — IN PROGRESS

## Current Position

Milestone: v1.0 Client Portal & Self-Service Booking Management — **IN PROGRESS**
Phase: 3 of 3 (Client Portal UI) — Not started
Plan: Not started
Status: Ready to plan Phase 12
Last activity: 2026-04-05 — Phase 11 complete; all 3 plans unified; transitioned to Phase 12

Progress:
- Milestone: [████████░░░░] 67%
- Phase 3: [░░░░░░░░░░░░] 0%

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ○        ○        ○     [Ready for next PLAN]
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
| Client router uses (req as any).user from middleware | requireClient already calls getAuthenticatedUser; double call = double Supabase round-trip | Zero-cost re-auth in client route handlers |
| getClientBookings: two parallel queries + in-process merge | Avoids complex OR on nullable column | Clean dedup; slight extra DB round-trip acceptable |
| Fire-and-forget GHL/notification sync for cancel/reschedule | HTTP response speed — client must not wait for external services | Sync runs in background; failure logged only |

### Deferred Issues
- Verify if SCRAM error source is pooled URL only or shared across all DB URLs.
- Determine whether login redirect loop is caused by failed session persistence, auth role fetch failure, or client route guard timing.
- `npm run db:push` required to apply bookings.userId column before client booking ownership works in production.

### Blockers/Concerns
- `npm run db:push` required before deploying v1.0 Phase 1+2 schema changes (bookings.userId FK)
- Stripe account and API keys needed for live testing (test mode keys fine for dev)
- Token in query param appears in server logs — acceptable for internal OAuth, worth noting

### Git State
Last commit: d31fa8a
Branch: main

## Session Continuity

Last session: 2026-04-05
Stopped at: Phase 11 complete; transitioned to Phase 12 (Client Portal UI)
Next action: /paul:plan — begin Phase 12 (Client Portal UI)
Resume file: .paul/ROADMAP.md

---
*STATE.md — Updated after every significant action*
