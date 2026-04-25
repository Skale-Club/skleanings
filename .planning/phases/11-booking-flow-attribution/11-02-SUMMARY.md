---
phase: 11-booking-flow-attribution
plan: 02
subsystem: attribution
tags: [attribution, booking, payments, stripe, analytics]
dependency_graph:
  requires: [11-01]
  provides: [booking-attribution-chain, conversion-events]
  affects: [client/src/pages/BookingPage.tsx, server/routes/bookings.ts, server/routes/payments.ts]
tech_stack:
  added: []
  patterns: [fire-and-forget-try-catch, visitorId-outside-zod-schema]
key_files:
  created: []
  modified:
    - client/src/pages/BookingPage.tsx
    - server/routes/bookings.ts
    - server/routes/payments.ts
decisions:
  - "D-07: visitorId read from req.body directly after Zod parse — not added to insertBookingSchema to avoid polluting booking schema with analytics concern"
  - "Direct import of linkBookingToAttribution + recordConversionEvent from ../storage/analytics — storage.ts is a DatabaseStorage class instance that does not expose analytics module methods"
metrics:
  duration: 6 minutes
  completed_date: "2026-04-25"
  tasks_completed: 2
  files_modified: 3
---

# Phase 11 Plan 02: Booking Flow Attribution Wiring Summary

**One-liner:** Wired visitorId attribution thread through BookingPage.tsx (both booking paths) and Stripe webhook, ensuring every completed booking links to its visitor session via fire-and-forget try-catch blocks.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add visitorId to bookingPayload and booking_started event | 3a07a2d | client/src/pages/BookingPage.tsx |
| 2 | Wire attribution calls into bookings.ts and payments.ts | cc577c3 | server/routes/bookings.ts, server/routes/payments.ts |
| - | Rebuild api/index.js bundle | 83f3b18 | api/index.js |

## What Was Built

### Task 1: BookingPage.tsx Changes
- Added fire-and-forget `booking_started` event in the existing mount `useEffect` (guards: `items.length > 0`)
  - Reads `localStorage.getItem('skleanings_visitor_id')` into local var
  - POSTs to `/api/analytics/events` with `eventType: 'booking_started'` and `pageUrl`
  - `.catch(() => {})` ensures booking flow is never blocked
- Added `visitorId: localStorage.getItem('skleanings_visitor_id') ?? undefined` to `bookingPayload`
  - Affects both direct booking path and Stripe checkout path simultaneously (ATTR-02)
  - `undefined` when localStorage null (private browsing) — server skips attribution silently (D-03)
- Added `as any` cast to `createBooking.mutate(bookingPayload as any, ...)` — `useCreateBooking` mutationFn expects `InsertBooking` which doesn't include `visitorId`

### Task 2: Server Attribution Wiring

**bookings.ts (direct path):**
- Imports `linkBookingToAttribution` and `recordConversionEvent` directly from `../storage/analytics`
- Reads `visitorId` from `req.body.visitorId` after Zod parse (D-07: Zod strips unknown fields)
- Two independent try-catch blocks after contact upsert:
  1. `linkBookingToAttribution(booking.id, visitorId)` — only when visitorId is present
  2. `recordConversionEvent('booking_completed', { bookingId, bookingValue })` — always fires
- Neither block blocks the booking response (EVENTS-04)

**payments.ts (Stripe checkout path):**
- Same import pattern
- Reads `visitorId` from `req.body.visitorId` immediately after Zod parse
- After `createBooking(...)`: single try-catch calls `linkBookingToAttribution` (no conversion event here — D-05)
- Stripe webhook `checkout.session.completed` handler: after `updateBooking(bookingId, { paymentStatus: 'paid' })`, calls `recordConversionEvent('booking_completed', { bookingId })` in try-catch (D-05)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Direct import required for analytics functions**

- **Found during:** Task 2
- **Issue:** Plan said "No new imports needed — `storage` is already imported." However `server/storage.ts` is a `DatabaseStorage` class instance that does NOT expose `linkBookingToAttribution` or `recordConversionEvent`. These functions live in `server/storage/analytics.ts`, assembled only into `server/storage/index.ts`. The routes used `../storage` (the class), not `../storage/index` (the assembled object).
- **Fix:** Added `import { linkBookingToAttribution, recordConversionEvent } from "../storage/analytics"` to both routes. Called these functions directly rather than via `storage.*`.
- **Files modified:** server/routes/bookings.ts, server/routes/payments.ts
- **Commits:** cc577c3

**2. [Rule 1 - Bug] Acceptance criterion grep count mismatch — comment contained function name**

- **Found during:** Task 2 acceptance check
- **Issue:** Added comment `// D-05: NO recordConversionEvent here` in checkout handler — this caused `grep -c "recordConversionEvent" payments.ts` to return 3 instead of 2 (import + comment + webhook call).
- **Fix:** Changed comment text to `// D-05: conversion event fires in webhook only` to avoid false positive.
- **Files modified:** server/routes/payments.ts
- **Commits:** cc577c3

## Verification Results

```
npm run check  → EXIT: 0 (TypeScript passes)
npm run build  → EXIT: 0 (client + server bundle built successfully)
```

### Acceptance Criteria Results

| Criterion | Result |
|-----------|--------|
| `grep -n "visitorId: localStorage.getItem" BookingPage.tsx` = 1 match (bookingPayload) | PASS |
| `grep -n "booking_started" BookingPage.tsx` = 1+ matches | PASS |
| `grep -n "createBooking.mutate(bookingPayload as any" BookingPage.tsx` = 1 match | PASS |
| `.catch(() => {})` in BookingPage.tsx | PASS |
| `grep -n "linkBookingToAttribution" bookings.ts` = 1 call | PASS |
| `grep -n "recordConversionEvent" bookings.ts` = 1 call | PASS |
| `grep -n "visitorId = req.body.visitorId" bookings.ts` = 1 match | PASS |
| `grep -n "visitorId = req.body.visitorId" payments.ts` = 1 match | PASS |
| `grep -n "linkBookingToAttribution" payments.ts` = 1 call (checkout only) | PASS |
| `grep -n "recordConversionEvent" payments.ts` = 1 call (webhook only, D-05) | PASS |
| `npm run check` exits 0 | PASS |
| `npm run build` exits 0 | PASS |

## Known Stubs

None — all attribution calls are wired to real storage functions. Runtime execution requires the DB migration from Plan 11-01 to be applied (`visitor_sessions` and `conversion_events` tables must exist).

## Self-Check: PASSED

- `client/src/pages/BookingPage.tsx` — exists and modified
- `server/routes/bookings.ts` — exists and modified
- `server/routes/payments.ts` — exists and modified
- Commit 3a07a2d — verified via git log
- Commit cc577c3 — verified via git log
- Commit 83f3b18 — verified via git log
