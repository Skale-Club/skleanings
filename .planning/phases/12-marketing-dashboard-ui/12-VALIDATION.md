---
phase: 12
slug: marketing-dashboard-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — TypeScript type check + manual browser |
| **Config file** | none |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green + browser smoke test
- **Max feedback latency:** ~15 seconds automated; browser verification manual

---

## Wave 0 Requirements

**CRITICAL — must happen before any other wave:**
- `AdminSection` union type in `shared/types.ts` (or wherever defined) must include `| 'marketing'`
- Without this `npm run check` fails for all Phase 12 files

---

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Automated | Status |
|------|------|------|-------------|-----------|--------|
| AdminSection type + analytics-display.ts | 12-01 | 0 | UX-01 | `npm run check` | ⬜ pending |
| GET /api/analytics/overview endpoint | 12-01 | 1 | OVERVIEW-01–04 | `npm run check` | ⬜ pending |
| GET /api/analytics/sources endpoint | 12-01 | 1 | SOURCES-01–04 | `npm run check` | ⬜ pending |
| GET /api/analytics/campaigns endpoint | 12-01 | 1 | CAMP-01–04 | `npm run check` | ⬜ pending |
| MarketingSection shell + date filter + tabs | 12-02 | 2 | FILTER-01–03, UX-01 | `npm run check` | ⬜ pending |
| MarketingOverviewTab | 12-02 | 2 | OVERVIEW-01–05 | `npm run check` | ⬜ pending |
| MarketingSourcesTab | 12-03 | 3 | SOURCES-01–04 | `npm run check` | ⬜ pending |
| MarketingCampaignsTab | 12-03 | 3 | CAMP-01–04 | `npm run check` | ⬜ pending |
| Admin.tsx sidebar + section registration | 12-02 | 2 | UX-01 | `npm run check && npm run build` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Marketing section visible in admin sidebar | UX-01 | Browser required | Log into admin → confirm "Marketing" appears in sidebar |
| Overview tab loads with KPI cards | OVERVIEW-01 | DB + browser required | Open Marketing → Overview tab → verify 4 KPI cards render |
| Empty state shows (no migration) | OVERVIEW-05 | Browser required | Without migration applied → verify empty state copy shown |
| Date preset changes update all tabs | FILTER-01 | Browser required | Change date to "Last 7 days" → confirm all 3 tabs update |
| Sources table shows Direct/Unknown always | SOURCES-03 | DB + browser required | Open Sources tab → Direct/Unknown rows present with tooltip |
| "No bookings yet" text on zero campaigns | CAMP-02 | DB + browser required | Campaign with traffic + 0 bookings → verify "No bookings yet" text |
| All labels business-friendly (no raw UTMs) | UX-02 | Browser visual review | Scan all tabs — no "utm_source", "utm_medium" etc. visible |

---

## Validation Sign-Off

- [ ] AdminSection type includes 'marketing' — `npm run check` passes
- [ ] All GET endpoints return 200 with empty data when migration not applied
- [ ] Marketing section accessible from admin sidebar
- [ ] Empty states render correctly on all tabs
- [ ] `nyquist_compliant: true` set in frontmatter when all boxes checked

**Approval:** pending
