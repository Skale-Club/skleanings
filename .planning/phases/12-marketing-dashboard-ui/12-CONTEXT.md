# Phase 12: Marketing Dashboard UI — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the `MarketingSection` admin component with three tabs (Overview, Sources, Campaigns), a global date range filter, and full empty states. Add GET endpoints to the analytics router for all three views. Register the section in Admin.tsx sidebar. No new backend storage functions beyond what Phases 10–11 built — Phase 12 is pure GET endpoints + React UI.

Requirements in scope: OVERVIEW-01–05, SOURCES-01–04, CAMP-01–04, FILTER-01–03, UX-01–03.

**Not in scope:** Conversions list view (Phase 13), Visitor Journey view (Phase 13), GoHighLevel sync (Phase 13).

</domain>

<decisions>
## Implementation Decisions

### Tab Structure
- **D-01:** Three tabs in this phase: **Overview**, **Sources**, **Campaigns**. This order — Overview first, Sources second, Campaigns third — answers the business questions in a natural progression ("Where are my leads coming from?" → "Which sources are best?" → "Which campaigns are working?"). Conversions and Visitor Journey are Phase 13.

### Date Filter — Global Placement
- **D-02:** One global date range selector at the top of the `MarketingSection` component, above the tabs. Changing the date filter updates all three tabs simultaneously. State lives in `MarketingSection` and passes as a prop to each tab. This is the standard pattern (Plausible, GA4) and the correct choice for a non-technical user — they should not need to re-set the date for each view.
- **D-03:** Date range presets: **Today**, **Yesterday**, **Last 7 days**, **Last 30 days** (default), **This month**, **Last month**, **Custom** (date picker). The active preset is stored in component state as `{ from: Date, to: Date, preset: string }`.

### Zero-Conversion Campaigns (CAMP-02)
- **D-04:** Campaigns with traffic but zero bookings appear in the same Campaigns table as others. In the Bookings column, instead of "0", show **"No bookings yet"** in muted text. No red badge, no warning icon — non-alarming, business-friendly. A subtitle under the Campaigns tab header reads: _"Showing all campaigns. 'No bookings yet' means visitors arrived but didn't book."_ This satisfies CAMP-02 without making the admin feel like a developer tool.

### Admin Navigation Integration
- **D-05:** Add `{ id: 'marketing', title: 'Marketing', icon: BarChart2 }` to `menuItems` in `Admin.tsx`. The `BarChart2` icon from Lucide is already available in the project. Place it after `bookings` in the menu order (logical flow: manage bookings → understand where bookings come from).
- **D-06:** In Admin.tsx render block, add: `{activeSection === 'marketing' && <MarketingSection getAccessToken={getAccessToken} />}`.

### Component Architecture
- **D-07:** Single top-level component `MarketingSection` in `client/src/components/admin/MarketingSection.tsx`. It owns the date filter state and renders three sub-components:
  - `MarketingOverviewTab` — KPI cards + trend chart + recent conversions
  - `MarketingSourcesTab` — Sources performance table
  - `MarketingCampaignsTab` — Campaigns performance table
  Tab switching via local `useState`, not URL routing (consistent with how other admin sections handle internal tabs like IntegrationsSection).

### KPI Cards Layout (OVERVIEW-01, OVERVIEW-02)
- **D-08:** Four KPI cards in a 2×2 grid on mobile, 4-column row on desktop: **Visitors**, **Bookings**, **Conversion Rate**, **Revenue**. Below the KPI cards: a row of three smaller "best of" cards: **Top Source**, **Top Campaign**, **Top Landing Page**. This satisfies OVERVIEW-01 and OVERVIEW-02.

### Trend Chart (OVERVIEW-03)
- **D-09:** Single `AreaChart` from recharts (already installed) showing **Visitors** (blue) and **Bookings** (brand yellow `#FFFF01`) as two areas over the selected date range. X-axis: date labels. Y-axis: count. Tooltip shows both values. ResponsiveContainer for responsive width. This satisfies OVERVIEW-03.

