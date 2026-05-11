---
phase: 20-calendar-timeline-structure-audit
verified: 2026-05-11T00:00:00Z
status: human_needed
score: 4/4 code artifacts verified; 4/4 UAT items deferred to human browser session
human_verification:
  - test: "CAL-FIX-01 zoom x view matrix — run DevTools getBoundingClientRect snippet at 75%, 100%, 125% zoom in Day, Week, Day+ByStaff views (9 cells)"
    expected: "MAX |offset| <= 1 px in all 9 cells"
    why_human: "Requires live browser DevTools at specific zoom levels; cannot automate pixel measurement"
  - test: "CAL-FIX-02 view-switch sequence — Month -> Week -> Day -> By Staff -> Week -> Month, check gutter width, header/column alignment, event placement, no reload needed"
    expected: "All 4 visual sub-checks pass at every view transition"
    why_human: "Requires live browser interaction and visual inspection across stateful view changes"
  - test: "CAL-FIX-03 By Staff multi-column — 5+ staff visible, confirm one column per staff, horizontal scrollbar present, staff filter toggle adds/removes column, gutter stays sticky"
    expected: "All 4 sub-checks pass"
    why_human: "Requires live browser with real staff data and visual scroll inspection"
  - test: "CAL-FIX-04 Phase 19 regression — re-run all 5 Phase 19 UAT items verbatim (By Staff layout, QuickBook flow, drag-to-reassign+undo, GCal block guard, customer step 3 staff badges)"
    expected: "All 5 Phase 19 UAT items pass identically"
    why_human: "Requires live browser interaction with real booking data, drag-and-drop, and toast verification"
---

# Phase 20: Calendar Timeline Structure Audit — Verification Report

**Phase Goal:** The admin calendar renders with pixel-correct timeline alignment in every view (Day, Week, Month, By Staff), the underlying RBC + DnD HOC structure is well-organized and free of regressions from Phases 14/18/19, and any architectural debt in AppointmentsCalendarSection.tsx is identified and addressed where it blocks visual correctness.

**Verified:** 2026-05-11
**Status:** human_needed — all code artifacts verified; 4 UAT items intentionally deferred to human browser session
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `visibleStaffForResources` is memoized on `[scopedStaffList, hiddenStaff]` | VERIFIED | Line 932-935: `const visibleStaffForResources = useMemo(() => scopedStaffList.filter(...), [scopedStaffList, hiddenStaff])` |
| 2 | `resourceProps` is memoized on `[isByStaff, visibleStaffForResources]` | VERIFIED | Lines 937-947: `const resourceProps = useMemo(() => isByStaff ? {...} : {}, [isByStaff, visibleStaffForResources])` |
| 3 | `calendarComponents` is memoized on `[isByStaff, handleByStaff, filterPopover]` | VERIFIED | Lines 1063-1073: `const calendarComponents = useMemo(() => ({...}), [isByStaff, handleByStaff, filterPopover])` |
| 4 | `handleViewChange` is a `useCallback` with stable deps | VERIFIED | Lines 1053-1056: `const handleViewChange = useCallback((v: string) => {...}, [])` |
| 5 | `handleByStaff` is a `useCallback` with stable deps | VERIFIED | Lines 1058-1061: `const handleByStaff = useCallback((active: boolean) => {...}, [])` |
| 6 | Redundant on-mount `setCurrentView(DEFAULT_CALENDAR_VIEW)` useEffect is deleted | VERIFIED | No `useEffect` containing `setCurrentView` exists; only `useState<string>(DEFAULT_CALENDAR_VIEW)` at line 397 |
| 7 | `key={currentView-isByStaff}` prop is first prop on `<DnDCalendar>` | VERIFIED | Lines 1122-1124: `<DnDCalendar key={\`${currentView}-${isByStaff}\`} {...resourceProps} ...` |
| 8 | Strategy D CSS rule in `index.css` — gutter slot min-height matches day-slot (2.25rem) | VERIFIED | Lines 367-369 of index.css: `.appointments-calendar .rbc-time-view .rbc-time-gutter .rbc-time-slot { min-height: 2.25rem; }` |
| 9 | Day-slot rule from Phase 18 untouched (2.25rem) | VERIFIED | Line 364: `.rbc-time-view .rbc-day-slot .rbc-time-slot { min-height: 2.25rem; }` — present and unchanged |
| 10 | `20-HUMAN-UAT.md` exists with 4 CAL-FIX entries | VERIFIED | File present; 4 entries: CAL-FIX-01 through CAL-FIX-04 with verbatim pass criteria |
| 11 | `20-DIAGNOSIS.md` skeleton exists with DevTools snippet, 3 measurement tables, Strategy D decision | VERIFIED | File present with all sections; Strategy Decision section filled with Strategy D justification |
| 12 | All 4 SUMMARY.md files exist for Plans 01-04 | VERIFIED | `20-01-SUMMARY.md`, `20-02-SUMMARY.md`, `20-03-SUMMARY.md`, `20-04-SUMMARY.md` all present |
| 13 | Visual UAT correctness — pixel alignment, view-switch, By Staff, Phase 19 regression | HUMAN NEEDED | Browser DevTools and visual inspection required; see Human Verification Required |

