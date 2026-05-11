# Phase 20: Calendar Timeline & Structure Audit — Research

**Researched:** 2026-05-05
**Domain:** react-big-calendar v1.19.4 layout internals, DnD HOC + resources interaction, controlled-view remount semantics, CSS gutter alignment
**Confidence:** HIGH (library internals read directly from `node_modules`); MEDIUM on community-reported regression patterns (cross-verified across multiple GitHub issues)

## Summary

The admin calendar uses react-big-calendar 1.19.4 with `withDragAndDrop` wrapping `Calendar` at module scope (good), but passes a fresh `components` object and a fresh `resourceProps` object on every render of `AppointmentsCalendarSection`. Reading the library source confirms two structural pain points: (1) the time gutter renders the time label as a `<span class="rbc-label">` inside the **first** `.rbc-time-slot` of each `.rbc-timeslot-group` only — Phase 18's `transform: translateY(-50%)` on `.rbc-label` is the canonical pixel-perfect anchor for "label sits on the top grid line of its hour." (2) The DnD HOC's `mergeComponents()` is known (issue #2588) to re-mount custom components when the `components` prop reference changes between renders, which can also reset internal RBC layout caches — a likely contributor to stale layout when switching views.

Resources mode (`rbc-time-view-resources`) makes `rbc-time-gutter` `position: sticky; left: 0` and gives day columns `min-width: 140px`. This does **not** alter `rbc-timeslot-group` height or `rbc-label` markup, so Phase 18's CSS rule should still produce correct alignment in By Staff view — but it depends on `.rbc-label`'s containing block being the `.rbc-time-slot` (block-level descendant of the timeslot group), which is true in both modes. Investigation should confirm this in the live DOM rather than assume.

**Primary recommendation:** Plan opens with a 30–60 minute browser-DOM diagnosis pass (with DevTools open, measure `getBoundingClientRect()` of `.rbc-label` vs the corresponding `.rbc-timeslot-group` top in Day, Week, and Day+ByStaff at 75/100/125% zoom). Only then decide between the four candidate fixes documented below. Stabilize `components` and `resourceProps` identity via `useMemo` regardless of the alignment finding — that change is independently justified by issue #2588 and is the smallest safe structural cleanup.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Investigation-first approach. Plan opens with a diagnosis pass: enumerate every observed misalignment / stale-state symptom in Day / Week / Day+ByStaff / Month, attribute each to a root cause (CSS rule, HOC ordering, resourceProps shape, HTML structure, conditional spread timing, view-switch effect timing), and document findings before any fix.
- **D-02:** Fix only what's needed to deliver CAL-FIX-01 through CAL-FIX-04. Structural change allowed if required for correctness (HOC placement, resourceProps spread ordering, missing key). Document non-blocking debt as deferred — do NOT proactively split files.
- **D-03:** Root-cause over surface-fix. Phase 18 shipped a CSS `transform: translateY(-50%)` fix; if regressed, prefer fixing the underlying cause (HOC placement, conditional spread, missing key) over stacking more CSS overrides. Only fall back to CSS overrides when HTML structure is correct and misalignment is purely visual styling.
- **D-04:** Match Phase 19's UAT pattern. Each CAL-FIX requirement gets a human UAT entry in `20-HUMAN-UAT.md` with explicit pass criteria.
- **D-05:** Zoom matrix for CAL-FIX-01: 75%, 100%, 125%. View matrix: Day, Week, Day + By Staff (Month has no time gutter).
- **D-06:** View-switch matrix for CAL-FIX-02: Month → Week → Day → By Staff → Week → Month, verifying gutter widths, header positions, event placements re-render correctly without manual reload.
- **D-07:** Regression check for CAL-FIX-04: re-run the 5 outstanding Phase 19 UAT items after the refactor.
- **D-08:** No automated visual regression tooling introduced. Manual browser verification is the bar.
- **D-09:** Reset on view switch — drag-in-progress (RBC internal), RBC layout cache (force re-mount via key if stale), GCal busy events (already wired).
- **D-10:** Persist across view switch — `hiddenStaff`, `hiddenStatuses`, `currentDate`, browser zoom.
- **D-11:** The on-mount `setCurrentView(DEFAULT_CALENDAR_VIEW)` (line 932) and `if (v !== 'day') setIsByStaff(false)` (line 1112) handlers — audit whether sufficient or contribute to staleness. Prefer `key`-based remount if cleaner.

### Claude's Discretion

- Whether to introduce `key={`${view}-${isByStaff}`}` on `<DnDCalendar>` to force remount on view changes — measure first, decide based on diagnosis.
- Exact CSS selector / property adjustments for `.rbc-label` if Phase 18's fix has regressed — measure pixel offset in browser, choose minimal change.
- Whether the on-mount `setCurrentView` useEffect (line 932) should be removed — decide during audit.
- Whether `resourceProps` should be memoized with `useMemo` — decide based on observed re-render behavior.
- Small extractions of inline helpers if they reduce coupling that contributes to stale closures — opportunistic only.

### Deferred Ideas (OUT OF SCOPE)

- Decomposing the 1556-line `AppointmentsCalendarSection.tsx` into smaller modules (CalendarToolbar, EventComponent, MetricCard, FilterPill, BookingFormDialog) — proactive refactor.
- Performance optimization (memoization audit, query batching, render profiling) — v3.1 territory.
- Mobile responsiveness for the calendar — v3.1 territory.
- Drag-to-resize event duration — distinct from drag-to-reassign; deferred since Phase 19.
- Per-staff service capability matrix — deferred since Phase 19.
- Week view with multi-staff columns — column-overflow UX problem unsolved.
- Unify booking creation modal across Calendar and Bookings pages — Phase 21 candidate.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAL-FIX-01 | Time gutter labels align horizontally with corresponding grid line in Day/Week/By Staff at all zoom levels — zero pixel offset | Library DOM model section + Pixel-Alignment CSS techniques section. Identifies the four candidate root causes (DnD HOC re-mount, fresh resourceProps identity, conditional `overflowX` shifting parent, `.rbc-label transform: translateY(-50%)` interaction) and the canonical alternative anchor strategies. |
| CAL-FIX-02 | Switching Month/Week/Day/By Staff and back leaves no stale layout state | RBC controlled-view + scrollToTime regression notes (issues #2260 and #2588). Documents the `key={view-isByStaff}` remount pattern, the on-mount `setCurrentView` useEffect anti-pattern, and the `from`/`to` recalculation flow. |
| CAL-FIX-03 | By Staff multi-column view continues to render correctly post-fix; horizontal scroll for 5+ staff preserved | `rbc-time-view-resources` CSS analysis (sticky gutter, `min-width: 140px` per column). Identifies that `overflowX: 'auto'` on `appointments-calendar-shell__board` is the correct horizontal-scroll mechanism and must NOT be removed; instead, `isByStaff ? 'auto' : undefined` could be the source of layout shift on view switch — alternatives below. |
| CAL-FIX-04 | Phase 19 interactive flows function identically — no regression on 5 UAT items | DnD HOC source review confirms `withDragAndDrop(Calendar)` at module scope (line 146) is correct. The handlers (`handleEventDrop`, `handleSelectSlot` with `resourceId`) are stable function definitions. Risk vector: if `components` prop reference changes (issue #2588), event-drop / selection handlers can re-bind; memoize the `components` object. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack lock:** React 18 + TypeScript, Tailwind CSS, shadcn/ui, react-big-calendar v1.19.4. **No new UI frameworks.**
- **Styling pattern:** Tailwind `@apply` inside `client/src/index.css` for design-token-driven values; BEM-style class names for shell wrappers (`appointments-calendar-shell__board`).
- **Brand:** Primary Blue `#1C53A3`, Brand Yellow `#FFFF01` for CTAs. Not directly relevant for this phase but constrains any toolbar/button changes if accidentally touched.
- **Database migrations:** Always Supabase CLI, never `drizzle-kit push` (memory note). Not relevant — Phase 20 has no schema changes.
- **State management:** React Query for server state, Context API for cart/auth. Not relevant — Phase 20 doesn't add state stores.

## Standard Stack

### Core (already installed — verify only, do not bump)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-big-calendar` | 1.19.4 | Calendar grid, time gutter, views, resources columns | Project-locked; HOC + DnD addon both ship in this package |
| `react-big-calendar/lib/addons/dragAndDrop` | (bundled) | Drag-to-reassign HOC `withDragAndDrop(Calendar)` | The only first-party DnD wrapper for RBC; Phase 19 chose this |
| `date-fns` + `date-fns/locale` | (already installed) | Localizer (`dateFnsLocalizer`) | Project pattern — see `localizer` at line 102 |
| `react-hook-form` + `@hookform/resolvers/zod` | (installed) | Form state for booking modals | Already used; not changing |
| `@tanstack/react-query` | (installed) | Bookings query with `refetchInterval: 30_000` | Phase 19 D-14 — keep |

### Supporting (no new dependencies)

This is a diagnose-and-fix-narrowly phase. No new libraries. All work happens in `AppointmentsCalendarSection.tsx`, `client/src/index.css`, and possibly small helper extractions inside the same component file.

### Alternatives Considered (and rejected per CONTEXT.md)

| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| react-big-calendar | FullCalendar, Schedule-X, custom RBC fork | Switching libraries solves nothing if the issue is structural CSS/HOC use; high churn | **REJECTED.** Out of scope per CONTEXT.md narrow-scope guidance. |
| `transform: translateY(-50%)` on `.rbc-label` | Flex `align-items: flex-start` on `.rbc-timeslot-group` + `position: relative; top: -<half-line-height>` on label | Both produce the same offset; transform is GPU-accelerated and survives parent layout changes; relative positioning is cleaner DOM-wise | **DECIDE during diagnosis.** Listed in "Pixel-Alignment Strategies" below. |
| Inline `style={{ overflowX: ... }}` | Conditional className `appointments-calendar-shell__board--by-staff` with `overflow-x: auto` defined in CSS | Both work; CSS-class approach is more idiomatic with the project's BEM convention | **PREFER CSS-class** if a structural fix is needed. |

**Version verification (HIGH confidence — read from local `node_modules`):**

```
node_modules/react-big-calendar/package.json:3:  "version": "1.19.4"
```

No upgrade. Phase 20 explicitly avoids dependency churn.

## Library DOM Model — react-big-calendar Time Gutter (HIGH confidence)

**Sources:** `node_modules/react-big-calendar/lib/TimeGutter.js`, `lib/TimeSlotGroup.js`, `lib/css/react-big-calendar.css` lines 541–675.

### Gutter render shape (per hour group)

```html
<div class="rbc-time-gutter rbc-time-column">
  <div class="rbc-timeslot-group">                <!-- flex column; min-height: 40px; border-bottom: 1px -->
    <div class="rbc-time-slot">                    <!-- flex: 1 0 0 -->
      <span class="rbc-label">9:00 AM</span>      <!-- ONLY rendered for idx===0 -->
    </div>
    <div class="rbc-time-slot">                    <!-- flex: 1 0 0; empty -->
    </div>
    <!-- ... one slot per `step / timeslots` subdivision -->
  </div>
  <!-- next hour group ... -->
</div>
```

**Critical structural facts:**

1. The hour label (`<span class="rbc-label">`) lives **inside the first `.rbc-time-slot`** of each `.rbc-timeslot-group`. (TimeGutter.js line 84: `if (idx) return null;` — only the first slot renders content.)
2. The visible "9 AM grid line" is the **bottom border of the previous `.rbc-timeslot-group`** (`border-bottom: 1px solid #ddd`, base CSS line 548) — equivalent to the **top of the current group**.
3. Without any override, `rbc-label` is `padding: 0 5px;` (CSS line 567) and the `<span>` is inline — its baseline sits roughly mid-slot due to default line-height. **This is the misalignment Phase 18 fixed** by making it `display: block; transform: translateY(-50%)` so the label's vertical center sits at the top edge of its first slot (which is the visible hour grid line).
4. `.rbc-time-slot { flex: 1 0 0; }` (base CSS line 666) — slots within a group share height equally. The group has `min-height: 40px` (line 549). This is overridden by the project to `min-height: 2.25rem` (36px) at `index.css:363` — that override is on `.rbc-day-slot .rbc-time-slot` ONLY, not on the gutter slots, so gutter and day-slot heights can diverge if the group's `min-height: 40px` wins on the gutter side and `2.25rem * timeslots` wins on the day side. **This is a candidate root cause for misalignment** — see Suspect 5 below.

### Resources mode adds (no DOM shape change to gutter slots)

From `lib/css/react-big-calendar.css` lines 626–660:

```css
.rbc-time-view-resources .rbc-time-gutter,
.rbc-time-view-resources .rbc-time-header-gutter {
  position: sticky;
  left: 0;
  background-color: white;
  border-right: 1px solid #ddd;
  z-index: 10;
  margin-right: -1px;
}
.rbc-time-view-resources .rbc-day-slot { min-width: 140px; }
.rbc-time-view-resources .rbc-header,
.rbc-time-view-resources .rbc-day-bg { width: 140px; flex: 1 1 0; flex-basis: 0px; }
```

**Implications:**
- Gutter labels remain identical markup in resources mode. Phase 18's CSS should still hit them correctly.
- The gutter becomes `position: sticky` — `transform` on a descendant (`<span class="rbc-label">`) **interacts with sticky parents**. Sticky containing block is the nearest scrolling ancestor; if `appointments-calendar-shell__board` has `overflowX: auto` (set inline at line 1096 in resources mode), that becomes the scroll context. Browsers sometimes round subpixel positions differently inside sticky elements, especially at non-100% zoom. **Confidence: MEDIUM** (verified from spec; needs browser confirmation).
- `background-color: white` on the sticky gutter overrides the project's `bg-muted/35` at line 333. Cosmetic, not alignment-related.

### Hour grid lines on the day side (HIGH confidence)

From base CSS line 622–624:

```css
.rbc-day-slot .rbc-time-slot {
  border-top: 1px solid #f7f7f7;
}
```

**Implication:** Each subdivision (e.g., 9:00, 9:30 if `timeslots=2`) gets a top border on the day-slot side. The hour boundary itself is the **bottom border of the previous `.rbc-timeslot-group`**. The project's CSS overrides `border-color` on `rbc-timeslot-group` (line 295) to a darker `hsl(var(--border) / 0.65)` to make hours more visible than half-hours. So the visual alignment target is: **`.rbc-label` baseline (after Phase 18 transform) must coincide with the top of `.rbc-timeslot-group`**, which is the bottom of the previous group's `border-bottom`.

## Architecture Patterns

### Pattern 1: HOC at module scope (already correct)

**What:** `const DnDCalendar = withDragAndDrop(Calendar);` declared at module scope (line 146).
**When to use:** Always for any HOC. Recreating an HOC inside a component re-runs the wrapping on every render and forces React to treat each render's output as a new component (unmount + mount).
**Already applied — keep this.**

```typescript
// Source: client/src/components/admin/AppointmentsCalendarSection.tsx:146
const DnDCalendar = withDragAndDrop(Calendar);
```

### Pattern 2: Stabilize `components` prop identity (NOT yet applied — fix recommended)

**What:** Memoize the `components` object passed to RBC.
**When to use:** Any time RBC is wrapped with `withDragAndDrop`. Per [issue #2588](https://github.com/jquense/react-big-calendar/issues/2588), the DnD HOC's `mergeComponents()` runs in render — passing a fresh `components` object causes the merged map to re-create, which can re-mount custom components.
**Currently:** Lines 1117–1130 build `{ event: EventComponent, toolbar: <inline arrow> }` fresh on every parent render.

```typescript
// RECOMMENDED PATTERN
const calendarComponents = useMemo(
  () => ({
    event: EventComponent,
    toolbar: (toolbarProps: any) => (
      <CalendarToolbar
        {...toolbarProps}
        isByStaff={isByStaff}
        onByStaff={(active: boolean) => {
          setIsByStaff(active);
          if (active) setCurrentView(Views.DAY);
        }}
        filterControl={filterPopover}
      />
    ),
  }),
  [isByStaff, filterPopover],
);
```

Caveat: `filterPopover` is itself JSX built fresh every render — memoizing it too may be needed. **Confidence: MEDIUM** that this fully resolves the re-mount path; confirm by adding a `console.log` in `EventComponent` and watching for re-mount on unrelated state changes.

### Pattern 3: Stabilize `resourceProps` identity (NOT yet applied — fix recommended)

**What:** Wrap the conditional `resourceProps` in `useMemo`.
**Currently:** Lines 938–945 build a fresh object on every render whenever `isByStaff` is true.

```typescript
// RECOMMENDED
const resourceProps = useMemo(
  () => isByStaff
    ? {
        resources: visibleStaffForResources,
        resourceIdAccessor: (r: any) => r.id,
        resourceTitleAccessor: (r: any) => r.firstName,
        resourceAccessor: (e: any) => e.staffMemberId,
      }
    : {},
  [isByStaff, visibleStaffForResources],
);
```

`visibleStaffForResources` is itself recomputed every render (line 936) — memoize it too:

```typescript
const visibleStaffForResources = useMemo(
  () => scopedStaffList.filter((s) => !hiddenStaff.has(s.id)),
  [scopedStaffList, hiddenStaff],
);
```

### Pattern 4: Force remount on view+resources change (CONDITIONAL — apply only if diagnosis confirms stale layout)

**What:** Add `key={`${currentView}-${isByStaff}`}` to `<DnDCalendar>`.
**When to use:** ONLY if the diagnosis confirms RBC's internal slot-metrics or layout state is stale across view transitions. The `setSlotMetrics(slotMetrics.update(...))` in `TimeGutter.js` lines 68–82 should handle re-computation when `min/max/timeslots/step` change — but if the `from/to` derivation (lines 410–429) doesn't trigger that path on a mount-stable RBC instance, a `key` remount is the blunt-force fix.
**Tradeoff:** Remount destroys RBC's scroll position, animation state, and any in-flight drag. Per [issue #2260](https://github.com/jquense/react-big-calendar/issues/2260), `scrollToTime` already re-fires on user interaction with DnD — adding a remount may amplify scroll-jump UX issues. Document and verify.

```typescript
// CONDITIONAL — apply only if diagnosis points here
<DnDCalendar
  key={`${currentView}-${isByStaff}`}  // forces RBC to recompute layout on view/resources change
  {...resourceProps}
  ...
/>
```

### Anti-Patterns to Avoid

- **Anti-pattern: Recreating the DnD HOC inside the component.** Already avoided — keep at module scope.
- **Anti-pattern: Passing inline arrow functions to `components.toolbar`** (currently happening at line 1119–1129) without memoization. Per issue #2588 this re-creates the merged components map on every render.
- **Anti-pattern: Using both `defaultView` and a controlled `view` prop without aligning them.** Currently both are present (`defaultView={DEFAULT_CALENDAR_VIEW}` at line 1105 AND `view={currentView}` at line 1108). RBC documents both; with controlled mode, `defaultView` is ignored — but coexistence is harmless. **Lower priority.**
- **Anti-pattern: On-mount `useEffect` that re-asserts initial state already set in `useState`.** Lines 932–934 do `setCurrentView(DEFAULT_CALENDAR_VIEW)` after `useState(DEFAULT_CALENDAR_VIEW)` initialized it (line 397). This is a tautological reset; it triggers an extra render on mount. **Recommend deletion** — confidence HIGH.
- **Anti-pattern: Stacking CSS overrides to fix a structural problem.** Per CONTEXT.md D-03, prefer the upstream fix.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Custom calendar grid / time gutter | Hand-rolled grid replacing RBC | Keep RBC; fix CSS/HOC issues | Pixel-perfect time grids, DST handling, drag-resize math, resources columns, accessibility — months of work to reproduce. |
| Custom drag-to-reassign logic | Manual `dragstart`/`dragend` listeners | Keep `withDragAndDrop` HOC | RBC's HOC handles slot snapping, resource-column detection, allDay edge cases. |
| Custom view-switch state cache invalidation | Manual `useEffect` chains tracking previous view | React's `key` prop OR rely on RBC's internal `slotMetrics.update()` | The `key` prop is the standard React-idiomatic remount mechanism. Manual cache invalidation is fragile. |
| Custom alignment measurement at runtime | `getBoundingClientRect()` polling + JS-driven label position | CSS `transform` + flex anchoring | CSS can express the alignment statically. JS-driven layout is a known pattern only when CSS truly can't express the constraint (it can here). |
| Subpixel alignment shim for non-100% zoom | Detecting `window.devicePixelRatio` and adjusting transform | Trust CSS pixel rounding; if browser-specific, narrow the override to that browser | Browser zoom subpixel rounding is implementation-defined; chasing it via JS is a rabbit hole. |

**Key insight:** The fix for Phase 20 is almost certainly small (`useMemo` placements, deletion of one redundant `useEffect`, possibly a single CSS rule adjustment). The temptation to refactor the 1556-line file is real and explicitly out of scope per CONTEXT.md D-02.

## Runtime State Inventory

> Phase 20 is a calendar UI alignment fix, not a rename/refactor/migration. No data migration involved. Section omitted by triggering rule.

**Stored data:** None — verified by reading CONTEXT.md (no rename/string-replace work).
**Live service config:** None — no external service config touches.
**OS-registered state:** None.
**Secrets/env vars:** None.
**Build artifacts:** None — pure source changes; Vite HMR handles reloads.

## Common Pitfalls

### Pitfall 1: Phase 18's `.rbc-label transform: translateY(-50%)` regressed by Phase 19's resources mode

**What goes wrong:** Time labels appear shifted up or down relative to the hour grid line, particularly visible at 75% or 125% browser zoom or when toggling By Staff.
**Why it happens:** Multiple candidates — see Suspect Hot Spots below. Most likely: the `components` and `resourceProps` objects rebuild each render, triggering DnD HOC's `mergeComponents()` to re-mount `EventComponent` and (transitively) reset RBC's `slotMetrics` cache, re-measuring slot heights at a moment when CSS hasn't fully applied.
**How to avoid:** Memoize `components` and `resourceProps`; verify in DevTools that `EventComponent` doesn't unmount on parent state changes.
**Warning signs:** Toggling a filter pill (which mutates `hiddenStaff`) causes a visible "flicker" in the calendar grid. Drag-in-progress events stop responding mid-drag when an unrelated state update lands.

### Pitfall 2: Conditional `style={{ overflowX: isByStaff ? 'auto' : undefined }}` on a parent shifts gutter measurement

**What goes wrong:** Switching from Day to Day+ByStaff (or back) leaves residual layout — gutter widths or label positions look "wrong" until a manual reload.
**Why it happens:** Toggling `overflowX` on `.appointments-calendar-shell__board` changes the scroll-context establishment for the sticky gutter inside (`rbc-time-view-resources .rbc-time-gutter` is `position: sticky`). The sticky containing block changes between renders. Browser sticky-position recomputation does not always re-flow descendants instantly.
**How to avoid:** Move the conditional to a className (`appointments-calendar-shell__board--by-staff`) defined in CSS. CSS class swaps go through the same paint cycle as inline styles but are easier to debug in DevTools and more idiomatic with the project's BEM convention.
**Warning signs:** Browser DevTools "Layout" tree shows the sticky element re-evaluating its containing block when you toggle the view.

### Pitfall 3: `scrollToTime` re-fires on every interaction in DnD mode

**What goes wrong:** Dragging an event or toggling a filter resets the calendar's scroll position to 8:00 AM (`DEFAULT_SCROLL_TIME`).
**Why it happens:** [Issue #2260](https://github.com/jquense/react-big-calendar/issues/2260) — known DnD interaction with `scrollToTime`. The HOC's `setState` on drag-start/end triggers a re-render that re-applies `scrollToTime`.
**How to avoid:** If observed during diagnosis, options are (a) move `scrollToTime` into a `useEffect` that fires only on mount, (b) memoize `scrollToTime` to the same `Date` reference (it's recreated each render at line 144 — `DEFAULT_SCROLL_TIME` is module-scoped so this is fine), or (c) accept it (Phase 19 may have considered acceptable). **Confidence: MEDIUM** — verify whether this affects current users before fixing.
**Warning signs:** Calendar visibly scrolls to 8 AM on each drag-drop or filter toggle.

### Pitfall 4: On-mount `setCurrentView(DEFAULT_CALENDAR_VIEW)` useEffect (line 932) causes double-render and may mask other bugs

**What goes wrong:** On every mount, `currentView` is set twice (initial `useState` + immediate `useEffect`). Subtle but: any other on-mount effect that depends on `currentView` will see the value change between effect runs, potentially racing with the bookings query or the gcalBusy fetch.
**Why it happens:** Code legacy — possibly a leftover from when view state was meant to be persisted and reset.
**How to avoid:** Delete the `useEffect`. The `useState(DEFAULT_CALENDAR_VIEW)` initialization at line 397 already establishes the value.
**Warning signs:** React DevTools profiler shows a re-render of `AppointmentsCalendarSection` on the first frame after mount with no user interaction.

### Pitfall 5: `min-height: 2.25rem` on `.rbc-day-slot .rbc-time-slot` while gutter group keeps `min-height: 40px`

**What goes wrong:** Gutter rows and day-slot rows can have slightly different heights at certain zoom levels, producing a creeping offset that accumulates down the day.
**Why it happens:** `index.css:363` sets `min-height: 2.25rem` (36px at 16px root) on day-slot time slots. Gutter slots are not overridden — they inherit `flex: 1 0 0` and the parent group's `min-height: 40px`. Flex-stretch usually equalizes them, BUT at non-integer zoom levels (75%, 125%) `36px * 1.0` and `40px * (zoom / parent-zoom)` can round differently.
**How to avoid:** Match the day-slot override on the gutter slot — `.appointments-calendar .rbc-time-gutter .rbc-time-slot { min-height: 2.25rem; }` — OR remove the day-slot override and let RBC's defaults apply. **Confidence: MEDIUM** that this is THE root cause; HIGH that it is a candidate worth measuring.
**Warning signs:** At 100% zoom labels look correct, but at 75%/125% they drift more the further down the day you look.

## Code Examples

### Diagnostic snippet — measure label offset in browser DevTools console

```javascript
// Run in DevTools Console while admin calendar is open
// Source: synthesized from RBC DOM model
const labels = document.querySelectorAll('.appointments-calendar .rbc-time-gutter .rbc-label');
const groups = document.querySelectorAll('.appointments-calendar .rbc-time-gutter .rbc-timeslot-group');
[...labels].forEach((label, i) => {
  const group = groups[i];
  if (!group) return;
  const labelRect = label.getBoundingClientRect();
  const groupRect = group.getBoundingClientRect();
  const labelCenter = labelRect.top + labelRect.height / 2;
  const groupTop = groupRect.top;
  console.log(
    `Label ${i} (${label.textContent}): label-center=${labelCenter.toFixed(2)} group-top=${groupTop.toFixed(2)} offset=${(labelCenter - groupTop).toFixed(2)}px`
  );
});
// Expected with Phase 18 fix: offset ≈ 0px (label center sits on group top = grid line)
// If offsets are non-zero or non-uniform: Phase 18 fix is regressed
```

Use this snippet at 75%, 100%, 125% zoom in Day, Week, and Day+ByStaff views. Record findings in `20-DIAGNOSIS.md` (recommend creating this artifact during planning).

### Memoizing `components` and `resourceProps` (recommended fix)

```typescript
// Source: synthesized from RBC issue #2588 + project state
import { useMemo } from 'react';

// Inside AppointmentsCalendarSection:

const visibleStaffForResources = useMemo(
  () => scopedStaffList.filter((s) => !hiddenStaff.has(s.id)),
  [scopedStaffList, hiddenStaff],
);

const resourceProps = useMemo(
  () => isByStaff
    ? {
        resources: visibleStaffForResources,
        resourceIdAccessor: (r: any) => r.id,
        resourceTitleAccessor: (r: any) => r.firstName,
        resourceAccessor: (e: any) => e.staffMemberId,
      }
    : {},
  [isByStaff, visibleStaffForResources],
);

const handleViewChange = useCallback((v: string) => {
  setCurrentView(v);
  if (v !== 'day') setIsByStaff(false);
}, []);

const handleByStaff = useCallback((active: boolean) => {
  setIsByStaff(active);
  if (active) setCurrentView(Views.DAY);
}, []);

const calendarComponents = useMemo(() => ({
  event: EventComponent,
  toolbar: (toolbarProps: any) => (
    <CalendarToolbar
      {...toolbarProps}
      isByStaff={isByStaff}
      onByStaff={handleByStaff}
      filterControl={filterPopover}
    />
  ),
}), [isByStaff, handleByStaff, filterPopover]);
// Note: filterPopover is JSX built fresh every render. If diagnosis shows
// EventComponent still re-mounts, memoize filterPopover separately.
```

### CSS-class alternative for the conditional `overflowX`

```css
/* Source: client/src/index.css — recommended replacement for inline style */
.appointments-calendar-shell__board {
  /* existing rules */
}

.appointments-calendar-shell__board--by-staff {
  overflow-x: auto;
}
```

```tsx
// Replace line 1094–1096
<div
  className={cn(
    'appointments-calendar-shell__board',
    isByStaff && 'appointments-calendar-shell__board--by-staff',
  )}
  style={{ height: 720 }}
>
```

## Pixel-Alignment Strategies for `.rbc-label` (DECIDE during diagnosis)

Four candidate strategies, ranked by structural fidelity:

### Strategy A (Phase 18 — current) — `transform: translateY(-50%)` on `display: block` span

```css
.appointments-calendar .rbc-time-gutter .rbc-label {
  display: block;
  padding-top: 0;
  line-height: 1;
  transform: translateY(-50%);
  overflow: visible;
}
```

**Pros:** GPU-accelerated; survives parent reflows well; doesn't disturb flex layout.
**Cons:** Subpixel rounding inside sticky parents can drift at non-100% zoom (Pitfall 1). Depends on `line-height: 1` matching the visual baseline.
**When to keep:** If diagnosis shows offsets within ±1px at all zoom levels — Phase 18's fix still works; the bug is elsewhere (component re-mount, conditional overflow, or Pitfall 5).

### Strategy B — Flex anchor at top with negative margin

```css
.appointments-calendar .rbc-time-gutter .rbc-label {
  display: block;
  line-height: 1;
  margin-top: -0.5em;  /* half line-height — pulls label up to sit on group top */
  padding-top: 0;
  overflow: visible;
}
```

**Pros:** No `transform` — survives sticky-positioning quirks. Pure flow layout.
**Cons:** Negative margin can hide overflow if the first label sits at the gutter's top edge (label "8:00 AM" first row clipped). Test the first row carefully.

### Strategy C — Anchor inside first slot via absolute positioning

```css
.appointments-calendar .rbc-time-gutter .rbc-time-slot:first-child {
  position: relative;
}
.appointments-calendar .rbc-time-gutter .rbc-time-slot:first-child .rbc-label {
  position: absolute;
  top: 0;
  transform: translateY(-50%);
  left: 5px;  /* matches base padding */
  right: 5px;
  display: block;
  line-height: 1;
}
```

**Pros:** Decouples label from slot's flex height — most robust against Pitfall 5. Explicit positioning intent.
**Cons:** Most invasive CSS. Need to verify all existing label-related rules still match. May need to adjust `padding` rules.

### Strategy D — Match gutter slot heights to day-slot override (fix Pitfall 5 only)

```css
.appointments-calendar .rbc-time-gutter .rbc-time-slot {
  min-height: 2.25rem;  /* match index.css:363 day-slot override */
}
```

**Pros:** One-line fix if Pitfall 5 is the actual cause. Doesn't touch Phase 18's transform.
**Cons:** Treats a symptom (height mismatch) without confirming the underlying flex behavior.

**Decision matrix:**
- Diagnosis shows uniform offset at 100% but drift at 75%/125% → Strategy D first, then re-measure.
- Diagnosis shows offset only in By Staff view → Strategy C (most robust against sticky-positioning interaction).
- Diagnosis shows offset varies with parent state changes → root cause is component re-mount; fix `useMemo`s first, then re-measure (Strategy A may already be sufficient).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HOC inside component body | HOC at module scope | Always best practice; Phase 19 D-10 enforced | Already correct in this codebase |
| Mutable `components` prop fresh each render | Memoized `components` via `useMemo` | RBC issue #2588 (2023) | NOT yet applied — recommend |
| Inline conditional `style` for layout-affecting CSS | Conditional className with CSS class | General React/Tailwind best practice | NOT yet applied — recommend if structural fix needed |
| `defaultView` + controlled `view` together | Either-or; controlled `view` wins | RBC docs (current) | Currently both present — harmless but worth simplification |

**Deprecated/outdated:**
- `intljusticemission/react-big-calendar` (old GitHub org) — moved to `jquense/react-big-calendar` years ago. Some older Stack Overflow answers still link to the old org. Use `jquense/react-big-calendar` issues only.

## Open Questions

1. **Is the `.rbc-label` regression actually present right now?**
   - What we know: REQUIREMENTS.md says "may be back" — Phase 18 shipped commit a326c33; Phase 19 changed the HOC and added resources. Anything between could have regressed it.
   - What's unclear: No screenshots in CONTEXT.md or REQUIREMENTS.md showing the regression. Plan must include browser-verification step BEFORE selecting a fix.
   - Recommendation: First diagnostic task is "open admin calendar, run the measurement snippet above at 75/100/125% in Day/Week/Day+ByStaff, write findings to `20-DIAGNOSIS.md`". Without this evidence, all CSS choices are guesses.

2. **Does view-switching actually leave stale layout, or is the concern speculative?**
   - What we know: CONTEXT.md D-09 says verify; D-11 mentions on-mount `setCurrentView` and `if (v !== 'day') setIsByStaff(false)` may be insufficient.
   - What's unclear: Whether the symptom is actually observable, or whether it's preventive hardening.
   - Recommendation: Diagnostic task — perform the D-06 view-switch matrix (Month → Week → Day → By Staff → Week → Month), screenshot each transition, look for visible artifacts. Only add `key={view-isByStaff}` if artifacts confirmed.

3. **Are inline functions in `onView`/`onByStaff` causing perf-visible re-renders?**
   - What we know: Lines 1110–1113 and 1123–1126 define inline arrows on every render.
   - What's unclear: Whether RBC re-renders heavily because of this. Could be visible-flicker source.
   - Recommendation: Wrap in `useCallback` while doing the `useMemo` work — costs nothing, may help.

4. **Should `EventComponent`, `MetricCard`, `FilterPill` be extracted to separate files?**
   - What we know: They're at module scope (lines 288, 311, 339) — NOT inside the component, so identity is stable. CONTEXT.md D-02 says "do not proactively split files."
   - What's unclear: Nothing — keep them in-file. Note as future-debt only if a fix requires touching them.
   - Recommendation: No extraction. Document as deferred debt for the eventual "Calendar Decomposition" phase.

## Environment Availability

> Phase 20 has no external dependencies. All work is in-source and CSS. No new tools, services, or runtimes required. Section is informational.

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js + npm | Vite dev server | Assumed (project running) | (existing) | — |
| Browser with DevTools | Diagnosis steps (Chrome/Edge/Firefox) | Assumed (any modern browser) | — | — |
| `react-big-calendar` | Already installed | ✓ | 1.19.4 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None for this phase — manual UAT only (CONTEXT.md D-08: "No automated visual regression tooling introduced") |
| Config file | n/a |
| Quick run command | `npm run check` (TypeScript type check — must pass after any source edit) |
| Full suite command | `npm run check && npm run build` (type check + build to verify no broken imports) |
| Manual verification | Browser DevTools at 75% / 100% / 125% zoom, view-switch matrix per D-06 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAL-FIX-01 | Time gutter labels align with grid line at zero pixel offset across Day/Week/By Staff at 75/100/125% zoom | manual-only | n/a — DevTools `getBoundingClientRect` snippet (above) + visual inspection | ❌ Wave 0 (`20-HUMAN-UAT.md` to be created) |
| CAL-FIX-02 | Switching Month → Week → Day → By Staff → Week → Month leaves no stale layout (gutter widths, header positions, event placements re-render correctly without manual reload) | manual-only | n/a — visual inspection | ❌ Wave 0 |
| CAL-FIX-03 | By Staff renders one column per visible staff after fix; horizontal scroll preserved for 5+ staff; switching staff filters re-renders columns correctly | manual-only | n/a — visual inspection | ❌ Wave 0 |
| CAL-FIX-04 | Phase 19 UAT items still pass — drag-to-reassign with undo toast, QuickBook walk-in modal, GCal busy block guard | manual-only — re-run 5 items in `19-HUMAN-UAT.md` | n/a | ✅ (`19-HUMAN-UAT.md` exists; reference for re-test) |
| Type safety | TypeScript compiles after all edits | automated | `npm run check` | ✅ (project config) |
| Build integrity | Production build succeeds (no broken imports / dead code from any extractions) | automated | `npm run build` | ✅ |

**Manual-only justification:** Per CONTEXT.md D-08 and the project's pattern (Phase 19 used the same approach). Visual pixel alignment and view-switch state are inherently visual/spatial — automated visual regression tooling (Percy, Chromatic, Playwright screenshot diff) is NOT in scope for this phase. The validation bar is human verification at the documented zoom × view matrix.

### Sampling Rate

- **Per task commit:** `npm run check` (must pass — TypeScript types are the safety net).
- **Per wave merge:** `npm run check && npm run build`.
- **Phase gate:** All entries in `20-HUMAN-UAT.md` marked PASS by human reviewer + Phase 19 UAT regression check passes + `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] Create `.planning/phases/20-calendar-timeline-structure-audit/20-HUMAN-UAT.md` — UAT entry per CAL-FIX requirement with explicit pass criteria (mirrors Phase 19's UAT format)
- [ ] Create `.planning/phases/20-calendar-timeline-structure-audit/20-DIAGNOSIS.md` (recommended) — capture the diagnosis-pass findings before writing fix tasks. Per CONTEXT.md D-01 the plan opens with diagnosis; documenting findings as a separate artifact creates a persistent reference and a reviewable boundary between investigation and fix.
- [ ] No automated test framework setup needed — pure manual UAT phase

## Sources

### Primary (HIGH confidence — read directly from local code)

- `node_modules/react-big-calendar/lib/TimeGutter.js` (lines 35–106) — gutter render shape, label only at idx===0
- `node_modules/react-big-calendar/lib/TimeSlotGroup.js` (full file) — `.rbc-timeslot-group` is a flexbox row of `.rbc-time-slot` divs
- `node_modules/react-big-calendar/lib/css/react-big-calendar.css` (lines 541–675) — base layout CSS for gutter, slots, resources mode
- `node_modules/react-big-calendar/lib/addons/dragAndDrop/styles.css` (full file) — DnD addon CSS surface (no layout-shifting rules in the gutter region)
- `node_modules/react-big-calendar/lib/addons/dragAndDrop/withDragAndDrop.js` (lines 1–100) — HOC structure; `mergeComponents()` location confirmed via issue #2588 cross-reference
- `client/src/components/admin/AppointmentsCalendarSection.tsx` (lines 102–146, 388–946, 1093–1140) — current implementation, all suspect hot spots
- `client/src/index.css` (lines 220–428) — project CSS overrides for the calendar
- `node_modules/react-big-calendar/package.json` — version 1.19.4 confirmed

### Secondary (MEDIUM confidence — community-reported, cross-referenced)

- [GitHub issue #2588 — DragAndDrop with custom components causes re-mount on each render](https://github.com/jquense/react-big-calendar/issues/2588) — root justification for memoizing `components` prop
- [GitHub issue #2260 — User interaction on Drag and Drop calendar with scrollToTime causes re-scroll](https://github.com/jquense/react-big-calendar/issues/2260) — explains potential scrollToTime regression
- [GitHub issue #2582 — Drag and Drop event duplication with resources](https://github.com/jquense/react-big-calendar/issues/2582) — confirms DnD + resources is a known interaction surface (verify drag-to-reassign flow doesn't duplicate)
- [GitHub issue #1862 — Drag event between resources](https://github.com/jquense/react-big-calendar/issues/1862) — drag-across-columns is supported but has known edge cases
- [GitHub issue #2506 — customizing time header gutter](https://github.com/jquense/react-big-calendar/issues/2506) — gutter-header customization context
- [Lightrun mirror — week view headers misaligned with day columns](https://lightrun.com/answers/jquense-react-big-calendar-week-view-headers-misaligned-with-day-columns) — historical alignment workarounds (minWidth on `.rbc-header` and `.rbc-time-header-gutter`)

### Tertiary (LOW confidence — general references, not load-bearing)

- [React `key` prop remount pattern](https://saynaesmailzadeh.medium.com/mastering-react-component-remounts-with-key-an-in-depth-guide-for-s-frontend-developers-a4d8dafe0c85) — standard React pattern, not specific to RBC
- [npm — react-big-calendar package page](https://www.npmjs.com/package/react-big-calendar) — version surface

## Suspect Hot Spots (CONTEXT.md §code_context, expanded with research)

The four CONTEXT.md hot spots, each annotated with the research finding that validates or invalidates it:

| # | Suspect | CONTEXT line | Validated? | Recommended action |
|---|---------|--------------|------------|--------------------|
| 1 | On-mount `setCurrentView(DEFAULT_CALENDAR_VIEW)` useEffect | line 932 | **VALIDATED** as redundant (state already initialized at line 397). Not the alignment cause but a code smell that should be removed. | Delete the useEffect. HIGH confidence. |
| 2 | Fresh `resourceProps` object every render | line 938–945 | **VALIDATED** as a re-mount risk per RBC issue #2588 — `mergeComponents()` runs on every render and unstable `resources` prop identity invalidates RBC's slot-metrics state. | Wrap in `useMemo(() => ..., [isByStaff, visibleStaffForResources])`. HIGH confidence. |
| 3 | Inline `style={{ overflowX: isByStaff ? 'auto' : undefined }}` shifts inner gutter measurement | line 1096 | **PLAUSIBLE** — `position: sticky` containing block changes when `overflow` toggles. **Unverified in this browser.** | Verify in DevTools: toggle By Staff while inspecting the sticky gutter. If shift observed, replace inline style with conditional className. MEDIUM confidence. |
| 4 | `.rbc-label transform: translateY(-50%)` interaction with parent layout | CSS line 392 | **PARTIAL** — the transform is correct in principle (anchors label center on group top edge). Regression is likely from upstream component re-mount (suspect #2), NOT from the CSS rule itself. Fix #2 first; if alignment still off, then revisit CSS via Strategies B/C/D above. | Measure FIRST (diagnostic snippet); decide AFTER fix #1+#2 land. |

**Newly identified suspect (from research, not in CONTEXT.md):**

| # | Suspect | Location | Validated? | Recommended action |
|---|---------|----------|------------|--------------------|
| 5 | `min-height: 2.25rem` on `.rbc-day-slot .rbc-time-slot` while gutter slots inherit `min-height: 40px` from RBC base CSS via `.rbc-timeslot-group` | `index.css:363–365` vs base CSS `lib/css/react-big-calendar.css:549` | **PLAUSIBLE** — at non-integer zoom levels, 36px and 40px round to different subpixel values, producing per-row drift. Strong candidate for "drift more visible at 75/125%". | Diagnostic measurement at three zoom levels will confirm or rule out. If confirmed: apply Strategy D (match gutter to 2.25rem) OR remove the day-slot override. MEDIUM confidence. |
| 6 | Fresh `components` object passed to `<DnDCalendar>` (lines 1117–1130) — inline `toolbar` arrow function | line 1117 | **VALIDATED** as the most-cited cause per issue #2588. | Wrap in `useMemo`. HIGH confidence. |

## Metadata

**Confidence breakdown:**
- Library DOM model (gutter render shape, resources mode CSS): **HIGH** — read directly from `node_modules` source.
- Recommended fixes (memoize components, memoize resourceProps, delete redundant useEffect): **HIGH** for the first two (cited by RBC issue #2588), **HIGH** for the deletion (clear redundancy).
- CSS alignment strategies (A/B/C/D): **MEDIUM** — strategies are well-grounded in CSS spec, but selection depends on browser diagnosis not yet performed. Plan tasks must include the diagnostic step before choosing.
- View-switch stale-layout (CAL-FIX-02): **MEDIUM** — likely caused by re-mount path; if memoization fixes don't resolve, the `key={view-isByStaff}` remount is the documented escalation.
- Pitfall 5 (gutter vs day-slot height mismatch): **MEDIUM** — credible but not yet measured.

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (RBC 1.19.4 is stable; major-version bumps would invalidate library-internals findings)
