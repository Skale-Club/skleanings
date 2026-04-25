# Phase 13: Visitor Journey & GHL Sync — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 13-visitor-journey-ghl-sync
**Mode:** --auto (all areas auto-selected, recommended defaults chosen)
**Areas discussed:** Conversions tab, Visitor Journey entry point, Dimension filters scope, GHL custom fields, GHL sync trigger

---

## Conversions Tab

| Option | Description | Selected |
|--------|-------------|----------|
| 4th tab in MarketingSection | Consistent with existing tab pattern, no new routes | ✓ |
| Separate page/route | More screen space, requires router changes | |

**Auto-selected:** 4th tab in MarketingSection

**De-duplication decision:**

| Option | Description | Selected |
|--------|-------------|----------|
| last_touch rows only | Consistent with Overview, no confusing duplicates | ✓ |
| Both rows (first+last) | Shows both attribution models, doubles row count per booking | |

**Auto-selected:** last_touch only

---

## Visitor Journey Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-over from Conversions row | Natural drill-down, no navigation change | ✓ |
| Separate "Sessions" list view | More browsable but adds new navigation surface | |
| Link from Sources/Campaigns rows | Harder to pinpoint — sessions don't map 1:1 to rows | |

**Auto-selected:** Slide-over panel (shadcn Sheet) triggered by Conversions row click

---

## Dimension Filters Scope (FILTER-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Conversions tab only | Source dropdown satisfies FILTER-02, no retrofitting needed | ✓ |
| All 4 tabs | More powerful but adds query params to 3 already-complete tabs | |

**Auto-selected:** Conversions tab only (source + date)

---

## GHL Custom Fields

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed field keys (admin configures once in GHL) | Simple, no API discovery call, no new settings UI | ✓ |
| Auto-discover field IDs via GHL API | More robust but requires extra API call per sync | |
| New settings UI for field mapping | Most flexible but out of scope for Phase 13 | |

**Auto-selected:** Fixed keys: utm_first_source, utm_first_campaign, utm_last_source, utm_last_campaign

---

## GHL Sync Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Piggyback on syncBookingToGhl | Already fires in webhook, fire-and-forget, zero new wiring | ✓ |
| Separate webhook handler | Clean separation but duplicate trigger logic | |
| On booking_completed event recording | Later in flow, may miss webhook-only path | |

**Auto-selected:** Inside syncBookingToGhl, after contact found/created, fire-and-forget

---

## Claude's Discretion

- Exact SQL queries for conversions and session endpoints
- Loading skeleton implementation details
- Responsive column widths in Conversions table
- "Load more" button vs link styling

## Deferred Ideas

- Dimension filters on existing Overview/Sources/Campaigns tabs
- GHL field auto-discovery API
- CSV export
