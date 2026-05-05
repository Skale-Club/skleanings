# Phase 20: Calendar Timeline & Structure Audit — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 20-calendar-timeline-structure-audit
**Areas presented:** Audit scope & refactor depth, Verification methodology, View-switch state hygiene, Folded todo: extract booking dialog

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Audit scope & refactor depth | Strict bug-fix vs structural refactor; changes plan size by 3-5x | (deferred to Claude) |
| Verification methodology | Manual zoom matrix vs automated visual regression; new bar after Phase 18 regression | (deferred to Claude) |
| View-switch state hygiene | Bound the reset behavior on view switch (filters, scroll, drag, resourceProps, gcalBusy) | (deferred to Claude) |
| Folded todo: extract booking dialog | Fold the pending "Unify booking modal" todo into Phase 20 or defer to Phase 21 | (deferred to Claude) |

**User's choice:** "do what is needed"

**Notes:** User declined to drill into individual gray areas and delegated implementation-shape decisions to Claude. Per REQUIREMENTS.md the scope is explicitly narrow ("timeline alignment + structural correctness", performance/mobile/behavior changes are out-of-scope for v3.1 if needed), so all four areas were resolved with conservative defaults aligned to that constraint:

- **Audit scope:** Investigation-first, fix only what's needed for CAL-FIX-01 through -04. Document deferred structural debt without proactively refactoring.
- **Verification methodology:** Manual UAT matching Phase 19's pattern. Defined zoom matrix (75/100/125%) and view matrix (Day, Week, Day+ByStaff). No automated visual regression introduced.
- **View-switch state hygiene:** Reset RBC layout cache + drag state + gcalBusy refetch (already wired). Persist hiddenStaff/hiddenStatuses/currentDate. Prefer `key`-based remount if cleaner than current useEffect.
- **Folded todo:** Deferred to Phase 21. Booking-modal extraction is feature/entry-point work, not alignment work.

---

## Claude's Discretion

User explicitly delegated the following sub-decisions to Claude (see CONTEXT.md `<decisions>` → "Claude's Discretion" section):

- Whether to add `key={view-isByStaff}` for forced remount
- Exact CSS adjustments to `.rbc-label` if Phase 18 fix regressed
- Whether the on-mount `setCurrentView` useEffect (line ~933) should be removed
- Whether `resourceProps` should be `useMemo`'d
- Opportunistic small extractions (EventComponent, MetricCard, FilterPill) only if they reduce coupling that contributes to staleness

## Deferred Ideas

- Extract Create Booking modal into shared component (Phase 21+)
- Full decomposition of 1556-line `AppointmentsCalendarSection.tsx` (future "Calendar Decomposition" phase)
- Performance / mobile / drag-to-resize / per-staff capability matrix / Week+ByStaff (carried forward from Phase 19 deferred list — remain deferred)
