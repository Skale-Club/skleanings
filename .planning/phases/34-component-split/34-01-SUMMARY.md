---
phase: 34-component-split
plan: "01"
subsystem: booking-ui
tags: [component-split, schema, react, typescript]
dependency_graph:
  requires: []
  provides:
    - client/src/pages/booking/bookingSchema.ts
    - client/src/pages/booking/BookingSummary.tsx
  affects:
    - client/src/pages/BookingPage.tsx (plan 04 will import from these)
    - client/src/pages/booking/StepCustomerDetails.tsx (plan 02 will import bookingSchema)
tech_stack:
  added: []
  patterns:
    - Schema/type extracted into standalone module to prevent circular imports
    - Component lifted verbatim with explicit props interface
key_files:
  created:
    - client/src/pages/booking/bookingSchema.ts
    - client/src/pages/booking/BookingSummary.tsx
  modified: []
decisions:
  - bookingFormSchema and BookingFormValues placed in bookingSchema.ts as pure schema module (no UI code)
  - BookingSummary receives all state via props — no direct hook calls — enabling use by thin orchestrator in plan 04
  - formatTime copied locally into BookingSummary.tsx to avoid any import from BookingPage.tsx
  - BookingPage.tsx left unchanged at this wave — plan 04 will swap original sidebar for import
metrics:
  duration: "~2 minutes"
  completed: "2026-05-13"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 34 Plan 01: Component Split Foundation — bookingSchema + BookingSummary Summary

**One-liner:** Extracted Zod booking form schema into `bookingSchema.ts` and lifted sticky sidebar JSX into `BookingSummary.tsx` — the type-contract and UI building blocks for the full component split.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create bookingSchema.ts | 7785de8 | client/src/pages/booking/bookingSchema.ts |
| 2 | Extract BookingSummary.tsx | c0462bf | client/src/pages/booking/BookingSummary.tsx |

## What Was Built

**bookingSchema.ts** — A pure schema/type module containing `bookingFormSchema` (Zod object) and `BookingFormValues` (inferred type). No UI imports, no hooks. Acts as the single source of truth for the booking form shape that both `BookingPage.tsx` and future step components can import without circular dependencies.

**BookingSummary.tsx** — The sticky sidebar component lifted verbatim from `BookingPage.tsx` lines 775–943. All state is received via a fully-typed props interface (`BookingSummaryProps`) — no `any`, no prop spreading. Cart mutations are passed as callbacks (`onRemoveItem`, `onUpdateQuantity`, `onSelectFrequency`, `onContinueToContact`). The `formatTime` helper is duplicated locally to avoid any import back into `BookingPage.tsx`.

## Verification

- `npm run check` exits 0 after each task
- `client/src/pages/BookingPage.tsx` has 0 diff lines — zero regression risk
- Both files exist and export their respective artifacts

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both files are complete implementations with no placeholder data.

## Self-Check: PASSED

- [x] `client/src/pages/booking/bookingSchema.ts` exists — FOUND
- [x] `client/src/pages/booking/BookingSummary.tsx` exists — FOUND
- [x] Commit 7785de8 exists — FOUND
- [x] Commit c0462bf exists — FOUND
- [x] BookingPage.tsx unmodified — CONFIRMED (0 diff lines)
