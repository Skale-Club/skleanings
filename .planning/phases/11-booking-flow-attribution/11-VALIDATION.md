---
phase: 11
slug: booking-flow-attribution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — TypeScript type check + manual curl/browser |
| **Config file** | none |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Automated | Status |
|------|------|------|-------------|-----------|--------|
| linkBookingToAttribution + recordConversionEvent storage | 11-01 | 1 | ATTR-01, EVENTS-01 | `npm run check` | ⬜ pending |
| POST /api/analytics/events endpoint | 11-01 | 1 | EVENTS-02, EVENTS-03 | `npm run check` | ⬜ pending |
| BookingPage visitorId + booking_started | 11-02 | 2 | ATTR-02, EVENTS-02, EVENTS-04 | `npm run check` | ⬜ pending |
| bookings.ts linkage + conversion write | 11-02 | 2 | ATTR-01, EVENTS-01, EVENTS-04 | `npm run check` | ⬜ pending |
| payments.ts checkout visitorId + webhook conversion | 11-02 | 2 | ATTR-02, EVENTS-01 | `npm run check` | ⬜ pending |
| ChatWidget chat_initiated event | 11-03 | 3 | EVENTS-03, EVENTS-04 | `npm run check` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

**Migration gate:** visitor_sessions, conversion_events tables and bookings.utm_session_id must exist in the database before Phase 11 integration tests can run. DB tables are pending POSTGRES_URL_NON_POOLING (see STATE.md blocker). Code can be written before migration is applied; integration testing requires it.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Direct booking links utm_session_id on booking row | ATTR-01 | DB required | Make booking with UTM tag → check bookings.utm_session_id populated → check 2 rows in conversion_events |
| Stripe booking attribution survives redirect | ATTR-02 | Stripe + DB required | Click UTM link → book with Stripe → check booking row has utm_session_id after webhook fires |
| Duplicate prevention (webhook + confirmation race) | ATTR-03 | DB unique constraint check | Manually trigger both paths → confirm exactly 2 rows (not 4) in conversion_events |
| booking_started fires without blocking page load | EVENTS-02 | Browser DevTools | Load BookingPage → Network tab → confirm POST to /api/analytics/events fires fire-and-forget |
| visitorId missing — booking succeeds | EVENTS-04 | Browser DevTools | Clear localStorage → make booking → confirm booking created, no errors |

---

## Validation Sign-Off

- [ ] All tasks have `npm run check` passing after each wave
- [ ] Manual integration tests pass (after migration applied)
- [ ] visitorId missing test — booking completes without error
- [ ] `nyquist_compliant: true` set in frontmatter when all boxes checked

**Approval:** pending
