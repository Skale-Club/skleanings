---
phase: 31
slug: branded-transactional-email-via-resend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript type-check (`npm run check`) + manual email verification |
| **Config file** | tsconfig.json |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green + manual email receipt verified
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 31-01-01 | 01 | 1 | EMAIL-01 | type-check | `npm run check` | ⬜ pending |
| 31-01-02 | 01 | 1 | EMAIL-01 | type-check | `npm run check` | ⬜ pending |
| 31-02-01 | 02 | 2 | EMAIL-02/03/04/05 | type-check | `npm run check` | ⬜ pending |
| 31-02-02 | 02 | 2 | EMAIL-02/03/04 | type-check | `npm run check` | ⬜ pending |
| 31-03-01 | 03 | 3 | EMAIL-01 | type-check | `npm run check` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no new test framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirmation email received < 60s | EMAIL-02 | Requires live email delivery | Create booking with Resend configured, verify inbox within 60s |
| Reminder email received ~24h before | EMAIL-03 | Requires cron trigger + time | Trigger cron manually with booking scheduled in near future |
| Cancellation email received immediately | EMAIL-04 | Requires live email delivery | Cancel a booking via admin, verify inbox immediately |
| Templates show logo, name, brand colors | EMAIL-05 | Visual inspection | Open email in real client (Gmail/Outlook), verify brand elements |
| Admin test-send button works | EMAIL-01 | Requires Resend API key | Enter valid API key, click test-send, verify inbox |
| DNS pre-flight: Resend domain verified | EMAIL-01 | External DNS propagation | Verify green DKIM + SPF in Resend dashboard before production deploy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
