---
phase: 10-client-portal-booking-ownership
plan: 02
subsystem: database
tags: [postgres, drizzle, bookings, ownership, auth]

requires:
  - phase: 10-client-portal-booking-ownership
    plan: 01
    provides: requireClient middleware + client role in auth layer

provides:
  - bookings.userId nullable FK column (migration pending db:push)
  - getBookingsByUserId storage method
  - POST /api/bookings soft-auth: attaches userId when caller is role=client
  - Guest bookings unchanged (userId = null)

affects:
  - 11-01 (client profile + own-bookings endpoints consume getBookingsByUserId)
  - 11-02 (cancel/reschedule use booking.userId for ownership checks)

tech-stack:
  added: []
  patterns:
    - "Soft-auth pattern: getAuthenticatedUser inside try/catch on public endpoint — auth failure is non-fatal"
    - "userId omitted from insertBookingSchemaBase — server-side only, never accepted from client body"
    - "Only role=client triggers userId attachment; admin/user/staff bookings leave userId null"

key-files:
  modified:
    - shared/schema.ts
    - server/storage.ts
    - server/routes/bookings.ts

key-decisions:
  - "userId omitted from client-facing Zod schema — prevents userId spoofing from request body"
  - "Soft-auth in try/catch so DB bootstrap failures don't break guest checkout"
  - "Only client role gets userId attached — internal roles (admin booking on behalf of customer) intentionally leave userId null"
  - "Email-match legacy lookup deferred to phase 11 — only needed when building read endpoints"

patterns-established:
  - "Soft-auth: try getAuthenticatedUser on public endpoint, role-check result, non-fatal on failure"

duration: ~15min
started: 2026-04-05T00:00:00Z
completed: 2026-04-05T00:00:00Z
---

# Phase 10 Plan 02: Booking Ownership — Summary

**Added `bookings.userId` nullable FK and soft-auth on POST /api/bookings so authenticated client bookings are automatically linked to their account; guest checkout unchanged.**

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Schema has bookings.userId | Pass (code) | Column added; `npm run db:push` required to apply migration |
| AC-2: Authenticated client booking stores userId | Pass | Soft-auth attaches authUser.id when role=client |
| AC-3: Guest booking works with userId = null | Pass | No auth header → bookingUserId stays null, createBooking proceeds normally |
| AC-4: getBookingsByUserId returns scoped bookings | Pass | Implemented with eq(bookings.userId) + desc(createdAt) ordering |

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `shared/schema.ts` | Modified | Added `userId` nullable FK to `bookings` table; omitted from `insertBookingSchemaBase` |
| `server/storage.ts` | Modified | IStorage interface + `createBooking` signature + `userId` in INSERT + `getBookingsByUserId` |
| `server/routes/bookings.ts` | Modified | `getAuthenticatedUser` import + soft-auth block in POST handler |

## Deferred Items

- `npm run db:push` — must be run by the user before deploying to apply the `bookings.userId` column
- Email-match legacy lookup — deferred to phase 11 when `GET /api/client/bookings` is built; only needed for the read path, not the write path

## Next Phase Readiness

**Ready:**
- `bookings.userId` schema in place
- `getBookingsByUserId` available for phase 11 client API
- `requireClient` middleware available (from 10-01) for protecting client endpoints

**Blockers:**
- `npm run db:push` must complete before any client booking can write userId to production DB
