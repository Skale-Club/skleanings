# Phase 12: Marketing Dashboard UI — Research

**Researched:** 2026-04-25
**Domain:** React admin UI with Drizzle ORM aggregate queries, recharts AreaChart, React Query data fetching
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Three tabs: Overview, Sources, Campaigns (Conversions = Phase 13). Order: Overview first, Sources second, Campaigns third.
- **D-02:** One global date range selector at the top of `MarketingSection`, above the tabs. State lives in `MarketingSection`, passed as prop to each tab.
- **D-03:** Date range presets: Today, Yesterday, Last 7 days, Last 30 days (default), This month, Last month, Custom. State shape: `{ from: Date, to: Date, preset: string }`.
- **D-04:** Zero-conversion campaigns show "No bookings yet" in muted text (not a warning badge). Subtitle under Campaigns tab: "Showing all campaigns. 'No bookings yet' means visitors arrived but didn't book."
- **D-05:** Add `{ id: 'marketing', title: 'Marketing', icon: BarChart2 }` to `menuItems` in `Admin.tsx`. Place after `bookings`.
- **D-06:** In Admin.tsx render block: `{activeSection === 'marketing' && <MarketingSection getAccessToken={getAccessToken} />}`.
- **D-07:** Single top-level component `MarketingSection` in `client/src/components/admin/MarketingSection.tsx`. Owns date filter state. Tab switching via local `useState`, not URL routing. Three sub-components: `MarketingOverviewTab`, `MarketingSourcesTab`, `MarketingCampaignsTab`.
- **D-08:** Four KPI cards (Visitors, Bookings, Conversion Rate, Revenue) in 2×2 mobile / 4-column desktop. Below: three "best of" cards (Top Source, Top Campaign, Top Landing Page).
- **D-09:** `AreaChart` from recharts. Visitors = blue `#1C53A3`, Bookings = brand yellow `#FFFF01`. `ResponsiveContainer` for responsive width. X-axis: date labels. Tooltip shows both values.
- **D-10:** Recent conversions table (last 5 events): What happened | Source | Campaign | Value | Time. Links to booking if `bookingId` present.
- **D-11:** Sources table: Source | Visitors | Bookings | Conversion Rate | Revenue. Sorted Visitors desc. Direct/Unknown always shown with info tooltip.
- **D-12:** Campaigns table: Campaign | Source | Medium | Visitors | Bookings | Conversion Rate | Revenue. Sorted Visitors desc. Same campaign + different source = separate rows.
- **D-13:** Empty states built before chart components. Two states per view: (1) no data yet / migration pending, (2) no data for period.
- **D-14:** Three GET endpoints on analytics router behind `requireAdmin`: `/overview`, `/sources`, `/campaigns`. All return zeros/empty arrays when migration pending — never error 500.
- **D-15:** `useQuery` with `staleTime: 1000 * 60 * 5`. Query keys include date range: `['/api/analytics/overview', from, to]`.
- **D-16:** Dimension filters (source, medium, campaign dropdowns) deferred to Phase 13. Only date range filter in Phase 12.
- **D-17:** Brand colors: `#1C53A3` (visitors), `#FFFF01` (bookings/conversions). KPI cards use existing `bg-blue-500/10` / `text-blue-500` pattern from `DashboardSection`.

### Claude's Discretion

- Exact SQL queries for GET endpoints (use Drizzle ORM with `count()`, `sum()`, `groupBy()`).
- Loading skeleton states (use shadcn `Skeleton` or simple spinner).
- Mobile responsiveness (table overflow-scroll on small screens).
- Error boundary (standard React Query `isError` handling with retry button).

### Deferred Ideas (OUT OF SCOPE)

