# Phase 13: Visitor Journey & GHL Sync — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a **Conversions tab** (4th tab in MarketingSection) listing all conversion events with source filter + date filter. Add a **Visitor Journey slide-over panel** accessible by clicking any Conversions row. Extend GHL sync to write first/last-touch UTM data to GHL contact custom fields.

Requirements in scope: CONV-01, CONV-02, CONV-03, JOUR-01, JOUR-02, GHL-01, GHL-02, FILTER-02.

**Not in scope:** New admin pages/routes, new GHL settings UI, changing existing Overview/Sources/Campaigns tabs.

</domain>

<decisions>
## Implementation Decisions

### Conversions Tab (CONV-01, CONV-02, CONV-03)

- **D-01:** Add a 4th tab to `MarketingSection` — **Conversions** — after Campaigns. Tab order: Overview → Sources → Campaigns → Conversions.
- **D-02:** The Conversions list shows **last_touch rows only** from `conversion_events`. Rationale: `recordConversionEvent` writes 2 rows per booking (first_touch + last_touch). Showing both would display 2 rows per booking and confuse non-technical users. The Overview tab already uses last_touch as its source of truth — this keeps the whole dashboard consistent.
- **D-03:** Table columns: **Event** (human label: "Booking Completed", "Booking Started", "Chat Initiated"), **Source**, **Campaign**, **Landing Page**, **Value** (booking value or "—" for non-revenue events), **Time** (relative: "2 hours ago"), **Attribution** badge ("Last Touch"). Clicking any row opens the Visitor Journey slide-over.
- **D-04:** Conversions tab has its own filters: **Source** dropdown (all unique sources seen in data + "All sources" default) and the **global date range** inherited from MarketingSection parent. The source dropdown is the FILTER-02 dimension filter — scoped to Conversions tab only, not applied retroactively to Overview/Sources/Campaigns. Those tabs already present data grouped by dimension, so a dropdown filter there would be redundant.
- **D-05:** Pagination: **load 50 rows**, "Load more" button at bottom (no infinite scroll — simpler, consistent with table pattern in the codebase). Query: `GET /api/analytics/conversions?from=&to=&source=&limit=50&offset=0`.

### Visitor Journey (JOUR-01, JOUR-02)

- **D-06:** Journey is a **slide-over panel** (shadcn `Sheet` component, `side="right"`) triggered by clicking a row in the Conversions table. No new route, no new page — consistent with how booking detail is shown in BookingsSection (inline expansion, not navigation).
- **D-07:** Journey panel shows the full `visitor_sessions` row for the conversion's `visitor_id`:
  - **First Touch block:** first_traffic_source (display name), first_utm_source, first_utm_campaign, first_utm_medium, first_landing_page, first_seen_at
  - **Last Touch block:** last_traffic_source (display name), last_utm_source, last_utm_campaign, last_utm_medium, last_landing_page, last_seen_at
  - **Session stats:** visit_count, total_bookings, converted_at
  - **Influence indicator:** If first_traffic_source === last_traffic_source AND first_utm_campaign === last_utm_campaign → show "Same source, single touch". Otherwise → show "Multi-touch: [first source] → [last source]" in a highlighted summary row. This satisfies JOUR-02.
  - **Conversion event** at the bottom: the clicked event (type, value, time).
- **D-08:** If `visitor_id` is null on the conversion event (anonymous/untracked session) → panel shows "No session data available for this event. Attribution was not captured for this conversion."

### GET /api/analytics/conversions Endpoint

- **D-09:** New endpoint: `GET /api/analytics/conversions?from=&to=&source=&limit=&offset=`. Returns `ConversionEventRow[]`:
  ```
  {
    id, eventType, source, campaign, landingPage, bookingValue,
    occurredAt, bookingId, visitorId, attributionModel
  }
  ```
  Filters: `attributionModel = 'last_touch'` always applied (D-02). Optional `source` filter (WHERE `attributed_source = :source`). Date range filter on `occurred_at`. Protected by `requireAdmin`.
- **D-10:** Companion endpoint `GET /api/analytics/session/:visitorId` returns the full `visitor_sessions` row for the journey panel. Protected by `requireAdmin`. Returns 404 if not found.

### GHL UTM Sync (GHL-01, GHL-02)

- **D-11:** Write four UTM values to GHL contact custom fields on booking confirmed: `utm_first_source`, `utm_first_campaign`, `utm_last_source`, `utm_last_campaign`. These are the field **keys** that must be configured in GHL — admin creates custom fields with these exact keys once. No new admin settings UI in Phase 13.
- **D-12:** Implementation: extend `updateGHLContact` in `server/integrations/ghl.ts` to accept an optional `customFields?: Array<{ key: string; value: string }>` parameter. The GHL API accepts custom fields as `{ customFields: [{ id: "...", value: "..." }] }` — but looking up field IDs by key requires a separate API call. Simpler approach: pass the field **key** directly (GHL API v2021-07-28 accepts `key` as an alternate to `id` in `customFields` array).
- **D-13:** Sync fires inside `syncBookingToGhl` in `server/lib/booking-ghl-sync.ts`, after the contact is found/created. It's **fire-and-forget** — a failed custom field write never fails the booking or the main GHL contact sync. Attribution data is supplementary; the contact and appointment creation are primary.
- **D-14:** To get the UTM data for the sync: join `bookings.utm_session_id` → `visitor_sessions` to fetch first/last UTM fields. This join is done inside `syncBookingToGhl` using the existing `storage` layer.
- **D-15:** If `utm_session_id` is null on the booking (anonymous visitor), skip the custom field write entirely — log a debug line and return. Never fail the sync.

