---
created: 2026-04-29T01:45:48.968Z
title: Unify booking creation modal across Calendar and Bookings pages
area: ui
files:
  - client/src/components/admin/AppointmentsCalendarSection.tsx
  - client/src/components/admin/BookingsSection.tsx
  - client/src/components/admin/shared/CreateBookingDialog.tsx (new)
---

## Problem

Booking creation is currently only available from one entry point in the admin: clicking a slot on the Calendar (`AppointmentsCalendarSection.tsx`). Phase 14 built the Create Booking modal there with full slot pre-fill, customer type-ahead, end-time auto-compute, and POST /api/bookings wiring.

The admin Bookings page (`BookingsSection.tsx`) has no way to create a booking — the empty state just says "No bookings in this view" with no add affordance. The page header shows "0 Total" + a status filter dropdown, but no "+ Add booking" button.

Two related problems:
1. **UX gap:** an attendant on the Bookings page cannot create a booking without navigating to the Calendar and clicking the right slot.
2. **Code duplication risk:** if Bookings page builds its own Create Booking modal, the two will drift in features (multi-service, end-time editing, address conditional, etc. — see Phase 18 CAL-02 to CAL-06).

The user explicitly asked for the popup to be unified.

## Solution

1. **Extract** the Create Booking dialog from `AppointmentsCalendarSection.tsx` into a shared component:
   - `client/src/components/admin/shared/CreateBookingDialog.tsx`
   - Props:
     - `open`, `onOpenChange` (controlled)
     - `prefill?: { date?: string; startTime?: string; staffMemberId?: number | null }` — optional, all fields optional
     - `onCreated?: (bookingId: number) => void` — for any caller-specific success behaviour

2. **Calendar usage:** open with `prefill` populated from the clicked slot (current behaviour, just routed through the shared component).

3. **Bookings page usage:**
   - Add an "+ Add booking" button to the header (next to the status filter), brand-yellow per Phase 18 CAL-06
   - Open with no `prefill` — attendant fills date/time/staff manually
   - On success, invalidate `['/api/bookings']` so the new row appears in the current view

4. **Internal hook:** the dialog handles its own form state, customer type-ahead, end-time computation, and POST /api/bookings — caller is decoupled from booking-creation logic.

## Scheduling

Phase 18 in the v2.0 White Label roadmap already targets the Create Booking modal (CAL-02 widening, CAL-03 multi-service, CAL-04 editable end time, CAL-05 conditional address, CAL-06 brand button). Two scheduling options to weigh during planning:

- **Option A — Extend Phase 18 scope:** add unification + Bookings-page entry to Phase 18 requirements. Keeps modal-related work in one phase. Risk: scope creep on Phase 18.
- **Option B — New Phase 19:** Phase 18 stays focused on Calendar fixes and modal feature additions; Phase 19 does the structural extraction + Bookings-page mount. Cleaner separation: feature work first, refactor + new entry point second.

Recommended: Option B — refactor after Phase 18 lands the feature changes, so the extracted shared component reflects the final feature set rather than churning during Phase 18.
