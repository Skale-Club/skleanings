---
phase: 20-calendar-timeline-structure-audit
status: skeleton
created: 2026-05-05
last_updated: 2026-05-05
---

# Phase 20 — Diagnosis

> Persistent record of pre-fix measurements, post-Wave-1 measurements, post-Wave-2 measurements, and the CSS strategy decision. All numbers come from running the DevTools `getBoundingClientRect` snippet documented in `20-RESEARCH.md` § Diagnostic Snippet (lines 318–342) on the live admin calendar.

## DevTools Snippet (paste into browser console)

```javascript
// Run in DevTools Console while admin calendar is open
const labels = document.querySelectorAll('.appointments-calendar .rbc-time-gutter .rbc-label');
const groups = document.querySelectorAll('.appointments-calendar .rbc-time-gutter .rbc-timeslot-group');
const offsets = [];
[...labels].forEach((label, i) => {
  const group = groups[i];
  if (!group) return;
  const labelRect = label.getBoundingClientRect();
  const groupRect = group.getBoundingClientRect();
  const labelCenter = labelRect.top + labelRect.height / 2;
  const groupTop = groupRect.top;
  const offset = labelCenter - groupTop;
  offsets.push(offset);
  console.log(
    `Label ${i} (${label.textContent}): label-center=${labelCenter.toFixed(2)} group-top=${groupTop.toFixed(2)} offset=${offset.toFixed(2)}px`
  );
});
console.log(`MAX offset: ${Math.max(...offsets.map(Math.abs)).toFixed(2)}px`);
console.log(`MEAN offset: ${(offsets.reduce((a, b) => a + b, 0) / offsets.length).toFixed(2)}px`);
```

Pass criterion (per CAL-FIX-01 / VALIDATION.md): MAX |offset| ≤ 1 px.

## Baseline (Wave 0 — pre-fix)

| Zoom | View          | MAX offset | MEAN offset | Pass/Fail | Notes |
|------|---------------|------------|-------------|-----------|-------|
| 75%  | Day           |            |             |           |       |
| 75%  | Week          |            |             |           |       |
| 75%  | Day + ByStaff |            |             |           |       |
| 100% | Day           |            |             |           |       |
| 100% | Week          |            |             |           |       |
| 100% | Day + ByStaff |            |             |           |       |
| 125% | Day           |            |             |           |       |
| 125% | Week          |            |             |           |       |
| 125% | Day + ByStaff |            |             |           |       |

### Baseline observations

- (To fill in by Wave 0 measurer — note any visible regressions, suspect hot spots from RESEARCH.md § Suspect Hot Spots that match the symptom, screenshots if helpful)

## Post-Wave-1 (after memoize + delete redundant useEffect)

| Zoom | View          | MAX offset | MEAN offset | Δ vs Baseline | Pass/Fail |
|------|---------------|------------|-------------|---------------|-----------|
| 75%  | Day           |            |             |               |           |
| 75%  | Week          |            |             |               |           |
| 75%  | Day + ByStaff |            |             |               |           |
| 100% | Day           |            |             |               |           |
| 100% | Week          |            |             |               |           |
| 100% | Day + ByStaff |            |             |               |           |
| 125% | Day           |            |             |               |           |
| 125% | Week          |            |             |               |           |
| 125% | Day + ByStaff |            |             |               |           |

### Post-Wave-1 observations

- (Did memoization alone resolve the offset? Δ direction? Any new artifacts?)

## Strategy Decision (Plan 03 — gate for Wave 2 CSS work)

Decision rule (copy from RESEARCH.md § Pixel-Alignment Strategies, lines 484–488):
- **Strategy A (keep Phase 18 transform):** Diagnosis shows uniform offset within ±1px at all zoom levels after Wave 1. No further CSS change.
- **Strategy B (flex anchor + negative margin):** Diagnosis shows transform-related drift inside sticky parent (drift only in By Staff at non-100% zoom).
- **Strategy C (absolute position inside first slot):** Diagnosis shows offset only in By Staff view; sticky-positioning + transform interaction suspected.
- **Strategy D (match gutter slot heights):** Diagnosis shows uniform offset at 100% but drift at 75/125% — indicates Pitfall 5 height mismatch.

**Selected strategy:** _____________________ (filled by Plan 03 Task 1)

**Justification:** _____________________ (cite which post-Wave-1 measurement supports the choice)

## Post-Wave-2 (after CSS strategy applied)

| Zoom | View          | MAX offset | MEAN offset | Δ vs Post-Wave-1 | Pass/Fail |
|------|---------------|------------|-------------|------------------|-----------|
| 75%  | Day           |            |             |                  |           |
| 75%  | Week          |            |             |                  |           |
| 75%  | Day + ByStaff |            |             |                  |           |
| 100% | Day           |            |             |                  |           |
| 100% | Week          |            |             |                  |           |
| 100% | Day + ByStaff |            |             |                  |           |
| 125% | Day           |            |             |                  |           |
| 125% | Week          |            |             |                  |           |
| 125% | Day + ByStaff |            |             |                  |           |

### Post-Wave-2 observations

- (If still > 1 px on any cell, escalate to Wave 3 conditional `key={view-isByStaff}` remount task)

## Structural Debt Documented (deferred — informational)

Per CONTEXT.md D-02, document any structural debt observed during diagnosis that does NOT block CAL-FIX-01 to -04 (so a future "Calendar Decomposition" phase has a starting point). Examples:

- 1556-line `AppointmentsCalendarSection.tsx` — extraction candidates: `EventComponent`, `MetricCard`, `FilterPill`, `BookingFormDialog`, `CalendarToolbar`
- (Add others as observed during the diagnosis pass)
