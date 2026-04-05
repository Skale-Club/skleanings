# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-04)

**Core value:** Customers can book cleaning services with a specific professional, with a unified calendar that automatically resolves availability conflicts across staff members and their external Google Calendar events.
**Current focus:** v1.0 Client Portal & Self-Service Booking Management — NEXT

## Current Position

Milestone: v1.0 Client Portal & Self-Service Booking Management — **IN PROGRESS**
Phase: 1 of 3 (Client Role + Booking Ownership) — Planning
Plan: 10-01 — UNIFY complete
Status: Loop closed; ready for next PLAN (10-02)
Last activity: 2026-04-05 — UNIFY closed 10-01: client role foundation complete

Progress:
- Milestone: [░░░░░░░░░░░░] 0%
- Phase 1: [░░░░░░░░░░░░] 0%

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
| Post-login always redirects to /admin; Admin.tsx guard handles staff redirect | Avoids auth race condition — role fetched async | Admin.tsx always redirects staff; no timing issue |
| /staff route group isolated before /admin in Router() | Clean separation, same pattern as isAdminRoute | /staff/* paths never fall through to admin routes |
| linkStaffMemberToUser dedicated method | userId omitted from InsertStaffMember type; updateStaffMember can't accept it | create-then-link pattern for staff bridge |
| requireAuth on calendar endpoints (not requireAdmin) | Staff manage own calendar from /staff/settings | Staff can connect/disconnect Google Calendar |
| OAuth state encodes staffId:redirectTo | Survives round-trip through Google without DB storage | Stateless redirect routing |
| Token as query param for connect endpoint | Browser navigation can't carry Authorization header | Standard workaround for redirect-based OAuth from SPAs |

### Deferred Issues
- Verify if SCRAM error source is pooled URL only or shared across all DB URLs.
- Determine whether login redirect loop is caused by failed session persistence, auth role fetch failure, or client route guard timing.

### Blockers/Concerns
- `npm run db:push` required before deploying v0.6 schema changes (role + phone + userId FK)
- Stripe account and API keys needed for live testing (test mode keys fine for dev)
- Token in query param appears in server logs — acceptable for internal OAuth, worth noting
- Production login and `/api/blog/cron/generate` both intermittently fail on cold start with `SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing`
- Failure currently appears tied to serverless DB connection handshake through pgBouncer path
- Production login for `skleanings@gmail.com` can appear successful, then redirect back to `/login` repeatedly (loop)

### Git State
Last commit: d31fa8a
Branch: main

## Session Continuity

Last session: 2026-04-05
Stopped at: UNIFY closed for 10-01; client role foundation complete
Next action: /paul:plan — begin 10-02 (booking ownership: bookings.userId FK + client autofill)
Resume file: .paul/phases/10-client-portal-booking-ownership/10-01-SUMMARY.md

---
*STATE.md — Updated after every significant action*
