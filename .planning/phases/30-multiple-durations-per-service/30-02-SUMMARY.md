---
phase: 30-multiple-durations-per-service
plan: "02"
subsystem: booking
tags: [storage, booking-route, cart-context, duration, snapshot]
dependency_graph:
  requires: [30-01]
  provides: [storage.getServiceDuration, booking_items.duration_snapshot, cart_payload.selectedDurationId]
  affects: [server/routes/bookings.ts, client/src/context/CartContext.tsx, server/storage.ts]
tech_stack:
  added: []
  patterns: [storage-interface-extension, booking-item-snapshot, cart-payload-forwarding]
key_files:
  created: []
  modified:
    - server/storage.ts
    - server/routes/bookings.ts
    - client/src/context/CartContext.tsx
decisions:
  - "questionAnswers omitted from getCartItemsForBooking update — CartItem type does not carry the field (it lives on bookingItems schema); the field was already forwarded via cartItem.questionAnswers in the server route"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-11"
  tasks_completed: 2
  files_changed: 3
---

# Phase 30 Plan 02: Duration Data Plumbing Summary

Duration selection flows end-to-end: CartContext payload includes `selectedDurationId`, booking route resolves the chosen `ServiceDuration` via `storage.getServiceDuration`, and writes `durationLabel` + `durationMinutes` as snapshot columns into `bookingItems`.

## What Was Built

- **`server/storage.ts`**: `getServiceDuration(id: number)` added to `IStorage` interface and `DatabaseStorage` implementation — single-row select from `serviceDurations` by primary key.
- **`client/src/context/CartContext.tsx`**: `getCartItemsForBooking()` now includes `selectedDurationId: item.selectedDurationId` in the mapped payload so the field survives Zod's `cartItemSchema.parse` on the server.
- **`server/routes/bookings.ts`**: Inside the `for (const cartItem of validatedData.cartItems)` loop, duration is resolved via `storage.getServiceDuration(cartItem.selectedDurationId)` and `durationLabel` / `durationMinutes` are written into `bookingItemsData.push(...)`.

## Commits

| Hash | Message |
|------|---------|
| 8304871 | feat(30-02): add getServiceDuration to IStorage interface and DatabaseStorage |
| 0668486 | feat(30-02): wire duration selection through CartContext and booking route |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed questionAnswers from CartContext getCartItemsForBooking**
- **Found during:** Task 2 (npm run check)
- **Issue:** The plan template said to include `questionAnswers` if already present in the original function. The original `getCartItemsForBooking` did NOT have `questionAnswers`. Adding it caused TS2339 because `CartItem` does not carry that property (it lives only on the `bookingItems` Drizzle table, not the cart item interface).
- **Fix:** Omitted `questionAnswers` from the CartContext map. The field continues to be forwarded correctly on the server side via `cartItem.questionAnswers` (already present in `bookingItemsData.push`).
- **Files modified:** `client/src/context/CartContext.tsx`
- **Commit:** 0668486

## Known Stubs

None. Duration data now flows from cart selection through to the database snapshot columns added in Plan 01.

## Self-Check: PASSED

- `grep -n "getServiceDuration(id" server/storage.ts` — returns lines 170 (interface) and 703 (implementation)
- `grep -n "selectedDurationId: item.selectedDurationId" client/src/context/CartContext.tsx` — returns line 240
- `grep -n "storage.getServiceDuration" server/routes/bookings.ts` — returns line 84
- `grep -n "durationLabel" server/routes/bookings.ts` — returns lines 81, 86, 104
- `grep -n "durationMinutes: resolvedDurationMinutes" server/routes/bookings.ts` — returns line 105
- Commits 8304871 and 0668486 — verified in git log
- `npm run check` — exits 0