### Claude's Discretion

- Exact SQL for `GET /api/analytics/conversions` — use Drizzle ORM, order by `occurred_at DESC`.
- Loading skeleton and error states in journey panel — use shadcn Skeleton.
- Exact column widths and responsive breakpoints in Conversions table.
- Whether to show "Load more" as a button or a subtle link — either works.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Marketing Components (Phase 12)
- `client/src/components/admin/MarketingSection.tsx` — parent component with date filter state, tab switching pattern, how props flow to tab components
- `client/src/components/admin/marketing/MarketingOverviewTab.tsx` — useQuery pattern, empty state pattern, brand color usage
- `client/src/components/admin/marketing/MarketingSourcesTab.tsx` — table pattern (columns, sorting, shadcn Table usage)
- `client/src/lib/analytics-display.ts` — `getSourceDisplayName`, `formatConversionRate`, `formatRevenue` — MUST use these, do not duplicate

### Analytics Backend (Phases 10–12)
- `server/routes/analytics.ts` — existing GET endpoints pattern + requireAdmin import path (`../lib/auth`)
- `server/storage/analytics.ts` — existing storage functions, Drizzle import pattern, 42P01 safety pattern, `last_touch` filter pattern
- `shared/schema.ts` — `conversionEvents` and `visitorSessions` table columns (exact Drizzle field names)

### GHL Integration
- `server/integrations/ghl.ts` — `updateGHLContact` (line 476) needs `customFields` extension; `withRetry` and `ghlFetch` patterns to follow
- `server/lib/booking-ghl-sync.ts` — `syncBookingToGhl` is where UTM sync fires; existing fire-and-forget pattern

### Requirements
- `.planning/REQUIREMENTS.md` §Conversions View (CONV-01–03), §Visitor Journey (JOUR-01–02), §GoHighLevel UTM Sync (GHL-01–02), §Filters & Date Ranges (FILTER-02)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shadcn Sheet` component — available for the journey slide-over panel (side="right")
- `shadcn Table` — already used in Sources and Campaigns tabs; same pattern for Conversions
- `getSourceDisplayName` from `analytics-display.ts` — use for source column display names
- `formatRevenue` from `analytics-display.ts` — use for booking value column
- `useQuery` (React Query) — established pattern in all three existing tab components
- `requireAdmin` from `../lib/auth` — CRITICAL: must use this path, not `../middleware/auth`

### Established Patterns
- **Tab switching:** `useState<'overview'|'sources'|'campaigns'>` in MarketingSection — extend to include `'conversions'`
- **Date filter:** global `DateRange` state passed as prop to each tab component — pass same props to ConversionsTab
- **Empty states:** Two variants — "no data yet" (migration pending) and "no data for period" — build before table
- **42P01 safety:** All storage functions catch `err.code === '42P01'` → return empty array/shape
- **Double-count prevention:** All booking count queries filter `attributionModel = 'last_touch'`

### Integration Points
- `MarketingSection.tsx` — add `'conversions'` to tab union type and render block
- `server/routes/analytics.ts` — add `GET /conversions` and `GET /session/:visitorId` endpoints
- `server/storage/analytics.ts` — add `getConversionsData` and `getVisitorSession` storage functions
- `server/lib/booking-ghl-sync.ts` — extend to call UTM custom field write after contact sync
- `server/integrations/ghl.ts` — extend `updateGHLContact` to accept `customFields` parameter

</code_context>

<specifics>
## Specific Ideas

- Journey panel "influence indicator" (D-07): single-touch vs multi-touch summary at the top of the panel — plain language, not technical field names.
- GHL custom field keys are fixed strings: `utm_first_source`, `utm_first_campaign`, `utm_last_source`, `utm_last_campaign` — admin configures these in GHL once, no settings UI needed.
- FILTER-02 satisfied by source dropdown on Conversions tab only — not backfilled to existing tabs.

</specifics>

<deferred>
## Deferred Ideas

- Dimension filters on Overview/Sources/Campaigns tabs — would require query param threading through 3 existing views; deferred to a potential Phase 14 polish phase if needed.
- GHL custom field discovery API — auto-finding field IDs by key via `GET /locations/{id}/customFields`; deferred in favor of fixed key approach (simpler, no additional API call needed).
- Export to CSV — separate v2 requirement (EXPORT-V2-01), not in Phase 13.
- Real-time event streaming — out of scope (React Query polling is sufficient).

</deferred>

---

*Phase: 13-visitor-journey-ghl-sync*
*Context gathered: 2026-04-25*
