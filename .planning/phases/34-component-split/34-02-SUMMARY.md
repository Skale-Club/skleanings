---
phase: 34-component-split
plan: "02"
subsystem: booking-ui
tags: [component-split, react, typescript, props-drilling]
dependency_graph:
  requires:
    - client/src/pages/booking/bookingSchema.ts (plan 01)
  provides:
    - client/src/pages/booking/StepStaffSelector.tsx
    - client/src/pages/booking/StepTimeSlot.tsx
    - client/src/pages/booking/StepCustomerDetails.tsx
    - client/src/pages/booking/StepPaymentMethod.tsx
  affects:
    - client/src/pages/BookingPage.tsx (plan 04 will import these)
tech_stack:
  added: []
  patterns:
    - JSX lifted verbatim from monolith into typed sub-components
    - UseFormReturn<BookingFormValues> passed as prop (no useForm in children)
    - Local formatTime helper copied into StepTimeSlot to avoid circular imports
    - bookingStartedFiredRef stays exclusively in BookingPage parent
key_files:
  created:
    - client/src/pages/booking/StepStaffSelector.tsx
    - client/src/pages/booking/StepTimeSlot.tsx
    - client/src/pages/booking/StepCustomerDetails.tsx
    - client/src/pages/booking/StepPaymentMethod.tsx
  modified: []
decisions:
  - formatTime helper duplicated locally in StepTimeSlot (same pattern as BookingSummary in plan 01) to avoid any import back to BookingPage
  - Duration sub-step and calendar picker bundled into single StepTimeSlot component (both render under step 3 guard in parent)
  - onApplyDurations callback replaces direct updateItem calls in duration button onClick — parent owns cart mutation
  - Date selection onClick simplified to onSelectDate(dateStr) only — scroll-to-slots behavior will be re-added in plan 04 via parent refs
  - StepPaymentMethod receives onSubmit directly (parent passes form.handleSubmit(onSubmit)) — no double-wrapping in handleSubmit
metrics:
  duration: "~3 minutes"
  completed: "2026-05-13"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 34 Plan 02: Step Sub-Components Extraction Summary

**One-liner:** Lifted four booking step JSX blocks verbatim from BookingPage.tsx into typed sub-components with props-down/callbacks-up contracts, preserving form instance sharing and useRef guard isolation.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Extract StepStaffSelector and StepTimeSlot | b589ff1 | client/src/pages/booking/StepStaffSelector.tsx, client/src/pages/booking/StepTimeSlot.tsx |
| 2 | Extract StepCustomerDetails and StepPaymentMethod | f26b8b0 | client/src/pages/booking/StepCustomerDetails.tsx, client/src/pages/booking/StepPaymentMethod.tsx |

## What Was Built

**StepStaffSelector.tsx** — Staff card grid component lifted from BookingPage lines 341-394. Receives `staffList`, `selectedStaff`, `onSelectStaff`, and `onNext` as typed props. No hooks, no useRef.

**StepTimeSlot.tsx** — Combined duration sub-step (lines 397-447) and calendar/slot picker (lines 449-598). Contains the two inner conditionals intact (`!allDurationsSelected && itemsWithDurations.length > 0` for durations; `allDurationsSelected || itemsWithDurations.length === 0` for the calendar). Returns a React Fragment wrapping both blocks. `formatTime` helper copied locally.

**StepCustomerDetails.tsx** — Contact form lifted from BookingPage lines 601-676. Receives `form: UseFormReturn<BookingFormValues>` as a prop and calls `form.trigger(...)` for step-local validation before `onNext()`. Phone masking onChange preserved verbatim.

**StepPaymentMethod.tsx** — Address + payment method form lifted from BookingPage lines 679-771. Receives `form` as a prop and uses `form.watch("paymentMethod")` for conditional styling. The `<form>` element binds `onSubmit` directly (parent supplies `form.handleSubmit(onSubmit)`).

## Verification

- All four files exist in `client/src/pages/booking/`
- No `useForm` call in any step file
- No `bookingStartedFiredRef` reference in any step file
- `npm run check` introduces zero new TypeScript errors (pre-existing errors in `useDragToReschedule.ts` are out of scope)
- `BookingPage.tsx` has 0 diff lines — zero regression risk

## Deviations from Plan

**1. [Rule 1 - Adaptation] Date selection scroll-to-slots removed from StepTimeSlot**
- **Found during:** Task 1
- **Issue:** `slotsRef.current?.scrollIntoView(...)` inside StepTimeSlot's date onClick requires a ref that lives in the BookingPage parent — passing a ref as a prop would violate the props-only contract and couple the child to the parent's DOM structure
- **Fix:** Simplified `onClick` to call `onSelectDate(dateStr)` only. The parent (BookingPage) will re-attach scroll behavior in plan 04 when it wires the sub-components
- **Files modified:** StepTimeSlot.tsx
- **Impact:** Zero behavioral change until plan 04 wires components — BookingPage.tsx is unchanged

## Known Stubs

None — all four components are complete implementations rendering their full JSX. No placeholder data, no TODO comments, no hardcoded empties.

## Self-Check: PASSED

- [x] `client/src/pages/booking/StepStaffSelector.tsx` exists — FOUND
- [x] `client/src/pages/booking/StepTimeSlot.tsx` exists — FOUND
- [x] `client/src/pages/booking/StepCustomerDetails.tsx` exists — FOUND
- [x] `client/src/pages/booking/StepPaymentMethod.tsx` exists — FOUND
- [x] Commit b589ff1 exists — FOUND
- [x] Commit f26b8b0 exists — FOUND
- [x] BookingPage.tsx unmodified — CONFIRMED (0 diff lines)
- [x] No useForm in step files — CONFIRMED
- [x] No bookingStartedFiredRef in step files — CONFIRMED
