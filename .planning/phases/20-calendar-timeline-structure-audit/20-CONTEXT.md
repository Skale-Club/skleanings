# Phase 20: Calendar Timeline & Structure Audit — Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit the admin calendar (`AppointmentsCalendarSection.tsx`, 1556 lines) for visual correctness and structural debt that contributes to misalignment, then fix only what's necessary to deliver CAL-FIX-01 through CAL-FIX-04. Investigate-first, fix-narrowly. Document architectural debt that does NOT block visual correctness for follow-up phases — do not proactively decompose.

**In scope:**
- Diagnose root cause of any time-gutter / grid-line misalignment in Day, Week, By Staff views (CAL-FIX-01)
- Diagnose stale-layout artifacts when switching between Month / Week / Day / By Staff (CAL-FIX-02)
- Verify By Staff resourceProps + horizontal scroll still work post-fix (CAL-FIX-03)
- Verify Phase 19 interactive flows (drag-to-reassign, QuickBook, GCal busy guard) remain functional (CAL-FIX-04)
- Audit and document structural debt in `AppointmentsCalendarSection.tsx` (the diagnosis output, not proactive refactor)

**Out of scope (per REQUIREMENTS.md narrow-scope note):**
- Performance optimization
- Mobile responsiveness
- Behavior changes (drag-to-resize, customer-side calendar mirror, etc.)
- Extracting the Create Booking dialog into a shared component (pending todo — defer to Phase 21)
- Any "while we're in there" refactors that don't serve CAL-FIX requirements

</domain>

<decisions>
## Implementation Decisions

### Audit Scope & Refactor Depth

- **D-01:** Investigation-first approach. Plan opens with a diagnosis pass: enumerate every observed misalignment / stale-state symptom in Day / Week / Day+ByStaff / Month, attribute each to a root cause (CSS rule, HOC ordering, resourceProps shape, HTML structure, conditional spread timing, view-switch effect timing), and document findings before any fix.
- **D-02:** Fix only what's needed to deliver CAL-FIX-01 through CAL-FIX-04. If a structural change is required for correctness (e.g., DnD HOC wrapping the wrong subtree, resourceProps spread ordering causing stale memoization), make that change. If a structural concern does not block alignment (e.g., the 1556-line file size, prop-drilling inside the modal, inline component definitions), document it as deferred debt — do NOT proactively split files in this phase.
- **D-03:** Root-cause over surface-fix. Phase 18 shipped a CSS `transform: translateY(-50%)` fix for `.rbc-label`; per REQUIREMENTS.md the issue may be back. If the regression traces to Phase 19's DnDCalendar HOC + resourceProps changes (HTML structure shift), prefer fixing the underlying cause (e.g., HOC placement, conditional spread, missing key) over stacking more CSS overrides. Only fall back to CSS overrides when the HTML structure is correct and the misalignment is purely visual styling.

### Verification Methodology

- **D-04:** Match Phase 19's UAT pattern. Each CAL-FIX requirement gets a human UAT entry in `20-HUMAN-UAT.md` with explicit pass criteria.
- **D-05:** Zoom matrix for CAL-FIX-01: 75%, 100%, 125% browser zoom. View matrix: Day, Week, Day + By Staff (alignment-relevant views — Month does not show a time gutter).
- **D-06:** View-switch matrix for CAL-FIX-02: Month → Week → Day → By Staff → Week → Month sequence, verifying gutter widths, header positions, and event placements re-render correctly without manual reload at each transition.
- **D-07:** Regression check for CAL-FIX-04: re-run the 5 outstanding Phase 19 UAT items (in `19-HUMAN-UAT.md`) after the refactor — they must still pass.
- **D-08:** No automated visual regression tooling introduced in this phase. Manual browser verification is the bar (consistent with Phase 19 verification approach).

### View-Switch State Hygiene (CAL-FIX-02)

- **D-09:** Reset on view switch:
  - Drag-in-progress state (RBC handles internally — verify no leak)
  - Internal RBC layout cache for gutter widths and header positions (force re-mount if stale, e.g., via `key` prop tied to view + isByStaff combination)
  - GCal busy events re-fetch when `from`/`to` range changes (already wired via useEffect — verify)
- **D-10:** Persist across view switch:
  - `hiddenStaff` and `hiddenStatuses` filters (these are user-controlled meta-filters, not view state)
  - `currentDate` (date navigation persists)
  - Browser zoom level (always browser-controlled, never application state)
