---
phase: 34-component-split
plan: "03"
subsystem: admin-calendar
tags: [refactor, component-split, admin, calendar]
dependency_graph:
  requires: []
  provides:
    - client/src/components/admin/calendar/useDragToReschedule.tsx
    - client/src/components/admin/calendar/CreateBookingModal.tsx
  affects:
    - client/src/components/admin/AppointmentsCalendarSection.tsx (plan 04 will import from here)
tech_stack:
  added: []
  patterns:
    - Custom hook extracting mutation + event handler (useDragToReschedule)
    - Self-contained modal component owning all its own form state
key_files:
  created:
    - client/src/components/admin/calendar/useDragToReschedule.tsx
    - client/src/components/admin/calendar/CreateBookingModal.tsx
  modified: []
decisions:
  - useDragToReschedule.tsx uses .tsx extension instead of .ts because the file contains JSX (ToastAction element in undo toast)
metrics:
  duration: ~10 minutes
  completed_date: "2026-05-11"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 34 Plan 03: Admin Calendar Extract — CreateBookingModal + useDragToReschedule Summary

**One-liner:** Extracted admin calendar's Create Booking Dialog (~310 lines) and drag-reschedule mutation (~60 lines) into dedicated files in `client/src/components/admin/calendar/`.

## What Was Built

**Task 1: `useDragToReschedule.tsx`**
Custom hook that encapsulates the `reassignMutation` (PUT /api/bookings/:id) and `handleEventDrop` logic lifted from AppointmentsCalendarSection lines 747-887. Returns `{ handleEventDrop }`. Hook initializes its own `useToast` and `useQueryClient` internally. Accepts `getAccessToken` and `scopedStaffList` as props.

**Task 2: `CreateBookingModal.tsx`**
Full Create Booking Dialog component extracted from AppointmentsCalendarSection lines 1252-1562. Owns all local state:
- `bookingFormSchema` Zod schema (admin-specific, not the customer bookingSchema.ts)
- `useForm<BookingFormValues>` with zodResolver
- `useFieldArray` for service rows
- `userEditedEndTime`, `openServiceIdx`, `contactSearchOpen`, `serverError` state
- `createBookingMutation` with status patch and error handling
- `computedEndTime` and `estimatedTotal` memos
- Contact typeahead query
- `onSubmit` handler

The `onSuccess` prop delegates query invalidation to the parent; `form.reset()` runs locally inside the modal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed useDragToReschedule.ts to .tsx**
- **Found during:** Task 1 verification (npm run check)
- **Issue:** The hook uses JSX (`<ToastAction>` element for the undo toast action). TypeScript requires `.tsx` extension for files containing JSX.
- **Fix:** File created as `.tsx` instead of `.ts` as specified in the plan.
- **Files modified:** `client/src/components/admin/calendar/useDragToReschedule.tsx`
- **Commit:** b9cd3a7

## Verification

- `useDragToReschedule.tsx` exports `useDragToReschedule`, returns `{ handleEventDrop }` — PASS
- `CreateBookingModal.tsx` exports `CreateBookingModal` — PASS
- `useForm` exists inside CreateBookingModal.tsx (not passed as prop) — PASS
- `npm run check` exits 0 — PASS
- `AppointmentsCalendarSection.tsx` NOT modified — PASS

## Self-Check: PASSED

Files exist:
- FOUND: client/src/components/admin/calendar/useDragToReschedule.tsx
- FOUND: client/src/components/admin/calendar/CreateBookingModal.tsx

Commits exist:
- FOUND: b9cd3a7 — feat(34-03): extract useDragToReschedule hook
- FOUND: ff06dec — feat(34-03): extract CreateBookingModal component
