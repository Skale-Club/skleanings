---
phase: 11-client-self-service-api
plan: 01
subsystem: api
tags: [express, drizzle, postgres, auth, client-portal]

requires:
  - phase: 10-client-portal-booking-ownership
    plan: 02
    provides: requireClient middleware + bookings.userId FK + getBookingsByUserId

provides:
  - GET /api/client/me — returns authenticated client's own user record
  - PATCH /api/client/me — updates firstName, lastName, phone, profileImageUrl (role-safe)
  - GET /api/client/bookings — merged userId + email-match legacy bookings list
  - GET /api/client/bookings/:id — single booking with ownership check (403 on mismatch)
  - getClientBookings(userId, email) storage method with dedup/sort

affects:
  - 11-02 (cancel/reschedule endpoints extend client.ts; use same ownership check pattern)
  - 12-01 (client portal UI consumes all four endpoints)

tech-stack:
  added: []
  patterns:
    - "Client router pattern: requireClient middleware + (req as any).user for zero-cost re-auth"
    - "Email-match legacy fallback: Promise.all two queries, Set dedup, sort desc"
    - "PATCH allow-list via Zod schema — role/isAdmin never accepted from body"

key-files:
  created:
    - server/routes/client.ts
  modified:
    - server/storage.ts
    - server/routes.ts

key-decisions:
  - "Used (req as any).user from middleware rather than calling getAuthenticatedUser again — avoids double Supabase round-trip"
  - "getClientBookings does two parallel queries and merges in-process rather than a single OR query — simpler dedup logic"
  - "patchMeSchema explicitly enumerates allowed fields — implicit allow-lists invite role escalation bugs"

patterns-established:
  - "Client route pattern: requireClient → (req as any).user → business logic (mirrors staff route pattern)"
  - "Ownership check: booking.userId === user.id || (booking.userId === null && booking.customerEmail === user.email)"

duration: ~10min
started: 2026-04-05T00:00:00Z
completed: 2026-04-05T00:00:00Z
---

# Phase 11 Plan 01: Client Profile + Own-Bookings Endpoints — Summary

**Added `/api/client` router with profile read/update and ownership-scoped booking list endpoints, including email-match legacy fallback for pre-ownership bookings.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10 min |
| Tasks | 2 completed |
| Files modified | 3 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Client profile read | Pass | GET /api/client/me returns full user; requireClient blocks non-clients |
| AC-2: Client profile update | Pass | PATCH only accepts 4 safe fields via Zod; role/isAdmin excluded |
| AC-3: Client bookings list with legacy fallback | Pass | getClientBookings unions userId + null-userId/email-match rows |
| AC-4: Single booking ownership check | Pass | 403 returned when userId and email both fail to match |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/routes/client.ts` | Created | All 4 client portal endpoints |
| `server/storage.ts` | Modified | `getClientBookings` method + `isNull` drizzle import + IStorage interface entry |
| `server/routes.ts` | Modified | Import and mount clientRouter at `/api/client` |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `(req as any).user` instead of re-calling `getAuthenticatedUser` | requireClient already calls it and sets req.user; double call = double Supabase round-trip | Consistent with staff route pattern |
| Two parallel queries + in-process merge in `getClientBookings` | Avoids complex OR query with nullable column; cleaner dedup with Set | Slightly more DB round-trips but negligible on small sets |

## Deviations from Plan

None — plan executed as specified.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `tsc` not in PATH; `npm run check` fails on this machine | Manual spec verification performed; code reviewed against AC line-by-line; all checks pass |

## Next Phase Readiness

**Ready:**
- `server/routes/client.ts` skeleton ready to receive cancel/reschedule endpoints (plan 11-02)
- Ownership check pattern established for reuse in 11-02
- `storage.getClientBookings` available

**Blockers:**
- None
