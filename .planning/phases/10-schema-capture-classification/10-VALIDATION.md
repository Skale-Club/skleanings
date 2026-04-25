---
phase: 10
slug: schema-capture-classification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual curl + TypeScript type check only |
| **Config file** | none (no test framework configured) |
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| Schema definitions | 01 | 1 | CAPTURE-01–06, ATTR-03 | type-check | `npm run check` | ⬜ pending |
| Supabase migration | 01 | 1 | CAPTURE-01 | file-exists | `ls supabase/migrations/*utm*.sql` | ⬜ pending |
| Traffic classifier | 02 | 1 | CAPTURE-04 | type-check + manual | `npm run check` | ⬜ pending |
| Storage function | 02 | 2 | CAPTURE-05, CAPTURE-06 | type-check | `npm run check` | ⬜ pending |
| Session endpoint | 03 | 2 | CAPTURE-01, CAPTURE-02, CAPTURE-03 | manual curl | see below | ⬜ pending |
| useUTMCapture hook | 03 | 2 | CAPTURE-02 | type-check | `npm run check` | ⬜ pending |
| Route registration | 03 | 2 | CAPTURE-01 | build | `npm run build` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No test framework to install. Existing infrastructure covers:
- TypeScript type checking via `npm run check`
- Build verification via `npm run build`

Manual verification protocol (see below) covers behavioral assertions.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UTM session created with correct fields | CAPTURE-01 | No automated API test harness | `curl -X POST http://localhost:5000/api/analytics/session -H "Content-Type: application/json" -d '{"visitorId":"test-uuid","utmSource":"google","utmMedium":"cpc","utmCampaign":"test","landingPage":"/","referrer":"https://google.com"}'` — expect `{"sessionId":"...", "isNew":true}` |
| First-touch immutability on re-POST | CAPTURE-05 | No automated DB assertion | POST same visitorId with different UTMs → check DB: first_* columns unchanged, last_* columns updated |
| Organic search classification | CAPTURE-04 | Classification logic | POST with no UTMs + referrer "https://www.google.com/search?q=cleaning" → expect traffic_source "organic_search" in DB row |
| Direct traffic classification | CAPTURE-04 | Classification logic | POST with no UTMs + no referrer → expect traffic_source "direct" in DB row |
| Social classification | CAPTURE-04 | Classification logic | POST with no UTMs + referrer "https://www.facebook.com" → expect traffic_source "social" in DB row |
| Lowercase normalization | CAPTURE-03 | DB read required | POST with utmSource "Google" → check DB row has utm_source "google" |
| Last-touch preserved on direct return | D-02 (CONTEXT) | Logic branch | POST with UTMs → then POST same visitorId with no UTMs and no referrer → check DB: last_utm_source unchanged from first POST |
| DEV guard active | D-05 (CONTEXT) | Dev environment required | In dev, open browser DevTools → Network tab → confirm no POST to /api/analytics/session fires on page load |
| Supabase migration applies | CAPTURE-01 | DB required | Run migration → confirm visitor_sessions and conversion_events tables exist in Supabase dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `npm run check` passing after each wave
- [ ] Supabase migration file exists and applies cleanly
- [ ] Manual curl tests produce expected responses
- [ ] First-touch immutability confirmed via manual DB check
- [ ] Traffic classifier manual tests pass for organic, social, direct, paid cases
- [ ] No 3 consecutive tasks without some verification (type-check counts)
- [ ] `nyquist_compliant: true` set in frontmatter when all boxes checked

**Approval:** pending