### Recent Conversions (OVERVIEW-04)
- **D-10:** Below the trend chart in the Overview tab: a small table showing the last 5 conversion events with columns: **What happened** (e.g., "Booking completed"), **Source**, **Campaign**, **Value**, **Time** (relative: "2 hours ago"). Links to the booking detail if `bookingId` is present. This satisfies OVERVIEW-04.

### Sources Table (SOURCES-01 through SOURCES-04)
- **D-11:** Table columns: **Source** (business-friendly label), **Visitors**, **Bookings**, **Conversion Rate**, **Revenue**. Sorted by Visitors descending by default. Direct and Unknown always present with an info tooltip icon (hover shows: "Direct: visitors who typed your URL or came from a bookmark. Unknown: source couldn't be identified"). Source labels use display names: Google Ads, Facebook, Instagram, Organic Search, Direct, Social, Referral, Unknown.

### Campaigns Table (CAMP-01 through CAMP-04)
- **D-12:** Table columns: **Campaign**, **Source**, **Medium**, **Visitors**, **Bookings** (or "No bookings yet"), **Conversion Rate**, **Revenue**. Sorted by Visitors descending. Same campaign name from different sources appears as separate rows (source + campaign name together = unique row key).

### Empty States (UX-03, OVERVIEW-05)
- **D-13:** Empty states built before chart components (per research). Each view has two states:
  1. **No data yet** (migration not applied or no sessions yet): shows an icon + headline + "Data collection starts as soon as visitors arrive at your site." + note about pending migration if applicable.
  2. **No data for period** (date filter returns empty): shows "No data for this period. Try a wider date range or check back after more visitors arrive."
  Copy is written from the business owner's perspective, not the developer's.

### GET API Endpoints
- **D-14:** Three GET endpoints added to `server/routes/analytics.ts`, all behind `requireAdmin`:
  - `GET /api/analytics/overview?from=&to=` → `{ visitors, bookings, conversionRate, revenue, topSource, topCampaign, topLandingPage, recentConversions[], trend[] }`
  - `GET /api/analytics/sources?from=&to=` → `SourceRow[]` where each row has `{ source, displayName, visitors, bookings, conversionRate, revenue, bestCampaign, bestLandingPage }`
  - `GET /api/analytics/campaigns?from=&to=` → `CampaignRow[]` where each row has `{ campaign, source, medium, visitors, bookings, conversionRate, revenue }`
  All return empty arrays/zeros when tables don't exist (migration pending) — never error.

### Data Fetching Pattern
- **D-15:** Each tab component uses `useQuery` with React Query. Query keys include the date range: `['/api/analytics/overview', from, to]`. When the global date filter changes, queries auto-refetch. `staleTime: 1000 * 60 * 5` (5 minutes) — marketing data doesn't change second-by-second.

### Filter Panel (FILTER-01, FILTER-02)
- **D-16:** Date range filter is a single `Select` component with presets + a "Custom" option that reveals two `DatePicker` inputs. Dimension filters (source, medium, campaign) are NOT in Phase 12 — they require query parameter threading through all three views and are deferred to Phase 12 polish or Phase 13. The roadmap requirements FILTER-01 and FILTER-02 are partially satisfied: date range fully covered, dimension filters deferred.

### Brand Colors
- **D-17:** Use the project's existing brand palette. Primary blue `#1C53A3` for visitor data, brand yellow `#FFFF01` for booking/conversion data. Stats cards use the existing `bg-blue-500/10` / `text-blue-500` pattern from `DashboardSection`.

### Claude's Discretion
- Exact SQL queries for each GET endpoint — use Drizzle ORM, aggregate with `count()`, `sum()`, and `groupBy()` from existing Drizzle pattern.
- Loading skeleton states — use existing shadcn Skeleton component or simple spinner.
- Mobile responsiveness — table overflow scroll on small screens (existing pattern).
- Error boundary — standard React Query `isError` state handling with a retry button.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Admin Integration Points
- `client/src/pages/Admin.tsx` — `menuItems` array (line ~47), `activeSection` render block (line ~174+), section registration pattern
- `client/src/components/admin/DashboardSection.tsx` — KPI card pattern, React Query with `authenticatedRequest`, stats array pattern
- `client/src/components/admin/IntegrationsSection.tsx` OR `client/src/components/admin/BlogSection.tsx` — tab-within-section pattern using local `useState`
- `client/src/components/admin/shared/SettingsCard.tsx` — shared card component if applicable

