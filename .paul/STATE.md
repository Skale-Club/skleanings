# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-05)

**Core value:** Customers can book cleaning services with a specific professional, with a unified calendar that automatically resolves availability conflicts across staff members and their external Google Calendar events.
**Current focus:** v1.0 Client Portal & Self-Service Booking Management — COMPLETE

## Current Position

Milestone: v1.0 Client Portal & Self-Service Booking Management — **COMPLETE**
Phase: 3 of 3 (Client Portal UI) — Complete
Plan: 12-03 unified — MILESTONE COMPLETE
Status: Ready for next milestone
Last activity: 2026-04-05 — Phase 12 complete, v1.0 milestone shipped

Progress:
- Milestone: [████████████] 100%
- Phase 3: [████████████] 100%

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete — milestone complete]
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
| AlertDialog for cancel, Dialog for reschedule | AlertDialog has correct destructive semantics; Dialog suits multi-step picker | Consistent with shadcn conventions |
| onError: toast only, no onClose in dialogs | User should be able to retry without reopening | Better UX for transient API errors |

### Deferred Issues
- Verify if SCRAM error source is pooled URL only or shared across all DB URLs.
- Determine whether login redirect loop is caused by failed session persistence, auth role fetch failure, or client route guard timing.
- `npm run db:push` required to apply bookings.userId column before client booking ownership works in production.

### Blockers/Concerns
- `npm run db:push` required before deploying v1.0 schema changes (bookings.userId FK)
- Stripe account and API keys needed for live testing (test mode keys fine for dev)
- Token in query param appears in server logs — acceptable for internal OAuth, worth noting

### Git State
Last commit: a0753dc
Branch: main

## Session Continuity

Last session: 2026-04-05
Stopped at: v1.0 milestone complete — all 3 phases shipped
Next action: /paul:complete-milestone (or /paul:milestone for v1.1 planning)
Resume file: .paul/ROADMAP.md

---
*STATE.md — Updated after every significant action*
