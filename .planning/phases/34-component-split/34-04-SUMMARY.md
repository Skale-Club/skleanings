---
plan: 34-04
phase: 34
status: complete
checkpoint: human-verify-pending
---

## What Was Built

BookingPage.tsx and AppointmentsCalendarSection.tsx wired to their extracted sub-components:

- `BookingPage.tsx` — reduced from ~948 lines to thin orchestrator. Imports `StepStaffSelector`, `StepTimeSlot`, `StepCustomerDetails`, `StepPaymentMethod`, `BookingSummary`. `bookingStartedFiredRef` and `useForm` remain in parent.
- `AppointmentsCalendarSection.tsx` — reduced from ~49KB to thin calendar shell. Delegates to `CreateBookingModal` and `useDragToReschedule`.
- `npm run check && npm run build` both exit 0.

## Checkpoint Pending

Human smoke test deferred to live browser session. Items to verify:
1. Full customer booking flow (staff → slot → details → payment → confirmation)
2. `booking_started` fires once only (useRef guard preserved)
3. Admin calendar Create Booking modal and drag-to-reschedule

## Commits

- `725143a` feat(34-04): thin BookingPage.tsx to step orchestrator
- `84e342c` feat(34-04): thin AppointmentsCalendarSection.tsx to calendar orchestrator
