---
status: partial
phase: 34-component-split
source: [34-04-PLAN.md]
started: 2026-05-13T00:00:00.000Z
updated: 2026-05-13T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full customer booking flow
expected: Customer can complete staff → slot → details → payment → confirmation without errors
result: [pending]

### 2. booking_started fires exactly once
expected: DevTools Network shows booking_started event once on /booking load, not on step changes
result: [pending]

### 3. Admin Create Booking modal
expected: Clicking a calendar slot opens the Create Booking modal; submission creates booking and refreshes calendar
result: [pending]

### 4. Drag-to-reschedule + undo toast
expected: Dragging a booking shows undo toast; confirming or dismissing works correctly
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