- Dimension filters (source, medium, campaign dropdowns) — Phase 13.
- Period comparison (this period vs last period) — Phase 13+.
- Conversions list view — Phase 13.
- Visitor Journey view — Phase 13.
- GoHighLevel UTM sync — Phase 13.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OVERVIEW-01 | Admin views total visitors, bookings, conversion rate, revenue in one panel | D-08 KPI cards; aggregate query patterns documented below |
| OVERVIEW-02 | Admin sees top source, top campaign, top landing page at a glance | D-08 "best of" cards; top-N query pattern documented |
| OVERVIEW-03 | Admin sees trend chart (visitors + bookings per day) | D-09 AreaChart pattern; day-aggregation SQL documented |
| OVERVIEW-04 | Admin sees last 5 conversions in overview | D-10 recent conversions table; `conversionEvents` schema confirmed |
| OVERVIEW-05 | Dashboard communicates clearly when no data yet | D-13 empty state spec; two-state pattern documented |
| SOURCES-01 | Sources table: visitors, bookings, conversion rate, revenue per source | Drizzle groupBy pattern on `attributedSource`; column names confirmed |
| SOURCES-02 | Per source: best campaign and best landing page | Sub-query / secondary aggregate pattern documented |
| SOURCES-03 | Direct/Unknown always shown with tooltip | Tooltip pattern + COALESCE('unknown') documented |
| SOURCES-04 | Source labels use business-friendly names | `analytics-display.ts` mapping spec in CONTEXT.md specifics |
| CAMP-01 | Campaigns table: source, medium, visitors, bookings, conversion rate, revenue | Drizzle groupBy on `(attributedCampaign, attributedSource, attributedMedium)` |
| CAMP-02 | Campaigns with zero bookings shown as "No bookings yet" | Conditional render on bookings === 0 |
| CAMP-03 | Per campaign: which landing pages received traffic | Visitor sessions join or separate sub-query |
| CAMP-04 | Same campaign from different sources = separate rows | Composite group key `(campaign, source)` |
| FILTER-01 | Date range filter with standard presets | `Select` + two `DatePicker` for custom; `date-fns` for preset calculation |
| FILTER-02 | Dimension filters deferred — date filter only in Phase 12 | Confirmed deferred per D-16 |
| FILTER-03 | Default date range = Last 30 days | `useState` initial value = `subDays(today, 30)` |
| UX-01 | Marketing section accessible from admin sidebar | `menuItems` + `AdminSection` type update |
| UX-02 | Business-friendly labels throughout | `analytics-display.ts` + column headers spec |
| UX-03 | Each dashboard view has meaningful empty state | Two-state empty state pattern documented |

</phase_requirements>

---

## Summary

Phase 12 is a pure UI + GET endpoint phase. The backend schema (`visitor_sessions`, `conversion_events`) and all write paths exist from Phases 10–11. This phase adds three aggregate GET endpoints and the React admin UI to display results.

The central technical challenge is writing correct Drizzle ORM aggregate queries over `conversionEvents` (which has denormalized attribution columns), applying a date filter, and handling graceful degradation when the migration has not been applied (the tables may not exist in staging). All other work — tab structure, KPI cards, recharts AreaChart — follows patterns that already exist verbatim in the codebase.

The `AdminSection` union type in `shared/types.ts` must be extended to include `'marketing'` before any Admin.tsx changes compile. This is a required Wave 0 step.

**Primary recommendation:** Start with Wave 0 (type extension + empty state scaffolding + GET endpoint stubs returning zeros), then build aggregate queries, then wire up the React components.

---

## Standard Stack

### Core (all already installed — no new packages)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| recharts | 2.15.2 | AreaChart trend, table charts | Installed |
| @tanstack/react-query | 5.60.5 | Data fetching with staleTime | Installed |
| date-fns | 3.6.0 | Date preset calculation, formatting | Installed |
| drizzle-orm | 0.39.3 | Aggregate queries (count, sum, groupBy) | Installed |
| lucide-react | 0.453.0 | Icons (BarChart2 confirmed available) | Installed |
| shadcn/ui | (project) | Card, Select, Table, Tabs, Skeleton | Installed |

### No New Packages Required

The full implementation requires zero new `npm install` commands. Every capability — charts, date math, query fetching, UI components, aggregate SQL — is covered by the existing stack.

---

## Architecture Patterns

### Pattern 1: Tab-Within-Section (local useState — the correct pattern for MarketingSection)