**Score:** 12/12 code-verifiable truths — VERIFIED. 4 browser UAT truths — HUMAN NEEDED.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/components/admin/AppointmentsCalendarSection.tsx` | useMemo on calendarComponents, resourceProps, visibleStaffForResources; useCallback on handleViewChange, handleByStaff; deleted redundant useEffect; key prop on DnDCalendar | VERIFIED | 1565 lines; all 5 structural edits confirmed at correct line numbers |
| `client/src/index.css` | Strategy D rule: `.rbc-time-gutter .rbc-time-slot { min-height: 2.25rem }` | VERIFIED | Lines 367-369; immediately after day-slot rule at line 363-365 |
| `.planning/phases/20-calendar-timeline-structure-audit/20-HUMAN-UAT.md` | 4 CAL-FIX entries with verbatim pass criteria | VERIFIED | Present; 4 entries with per-item attribution under CAL-FIX-04 |
| `.planning/phases/20-calendar-timeline-structure-audit/20-DIAGNOSIS.md` | Skeleton + 3 measurement tables + Strategy D decision | VERIFIED | Present; tables have empty measurement rows (intentional — require human DevTools); Strategy Decision section filled |
| `20-01-SUMMARY.md` | Plan 01 summary | VERIFIED | Present |
| `20-02-SUMMARY.md` | Plan 02 summary | VERIFIED | Present |
| `20-03-SUMMARY.md` | Plan 03 summary | VERIFIED | Present |
| `20-04-SUMMARY.md` | Plan 04 summary | VERIFIED | Present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `calendarComponents` (useMemo) | `<DnDCalendar components={...}>` | Line 1139: `components={calendarComponents}` | WIRED | Memoized object passed directly to DnDCalendar |
| `resourceProps` (useMemo) | `<DnDCalendar {...resourceProps}>` | Line 1124: `{...resourceProps}` | WIRED | Spread as first group of props after key |
| `handleViewChange` (useCallback) | `<DnDCalendar onView={...}>` | Line 1135: `onView={handleViewChange as any}` | WIRED | Stable callback passed to onView |
| `handleByStaff` (useCallback) | `<CalendarToolbar onByStaff={...}>` inside calendarComponents | Line 1069: `onByStaff={handleByStaff}` | WIRED | Stable callback captured in memoized calendarComponents |
| `key={currentView-isByStaff}` | `<DnDCalendar>` remount trigger | Line 1123: first prop on DnDCalendar | WIRED | Forces remount on view/resource change |
| Strategy D CSS | `.rbc-time-gutter .rbc-time-slot` elements | index.css line 367 | WIRED | Scoped rule under `.appointments-calendar .rbc-time-view` |

---

### Data-Flow Trace (Level 4)

Not applicable. Phase 20 artifacts are structural (memoization, CSS, key prop) — they stabilize rendering identity and CSS layout, not data pipelines. No new data-fetching or state variables were introduced.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `useCallback` import present | `grep "useCallback" AppointmentsCalendarSection.tsx` line 1 | `import { useCallback, ...` | PASS |
| `visibleStaffForResources` useMemo deps | grep lines 932-935 | `[scopedStaffList, hiddenStaff]` | PASS |
| `resourceProps` useMemo deps | grep lines 937-946 | `[isByStaff, visibleStaffForResources]` | PASS |
| `calendarComponents` useMemo deps | grep lines 1063-1073 | `[isByStaff, handleByStaff, filterPopover]` | PASS |
| No `setCurrentView` inside useEffect | grep for pattern | Not found — only useState initializer at line 397 | PASS |
| key prop is first on DnDCalendar | lines 1122-1124 | `key={...}` immediately after `<DnDCalendar` | PASS |
| CSS gutter rule exists | grep index.css | `.rbc-time-gutter .rbc-time-slot { min-height: 2.25rem }` at lines 367-369 | PASS |
| CSS day-slot rule preserved | grep index.css | `.rbc-day-slot .rbc-time-slot { min-height: 2.25rem }` at lines 363-365 | PASS |
| Commits documented in SUMMARY exist | git log check | 4441fe7 (memoization), 41df3d8 (CSS), 86cf873 (key prop) all verified present | PASS |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| CAL-FIX-01 | Time gutter label alignment at all zoom levels | HUMAN NEEDED | Code foundation laid (Strategy D CSS + memoization); pixel verification requires live browser DevTools at 75/100/125% zoom |
| CAL-FIX-02 | View-switch leaves no stale layout | HUMAN NEEDED | `key={currentView-isByStaff}` remount mechanism applied (line 1123); visual correctness requires live browser view-switch sequence |
| CAL-FIX-03 | By Staff multi-column view preserved after refactor | HUMAN NEEDED | `resourceProps` memoization and `visibleStaffForResources` filtering intact; multi-column correctness requires live browser with 5+ staff |
| CAL-FIX-04 | Phase 19 regression check | HUMAN NEEDED | No regressions introduced by code analysis; drag-to-reassign, QuickBook, GCal guard require live browser interaction |

Note: REQUIREMENTS.md shows CAL-FIX-01 and CAL-FIX-03 already marked `[x]` (checked), while CAL-FIX-02 and CAL-FIX-04 remain `[ ]`. This is consistent with the UAT pending state — all 4 await final human confirmation before closing.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `AppointmentsCalendarSection.tsx` | 949 | `filterPopover` JSX expression is a useMemo dep but not itself memoized | Info | Accepted tradeoff per Plan 02 decision: calendarComponents re-runs when filter state changes (acceptable); flagged in RESEARCH.md as conditional follow-up scope |
| `20-DIAGNOSIS.md` | 42-50, 58-68, 88-98 | Three measurement tables have empty rows | Info | Intentional — measurement tables require human DevTools session; not a code stub |
| `20-HUMAN-UAT.md` | All | All 4 result fields `[pending]` | Info | Intentional — UAT results filled by human after browser testing |

No blockers or warnings. The `filterPopover` non-memo is a documented, accepted tradeoff. The empty measurement tables are structural placeholders for human data, not code stubs.

---

### Human Verification Required

#### 1. CAL-FIX-01: Time Gutter Alignment Zoom Matrix

**Test:** Open admin calendar in browser. For each of 3 zoom levels (75%, 100%, 125%) and 3 views (Day, Week, Day+ByStaff): paste the DevTools snippet from `20-DIAGNOSIS.md § DevTools Snippet` into the console. Record `MAX offset` and `MEAN offset` into the 9 rows of `20-DIAGNOSIS.md § Post-Wave-2` table.
**Expected:** MAX |offset| <= 1 px in all 9 cells.
**Why human:** Browser DevTools `getBoundingClientRect` at specific zoom levels; cannot automate zoom or pixel measurement.

#### 2. CAL-FIX-02: View-Switch Stale Layout Check

**Test:** Walk through Month -> Week -> Day -> By Staff -> Week -> Month in one continuous browser session. After each transition: (a) inspect `.rbc-time-gutter` width is consistent, (b) inspect `.rbc-header` row positions match `.rbc-day-slot` columns, (c) verify event blocks sit within slot boundaries, (d) confirm no manual page reload was needed.
**Expected:** All 4 visual checks pass at every transition.
**Why human:** Requires live stateful navigation and visual inspection of layout correctness.

#### 3. CAL-FIX-03: By Staff Multi-Column + Horizontal Scroll

**Test:** With 5+ staff visible, enter By Staff view: (a) confirm one column per visible staff, (b) confirm horizontal scrollbar appears on `.appointments-calendar-shell__board`, (c) toggle a staff filter — column should be added/removed without page reload, (d) confirm gutter remains sticky at left during horizontal scroll.
**Expected:** All 4 sub-checks pass.
**Why human:** Requires live browser with real staff data and visual scroll inspection.

#### 4. CAL-FIX-04: Phase 19 Regression Check

**Test:** Walk through each of the 5 items in `.planning/phases/19-receptionist-booking-flow-multi-staff-view/19-HUMAN-UAT.md` exactly as written. Record result under CAL-FIX-04 per-item attribution in `20-HUMAN-UAT.md`.
**Expected:** All 5 Phase 19 UAT items pass identically.
**Why human:** Requires live browser interaction with real booking data, drag-and-drop gestures, toast observation, and GCal busy block verification.

---

### Summary

All code-verifiable deliverables for Phase 20 are confirmed present and correctly wired:

- **Wave 1 (memoization):** `visibleStaffForResources`, `resourceProps`, and `calendarComponents` wrapped in `useMemo` with correct deps; `handleViewChange` and `handleByStaff` extracted to `useCallback([])`; the tautological on-mount `setCurrentView(DEFAULT_CALENDAR_VIEW)` useEffect was deleted (commit 4441fe7).

- **Wave 2 (CSS):** Strategy D rule added to `index.css` at lines 367-369 — `.rbc-time-gutter .rbc-time-slot { min-height: 2.25rem }` matches the existing day-slot override. Phase 18's `transform: translateY(-50%)` rule is untouched (commit 41df3d8).

- **Wave 3 (key prop):** `key={\`${currentView}-${isByStaff}\`}` placed as the first prop on `<DnDCalendar>`, forcing a clean remount on view switch or By Staff toggle (commit 86cf873).

- **Documentation:** All 4 SUMMARY files present; `20-HUMAN-UAT.md` contains 4 pending UAT entries with verbatim pass criteria; `20-DIAGNOSIS.md` skeleton complete with Strategy D justification.

The 4 browser UAT items (CAL-FIX-01 through CAL-FIX-04) are intentionally pending — they require a human browser session and were deferred per phase design. These are `human_needed`, not `gaps_found`. Phase ships when all 4 UAT items are recorded as PASS in `20-HUMAN-UAT.md`.

---

_Verified: 2026-05-11_
_Verifier: Claude (gsd-verifier)_
