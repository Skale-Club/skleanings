---
phase: 20
slug: calendar-timeline-structure-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-05
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

> **Source:** `20-RESEARCH.md` § Validation Architecture (lines 536–571). This file is the canonical validation gate.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None for this phase — manual UAT only (CONTEXT.md D-08: "No automated visual regression tooling introduced") |
| **Config file** | n/a |
| **Quick run command** | `npm run check` (TypeScript type check — must pass after any source edit) |
| **Full suite command** | `npm run check && npm run build` (type check + build to verify no broken imports) |
| **Estimated runtime** | ~30 seconds for `npm run check`; ~60 seconds for full build |

---

## Sampling Rate

- **After every task commit:** Run `npm run check` (TypeScript safety net for any source edit)
- **After every plan wave:** Run `npm run check && npm run build`
- **Before `/gsd:verify-work`:** All entries in `20-HUMAN-UAT.md` must be marked PASS by human reviewer; Phase 19 UAT regression check must pass
- **Max feedback latency:** ~30 seconds (type check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD-01-01 | 01 | 0 | (Wave 0 setup) | n/a (file creation) | `test -f .planning/phases/20-calendar-timeline-structure-audit/20-HUMAN-UAT.md` | ❌ W0 | ⬜ pending |
| TBD-01-02 | 01 | 0 | (Wave 0 setup) | n/a (file creation) | `test -f .planning/phases/20-calendar-timeline-structure-audit/20-DIAGNOSIS.md` | ❌ W0 | ⬜ pending |
| TBD-01-03 | 01 | 0 | CAL-FIX-01, -02, -03 | manual-only | DevTools `getBoundingClientRect` measurements logged in DIAGNOSIS.md | ❌ W0 | ⬜ pending |
| TBD-02-01 | 02 | 1 | CAL-FIX-02, -04 | automated | `npm run check` (must pass after source edits) | ✅ | ⬜ pending |
| TBD-03-01 | 03 | 2 | CAL-FIX-01 | manual-only | Re-measure with same DevTools snippet; compare against Wave 0 baseline | ❌ W0 | ⬜ pending |
| TBD-04-01 | 04 | 3 | CAL-FIX-01, -02, -03, -04 | manual-only | Human UAT entries in `20-HUMAN-UAT.md` marked PASS | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Task IDs are placeholders — gsd-planner will assign real IDs based on the wave breakdown.*

---

## Wave 0 Requirements

- [ ] `.planning/phases/20-calendar-timeline-structure-audit/20-HUMAN-UAT.md` — UAT entry per CAL-FIX requirement with explicit pass criteria (mirrors Phase 19's UAT format, captures the zoom × view matrix from CONTEXT.md D-05/D-06)
- [ ] `.planning/phases/20-calendar-timeline-structure-audit/20-DIAGNOSIS.md` — capture diagnosis-pass findings before writing fix tasks. Per CONTEXT.md D-01 the plan opens with diagnosis; documenting findings as a separate artifact creates a persistent reference and a reviewable boundary between investigation and fix.
- [ ] No automated test framework setup needed — pure manual UAT phase

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Time gutter labels align with grid line at zero pixel offset across Day/Week/By Staff at 75/100/125% browser zoom | CAL-FIX-01 | Pixel alignment is inherently visual; project's narrow scope explicitly rejects automated visual regression tooling | Open admin calendar; for each (view × zoom) cell of the matrix, run the DevTools `getBoundingClientRect` snippet from `20-RESEARCH.md` § Diagnostic Snippet on `.rbc-label` and the corresponding `.rbc-timeslot-group` top; record offset; pass = 0 px ± 1 px subpixel rounding; fail = > 1 px |
| Switching Month → Week → Day → By Staff → Week → Month leaves no stale layout (gutter widths, header positions, event placements re-render correctly without manual reload) | CAL-FIX-02 | View-switch stale state is a visual-spatial property; cannot be asserted via grep/test | Walk through the view sequence in one continuous browser session; after each transition: (a) inspect `.rbc-time-gutter` width is consistent, (b) inspect `.rbc-header` row positions match `.rbc-day-slot` columns, (c) verify event blocks sit within their slot boundaries, (d) confirm no manual page reload was needed; pass = all 4 visual checks pass at every transition |
| By Staff renders one column per visible staff after fix; horizontal scroll preserved for 5+ staff; switching staff filters re-renders columns correctly | CAL-FIX-03 | Multi-column layout + horizontal scroll behavior is visual | With 5+ staff visible, enter By Staff view: (a) confirm one column per visible staff, (b) confirm horizontal scrollbar appears on `.appointments-calendar-shell__board`, (c) toggle a staff filter — column should be added/removed without page reload, (d) confirm gutter remains sticky at left during horizontal scroll; pass = all 4 |
| Phase 19 UAT items still pass — drag-to-reassign with undo toast, QuickBook walk-in modal, GCal busy block guard, By Staff column layout, customer per-staff badges | CAL-FIX-04 | Re-runs the existing 5 manual UAT items in `19-HUMAN-UAT.md` | Walk through each of the 5 items in `.planning/phases/19-receptionist-booking-flow-multi-staff-view/19-HUMAN-UAT.md` exactly as written; pass = all 5 still pass identically to Phase 19 acceptance |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify command OR Wave 0 dependency to a manual UAT entry
- [ ] Sampling continuity: every task that edits source code runs `npm run check` (no 3 consecutive code-edit tasks without type check)
- [ ] Wave 0 covers `20-HUMAN-UAT.md` and `20-DIAGNOSIS.md` creation
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s for automated checks
- [ ] `nyquist_compliant: true` set in frontmatter once gsd-planner has assigned real task IDs and confirmed each task maps to either an automated command or a UAT entry

**Approval:** pending (gsd-planner will finalize task IDs in Step 8)