- **D-11:** The existing on-mount `setCurrentView(DEFAULT_CALENDAR_VIEW)` (line ~933) and `if (v !== 'day') setIsByStaff(false)` (line ~1112) handlers are part of the existing behavior — audit whether they are sufficient or contribute to staleness. If a `key`-based remount approach is cleaner, prefer it.

### Claude's Discretion

- Whether to introduce a `key={`${view}-${isByStaff}`}` on the `<DnDCalendar>` to force re-mount on view changes — measure first, decide based on diagnosis
- Exact CSS selector / property adjustments for `.rbc-label` if Phase 18's fix has regressed — measure pixel offset in browser, choose minimal change
- Whether the `useEffect` resetting `currentView` on mount (line ~933) should be removed (it's a one-time-on-mount reset that may now conflict with persisted state) — decide during audit
- Whether `resourceProps` should be memoized with `useMemo` to stabilize identity — decide based on observed re-render behavior
- File structure during fixes: small extractions of inline helpers (e.g., `EventComponent`, `MetricCard`, `FilterPill`) are allowed if they reduce coupling that contributes to stale closures — but this is opportunistic, not a goal

### Folded Todos

None. The "Unify booking creation modal" todo is deferred to Phase 21 (see Deferred Ideas) — it is feature/structural work adjacent to but distinct from timeline-alignment correctness.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary Target Files
- `client/src/components/admin/AppointmentsCalendarSection.tsx` — 1556-line target file. Key sections:
  - Lines 102–108: `localizer` config (dateFnsLocalizer)
  - Line 146: `DnDCalendar = withDragAndDrop(Calendar)` at module scope (Phase 19 D-10)
  - Lines 388–599: `AppointmentsCalendarSection` component start; state, queries, events derivation
  - Lines 815–826: `handleSelectSlot` with `resourceId` extraction (Phase 19 D-04)
  - Lines 932–934: on-mount `setCurrentView(DEFAULT_CALENDAR_VIEW)` useEffect — audit suspect
  - Lines 938–945: `resourceProps` conditional spread (Phase 19 D-02)
  - Lines 1093–1096: shell with inline `style={{ height: 720, overflowX: isByStaff ? 'auto' : undefined }}`
  - Lines 1098–1140: `<DnDCalendar>` JSX — view switching `onView` handler, prop spread
- `client/src/index.css` lines 277–427 — all `.appointments-calendar .rbc-*` rules. Specific suspects:
  - Lines 332–335: time gutter background
  - Lines 337–341: `border-top: 0 !important` on time-header
  - Lines 351–357: time-header-content min-height adjustments
  - Lines 363–365: `min-height: 2.25rem` on `.rbc-day-slot .rbc-time-slot`
  - Lines 383–394: `.rbc-time-slot` and `.rbc-label` rules — Phase 18 fix lives here (`transform: translateY(-50%)`)

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — CAL-FIX-01 through CAL-FIX-04 acceptance criteria; explicit narrow-scope note (lines 28–30)
- `.planning/ROADMAP.md` — Phase 20 success criteria (4 items, lines 22–26)

### react-big-calendar (library)
- `node_modules/react-big-calendar/lib/css/react-big-calendar.css` — base CSS the project overrides
- `node_modules/react-big-calendar/lib/addons/dragAndDrop/styles.css` — DnD styles
- react-big-calendar API surface:
  - `resources`, `resourceIdAccessor`, `resourceTitleAccessor`, `resourceAccessor` props (Phase 19)
  - `withDragAndDrop` HOC: `onEventDrop`, `draggableAccessor`
  - `scrollToTime`, `views`, `defaultView`, `view` controlled mode

### Prior Phase Context (decisions to honor)
- `.planning/phases/14-admin-calendar-create-booking-from-slot/14-CONTEXT.md` — booking modal foundation; status defaults, type-ahead, pre-fill behavior
- `.planning/phases/18-admin-calendar-improvements/18-CONTEXT.md` — D-13 `.rbc-label` CSS approach; multi-service rows; modal width
- `.planning/phases/19-receptionist-booking-flow-multi-staff-view/19-CONTEXT.md` — DnDCalendar HOC at module scope (D-10), resourceProps shape (D-02), drag-to-reassign behavior (D-12), 30s polling (D-14)
- `.planning/phases/19-receptionist-booking-flow-multi-staff-view/19-HUMAN-UAT.md` — 5 outstanding human UAT items that must still pass after Phase 20

### Pending Todo (deferred — informational only)
- `.planning/todos/pending/2026-04-29-unify-booking-creation-modal-across-calendar-and-bookings-pages.md` — Phase 21 candidate

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cn()` utility from `@/lib/utils` — already imported; use for conditional `key`/className composition
- `getStaffColor(staffId)` — color mapping consistent with Phase 19 column headers
- Phase 19's `resourceProps` conditional object — already structured; can be wrapped in `useMemo` if needed
- Existing `useEffect` for gcalBusy fetch (lines 488–555) — already keys on `from`/`to`; range change triggers refetch automatically
- shadcn/ui Toast (already used for drag-to-reassign undo) — reuse for any user-facing error if a fix needs one

### Established Patterns
- View state controlled via `currentView` + `onView` handler (controlled mode) — Phase 20 should keep this pattern
- DnD HOC at module scope (line 146) — never recreate per render
- BEM-style CSS class naming for the calendar shell (`appointments-calendar-shell__board`) — keep convention if any new wrappers added
- Tailwind `@apply` inside CSS rules for design-token-driven values — RBC override rules use this pattern

### Integration Points
- The DnDCalendar HOC + resourceProps spread + conditional className all converge at lines 1098–1140 — this is the structural pinch point
- `from`/`to` derivation (lines 410–429) drives both bookings query and gcalBusy fetch — view changes flow through here
- `hiddenStaff` Set is read by 4+ places (resourceProps, events filter, gcalBusy effect, FilterPill render) — keep coupling tight; do not split state without reason

### Suspect Hot Spots (for diagnosis)
1. The on-mount `setCurrentView(DEFAULT_CALENDAR_VIEW)` useEffect (line 932) — runs once but may conflict with controlled-view callers
2. Conditional spread `{...resourceProps}` (line 1099) where `resourceProps` is a fresh object on every render when `isByStaff` is true — may invalidate RBC's internal memoization
3. Inline `style={{ height: 720, overflowX: isByStaff ? 'auto' : undefined }}` (line 1096) — switching `isByStaff` flips overflow on the shell, which can shift the inner gutter measurement
4. `.rbc-label` `transform: translateY(-50%)` (CSS line 392) — depends on `display: block` and `line-height: 1`; if a parent's `border-top` or `padding` changes between views, alignment shifts

</code_context>

<specifics>
## Specific Ideas

- Treat the audit as a 3-step sequence: (1) document symptoms in browser with screenshots/notes, (2) attribute each to a root cause in code, (3) make the minimal change that fixes the cause without touching unrelated areas.
- When in doubt between CSS override vs HTML/HOC fix, prefer the upstream fix — the user's stated motivation is "fix at the structural level rather than patching symptoms" (ROADMAP scope, line 15).
- The Phase 18 `.rbc-label` transform may still be correct in Day/Week views but break in By Staff view due to a different DOM structure introduced by `resources` — measure both view configurations before changing the rule.
- Keep the existing toolbar, filter popover, MetricCard, EventComponent, and modal markup unchanged unless a change is required for correctness — those are out of audit scope.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- **Unify booking creation modal across Calendar and Bookings pages** (`.planning/todos/pending/2026-04-29-unify-booking-creation-modal-across-calendar-and-bookings-pages.md`) — Reviewed and deferred. Reason: extracting the Create Booking dialog into a shared component is feature/structural work that adds a new entry point on the Bookings page. Phase 20's REQUIREMENTS.md explicitly scopes timeline alignment + structural correctness only. Defer to Phase 21 (or whichever phase opens v3.1 / addresses admin entry-point UX).

### Other Deferred
- Decomposing the 1556-line `AppointmentsCalendarSection.tsx` into smaller modules (CalendarToolbar, EventComponent, MetricCard, FilterPill, BookingFormDialog) — proactive refactor; not required for CAL-FIX-01 to -04. Document remaining structural debt in plan output for a future "Calendar Decomposition" phase.
- Performance optimization (memoization audit, query batching, render profiling) — explicit v3.1 territory per REQUIREMENTS.md.
- Mobile responsiveness for the calendar — explicit v3.1 territory.
- Drag-to-resize event duration — distinct from drag-to-reassign; deferred since Phase 19.
- Per-staff service capability matrix — deferred since Phase 19.
- Week view with multi-staff columns — deferred since Phase 19; remains deferred (column-overflow UX problem unsolved).

</deferred>

---

*Phase: 20-calendar-timeline-structure-audit*
*Context gathered: 2026-05-05*
