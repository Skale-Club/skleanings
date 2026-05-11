---
phase: 20-calendar-timeline-structure-audit
plan: 01
subsystem: ui
tags: [react-big-calendar, calendar, devtools, diagnosis, uat]

# Dependency graph
requires: []
provides:
  - "20-HUMAN-UAT.md with 4 UAT entries (CAL-FIX-01 through CAL-FIX-04) and verbatim pass criteria from VALIDATION.md"
  - "20-DIAGNOSIS.md skeleton with embedded DevTools snippet and three 9-row measurement tables (Baseline, Post-Wave-1, Post-Wave-2)"
  - "Strategy Decision section with all 4 strategies documented — ready for Plan 03 to fill"
affects:
  - 20-02-PLAN (Wave 1 memoization fixes — needs baseline numbers before starting)
  - 20-03-PLAN (Wave 2 CSS strategy — reads post-Wave-1 measurements to choose strategy)
  - 20-04-PLAN (final UAT — reads 20-HUMAN-UAT.md entries)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DevTools getBoundingClientRect snippet embedded directly in DIAGNOSIS.md for easy copy-paste by measurer"
    - "UAT format mirrors Phase 19 (frontmatter + ### N. Title / expected / result structure)"

key-files:
  created:
    - ".planning/phases/20-calendar-timeline-structure-audit/20-HUMAN-UAT.md"
    - ".planning/phases/20-calendar-timeline-structure-audit/20-DIAGNOSIS.md"
  modified: []

key-decisions:
  - "Diagnosis-before-fixes: 20-DIAGNOSIS.md Baseline section must be filled by human (Task 3 checkpoint) before Wave 1 code changes begin in Plan 02"
  - "CAL-FIX-04 uses per-item attribution for all 5 Phase 19 UAT items — enables regression tracking at item granularity"

patterns-established:
  - "Measurement-first: persist baseline numbers before any code changes so Wave 1/2 deltas are verifiable"

requirements-completed: [CAL-FIX-01, CAL-FIX-02, CAL-FIX-03, CAL-FIX-04]

# Metrics
duration: checkpoint-pending
completed: 2026-05-11
---

# Phase 20 Plan 01: Wave 0 Investigation Setup Summary

**20-HUMAN-UAT.md (4 UAT entries) and 20-DIAGNOSIS.md skeleton (3 nine-row tables + DevTools snippet) created; Task 3 baseline measurement awaiting human browser session**

## Performance

- **Duration:** Partial (Tasks 1-2 complete; Task 3 pending human verification)
- **Started:** 2026-05-05T00:00:00Z (prior session)
- **Completed:** 2026-05-11T09:01:05Z (Tasks 1 and 2 verified; Task 3 at checkpoint)
- **Tasks:** 2 of 3 complete (Task 3 = checkpoint:human-verify, blocked on browser measurement)
- **Files modified:** 2

## Accomplishments

- 20-HUMAN-UAT.md created with all 4 CAL-FIX entries (CAL-FIX-01 through CAL-FIX-04), pass criteria copied verbatim from VALIDATION.md, frontmatter matching Phase 19 UAT format, and per-item attribution block for Phase 19 regression check under CAL-FIX-04
- 20-DIAGNOSIS.md skeleton created with: embedded DevTools `getBoundingClientRect` snippet, three 9-row empty tables (Baseline, Post-Wave-1, Post-Wave-2), four-strategy decision rule (Strategy A/B/C/D) copied from RESEARCH.md, and Structural Debt section pre-populated with the 1556-line component observation
- All Task 1 and Task 2 acceptance criteria verified via automated checks (grep counts match exactly)

## Task Commits

1. **Task 1: Create 20-HUMAN-UAT.md** - `ea0d63b` (docs)
2. **Task 2: Create 20-DIAGNOSIS.md skeleton** - `1b2b939` (docs)
3. **Task 3: Baseline measurement** - PENDING (checkpoint:human-verify)

**Plan metadata:** (pending — created after Task 3 completes)

## Files Created/Modified

- `.planning/phases/20-calendar-timeline-structure-audit/20-HUMAN-UAT.md` — 4 UAT entries with verbatim pass criteria, pending human fill-in
- `.planning/phases/20-calendar-timeline-structure-audit/20-DIAGNOSIS.md` — Skeleton with DevTools snippet, 3 measurement tables, strategy decision section; Baseline rows empty pending human browser session

## Decisions Made

- Diagnosis-before-fixes: the Baseline table in DIAGNOSIS.md must be filled by a human running the DevTools snippet at 9 zoom x view cells before any Wave 1 code changes. This ensures post-Wave-1 deltas are meaningful.
- CAL-FIX-04 per-item attribution structure added (not in VALIDATION.md template) to enable regression tracking at the granularity of each Phase 19 UAT item.

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 were committed in a prior session; this session verified their acceptance criteria.

## Issues Encountered

None.

## Checkpoint Pending — Task 3

**Type:** human-verify (blocking gate)

Task 3 requires a human to open the admin calendar in a live browser, set browser zoom to 75%, 100%, and 125%, switch between Day, Week, and Day+ByStaff views (9 combinations), paste the DevTools snippet from `20-DIAGNOSIS.md § DevTools Snippet` into the Console, and record `MAX offset` / `MEAN offset` / `Pass/Fail` for each of the 9 rows in the `## Baseline` table.

Claude cannot automate browser zoom, DevTools execution, or visual calendar inspection.

**Resume signal:** Type "baseline-recorded" when all 9 Baseline rows are filled and `### Baseline observations` contains at least one written sentence.

## Known Stubs

- `## Baseline` table in `20-DIAGNOSIS.md` — all 9 rows empty; human measurement required (Task 3 checkpoint)
- `### Baseline observations` in `20-DIAGNOSIS.md` — placeholder text; human observation required
- All `result: [pending]` fields in `20-HUMAN-UAT.md` — intentional, to be filled in Plan 04 UAT execution

## Next Phase Readiness

**Plan 02 cannot begin** until Task 3 (Baseline measurement) is complete. The Wave 1 memoization fixes in Plan 02 must be measured against known baseline numbers.

Once Task 3 is complete (human fills `## Baseline` table and writes observations), Plan 02 can proceed immediately without modification.

---
*Phase: 20-calendar-timeline-structure-audit*
*Plan: 01*
*Completed: 2026-05-11 (partial — Task 3 checkpoint pending)*

## Self-Check: PASSED

- FOUND: `.planning/phases/20-calendar-timeline-structure-audit/20-HUMAN-UAT.md`
- FOUND: `.planning/phases/20-calendar-timeline-structure-audit/20-DIAGNOSIS.md`
- FOUND: `.planning/phases/20-calendar-timeline-structure-audit/20-01-SUMMARY.md`
- FOUND: commit `ea0d63b` (Task 1)
- FOUND: commit `1b2b939` (Task 2)