Decision D-07 specifies local `useState` for tab switching, NOT `useSlugTab`. The `IntegrationsSection` uses `useSlugTab` (URL-persisted tabs), but D-07 explicitly chose local state (consistent with `BlogSection`'s `activeTab` state).

```typescript
// Source: client/src/components/admin/BlogSection.tsx (line 54)
const [activeTab, setActiveTab] = useState<'posts' | 'settings'>('posts');
// Conditional render (not Tabs component):
{activeTab === 'posts' && <PostsList />}
{activeTab === 'settings' && <BlogSettings />}
```

For MarketingSection, use the same local `useState` approach — no `useSlugTab`, no URL routing:

```typescript
// client/src/components/admin/MarketingSection.tsx
const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'campaigns'>('overview');
```

**NOTE:** IntegrationsSection DOES use shadcn `<Tabs>` component (with `TabsList`/`TabsTrigger`/`TabsContent`) combined with `useSlugTab`. Either approach is valid for the tab UI — the `<Tabs>` component provides accessible tab UI regardless of whether state is local or URL-backed. MarketingSection can use `<Tabs>` for the UI with local useState for the state source.

### Pattern 2: React Query with authenticatedRequest (canonical admin pattern)

```typescript
// Source: client/src/components/admin/DashboardSection.tsx (lines 21-29)
const { data: bookings } = useQuery<Booking[]>({
  queryKey: ['/api/bookings'],
  queryFn: async () => {
    const token = await getAccessToken();
    if (!token) throw new Error('Authentication required');
    const res = await authenticatedRequest('GET', '/api/bookings', token);
    return res.json();
  },
});
```

For marketing endpoints with date range params:

```typescript
const { data, isLoading, isError } = useQuery({
  queryKey: ['/api/analytics/overview', from.toISOString(), to.toISOString()],
  queryFn: async () => {
    const token = await getAccessToken();
    if (!token) throw new Error('Authentication required');
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const res = await authenticatedRequest('GET', `/api/analytics/overview?${params}`, token);
    return res.json();
  },
  staleTime: 1000 * 60 * 5,
});
```

### Pattern 3: KPI Cards (DashboardSection stats array pattern)

```typescript
// Source: client/src/components/admin/DashboardSection.tsx (lines 52-63)
const stats = [
  { label: 'Visitors', value: data?.visitors ?? 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { label: 'Bookings', value: data?.bookings ?? 0, icon: Calendar, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  { label: 'Conversion Rate', value: data?.conversionRate ?? '—', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { label: 'Revenue', value: `$${data?.revenue ?? '0.00'}`, icon: DollarSign, color: 'text-orange-500', bg: 'bg-orange-500/10' },
];
// Grid:
<div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
  {stats.map((stat) => (
    <Card key={stat.label}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-lg sm:text-2xl font-bold">{stat.value}</p>
          </div>
          <div className={clsx('w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0', stat.bg)}>
            <stat.icon className={clsx('w-5 h-5 sm:w-6 sm:h-6', stat.color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  ))}
</div>
```

### Pattern 4: recharts AreaChart

The project has a shadcn `ChartContainer` component at `client/src/components/ui/chart.tsx` that wraps `ResponsiveContainer`. Direct recharts import is also valid — both approaches work. Direct import is simpler for this use case:

```typescript
// Direct recharts import (verified against recharts 2.15.2):
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';

// Usage in MarketingOverviewTab:
<ResponsiveContainer width="100%" height={300}>
  <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Area type="monotone" dataKey="visitors" stroke="#1C53A3" fill="#1C53A3" fillOpacity={0.15} name="Visitors" />
    <Area type="monotone" dataKey="bookings" stroke="#FFFF01" fill="#FFFF01" fillOpacity={0.3} name="Bookings" />
  </AreaChart>
</ResponsiveContainer>
```

`trendData` shape: `Array<{ date: string; visitors: number; bookings: number }>` — date formatted as `"Apr 1"` via `date-fns format(d, 'MMM d')`.

### Pattern 5: requireAdmin Middleware Import

**CRITICAL:** The correct import path is `"../lib/auth"`, NOT `"../middleware/auth"`.

- `server/middleware/auth.ts` — exists but uses session-based auth (old pattern). Has `requireAdmin` but uses `req.session.userId`.
- `server/lib/auth.ts` — the canonical import used by ALL current routes (blog.ts, bookings.ts, auth-routes.ts). Uses Supabase token verification.

```typescript
// server/routes/analytics.ts — add to existing file:
import { requireAdmin } from "../lib/auth";

router.get("/overview", requireAdmin, async (req, res) => { ... });
router.get("/sources", requireAdmin, async (req, res) => { ... });
router.get("/campaigns", requireAdmin, async (req, res) => { ... });
```

### Pattern 6: AdminSection Type Extension

`AdminSection` type lives in `client/src/components/admin/shared/types.ts` (lines 3–18). It must be extended before Admin.tsx changes compile:

```typescript
// client/src/components/admin/shared/types.ts — ADD 'marketing' to the union:
export type AdminSection =
  | 'dashboard'
  | 'calendar'
  | 'contacts'
  | 'categories'
  | 'services'
  | 'bookings'
  | 'hero'
  | 'company'
  | 'seo'
  | 'faqs'
  | 'users'
  | 'availability'
  | 'chat'
  | 'integrations'
  | 'blog'
  | 'marketing'; // NEW
```

---

## Drizzle ORM Aggregate Query Patterns

This is the primary research area — exact Drizzle syntax for the three GET endpoints.

### Existing aggregate pattern in codebase

```typescript
// Source: server/storage/blog.ts (line 171)
const result = await db.select({ count: sql<number>`count(*)` })
  .from(blogPosts)
  .where(eq(blogPosts.status, 'published'));

// Source: server/storage/staff.ts (line 36) — cast to int:
const [row] = await db.select({ count: sql<number>`count(*)::int` })
  .from(staffMembers)
  .where(eq(staffMembers.isActive, true));
```

### Required imports for aggregate queries

```typescript
// server/storage/analytics.ts — add these imports:
import { and, gte, lte, eq, sql, desc, asc, isNotNull, isNull, coalesce } from "drizzle-orm";
```

All of `and`, `gte`, `lte`, `sql` are already used in the project (confirmed in storage/blog.ts, storage/bookings.ts). `desc`, `asc`, `isNotNull` are standard Drizzle exports.

### Date range filter pattern

```typescript
// server/storage/bookings.ts (line 86) — existing date range pattern:
.where(and(gte(bookings.bookingDate, from), lte(bookings.bookingDate, to)))

// For conversion_events.occurred_at (timestamp, not date):
const fromDate = new Date(req.query.from as string);
const toDate = new Date(req.query.to as string);
.where(and(
  gte(conversionEvents.occurredAt, fromDate),
  lte(conversionEvents.occurredAt, toDate),
  eq(conversionEvents.attributionModel, 'last_touch'), // always filter to one model
))
```

### Overview: Total visitors in date range

`visitor_sessions` does not have an `occurredAt` column — it has `firstSeenAt` and `lastSeenAt`. For the Overview, count unique visitor sessions first seen in the date range:

```typescript
// Visitors in date range (first_seen_at):
const visitorResult = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(visitorSessions)
  .where(and(
    gte(visitorSessions.firstSeenAt, fromDate),
    lte(visitorSessions.firstSeenAt, toDate),
  ));
const visitors = visitorResult[0]?.count ?? 0;

// Bookings (conversion_events, last_touch only, booking_completed):
const bookingResult = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(conversionEvents)
  .where(and(
    eq(conversionEvents.eventType, 'booking_completed'),
    eq(conversionEvents.attributionModel, 'last_touch'),
    gte(conversionEvents.occurredAt, fromDate),
    lte(conversionEvents.occurredAt, toDate),
  ));
const bookings = bookingResult[0]?.count ?? 0;

// Revenue:
const revenueResult = await db
  .select({ total: sql<string>`COALESCE(SUM(booking_value::numeric), 0)::text` })
  .from(conversionEvents)
  .where(and(
    eq(conversionEvents.eventType, 'booking_completed'),
    eq(conversionEvents.attributionModel, 'last_touch'),
    gte(conversionEvents.occurredAt, fromDate),
    lte(conversionEvents.occurredAt, toDate),
  ));
const revenue = parseFloat(revenueResult[0]?.total ?? '0');
```

### Sources: GROUP BY attributedSource

```typescript
// Sources aggregate query — last_touch, booking_completed only for bookings/revenue:
// Pattern: two queries + merge in JS (simpler than a LEFT JOIN in Drizzle 0.39.3)

// Query 1: visitor counts per traffic source (from visitor_sessions.last_traffic_source)
const visitorsBySource = await db
  .select({
    source: visitorSessions.lastTrafficSource,
    visitors: sql<number>`count(*)::int`,
  })
  .from(visitorSessions)
  .where(and(
    gte(visitorSessions.firstSeenAt, fromDate),
    lte(visitorSessions.firstSeenAt, toDate),
  ))
  .groupBy(visitorSessions.lastTrafficSource);

// Query 2: bookings + revenue per attributedSource (conversion_events)
const bookingsBySource = await db
  .select({
    source: conversionEvents.attributedSource,
    bookings: sql<number>`count(*)::int`,
    revenue: sql<string>`COALESCE(SUM(booking_value::numeric), 0)::text`,
  })
  .from(conversionEvents)
  .where(and(
    eq(conversionEvents.eventType, 'booking_completed'),
    eq(conversionEvents.attributionModel, 'last_touch'),
    gte(conversionEvents.occurredAt, fromDate),
    lte(conversionEvents.occurredAt, toDate),
  ))
  .groupBy(conversionEvents.attributedSource);

// Merge in JS: combine visitor counts with booking counts per source key
// COALESCE null source → 'unknown'
```

**NOTE on source field mismatch:** `visitor_sessions` stores the classified channel in `last_traffic_source` (values like `'organic_search'`, `'direct'`, `'paid'`). `conversion_events` stores the raw UTM source in `attributed_source` (values like `'google'`, `'facebook'`, null). The display name mapping must handle both. The Sources table should use `last_traffic_source` from `visitor_sessions` as the primary grouping key — it is already classified into business-friendly channels by `traffic-classifier.ts`.

To align sources with bookings: join `conversion_events` to `visitor_sessions` on `conversion_events.visitor_id = visitor_sessions.id` and group by `visitor_sessions.last_traffic_source`. This gives one consistent source classification for both visitor counts and booking counts.

```typescript
// Better approach: join conversion_events to visitor_sessions for booking counts by classified source
const bookingsByClassifiedSource = await db
  .select({
    source: visitorSessions.lastTrafficSource,
    bookings: sql<number>`count(*)::int`,
    revenue: sql<string>`COALESCE(SUM(${conversionEvents.bookingValue}::numeric), 0)::text`,
  })
  .from(conversionEvents)
  .innerJoin(visitorSessions, eq(conversionEvents.visitorId, visitorSessions.id))
  .where(and(
    eq(conversionEvents.eventType, 'booking_completed'),
    eq(conversionEvents.attributionModel, 'last_touch'),
    gte(conversionEvents.occurredAt, fromDate),
    lte(conversionEvents.occurredAt, toDate),
  ))
  .groupBy(visitorSessions.lastTrafficSource);
```

### Campaigns: GROUP BY (attributedCampaign, attributedSource, attributedMedium)

`conversion_events` has `attributed_campaign`, `attributed_source`, `attributed_medium` as denormalized columns — no join needed for campaign queries.

```typescript
// Visitor count per campaign requires visitor_sessions join (visitor_sessions has utm_campaign)
// For bookings/revenue per campaign: group conversion_events directly

const campaignBookings = await db
  .select({
    campaign:  conversionEvents.attributedCampaign,
    source:    conversionEvents.attributedSource,
    medium:    conversionEvents.attributedMedium,
    bookings:  sql<number>`count(*)::int`,
    revenue:   sql<string>`COALESCE(SUM(booking_value::numeric), 0)::text`,
  })
  .from(conversionEvents)
  .where(and(
    eq(conversionEvents.eventType, 'booking_completed'),
    eq(conversionEvents.attributionModel, 'last_touch'),
    gte(conversionEvents.occurredAt, fromDate),
    lte(conversionEvents.occurredAt, toDate),
  ))
  .groupBy(
    conversionEvents.attributedCampaign,
    conversionEvents.attributedSource,
    conversionEvents.attributedMedium,
  );

// Visitor count per campaign (from visitor_sessions):
const campaignVisitors = await db
  .select({
    campaign: visitorSessions.lastUtmCampaign,
    source:   visitorSessions.lastUtmSource,
    medium:   visitorSessions.lastUtmMedium,
    visitors: sql<number>`count(*)::int`,
  })
  .from(visitorSessions)
  .where(and(
    isNotNull(visitorSessions.lastUtmCampaign),
    gte(visitorSessions.firstSeenAt, fromDate),
    lte(visitorSessions.firstSeenAt, toDate),
  ))
  .groupBy(
    visitorSessions.lastUtmCampaign,
    visitorSessions.lastUtmSource,
    visitorSessions.lastUtmMedium,
  );
// Merge by composite key: `${campaign}|${source}|${medium}`
```

### Trend chart: visitors + bookings per day

```typescript
// Daily visitor counts:
const dailyVisitors = await db
  .select({
    day:      sql<string>`DATE(first_seen_at)::text`,
    visitors: sql<number>`count(*)::int`,
  })
  .from(visitorSessions)
  .where(and(
    gte(visitorSessions.firstSeenAt, fromDate),
    lte(visitorSessions.firstSeenAt, toDate),
  ))
  .groupBy(sql`DATE(first_seen_at)`)
  .orderBy(sql`DATE(first_seen_at)`);

// Daily booking counts:
const dailyBookings = await db
  .select({
    day:      sql<string>`DATE(occurred_at)::text`,
    bookings: sql<number>`count(*)::int`,
  })
  .from(conversionEvents)
  .where(and(
    eq(conversionEvents.eventType, 'booking_completed'),
    eq(conversionEvents.attributionModel, 'last_touch'),
    gte(conversionEvents.occurredAt, fromDate),
    lte(conversionEvents.occurredAt, toDate),
  ))
  .groupBy(sql`DATE(occurred_at)`)
  .orderBy(sql`DATE(occurred_at)`);

// Merge in JS: generate all dates in range, fill with 0 where missing
// Output shape: Array<{ date: string; visitors: number; bookings: number }>
```

### Handling missing tables (migration pending)

```typescript
// Wrap every aggregate query in try/catch — check for "does not exist" error:
async function getOverviewData(fromDate: Date, toDate: Date): Promise<OverviewData> {
  try {
    // ... aggregate queries ...
    return { visitors, bookings, conversionRate, revenue, trend, recentConversions, topSource, topCampaign, topLandingPage };
  } catch (err: any) {
    // PostgreSQL error code 42P01 = "undefined_table"
    if (err?.code === '42P01' || err?.message?.includes('does not exist')) {
      return getEmptyOverviewData(); // Return zeros — migration not applied yet
    }
    throw err; // Re-throw unexpected errors
  }
}
```

The GET endpoint then catches unexpected re-throws and returns 500 only for non-migration errors. The migration-pending case always returns 200 with empty data.

---

## Source Display Name Mapping

Per D-07 CONTEXT.md specifics, `analytics-display.ts` lives in `client/src/lib/`:

```typescript
// client/src/lib/analytics-display.ts

// Traffic source channel labels (from traffic-classifier.ts output):
export const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  organic_search: 'Organic Search',
  social:         'Social',
  paid:           'Paid Search',
  referral:       'Referral',
  direct:         'Direct',
  email:          'Email',
  unknown:        'Unknown',
};

// UTM source overrides (raw utm_source values → display labels):
export const UTM_SOURCE_LABELS: Record<string, string> = {
  google:    'Google Ads',
  facebook:  'Facebook',
  instagram: 'Instagram',
  youtube:   'YouTube',
  tiktok:    'TikTok',
  linkedin:  'LinkedIn',
};

// Primary lookup: traffic source → display label
export function getSourceDisplayName(trafficSource: string | null): string {
  if (!trafficSource) return 'Unknown';
  return TRAFFIC_SOURCE_LABELS[trafficSource] ?? trafficSource;
}

// Conversion rate: always show '—' when visitors is 0 (avoids NaN/Infinity):
export function formatConversionRate(bookings: number, visitors: number): string {
  if (visitors === 0) return '—';
  return (bookings / visitors * 100).toFixed(1) + '%';
}

// Revenue: always show $0.00 not blank:
export function formatRevenue(value: number | string | null): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  return `$${num.toFixed(2)}`;
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive chart container | Manual width calculation | `<ResponsiveContainer>` from recharts | Handles resize events, SSR, observer |
| Date range preset math | Manual date arithmetic | `date-fns`: `subDays`, `startOfMonth`, `endOfMonth`, `startOfDay`, `endOfDay` | DST-safe, tested |
| Tab accessible keyboard nav | Custom keyboard handler | `<Tabs>` from shadcn/ui | ARIA roles, focus management built in |
| Loading/skeleton | CSS spinner animation | shadcn `<Skeleton>` or existing `<Loader2>` pattern | Consistent with admin UI |
| Empty table state | `null` return | Explicit empty state component rendered before table | Trust problem — see FEATURES.md |

---

## Common Pitfalls

### Pitfall 1: Wrong requireAdmin Import Path
**What goes wrong:** Importing from `"../middleware/auth"` uses the session-based admin check (`req.session.userId`) which is the OLD auth pattern. The project migrated to Supabase token auth.
**Why it happens:** `server/middleware/auth.ts` exists and exports `requireAdmin` — it compiles fine but uses `req.session.userId` which is always undefined with the current Supabase auth flow.
**How to avoid:** Always import `requireAdmin` from `"../lib/auth"` — this is what every current route (blog.ts, bookings.ts, auth-routes.ts) does.
**Warning signs:** GET endpoints return 401 for logged-in admin users.

### Pitfall 2: AdminSection Type Not Extended
**What goes wrong:** Adding `'marketing'` to `menuItems` in Admin.tsx causes TypeScript compile error because `AdminSection` type does not include `'marketing'`.
**Why it happens:** `AdminSection` is a union type in `shared/types.ts` — it needs explicit extension.
**How to avoid:** Extend `AdminSection` in `client/src/components/admin/shared/types.ts` as Wave 0 step.
**Warning signs:** `npm run check` fails with "Type 'string' is not assignable to type 'AdminSection'".

### Pitfall 3: Querying Wrong Attribution Model
**What goes wrong:** Queries that don't filter `attribution_model = 'last_touch'` will double-count every booking (the schema writes two rows per event — first_touch AND last_touch).
**Why it happens:** `recordConversionEvent` writes two rows per event per D-05 (dual attribution model). A COUNT(*) without model filter returns 2× the real booking count.
**How to avoid:** Every aggregate query on `conversion_events` MUST include `eq(conversionEvents.attributionModel, 'last_touch')` in the WHERE clause (or explicitly query first_touch where needed).
**Warning signs:** Booking counts are exactly 2× what's in the bookings table.

### Pitfall 4: Source Field Mismatch Between Tables
**What goes wrong:** `visitor_sessions.last_traffic_source` contains classified channel names (`'organic_search'`, `'direct'`). `conversion_events.attributed_source` contains raw UTM values (`'google'`, `null`). Joining them directly produces mismatched rows.
**Why it happens:** Sessions are classified server-side at upsert time; conversion events snapshot the raw UTM source at event time.
**How to avoid:** For the Sources tab, GROUP BY `visitor_sessions.last_traffic_source` (join `conversion_events` to `visitor_sessions` via `visitor_id`). Do not group by `conversion_events.attributed_source` for source performance.
**Warning signs:** "google" and "paid" appear as separate source rows for the same traffic.

### Pitfall 5: Migration-Pending 500 Errors
**What goes wrong:** GET endpoints crash with 500 when the migration has not been applied and the tables don't exist.
**Why it happens:** Drizzle queries throw with `code: '42P01'` (PostgreSQL "undefined_table") when querying a non-existent table.
**How to avoid:** Wrap all aggregate queries in try/catch. Check for `err.code === '42P01'` or `err.message.includes('does not exist')` — return empty data shape, not 500.
**Warning signs:** Admin marketing section shows error state instead of empty state on first deploy.

### Pitfall 6: Brand Yellow on White Background
**What goes wrong:** `#FFFF01` (brand yellow) is invisible on white/light card backgrounds.
**Why it happens:** Yellow on white has near-zero contrast ratio.
**How to avoid:** Only use `#FFFF01` as a chart area fill (on dark chart background) or as a CTA button background (with black text per brand guidelines). For KPI cards, use the `text-yellow-500` / `bg-yellow-500/10` Tailwind pattern — NOT the raw hex. The Bookings KPI card can use `text-violet-500` / `bg-violet-500/10` (matching Dashboard pattern).
**Warning signs:** Yellow text/icon invisible on card background.

---

## Architecture Patterns (Component File Structure)

```
client/src/components/admin/
├── MarketingSection.tsx          # Top-level: owns dateRange state, renders tabs
├── marketing/
│   ├── MarketingOverviewTab.tsx  # KPI cards + trend chart + recent conversions
│   ├── MarketingSourcesTab.tsx   # Sources performance table
│   └── MarketingCampaignsTab.tsx # Campaigns performance table

client/src/lib/
└── analytics-display.ts          # getSourceDisplayName, formatConversionRate, formatRevenue

server/routes/
└── analytics.ts                  # ADD: 3 GET endpoints (overview, sources, campaigns)

server/storage/
└── analytics.ts                  # ADD: getOverviewData, getSourcesData, getCampaignsData
```

---

## Date Range Preset Calculation (date-fns)

```typescript
// client/src/components/admin/MarketingSection.tsx
import { subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from 'date-fns';

type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';
type DateRange = { from: Date; to: Date; preset: DatePreset };

function getPresetRange(preset: DatePreset): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':     return { from: startOfDay(now), to: endOfDay(now), preset };
    case 'yesterday': return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)), preset };
    case 'last7':     return { from: startOfDay(subDays(now, 6)), to: endOfDay(now), preset };
    case 'last30':    return { from: startOfDay(subDays(now, 29)), to: endOfDay(now), preset };
    case 'thisMonth': return { from: startOfMonth(now), to: endOfDay(now), preset };
    case 'lastMonth': { const lm = subMonths(now, 1); return { from: startOfMonth(lm), to: endOfMonth(lm), preset }; }
    default:          return { from: startOfDay(subDays(now, 29)), to: endOfDay(now), preset: 'last30' };
  }
}

// Default state:
const [dateRange, setDateRange] = useState<DateRange>(() => getPresetRange('last30'));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| session-based requireAdmin (`req.session.userId`) | Supabase token `requireAdmin` from `"../lib/auth"` | Phase 9+ | Middleware import path matters |
| Drizzle push for migrations | Supabase CLI (`supabase db push`) | Per MEMORY.md | Migration for any new columns must use CLI |
| react-query v4 `useQuery` | react-query v5 `useQuery` (same API, slightly different types) | 5.60.5 installed | `data` is `undefined` not `null` when loading |

---

## Open Questions

1. **SOURCES-02: Best campaign per source** — the data model allows this (join visitor sessions to campaign data) but requires a sub-query or window function. The simplest approach is a second query: for each source in the result set, query the top campaign by booking count. At low row counts (<100 sources) this is fine. At scale, use a `RANK() OVER (PARTITION BY source)` window function in raw SQL. Recommend the simple two-query approach for Phase 12.

2. **CAMP-03: Landing pages per campaign** — requires counting `visitor_sessions.last_landing_page` grouped by campaign. The `last_landing_page` column is on `visitor_sessions`, not `conversion_events`. Requires joining visitor sessions to campaigns. Store as the top-3 landing pages per campaign (not a full list) to keep response payload small.

3. **Recent conversions time format** — "2 hours ago" requires a relative time formatter. `date-fns` provides `formatDistanceToNow(date, { addSuffix: true })` which returns "2 hours ago", "3 days ago". Confirmed available in date-fns 3.6.0.

4. **BarChart2 icon confirmation** — CONFIRMED available. `IntegrationsSection.tsx` line 2 imports `BarChart2` from `lucide-react` 0.453.0 and uses it on line 38 (`<BarChart2 className="w-3.5 h-3.5" /> Analytics`). No substitution needed.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 12 is purely code/UI changes with no external tool dependencies beyond the existing project stack (Node.js, PostgreSQL via Supabase, which are already running).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — no test framework installed |
| Config file | None |
| Quick run command | `npm run check` (TypeScript type check only) |
| Full suite command | `npm run check` |

No Jest, Vitest, or any test runner is installed. The project has only `"check": "tsc"` for validation.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| OVERVIEW-01 | KPI cards render visitors/bookings/revenue | Manual smoke | `npm run check` (type only) | No unit test possible |
| OVERVIEW-02 | Best-of cards populate | Manual smoke | `npm run check` | No unit test possible |
| OVERVIEW-03 | AreaChart renders with data | Manual smoke | `npm run check` | recharts is visual |
| OVERVIEW-04 | Recent conversions table renders | Manual smoke | `npm run check` | |
| OVERVIEW-05 | Empty state shows when no data | Manual smoke | `npm run check` | |
| SOURCES-01 | Sources table renders | Manual smoke | `npm run check` | |
| SOURCES-02 | Best campaign shown per source | Manual smoke | `npm run check` | |
| SOURCES-03 | Direct/Unknown always present with tooltip | Manual smoke | `npm run check` | |
| SOURCES-04 | Display names not raw UTM values | TypeScript (`getSourceDisplayName`) | `npm run check` | |
| CAMP-01 | Campaigns table renders | Manual smoke | `npm run check` | |
| CAMP-02 | Zero bookings shows "No bookings yet" | Manual smoke | `npm run check` | |
| CAMP-03 | Landing pages per campaign shown | Manual smoke | `npm run check` | |
| CAMP-04 | Same campaign + diff source = separate rows | Manual smoke | `npm run check` | |
| FILTER-01 | Date presets trigger data refetch | Manual smoke | `npm run check` | |
| FILTER-03 | Default = Last 30 days | TypeScript (initial state) | `npm run check` | |
| UX-01 | Marketing appears in sidebar | TypeScript (AdminSection type) | `npm run check` | |
| UX-02 | Business-friendly labels | Manual review | `npm run check` | |
| UX-03 | Empty states exist per view | Manual smoke | `npm run check` | |

### Sampling Rate

- **Per task commit:** `npm run check` (TypeScript — catches type errors immediately)
- **Per wave merge:** `npm run check` + manual browser test of the new routes
- **Phase gate:** `npm run check` passes + admin section loads + GET endpoints return 200 with correct shape

### Wave 0 Gaps

- [ ] `client/src/lib/analytics-display.ts` — utility functions needed by all three tabs
- [ ] `AdminSection` type extended with `'marketing'` in `shared/types.ts`
- [ ] `server/storage/analytics.ts` — stub functions returning empty data (for migration-pending safety)
- [ ] `server/routes/analytics.ts` — 3 GET endpoint stubs returning empty shape behind `requireAdmin`
- [ ] `client/src/components/admin/MarketingSection.tsx` — top-level component with empty states

---

## Project Constraints (from CLAUDE.md)

| Directive | Constraint for Phase 12 |
|-----------|------------------------|
| Frontend: React 18, TypeScript, Vite, Wouter, React Query, shadcn/ui, Tailwind | All components must use these; no class components, no Redux |
| Backend: Express.js, TypeScript, Drizzle ORM, PostgreSQL | GET endpoints use Drizzle aggregate queries; no raw SQL strings except `sql` template tag |
| Auth: Supabase-based admin auth | Import `requireAdmin` from `"../lib/auth"`, NOT `"../middleware/auth"` |
| Brand colors: Primary Blue `#1C53A3`, Brand Yellow `#FFFF01` | Chart colors locked to these values per D-17 |
| CTA Buttons: Brand Yellow with black bold text, pill-shaped | Any primary action buttons in the marketing section follow this pattern |
| Commands: `npm run check` for TypeScript checking, `npm run db:push` — NEVER use this | Per MEMORY.md: use Supabase CLI for all DB migrations, never `drizzle-kit push` |

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `server/routes/analytics.ts` — confirmed existing POST endpoints, no GET endpoints yet
- Direct code inspection: `server/storage/analytics.ts` — confirmed Drizzle import pattern (`import { db } from "../db"`, `import { eq } from "drizzle-orm"`)
- Direct code inspection: `server/lib/auth.ts` line 250 — `requireAdmin` canonical location confirmed
- Direct code inspection: `client/src/components/admin/IntegrationsSection.tsx` line 2 — `BarChart2` confirmed in lucide-react 0.453.0
- Direct code inspection: `client/src/components/admin/DashboardSection.tsx` — KPI card pattern confirmed
- Direct code inspection: `client/src/components/admin/BlogSection.tsx` line 54 — local `useState` tab pattern confirmed
- Direct code inspection: `shared/schema.ts` lines 125–235 — exact column names for `visitorSessions` and `conversionEvents`
- Direct code inspection: `client/src/components/admin/shared/types.ts` — `AdminSection` union type confirmed missing `'marketing'`
- Package.json: recharts 2.15.2, date-fns 3.6.0, lucide-react 0.453.0, react-query 5.60.5 — all confirmed

### Secondary (MEDIUM confidence)

- Prior project research: `.planning/research/SUMMARY.md` — architecture decisions, pitfalls
- Prior project research: `.planning/research/FEATURES.md` — feature prioritization, empty state design

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed with exact versions
- Architecture: HIGH — patterns copied from existing codebase, no speculation
- Drizzle aggregate queries: HIGH — patterns verified against existing usage in storage/blog.ts, storage/staff.ts, storage/bookings.ts
- requireAdmin import path: HIGH — verified against 5+ existing route files
- BarChart2 availability: HIGH — confirmed in IntegrationsSection.tsx import

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable stack)
