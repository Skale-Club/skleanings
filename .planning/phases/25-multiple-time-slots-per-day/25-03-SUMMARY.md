---
phase: 25-multiple-time-slots-per-day
plan: 03
subsystem: frontend
tags: [react, staff-availability, admin-ui, multi-range]

requires:
  - phase: 25-01
    provides: rangeOrder column in staffAvailability schema
  - phase: 25-02
    provides: PUT /api/staff/:id/availability accepts rangeOrder; GET returns rangeOrder-sorted rows

provides:
  - AvailabilityTab multi-range editor with per-day add/remove range buttons
  - Save payload includes rangeOrder so backend stores multiple rows per (staffMemberId, dayOfWeek)

affects: [staff-manage-dialog, admin-ui, availability-tab]

tech-stack:
  added: []
  patterns:
    - "DayState[] indexed by dayOfWeek; RangeEntry[] indexed by rangeOrder within each day"
    - "days.flatMap() to produce flat payload array with rangeOrder field"
    - "Native <input type=time> (not shadcn Input) — consistent with DateOverridesTab"
    - "Checkbox toggle hides ranges without destroying them (isAvailable=false preserves ranges in local state)"

key-files:
  created: []
  modified:
    - client/src/components/admin/StaffManageDialog.tsx

key-decisions:
  - "Tasks 1 and 2 committed together as single atomic commit — both live in same AvailabilityTab function, inseparable in the file"
  - "DAY_NAMES constant (Sun/Mon/Tue...) used unchanged — plan referred to it as DAY_LABELS but actual name read from file"
  - "Native checkbox instead of shadcn Switch for day toggle — aligns with plan target JSX"
  - "Task 3 (checkpoint:human-verify) deferred — user will run browser UAT in a single session at end of phase"

patterns-established:
  - "Multi-range UI pattern: DayState[] with flatMap payload construction"

requirements-completed: [SLOTS-02]

duration: 8min
completed: 2026-05-11
---

# Phase 25 Plan 03: Multi-Range AvailabilityTab UI Summary

**AvailabilityTab replaced with a per-day card editor where admins can add multiple time windows, remove individual ranges, and save rangeOrder-indexed payloads to the backend**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-11T10:24:00Z
- **Completed:** 2026-05-11T10:32:50Z
- **Tasks:** 2 of 3 executed (Task 3 deferred — see below)
- **Files modified:** 1

## Accomplishments

- Replaced `AvailabilityRow` interface and `rows` state with `DayState[]` (`RangeEntry[]` per day)
- `useEffect` now groups server rows by `dayOfWeek`, sorts by `rangeOrder`, and handles the zero-row default case
- Save mutation uses `days.flatMap()` to produce `{ dayOfWeek, isAvailable, startTime, endTime, rangeOrder }[]` — matching the Plan 02 API contract exactly
- Render: each day has a bordered card with a checkbox toggle, an ordered list of start/end time inputs, a trash button per range (visible only when 2+ ranges exist), and an "Add range" button
- `Plus` icon added to lucide-react import; `AvailabilityRow` interface removed
- Toggling a day's checkbox hides the range list but preserves `DayState.ranges` — re-enabling restores the same ranges

## Task Commits

1. **Task 1+2: Rewrite AvailabilityTab state + JSX** - `42eac94` (feat)

## Task 3 — Deferred

**Task 3 (checkpoint:human-verify)** was intentionally skipped per user instruction. The user will verify the multi-range editor in a single browser UAT session at the end of the phase.

UAT steps (from plan):
1. Open http://localhost:5000, log in as admin, open Staff management
2. Edit any staff member → Availability tab
3. Confirm existing single range loads correctly (no regression)
4. Click "Add range" on Monday — confirm second row appears
5. Set 08:00–12:00 and 14:00–17:00, click Save → confirm success toast
6. Close and reopen dialog → confirm both ranges persist
7. Trash one range, Save → confirm single range persists
8. Book a service on that day → confirm no slots between 12:00 and 14:00

## Files Created/Modified

- `client/src/components/admin/StaffManageDialog.tsx` — AvailabilityTab fully rewritten

## Decisions Made

- Tasks 1 and 2 are a single atomic commit because both live inside `AvailabilityTab` — splitting would produce a non-compiling intermediate state
- `DAY_NAMES` (not `DAY_LABELS` as stated in plan template) — read from file before editing
- Native `<input type="checkbox">` for day toggle (consistent with plan target JSX)
- Task 3 browser UAT deferred to end-of-phase human verification session

## Deviations from Plan

### Consolidation

**1. [Execution] Tasks 1 and 2 committed together**
- **Found during:** Implementation
- **Reason:** `AvailabilityTab` state hooks and JSX render are in the same function body. Writing state first without JSX would leave the file in a non-rendering (broken) intermediate state. Single commit is cleaner and fully verifiable.
- **Impact:** No functional deviation — all acceptance criteria for both tasks are met.

---

## Issues Encountered

- Pre-existing `npm run check` failures (5 errors in `server/index.ts` — express-rate-limit missing types). Not introduced by this plan.

## Known Stubs

None — the Availability tab is fully wired to `GET /api/staff/:id/availability` for loading and `PUT /api/staff/:id/availability` for saving.

## Next Phase Readiness

- Plan 03 frontend is complete
- Phase 25 is feature-complete pending human browser UAT (Task 3)
- The full multi-range flow (schema migration → API → frontend) is wired end-to-end

---
*Phase: 25-multiple-time-slots-per-day*
*Completed: 2026-05-11*
