---
phase: 20-calendar-timeline-structure-audit
plan: "02"
subsystem: ui
tags: [react, react-big-calendar, useMemo, useCallback, memoization, performance]

requires:
  - phase: 20-01
    provides: Baseline diagnostic measurements and RESEARCH.md identifying RBC re-mount hot spots

provides:
  - Stable component identity for DnDCalendar — calendarComponents, resourceProps, visibleStaffForResources all memoized
  - Removed tautological on-mount setCurrentView useEffect (eliminated double-render on mount)
  - Extracted handleViewChange and handleByStaff to useCallback (eliminated inline arrow recreation per render)

affects:
  - 20-03 (Wave 2 CSS strategy decision — baseline is now post-memoization, not pre-memoization)

tech-stack:
  added: []
  patterns:
    - "useCallback for stable event handler identity passed to DnDCalendar props"
    - "useMemo for derived list (visibleStaffForResources) gated on scopedStaffList + hiddenStaff"
    - "useMemo for conditional spread object (resourceProps) gated on isByStaff + visibleStaffForResources"
    - "useMemo for components object — critical RBC #2588 pattern to prevent mergeComponents() re-run"

key-files:
  created: []
  modified:
    - client/src/components/admin/AppointmentsCalendarSection.tsx

key-decisions:
  - "filterPopover JSX accepted as useMemo dep without memoizing it — filterPopover itself rebuilds every render but this is tracked as future scope per RESEARCH.md; calendarComponents will still re-run when filter state changes, which is acceptable for now"
  - "Pre-existing server/index.ts build failures (express-rate-limit missing, TS implicit-any) treated as out-of-scope pre-existing issues — confirmed identical in baseline before edits"
  - "Task 2 (Post-Wave-1 browser measurement) intentionally skipped — requires live DevTools session; human will perform and trigger plan resume"

requirements-completed: [CAL-FIX-01, CAL-FIX-02, CAL-FIX-04]

duration: 15min
completed: 2026-05-11
---

# Phase 20 Plan 02: Structural Memoization Fixes Summary

**Five memoization edits to AppointmentsCalendarSection.tsx stabilize DnDCalendar component identity — calendarComponents, resourceProps, visibleStaffForResources wrapped in useMemo; handleViewChange/handleByStaff in useCallback; tautological on-mount setCurrentView useEffect deleted (RBC #2588 + RESEARCH.md Pitfall 4)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-11T00:00:00Z
- **Completed:** 2026-05-11
- **Tasks:** 1 of 2 (Task 2 intentionally skipped — requires human browser session)
- **Files modified:** 1

## Accomplishments

- Deleted on-mount `setCurrentView(DEFAULT_CALENDAR_VIEW)` useEffect — `useState(DEFAULT_CALENDAR_VIEW)` already initializes the value; the effect was causing a double-render on every mount
- Memoized `visibleStaffForResources` with `useMemo([scopedStaffList, hiddenStaff])` — previously re-filtered on every parent render
- Memoized `resourceProps` with `useMemo([isByStaff, visibleStaffForResources])` — previously rebuilt object identity on every render, causing DnDCalendar re-processing
- Extracted `handleViewChange` and `handleByStaff` to `useCallback([])` — eliminated inline arrow function recreation per render
- Memoized `calendarComponents` with `useMemo([isByStaff, handleByStaff, filterPopover])` — this is the load-bearing RBC #2588 fix; DnDCalendar's `mergeComponents()` no longer re-runs on every parent render, preventing EventComponent re-mounts

## Task Commits

1. **Task 1: Memoize visibleStaffForResources, resourceProps; delete redundant useEffect; useCallback handlers; memoize calendarComponents** - `4441fe7` (fix)

## Files Created/Modified

- `client/src/components/admin/AppointmentsCalendarSection.tsx` — 5 edits applied: useCallback import added, useEffect deleted, visibleStaffForResources/resourceProps/calendarComponents wrapped in useMemo, handleViewChange/handleByStaff extracted to useCallback, JSX updated to use stable refs

## Decisions Made

- filterPopover accepted as a useMemo dep without memoizing — it rebuilds every render (JSX expression), so calendarComponents will also re-run when filter state changes. Memoizing filterPopover separately is flagged in RESEARCH.md as conditional scope for a follow-up if diagnosis shows residual EventComponent re-mounts. Not in this plan's scope.
- Pre-existing build failures in `server/index.ts` (`express-rate-limit` not installed, implicit `any` params) confirmed identical before/after edits — treated as out-of-scope pre-existing issues per deviation scope boundary.

## Deviations from Plan

None — plan executed exactly as specified for Task 1. Task 2 was intentionally excluded per orchestrator instructions (requires live browser DevTools session).

## Issues Encountered

- `npm run check` and `npm run build` both fail in the baseline (before edits) with pre-existing server errors (`express-rate-limit` missing from node_modules, implicit `any` params in `server/index.ts`). Verified by stashing edits and re-running — identical failures. The Vite client build succeeds cleanly in both cases. These are out-of-scope pre-existing issues.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 5 structural memoization edits are committed and verified (grep checks pass for all 9 acceptance criteria)
- **Task 2 (Post-Wave-1 measurement) is pending** — human must run the 9-cell browser diagnostic matrix (DevTools snippet across 3 zoom levels × 3 views) and fill `20-DIAGNOSIS.md § Post-Wave-1`
- Once Post-Wave-1 data is recorded, Plan 03 can select a CSS strategy (Strategy A if all pass; B/C/D depending on residual offset pattern per 20-DIAGNOSIS.md § Strategy Decision)
- If measurements show all cells pass after these fixes, Plan 03 becomes a no-op (Strategy A)

---
*Phase: 20-calendar-timeline-structure-audit*
*Completed: 2026-05-11*
