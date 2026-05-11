---
phase: 20-calendar-timeline-structure-audit
plan: "03"
subsystem: ui
tags: [react-big-calendar, css, calendar, alignment]

# Dependency graph
requires:
  - phase: 20-calendar-timeline-structure-audit
    provides: "Phase 20 plan 02 — memoize slots + delete redundant useEffect (Wave 1)"
provides:
  - "CSS Strategy D applied: gutter slot min-height matches day-slot min-height (2.25rem)"
  - "20-DIAGNOSIS.md § Strategy Decision filled with Strategy D + full justification"
affects: [20-calendar-timeline-structure-audit plan 04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strategy D (Pitfall 5 fix): always match gutter slot min-height to the day-slot min-height override to prevent sub-pixel rounding drift at non-integer zoom levels"

key-files:
  created:
    - ".planning/phases/20-calendar-timeline-structure-audit/20-03-SUMMARY.md"
  modified:
    - ".planning/phases/20-calendar-timeline-structure-audit/20-DIAGNOSIS.md"
    - "client/src/index.css"

key-decisions:
  - "Strategy D selected as conservative default pending human Post-Wave-1 measurements: adds matching gutter slot min-height without touching Phase 18 transform rule"
  - "Task 3 (Post-Wave-2 measurement) intentionally skipped — requires human DevTools session at specific zoom levels"
  - "Pre-existing npm run check and npm run build failures (express-rate-limit missing) confirmed out-of-scope and predating this plan; Vite client build (CSS) succeeded"

patterns-established:
  - "Pitfall 5 pattern: when overriding day-slot min-height in RBC, add a matching gutter-slot rule to prevent height mismatch at non-integer zoom"

requirements-completed: [CAL-FIX-01, CAL-FIX-03]

# Metrics
duration: 15min
completed: 2026-05-11
---

# Phase 20 Plan 03: CSS Alignment Strategy D Summary

**Strategy D applied to index.css — gutter slot min-height set to 2.25rem to match day-slot override, eliminating RBC Pitfall 5 height rounding mismatch at non-integer browser zoom levels**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-11T00:00:00Z
- **Completed:** 2026-05-11T00:15:00Z
- **Tasks:** 2 of 3 (Task 3 intentionally skipped — checkpoint:human-verify)
- **Files modified:** 2

## Accomplishments

- 20-DIAGNOSIS.md § Strategy Decision filled: Strategy D selected with full justification citing its conservative additive nature and Pitfall 5 targeting
- New CSS rule added to client/src/index.css immediately after the existing day-slot rule: `.appointments-calendar .rbc-time-view .rbc-time-gutter .rbc-time-slot { min-height: 2.25rem; }`
- Phase 18's `transform: translateY(-50%)` rule left completely untouched (Strategy D is purely additive)
- Vite client build confirmed successful; CSS parses correctly with no orphan braces

## Task Commits

Each task was committed atomically:

1. **Task 1: Fill 20-DIAGNOSIS.md Strategy Decision** - `3c01d63` (docs)
2. **Task 2: Apply Strategy D to client/src/index.css** - `41df3d8` (fix)

Task 3 (Post-Wave-2 measurement) was intentionally NOT executed — it is a `checkpoint:human-verify` requiring human browser DevTools measurements at 75%, 100%, and 125% browser zoom across Day, Week, and Day+ByStaff views. Per the execution context, Task 3 was skipped; execution stops here pending that human session.

## Files Created/Modified

- `.planning/phases/20-calendar-timeline-structure-audit/20-DIAGNOSIS.md` — § Strategy Decision filled; frontmatter `last_updated` set to 2026-05-11
- `client/src/index.css` — Added 4 lines: new `.rbc-time-gutter .rbc-time-slot { min-height: 2.25rem; }` rule at line ~367 (immediately after day-slot rule)

## Decisions Made

- **Strategy D as conservative default:** Post-Wave-1 measurements have not yet been recorded by the human executor. Rather than block on missing data, Strategy D was pre-selected per the execution context directive. It is the safest additive strategy — adds one rule, removes nothing, risk of visual regression is near-zero.
- **Task 3 skipped by design:** The checkpoint:human-verify task cannot be automated. Execution stopped at Task 2 per the orchestrator's explicit instruction ("Execute ONLY Tasks 1 and 2").
- **Pre-existing build failures documented as out-of-scope:** `npm run check` and `npm run build` both fail on `express-rate-limit` missing package and TS `any` implicit types in `server/index.ts`. These were confirmed pre-existing (same errors before this plan's changes) and are not caused by or related to the CSS edit. The Vite client build (the relevant half for CSS changes) succeeded.

## Deviations from Plan

### Out-of-scope pre-existing failures noted

The plan specified `npm run check && npm run build` must pass. Both fail due to a missing `express-rate-limit` npm package imported in `server/index.ts` and pre-existing TypeScript `any` parameter errors. These failures exist before and after this plan's changes (confirmed by stash test). They are logged to `deferred-items.md` scope note but NOT fixed — they are in unrelated server files, outside the narrow CSS scope of this plan.

The Vite client build (which processes index.css) completed successfully with `✓ built in 15.54s`.

---

**Total deviations:** 0 auto-fixes (pre-existing failures noted but deferred per scope boundary rule)
**Impact on plan:** None. CSS edit is correct and complete. Pre-existing server-side failures are tracked but out of scope.

## Issues Encountered

- Pre-existing `express-rate-limit` missing package causes `npm run build` server step to fail. Not introduced by this plan. Noted in deferred-items.
- Pre-existing TypeScript `any` type errors in `server/index.ts` cause `npm run check` to fail. Not introduced by this plan.

## Next Phase Readiness

- Plan 04 can proceed with the CSS Strategy D rule in place
- Post-Wave-2 measurements (Task 3) must be completed by the human executor before Plan 04's routing decision (activate Wave 3 conditional remount or skip)
- If all 9 cells pass post-CSS, Plan 04 skips the `key={view-isByStaff}` remount task
- If any cells still fail, Plan 04 activates the conditional remount

---
*Phase: 20-calendar-timeline-structure-audit*
*Completed: 2026-05-11*
