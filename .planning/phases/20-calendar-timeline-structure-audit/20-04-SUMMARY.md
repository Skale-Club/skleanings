---
phase: 20-calendar-timeline-structure-audit
plan: 04
subsystem: ui
tags: [react, react-big-calendar, dnd-calendar, key-prop, remount, calendar]

# Dependency graph
requires:
  - phase: 20-calendar-timeline-structure-audit
    provides: Wave 1 stable component identity + Wave 2 CSS gutter strategy (plans 01-03)
provides:
  - Conditional key prop on DnDCalendar forcing remount on view or By Staff change (Wave 3 escalation)
  - Code-complete state for all 3 waves of calendar fixes
affects: [phase 20 UAT sign-off, any future calendar decomposition phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "React key prop used as a controlled remount trigger on DnDCalendar — key={`${currentView}-${isByStaff}`} ensures fresh component tree on each view switch or By Staff toggle"

key-files:
  created: []
  modified:
    - client/src/components/admin/AppointmentsCalendarSection.tsx

key-decisions:
  - "Wave 3 key prop applied as precautionary escalation — Post-Wave-2 measurements not yet available (human session pending), so remount activated to ensure CAL-FIX-02 view-switch staleness is addressed rather than risking a pass based on unmeasured state"
  - "key prop placed as FIRST prop on <DnDCalendar> (before {...resourceProps} spread) so React reads it before any other prop deserialization"
  - "Scroll-position tradeoff accepted: scrollToTime={DEFAULT_SCROLL_TIME} re-applies after remount; view changes are user-initiated so position reset is tolerable"

patterns-established:
  - "React key remount pattern: use key={`${stateA}-${stateB}`} on library components that don't self-heal on prop changes to force fresh mount"

requirements-completed: [CAL-FIX-01, CAL-FIX-02, CAL-FIX-03, CAL-FIX-04]

# Metrics
duration: 15min
completed: 2026-05-11
---

# Phase 20 Plan 04: Wave 3 Conditional Remount Summary

**Conditional `key={currentView-isByStaff}` prop applied to DnDCalendar to force remount on view switch or By Staff toggle (Wave 3 escalation — code complete, pending human UAT sign-off)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-11T00:00:00Z
- **Completed:** 2026-05-11
- **Tasks:** 1 of 5 (tasks 2-5 are checkpoint:human-verify — skipped per execution context)
- **Files modified:** 1

## Accomplishments

- Applied `key={`${currentView}-${isByStaff}`}` as the first prop on `<DnDCalendar>` — React will unmount and remount the entire calendar component whenever the view changes (Day/Week/Month) or the By Staff toggle flips
- Confirmed the change does not introduce new TypeScript errors (pre-existing errors in server/index.ts are unrelated)
- Vite client build succeeds with the change in place

## Task Commits

1. **Task 1: Apply key prop to DnDCalendar** - `86cf873` (fix) — Wave 3 escalation
2. **Tasks 2-5: UAT browser checks** — skipped; all are `checkpoint:human-verify` requiring a live browser session with the human operator

**Plan metadata commit:** (below, in docs commit)

## Files Created/Modified

- `client/src/components/admin/AppointmentsCalendarSection.tsx` — Added `key={`${currentView}-${isByStaff}`}` as first prop on `<DnDCalendar>` at line 1099

## Decisions Made

**Wave 3 apply vs. skip decision:** Applied the key prop as a precautionary escalation. The decision routing in `20-DIAGNOSIS.md § Post-Wave-2 observations` shows empty measurement tables (no human session has yet filled them in). Per the execution context for plan 04: "without measurement data ruling it out, the remount ensures view-switch staleness (CAL-FIX-02) is addressed." This matches the plan's conditional logic: "If the observations say residual offsets > 1 px OR Wave 3 should activate — apply."

**Tradeoff accepted:** Remount destroys RBC's internal scroll position on view change. Acceptable because:
- `scrollToTime={DEFAULT_SCROLL_TIME}` re-applies after remount
- View changes are user-initiated, not automatic
- RBC issue #2260 already affects scroll on DnD interaction; users aren't relying on persistent scroll across view switches

## Deviations from Plan

### Pre-existing Build Failures (out of scope)

Both `npm run check` and `npm run build` (server step) fail due to pre-existing issues unrelated to this change:

- **TypeScript check:** `server/index.ts` errors — `Cannot find module 'express-rate-limit'`, two implicit `any` parameter errors. These exist on the base commit (verified by stash + re-run).
- **esbuild server build:** `Could not resolve "express-rate-limit"` — same missing package. The Vite client build succeeds.

These are out-of-scope per deviation rules (not caused by the current task's changes). Logged here for tracking; not fixed.

---

**Total deviations:** 0 auto-fixed (pre-existing build issues documented but not in scope)
**Impact on plan:** Task 1 executed exactly as specified.

## Issues Encountered

- Pre-existing `express-rate-limit` package missing from node_modules causes both `npm run check` and `npm run build` (server step) to fail. Not introduced by this task. Client Vite build completes successfully.

## Tasks 2-5: UAT Status (skipped per execution context)

Per the execution context directive, Tasks 2-5 are all `checkpoint:human-verify` and were not executed by this agent. They require a live browser session:

| Task | Name | Status |
|------|------|--------|
| 2 | CAL-FIX-01 zoom × view matrix (9 cells) | Pending human browser session |
| 3 | CAL-FIX-02 D-06 view-switch sequence | Pending human browser session |
| 4 | CAL-FIX-03 By Staff multi-column (5+ staff) | Pending human browser session |
| 5 | CAL-FIX-04 Phase 19 regression (5 sub-items) | Pending human browser session |

## Phase Shippability

**Code complete — pending human UAT sign-off.**

All three waves of fixes are applied:
- Wave 1 (Plan 01-02): Stable component identity, memoized handlers
- Wave 2 (Plan 03): CSS gutter alignment strategy
- Wave 3 (Plan 04 Task 1): Conditional DnDCalendar remount on view/resource change

The phase ships if all 4 CAL-FIX UAT entries pass (recorded in `20-HUMAN-UAT.md`). If any entry fails, gap-closure planning via `/gsd:diagnose --gaps` is needed.

## Known Stubs

None — no placeholder data or hardcoded values introduced in this plan.

## Structural Debt (deferred)

Per `20-CONTEXT.md D-02` and `20-DIAGNOSIS.md`, the following are documented for a future "Calendar Decomposition" phase:

- `AppointmentsCalendarSection.tsx` is ~1560 lines — extraction candidates: `EventComponent`, `MetricCard`, `FilterPill`, `BookingFormDialog`, `CalendarToolbar`
- These are informational only and do not block current phase shipping

## Next Phase Readiness

- Phase 20 code is complete and committed
- Human operator needs to run UAT tasks 2-5 in a browser to mark `20-HUMAN-UAT.md` entries as PASS/FAIL
- If all 4 pass: phase is shippable, ready for next milestone planning
- If any fail: `/gsd:diagnose --gaps` to plan gap-closure

---
*Phase: 20-calendar-timeline-structure-audit*
*Completed: 2026-05-11*
