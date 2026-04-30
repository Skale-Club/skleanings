---
status: partial
phase: 19-receptionist-booking-flow-multi-staff-view
source: [19-VERIFICATION.md]
started: 2026-04-30T00:00:00.000Z
updated: 2026-04-30T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. By Staff column layout
expected: RBC renders one column per visible staff member in Day view; column headers show first names
result: [pending]

### 2. Quick Book 30-second walk-in flow
expected: Modal opens on column slot click with staff/time pre-filled; submits to POST /api/bookings; booking appears on calendar with status=confirmed
result: [pending]

### 3. Drag-to-reassign with undo toast
expected: Dragging an event fires PUT /api/bookings/:id with new staffMemberId; undo toast reverses the change within 5 seconds
result: [pending]

### 4. GCal busy block not draggable
expected: Google Calendar busy blocks cannot be dragged; only real bookings are draggable
result: [pending]

### 5. Customer step 3 staff badges
expected: BookingPage time slots show staff name badges when multiple staff are available; no regression on single-staff sites
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
