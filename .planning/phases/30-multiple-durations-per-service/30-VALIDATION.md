---
phase: 30
slug: multiple-durations-per-service
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript type-check (`npm run check`) + manual browser verification |
| **Config file** | tsconfig.json |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 30-01-01 | 01 | 1 | DUR-01/02 | type-check | `npm run check` | ⬜ pending |
| 30-01-02 | 01 | 1 | DUR-05/06 | type-check | `npm run check` | ⬜ pending |
| 30-02-01 | 02 | 2 | DUR-03/04 | type-check + manual | `npm run check` | ⬜ pending |
| 30-02-02 | 02 | 2 | DUR-04 | manual browser | n/a | ⬜ pending |
| 30-03-01 | 03 | 3 | DUR-06 | type-check | `npm run check` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no new test framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Duration cards appear before calendar when service has durations | DUR-03 | UI render path | Add 2+ durations to a service in admin, open booking flow, verify cards appear in step 3 before calendar |
| Selected duration changes available time slots | DUR-04 | Requires live slot API | Select 2h vs 4h duration, verify different slot grids appear |
| Booking confirmation shows correct duration | DUR-05 | Full flow | Complete a booking with non-default duration, verify bookingItems record has correct durationMinutes |
| Recurring instance uses original duration | DUR-06 | Requires cron trigger | Create recurring booking with 4h, run cron manually, verify generated instance has durationMinutes=240 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
