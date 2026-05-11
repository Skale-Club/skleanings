---
phase: 30-multiple-durations-per-service
plan: "03"
subsystem: recurring-bookings
tags: [recurring, duration, snapshot, bugfix]
dependency_graph:
  requires: [30-01, 30-02]
  provides: [DUR-06]
  affects: [server/routes/bookings.ts, server/services/recurring-booking-generator.ts]
tech_stack:
  added: []
  patterns: [snapshot-fallback, null-coalescing]
key_files:
  modified:
    - server/routes/bookings.ts
    - server/services/recurring-booking-generator.ts
decisions:
  - "chosenDurationMinutes resolved from bookingItemsData[0].durationMinutes with null fallback — covers services without a duration selection"
  - "sub.durationMinutes ?? service.durationMinutes pattern used in generator — backward compatible for pre-Phase-30 subscriptions"
metrics:
  duration: "8 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 30 Plan 03: Recurring Duration Snapshot — Summary

Recurring subscription creation now captures the customer-chosen durationMinutes snapshot, and the recurring booking generator reads that snapshot (with a catalog fallback) so all future generated instances use the correct duration.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Capture durationMinutes in createRecurringBooking | e05befc | server/routes/bookings.ts |
| 2 | Fix generator to read sub.durationMinutes snapshot | 74b7b4e | server/services/recurring-booking-generator.ts |

## What Was Built

Two surgical fixes to close the DUR-06 gap in the recurring booking pipeline:

1. **bookings.ts** — Inside the `if (rawFrequencyId)` block, resolves `chosenDurationMinutes = bookingItemsData?.[0]?.durationMinutes ?? null` immediately before the `createRecurringBooking` call, then passes it as `durationMinutes: chosenDurationMinutes` in the argument object. This stores the customer's chosen duration as a snapshot on the subscription row.

2. **recurring-booking-generator.ts** — Replaces the hardcoded `const durationMinutes = service.durationMinutes` (line 78) with `const durationMinutes = sub.durationMinutes ?? service.durationMinutes`. The `??` fallback ensures pre-Phase-30 subscriptions (where `durationMinutes` is null) continue working correctly using the catalog default.

## DUR Requirement Coverage (Phase 30 complete)

| Req | Description | Plan |
|-----|-------------|------|
| DUR-01 | Admin duration CRUD | ServiceForm.tsx + catalog routes (pre-existing) |
| DUR-02 | Customer duration cards | BookingPage.tsx (pre-existing) |
| DUR-03 | Slots reflect selected duration | CartContext totalDuration + BookingPage.updateItem (Plan 02) |
| DUR-04 | bookingItems snapshot columns | Plan 01 migration + schema, Plan 02 write path |
| DUR-05 | selectedDurationId through Zod | Plan 01 schema, Plan 02 CartContext + route |
| DUR-06 | Recurring instances use snapshot | Plan 01 schema column, **Plan 03** subscription creation + generator fix |

## Verification

- `grep -n "chosenDurationMinutes" server/routes/bookings.ts` — 2 lines (declaration + usage)
- `grep -n "durationMinutes: chosenDurationMinutes" server/routes/bookings.ts` — 1 line in createRecurringBooking call
- `grep -n "sub.durationMinutes ?? service.durationMinutes" server/services/recurring-booking-generator.ts` — 1 line
- `grep -n "const durationMinutes = service.durationMinutes" server/services/recurring-booking-generator.ts` — 0 lines (old bug removed)
- `npm run check` — exit 0
- `npm run build` — exit 0 (3 pre-existing warnings, none introduced by this plan)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- server/routes/bookings.ts modified with chosenDurationMinutes capture — FOUND
- server/services/recurring-booking-generator.ts modified with snapshot fallback — FOUND
- Commit e05befc (Task 1) — FOUND
- Commit 74b7b4e (Task 2) — FOUND
- npm run check exits 0 — VERIFIED
- npm run build exits 0 — VERIFIED
