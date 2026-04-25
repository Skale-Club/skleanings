# Phase 12: Marketing Dashboard UI — Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md.

**Date:** 2026-04-25
**Phase:** 12-marketing-dashboard-ui
**Areas discussed:** Tab structure, Date filter placement, Zero-conversion campaigns (all auto-recommended)

---

## Tab Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Overview / Sources / Campaigns (3 tabs) | Conversions deferred to Phase 13 | ✓ |
| All 5 tabs in Phase 12 | Include Conversions and Visitor Journey now | |

**Choice:** Recommended default — 3 tabs only.
**Notes:** Auto-selected. Keeps Phase 12 focused. Conversions + Journey belong with Phase 13.

---

## Date Filter Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Global (top of section, all tabs) | One selector affects all views simultaneously | ✓ |
| Per-tab | Each tab has its own date picker | |

**Choice:** Recommended default — global top-of-section.
**Notes:** Auto-selected. Industry standard (Plausible, GA4). Single source of truth is less confusing for non-technical users.

---

## Zero-Conversion Campaigns

| Option | Description | Selected |
|--------|-------------|----------|
| "No bookings yet" muted text | Same table, business-friendly label | ✓ |
| Red/warning badge | Alert styling | |
| Just "0" | No special treatment | |

**Choice:** Recommended default — "No bookings yet" in muted text.
**Notes:** Auto-selected. Business-friendly, not alarming.

---

## Claude's Discretion

- KPI cards: 4-column row (Visitors, Bookings, Conversion Rate, Revenue)
- recharts AreaChart for trend (Visitors blue + Bookings yellow)
- Top Source/Campaign/Landing Page as 3 summary cards under KPIs
- Source display name mapping utility in client/src/lib/analytics-display.ts
- Dimension filters (FILTER-02) deferred — date filter only in Phase 12

## Deferred Ideas

- Dimension filters (source/medium/campaign dropdowns) — too much scope for Phase 12, add in Phase 13 or as a patch
- Period comparison (this vs last period) — v2 requirement
