---
phase: 18
slug: admin-calendar-improvements
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-30
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no vitest/jest/test directory in project |
| **Config file** | none |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check` + visual browser verification
- **Before `/gsd:verify-work`:** `npm run check` green + all 6 manual acceptance criteria met

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | CAL-01 | manual | `npm run check` | ✅ | ⬜ pending |
| 18-01-02 | 01 | 1 | CAL-02 | manual | `npm run check` | ✅ | ⬜ pending |
| 18-02-01 | 02 | 1 | CAL-03 | manual | `npm run check` | ✅ | ⬜ pending |
| 18-02-02 | 02 | 1 | CAL-04 | manual | `npm run check` | ✅ | ⬜ pending |
| 18-03-01 | 03 | 2 | CAL-05 | manual | `npm run check` | ✅ | ⬜ pending |
| 18-03-02 | 03 | 2 | CAL-06 | manual | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

*No test files to create — project has no automated test framework. `npm run check` (TypeScript) is the only automated gate. All 6 requirements are verified manually in the browser.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `.rbc-label` aligns with grid line | CAL-01 | Visual CSS alignment, no DOM assertion available | Open admin calendar on a day with appointments; verify time labels sit flush with horizontal grid lines |
| Modal ≥600px at >768px viewport | CAL-02 | Layout measurement, no automated width assertion | Open Create Booking modal on desktop; inspect element or visually confirm modal is significantly wider than before |
| Multiple services added + submitted | CAL-03 | Form interaction + submission flow | Click calendar slot → click "+ Add service" twice → set different services + quantities → submit → verify booking created with both items |
| Manual end time override persists on submit | CAL-04 | Form state interaction | Add a service (auto-fills end time) → manually type a different end time → submit → confirm booking reflects the typed time |
| Address field shows/hides per model | CAL-05 | Depends on companySettings value at runtime | Set `serviceDeliveryModel = at-customer` in admin → open modal → address field visible. Set `customer-comes-in` → open modal → address field hidden |
| Brand yellow submit button present | CAL-06 | Visual style verification | Open Create Booking modal → confirm submit button is yellow (#FFFF01), black bold text, full-width, pill-shaped |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
