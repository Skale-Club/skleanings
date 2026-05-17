---
id: SEED-004
status: shipped
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: when any phase needs to modify BookingPage or AppointmentsCalendarSection
scope: Medium
---

# SEED-004: Split giant components (BookingPage 39KB, AppointmentsCalendarSection 49KB)

## Why This Matters

`BookingPage.tsx` is 39KB and contains the 5 booking flow steps in a single file: staff selection, availability calendar, customer form, payment method selection, and confirmation. `AppointmentsCalendarSection.tsx` is 49KB and mixes calendar grid rendering, drag-to-reschedule logic, and the booking creation modal.

Every phase that touches these files increases conflict risk, makes code review harder, and makes it impossible to write focused unit tests.

**Why:** Any new feature in the booking flow (Phase 18 zipcode gating, new payment options, new confirmation step) will inflate these files even further.

## When to Surface

**Trigger:** when any phase modifies BookingPage or AppointmentsCalendarSection, or when adding a new step to the booking flow.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone with booking flow changes (new step, new payment method)
- Refactoring/quality milestone after White Label v2.0
- Milestone with unit tests (SEED-001) — splitting is a prerequisite for testability

## Scope Estimate

**Medium** — One phase. BookingPage: extract `StepStaffSelector`, `StepTimeSlot`, `StepCustomerDetails`, `StepPaymentMethod`, `StepConfirmation`. AppointmentsCalendarSection: extract `CalendarGrid`, `CreateBookingModal`, `RescheduleHandler`.

## Breadcrumbs

- `client/src/pages/BookingPage.tsx` — 39KB, 5 steps, shared state between steps
- `client/src/components/admin/AppointmentsCalendarSection.tsx` — 49KB, calendar + modal + drag
- `client/src/context/CartContext.tsx` — cart state shared with BookingPage
- Reference pattern: `client/src/components/admin/ServicesSection.tsx` (already uses sub-components well)

## Notes

Splitting BookingPage must preserve the state flow: state for each step needs to be managed by the parent component (BookingPage) or migrated to a dedicated `BookingFlowContext`. Watch out for the `useRef` fire-once guard for booking_started (Phase 15 decision) — must not be lost in the refactor.
