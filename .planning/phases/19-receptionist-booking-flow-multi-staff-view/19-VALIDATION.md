---
phase: 19
slug: receptionist-booking-flow-multi-staff-view
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-30
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no vitest/jest/test directory in project |
| **Config file** | none |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~15 seconds (check) / ~30 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run build` + visual browser verification
- **Before `/gsd:verify-work`:** `npm run build` green + manual walk-through of all 5 scenarios (By Staff view, Quick Book, drag, polling, BookingPage staff slots)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | D-10, D-02 | manual + build | `npm run check` | ✅ | ⬜ pending |
| 19-01-02 | 01 | 1 | D-04, D-14 | manual + check | `npm run check` | ✅ | ⬜ pending |
| 19-02-01 | 02 | 1 | D-12 | manual + check | `npm run check` | ✅ | ⬜ pending |
| 19-02-02 | 02 | 2 | D-11, D-12 | manual | `npm run check` | ✅ | ⬜ pending |
| 19-03-01 | 03 | 2 | D-05, D-06, D-08, D-09 | manual + check | `npm run check` | ✅ | ⬜ pending |
| 19-04-01 | 04 | 3 | D-15, D-16 | manual | `npm run check` | ✅ | ⬜ pending |
| 19-04-02 | 04 | 3 | — | checkpoint:human-verify | MISSING | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

*No new test files needed — project has no automated test framework. `npm run check` (TypeScript) and `npm run build` are the automated gates. All behavior requirements are verified manually in the browser.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| By Staff view shows one column per staff | D-02 | Visual column layout | Open admin Calendar → click "By Staff" → confirm one column per visible staff member in Day view |
| Column slot click pre-fills staff | D-04 | Form pre-fill interaction | Click a slot in Maria's column → Quick Book opens with Maria pre-filled |
| Drag appointment to different staff column | D-11 | Drag-and-drop interaction | Drag an event from Alex's column to Maria's → booking updates staff |
| Drag appointment to different time | D-11 | Time change interaction | Drag an event within a column to a new time → booking updates time |
| Undo toast appears and reverts | D-12 | Toast + API interaction | After drag → toast shows "Undo" → click Undo → booking reverts to original |
| Quick Book submits with correct payload | D-08 | Network request verification | Open Quick Book, fill name + service, submit → check network tab for POST /api/bookings with status=confirmed |
| Customer booking shows per-staff slots | D-16 | Customer-facing flow | Open booking page, add items to cart, proceed → time step shows which staff are available per slot |
| 30s polling refreshes calendar | D-14 | Cross-session test | Open calendar in two windows, create booking in one → second window shows it within 30s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
