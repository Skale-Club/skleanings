---
phase: 27
slug: recurring-bookings-schema-and-cron
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 27 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript type check (npm run check) + curl for cron endpoint |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check && npm run build` |
| **Estimated runtime** | ~15 seconds |

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 27-01-01 | 01 | 1 | RECUR-01 | migration file | `test -f supabase/migrations/*recurring_bookings*` | ⬜ pending |
| 27-01-02 | 01 | 1 | RECUR-01 | type-check | `npm run check` | ⬜ pending |
| 27-02-01 | 02 | 2 | RECUR-01, RECUR-02 | type-check | `npm run check` | ⬜ pending |
| 27-02-02 | 02 | 2 | RECUR-02 | type-check | `npm run check` | ⬜ pending |
| 27-03-01 | 03 | 3 | RECUR-02 | type-check | `npm run check` | ⬜ pending |
| 27-03-02 | 03 | 3 | RECUR-02 | file + type | `test -f .github/workflows/recurring-bookings-cron.yml && npm run check` | ⬜ pending |

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cron endpoint returns { processed, created, errors } | RECUR-02 | Requires running server + DB with active subscriptions | POST /api/cron/generate-recurring with Bearer token; check response JSON |
| Generated bookings appear in admin calendar | RECUR-02 | Requires browser + seeded subscription | Seed a recurring_bookings row with next_booking_date = today; call cron endpoint; verify booking in admin |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify
- [ ] No 3 consecutive tasks without automated verify
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
