---
phase: 24-manual-confirmation-flow-per-service
plan: "03"
subsystem: admin-ui, booking-flow, service-form
tags: [awaiting-approval, manual-confirmation, admin-actions, service-form, booking-confirmation]
dependency_graph:
  requires: [24-01, 24-02]
  provides: [approve-reject-ui, requires-confirmation-toggle, awaiting-approval-confirmation-page]
  affects: [SharedBookingCard, ServiceForm, BookingPage, Confirmation]
tech_stack:
  added: []
  patterns:
    - useMutation for approve/reject with query invalidation
    - AlertDialog with optional Textarea for reject reason
    - Query param detection (?awaiting=true) for conditional confirmation UI
key_files:
  created: []
  modified:
    - client/src/components/admin/shared/SharedBookingCard.tsx
    - client/src/components/admin/services/ServiceForm.tsx
    - client/src/pages/BookingPage.tsx
    - client/src/pages/Confirmation.tsx
decisions:
  - Approve/Reject buttons placed in interactive variant only, visible solely when status === awaiting_approval
  - Reject uses AlertDialog with optional Textarea so admin can optionally explain rejection
  - awaiting=true query param (not state) used for Confirmation routing — works across page reloads
  - requiresConfirmation toggle placed inside Booking Rules collapsible to keep form uncluttered
metrics:
  duration: ~20 minutes
  completed: "2026-05-10"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 4
---

# Phase 24 Plan 03: Manual Confirmation UI Summary

One-liner: Amber approve/reject buttons on awaiting_approval admin booking cards, requiresConfirmation service toggle, and clock-icon "Request Received" confirmation page for customers.

## What Was Built

Three targeted UI changes completing the manual confirmation flow:

**SharedBookingCard (admin):** Added `awaiting_approval` to the `statusColor` map (amber), added it as a `SelectItem` in the status dropdown, and added `approveMutation` / `rejectMutation` hooks that call `PUT /api/bookings/:id/approve` and `PUT /api/bookings/:id/reject` respectively. Approve/Reject buttons appear only when `booking.status === 'awaiting_approval'`. The Reject button opens an `AlertDialog` with an optional `Textarea` for a reason.

**ServiceForm (admin):** Added a `requiresConfirmation` boolean state initialized from `service?.requiresConfirmation ?? false`, included it in the `handleSubmit` data payload, and rendered a `Checkbox` labeled "Requires manual confirmation" inside the existing Booking Rules collapsible section with a helper text explaining the awaiting approval behavior.

**BookingPage + Confirmation (customer):** The `createBooking.mutate` `onSuccess` callback now receives `data: any` and checks `data?.status === 'awaiting_approval'` — if true, routes to `/confirmation?awaiting=true` instead of `/confirmation`. The Confirmation page detects `searchParams.get("awaiting") === "true"` and renders an amber Clock icon with "Request Received" heading and an awaiting message before the standard pay-on-site branch.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b4a9a0c | SharedBookingCard: awaiting_approval badge, select item, approve/reject buttons |
| 2 | 982331a | ServiceForm: requiresConfirmation toggle in Booking Rules section |
| 3 | 18e4742 | BookingPage + Confirmation: awaiting_approval redirect and clock UI |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are wired. The approve/reject endpoints were implemented in 24-02.

## Self-Check

- [x] `client/src/components/admin/shared/SharedBookingCard.tsx` — modified, commits verified
- [x] `client/src/components/admin/services/ServiceForm.tsx` — modified, commits verified
- [x] `client/src/pages/BookingPage.tsx` — modified, commits verified
- [x] `client/src/pages/Confirmation.tsx` — modified, commits verified
- [x] `npm run check` — passes with zero TypeScript errors
- [x] Grep confirms awaiting_approval in SharedBookingCard, requiresConfirmation in ServiceForm, Request Received in Confirmation
