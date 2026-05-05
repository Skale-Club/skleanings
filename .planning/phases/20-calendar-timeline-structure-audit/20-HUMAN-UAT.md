---
status: pending
phase: 20-calendar-timeline-structure-audit
source: [20-VALIDATION.md, 20-CONTEXT.md]
started: 2026-05-05T00:00:00.000Z
updated: 2026-05-05T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### CAL-FIX-01. Time gutter labels align with grid line at all zoom levels
expected: For each (view × zoom) cell of the matrix Day/Week/Day+ByStaff at 75/100/125%, run the DevTools `getBoundingClientRect` snippet from `20-RESEARCH.md` § Diagnostic Snippet on `.rbc-label` and the corresponding `.rbc-timeslot-group` top; record offset; pass = 0 px ± 1 px subpixel rounding; fail = > 1 px on any cell
result: [pending]

### CAL-FIX-02. View-switch leaves no stale layout
expected: Walk through Month → Week → Day → By Staff → Week → Month in one continuous browser session; after each transition: (a) inspect `.rbc-time-gutter` width is consistent, (b) inspect `.rbc-header` row positions match `.rbc-day-slot` columns, (c) verify event blocks sit within their slot boundaries, (d) confirm no manual page reload was needed; pass = all 4 visual checks pass at every transition
result: [pending]

### CAL-FIX-03. By Staff multi-column view + horizontal scroll
expected: With 5+ staff visible, enter By Staff view: (a) confirm one column per visible staff, (b) confirm horizontal scrollbar appears on `.appointments-calendar-shell__board`, (c) toggle a staff filter — column should be added/removed without page reload, (d) confirm gutter remains sticky at left during horizontal scroll; pass = all 4
result: [pending]

### CAL-FIX-04. Phase 19 UAT regression check
expected: Walk through each of the 5 items in `.planning/phases/19-receptionist-booking-flow-multi-staff-view/19-HUMAN-UAT.md` exactly as written; pass = all 5 still pass identically to Phase 19 acceptance. Per-item attribution required:
  - 19-UAT-1 (By Staff column layout): [pending]
  - 19-UAT-2 (Quick Book 30-second walk-in flow): [pending]
  - 19-UAT-3 (Drag-to-reassign with undo toast): [pending]
  - 19-UAT-4 (GCal busy block not draggable): [pending]
  - 19-UAT-5 (Customer step 3 staff badges): [pending]
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