### Analytics Backend
- `server/routes/analytics.ts` — existing POST endpoints; GET endpoints go here too
- `server/storage/analytics.ts` — existing storage functions; new aggregate query functions go here
- `server/middleware/auth.ts` OR `server/lib/auth.ts` — `requireAdmin` middleware for GET endpoints

### Phase 10 Context (schema)
- `.planning/phases/10-schema-capture-classification/10-CONTEXT.md` — table shapes, column names
- `shared/schema.ts` — `visitorSessions`, `conversionEvents` table definitions, exact column names

### Requirements
- `.planning/REQUIREMENTS.md` — all 19 Phase 12 requirements (OVERVIEW-01–05, SOURCES-01–04, CAMP-01–04, FILTER-01–03, UX-01–03)

### Research
- `.planning/research/SUMMARY.md` — empty state design guidance, recharts components, source display names
- `.planning/research/FEATURES.md` — table stakes vs differentiators, anti-features list

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardSection.tsx` stats array pattern: `{ label, value, icon, color, bg }` → exact template for KPI cards
- `Card`, `CardContent` from `@/components/ui/card` — already used everywhere
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` from `@/components/ui/select` — date preset selector
- `recharts` (`AreaChart`, `BarChart`, `ResponsiveContainer`, `XAxis`, `YAxis`, `Tooltip`, `Legend`) — all installed
- `date-fns` `format`, `subDays`, `startOfMonth`, `endOfMonth` — already in use

### Established Patterns
- React Query: `useQuery({ queryKey: [...], queryFn: async () => { const token = await getAccessToken(); const res = await authenticatedRequest('GET', '/api/...', token); return res.json(); } })`
- Tab switching: local `useState<'overview'|'sources'|'campaigns'>('overview')` + conditional render (see BlogSection or IntegrationsSection for internal tab pattern)
- Admin section prop: `getAccessToken: () => Promise<string | null>` passed from Admin.tsx to each section

### Integration Points
- `client/src/pages/Admin.tsx`: add `BarChart2` to lucide imports, add to `menuItems`, add `{activeSection === 'marketing' && <MarketingSection getAccessToken={getAccessToken} />}` to render block
- `server/routes/analytics.ts`: add 3 GET endpoints with `requireAdmin` middleware
- `server/storage/analytics.ts`: add aggregate query functions for overview/sources/campaigns

</code_context>

<specifics>
## Specific Ideas

- **Source display name mapping:** `{ organic_search: 'Organic Search', social: 'Social', paid: 'Paid Search', referral: 'Referral', direct: 'Direct', email: 'Email', unknown: 'Unknown' }` — plus UTM source overrides: `{ google: 'Google Ads', facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', linkedin: 'LinkedIn' }`. This mapping lives in a shared utility `client/src/lib/analytics-display.ts`.
- **Conversion rate formula:** `(bookings / visitors * 100).toFixed(1) + '%'` — show "—" if visitors is 0 to avoid NaN.
- **Revenue formatting:** `$${value.toFixed(2)}` — show "$0.00" not blank when zero.
- **"Top Source" card:** shows the source with the most bookings (not most visitors) — because the business cares about what drives bookings, not raw traffic.

</specifics>

<deferred>
## Deferred Ideas

- **Dimension filters** (source, medium, campaign filter dropdowns per FILTER-02): deferred from Phase 12 to avoid over-complicating the first dashboard build. Date filter (FILTER-01) is fully covered. Dimension filters can be added as a Phase 12.1 or folded into Phase 13.
- **Period comparison** (this period vs last period): Phase 13+ as documented in v2 requirements.

</deferred>

---

*Phase: 12-marketing-dashboard-ui*
*Context gathered: 2026-04-25*
