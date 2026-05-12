---
phase: 32
slug: calendar-harmony-retry-queue
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript type-check (`npm run check`) + manual admin panel verification |
| **Config file** | tsconfig.json |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green + admin sync panel visible
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 32-01-01 | 01 | 1 | SYNC-01/02/03 | type-check | `npm run check` | ⬜ pending |
| 32-01-02 | 01 | 1 | SYNC-01/02/03 | type-check | `npm run check` | ⬜ pending |
| 32-02-01 | 02 | 2 | SYNC-01 | type-check | `npm run check` | ⬜ pending |
| 32-02-02 | 02 | 2 | SYNC-02/03 | type-check | `npm run check` | ⬜ pending |
| 32-03-01 | 03 | 3 | SYNC-04/05/06 | type-check | `npm run check` | ⬜ pending |
| 32-03-02 | 03 | 3 | SYNC-07 | type-check | `npm run check` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no new test framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Creating a booking enqueues 3 jobs (GHL contact, GHL appointment, GCal) | SYNC-01 | Requires DB inspection | Create booking, query calendar_sync_queue WHERE booking_id=X, verify 3 rows |
| Worker processes pending jobs and marks success/failed | SYNC-02 | Requires live worker trigger | Call POST /api/cron/calendar-sync manually, check queue status updates |
| Stale-row reaper updates in_progress rows older than 10min | SYNC-03 | Requires time manipulation | Set a row to in_progress with old timestamp, trigger worker, verify it's reset |
| Admin sync health panel shows pending/failed counts | SYNC-04 | Browser inspection | Open admin → Integrations → Calendar Sync, verify counts render |
| Admin retry button re-queues failed job | SYNC-05 | Browser + DB inspection | Fail a job, click retry in admin, verify row status resets to pending |
| Banner appears after 10+ consecutive failures | SYNC-06 | Browser inspection | Seed 10 failed_permanent rows for same target, reload admin, verify banner |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
