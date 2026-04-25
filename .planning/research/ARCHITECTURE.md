# Architecture Research: First-Party UTM Tracking Integration

**Domain:** Marketing attribution layer for a cleaning service booking platform
**Researched:** 2026-04-25
**Confidence:** HIGH — recommendations are grounded in codebase inspection of actual file paths plus verified patterns from production analytics systems (Umami, PostHog)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Customer)                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  useUTMCapture hook (new)                                    │   │
│  │  · Reads URL params on first load                           │   │
│  │  · Reads/writes localStorage: skleanings_visitor_id         │   │
│  │  │                            skleanings_first_touch        │   │
│  │  │                            skleanings_last_touch         │   │
│  │  · Fires POST /api/analytics/session (fire-and-forget)      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────┐   ┌──────────────────────────────────────┐   │
│  │  BookingPage.tsx │   │  Confirmation.tsx (modified)         │   │
│  │  (modified)      │──▶│  · reads visitorId from localStorage │   │
│  │  · reads         │   │  · appends to POST /api/bookings     │   │
│  │    visitorId     │   │  · fires POST /api/analytics/events  │   │
│  └──────────────────┘   └──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                │ HTTP                           │ HTTP
                ▼                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER (server/)                          │
│                                                                     │
│  server/routes/analytics.ts (new)                                   │
│  ├── POST /api/analytics/session   → upsertVisitorSession()        │
│  ├── POST /api/analytics/events    → recordConversionEvent()        │
│  ├── GET  /api/analytics/overview  → getMarketingOverview()        │
│  ├── GET  /api/analytics/campaigns → getCampaignPerformance()      │
│  ├── GET  /api/analytics/sources   → getSourcePerformance()        │
│  ├── GET  /api/analytics/conversions → getConversionsList()        │
│  └── GET  /api/analytics/journey/:visitorId → getVisitorJourney()  │
│                                                                     │
│  server/routes/bookings.ts (modified)                               │
│  └── POST /api/bookings            → createBooking() with          │
│                                       visitorId from body           │
│                                       → storage.linkBookingAttrib() │
│                                                                     │
│  server/storage/analytics.ts (new)                                  │
│  ├── upsertVisitorSession()                                         │
│  ├── recordConversionEvent()                                        │
│  ├── linkBookingToAttribution()                                     │
│  └── query functions for each dashboard view                        │
└─────────────────────────────────────────────────────────────────────┘
                │ Drizzle ORM
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL (Supabase)                             │
│                                                                     │
│  visitor_sessions          conversion_events                        │
│  (one row per visitor)     (one row per event per visitor)          │
│                                                                     │
│  bookings (modified)                                                │
│  · utm_session_id FK (nullable)                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New / Modified |
|-----------|---------------|----------------|
| `useUTMCapture` hook | Reads URL params, generates/persists visitor UUID, fires session POST | New — `client/src/hooks/use-utm-capture.ts` |
| `App.tsx` `AnalyticsProvider` | Mount point for `useUTMCapture` (runs on every route load) | Modified — add hook call inside existing `AnalyticsProvider` |
| `BookingPage.tsx` | Reads `visitorId` from localStorage; injects into booking form payload | Modified — adds one field to the submitted payload |
| `Confirmation.tsx` | Fires `booking_completed` conversion event after successful booking | Modified — adds POST to `/api/analytics/events` |
| `server/routes/analytics.ts` | All analytics API endpoints; admin endpoints protected by `requireAdmin` | New |
| `server/storage/analytics.ts` | All DB queries for UTM tables; follows domain-module pattern | New |
| `shared/schema.ts` | Adds `visitorSessions` and `conversionEvents` table definitions | Modified |
| `visitor_sessions` table | One row per visitor; first-touch preserved, last-touch updated | New DB table |
| `conversion_events` table | One row per tracked action; links to visitor session | New DB table |
| `bookings.utm_session_id` | FK connecting a booking to the attribution row | New nullable column |

---

## Database Schema Design

### Table: `visitor_sessions`

One row per anonymous visitor. First-touch columns are written once and never overwritten. Last-touch columns are updated on every meaningful visit (any visit that carries UTM params or a new referrer).

```typescript
// shared/schema.ts addition
export const visitorSessions = pgTable("visitor_sessions", {
  id: uuid("id").primaryKey(),              // client-generated UUID (localStorage)
  // First-touch attribution (written once, never updated)
  firstSource:      text("first_source"),   // utm_source or classified source
  firstMedium:      text("first_medium"),   // utm_medium or classified medium
  firstCampaign:    text("first_campaign"), // utm_campaign
  firstTerm:        text("first_term"),     // utm_term
  firstContent:     text("first_content"),  // utm_content
  firstLandingPage: text("first_landing_page"), // full pathname
  firstReferrer:    text("first_referrer"),  // document.referrer
  firstSeenAt:      timestamp("first_seen_at").defaultNow().notNull(),
  // Last-touch attribution (overwritten on each meaningful visit)
  lastSource:       text("last_source"),
  lastMedium:       text("last_medium"),
  lastCampaign:     text("last_campaign"),
  lastTerm:         text("last_term"),
  lastContent:      text("last_content"),
  lastLandingPage:  text("last_landing_page"),
  lastReferrer:     text("last_referrer"),
  lastSeenAt:       timestamp("last_seen_at").defaultNow().notNull(),
  // Classification (derived on server from UTM params + referrer)
  trafficSource:    text("traffic_source").notNull().default("unknown"),
  // 'organic_search' | 'paid_search' | 'organic_social' | 'paid_social'
  // | 'email' | 'referral' | 'direct' | 'unknown'
  visitCount:       integer("visit_count").notNull().default(1),
  convertedAt:      timestamp("converted_at"),   // first conversion timestamp
  totalBookings:    integer("total_bookings").notNull().default(0),
});
```

**Indexes:**

```sql
-- Fast lookup when a booking is created and we resolve the visitor
CREATE INDEX idx_visitor_sessions_first_source ON visitor_sessions(first_source);
CREATE INDEX idx_visitor_sessions_traffic_source ON visitor_sessions(traffic_source);
CREATE INDEX idx_visitor_sessions_first_seen_at ON visitor_sessions(first_seen_at);
CREATE INDEX idx_visitor_sessions_last_seen_at ON visitor_sessions(last_seen_at);
-- Supports campaign performance query (GROUP BY first_campaign)
CREATE INDEX idx_visitor_sessions_first_campaign ON visitor_sessions(first_campaign);
```

### Table: `conversion_events`

One row per conversion action. Captures a denormalized snapshot of attribution at time of event so reports never need joins to get source context.

```typescript
export const conversionEvents = pgTable("conversion_events", {
  id:              serial("id").primaryKey(),
  visitorId:       uuid("visitor_id").references(() => visitorSessions.id, { onDelete: "set null" }),
  eventType:       text("event_type").notNull(),
  // 'booking_completed' | 'form_submit' | 'phone_click' | 'quote_request'
  bookingId:       integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  bookingValue:    numeric("booking_value", { precision: 10, scale: 2 }),
  // Denormalized attribution snapshot at event time (no JOIN needed for reports)
  attributedSource:   text("attributed_source"),
  attributedMedium:   text("attributed_medium"),
  attributedCampaign: text("attributed_campaign"),
  attributedLandingPage: text("attributed_landing_page"),
  attributionModel: text("attribution_model").notNull().default("last_touch"),
  // 'first_touch' | 'last_touch'
  occurredAt:      timestamp("occurred_at").defaultNow().notNull(),
  pageUrl:         text("page_url"),
  metadata:        jsonb("metadata").default({}), // flexible extra data
});
```

**Indexes:**

```sql
-- Primary reporting queries: by date, by type, by source
CREATE INDEX idx_conversion_events_occurred_at ON conversion_events(occurred_at);
CREATE INDEX idx_conversion_events_event_type ON conversion_events(event_type);
CREATE INDEX idx_conversion_events_attributed_source ON conversion_events(attributed_source);
CREATE INDEX idx_conversion_events_attributed_campaign ON conversion_events(attributed_campaign);
-- Visitor journey lookup
CREATE INDEX idx_conversion_events_visitor_id ON conversion_events(visitor_id);
-- Booking linkage
CREATE INDEX idx_conversion_events_booking_id ON conversion_events(booking_id);
```

### Modification: `bookings` table

Add one nullable column so any booking can be joined directly to its attribution session without going through conversion_events.

```typescript
// In shared/schema.ts, inside the bookings pgTable definition — add:
utmSessionId: uuid("utm_session_id").references(() => visitorSessions.id, { onDelete: "set null" }),
```

**Rationale for denormalization:** The admin dashboard needs attribution data per booking for the Conversions view. A FK on `bookings` means `SELECT bookings.*, visitor_sessions.*` works without a subquery through `conversion_events`. The conversion_events record for `booking_completed` captures the same data redundantly — this is intentional and eliminates JOIN complexity in reporting queries.

---

## Client-Side Architecture

### Session ID Strategy: localStorage UUID (recommended)

Use `localStorage` with a UUID generated on first visit. This is the correct choice for this platform because:

- **Booking journeys span multiple sessions.** A visitor may land Monday via a Google Ads click, return Wednesday organically, and book Thursday. `sessionStorage` would lose first-touch on the Wednesday return. `localStorage` preserves it.
- **No cookies required.** Avoids GDPR cookie consent complexity for a non-PII identifier. The UUID is anonymous — it links to no personal data until a booking is completed (and at that point the booking already contains customer PII separately).
- **Safari 7-day ITP caveat:** Safari clears `localStorage` after 7 days of inactivity. For a cleaning service booking cycle (typically 1-7 days from discovery to booking), this is acceptable. The first-touch row is already written to the server on first visit, so server-side data survives even if the client localStorage is cleared.

**Key names:**
```
skleanings_visitor_id   — UUID string, never expires
skleanings_first_touch  — JSON snapshot of first UTM params (for client-side idempotency check)
```

### Where to Place the Hook: Inside `AnalyticsProvider` in `App.tsx`

The `AnalyticsProvider` component in `client/src/App.tsx` (lines 77-101) already runs on every route, already has access to `useLocation`, and already handles GA4/GTM initialization. Adding `useUTMCapture()` inside this component is the correct mount point because:

1. It fires on every page load, not just the first.
2. It is inside `QueryClientProvider` (needed for the fire-and-forget fetch).
3. It is outside admin routes — UTM capture only applies to customer-facing pages.

The hook itself lives at `client/src/hooks/use-utm-capture.ts`.

### Hook Logic

```typescript
// client/src/hooks/use-utm-capture.ts  (pseudocode — implementation detail)
export function useUTMCapture() {
  const [location] = useLocation();

  useEffect(() => {
    // 1. Generate or retrieve visitor UUID
    let visitorId = localStorage.getItem('skleanings_visitor_id');
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem('skleanings_visitor_id', visitorId);
    }

    // 2. Read UTM params from current URL
    const params = new URLSearchParams(window.location.search);
    const utmSource   = params.get('utm_source');
    const utmMedium   = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    const utmTerm     = params.get('utm_term');
    const utmContent  = params.get('utm_content');
    const referrer    = document.referrer;
    const landingPage = window.location.pathname + window.location.search;

    // 3. Only fire if this visit has attribution signal
    //    (has UTM params OR has a referrer OR is a new visitor)
    const isNewVisitor = !localStorage.getItem('skleanings_first_touch');
    const hasSignal = utmSource || referrer || isNewVisitor;
    if (!hasSignal) return;

    // 4. Persist first-touch idempotency marker client-side
    if (isNewVisitor) {
      localStorage.setItem('skleanings_first_touch', JSON.stringify({
        source: utmSource, medium: utmMedium, campaign: utmCampaign,
        landingPage, referrer, capturedAt: Date.now()
      }));
    }

    // 5. Fire-and-forget to server — never await, never block render
    fetch('/api/analytics/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId, utmSource, utmMedium, utmCampaign,
        utmTerm, utmContent, referrer, landingPage,
        isNewVisitor,
      }),
    }).catch(() => { /* silent — analytics must never break UX */ });
  }, [location]); // re-runs on every navigation but only fires when signal exists
}
```

### Booking Flow Integration

**File: `client/src/pages/BookingPage.tsx`** (modified)

The booking form already submits a payload to `POST /api/bookings`. Add one field:

```typescript
// Before submitting, read visitorId:
const visitorId = localStorage.getItem('skleanings_visitor_id') ?? undefined;

// Include in the payload:
const payload = { ...formData, visitorId };
```

No schema changes needed for the Zod form schema — `visitorId` is appended outside the form validation.

**File: `client/src/pages/Confirmation.tsx`** (modified)

After the `trackPurchase` call in the existing `useEffect` (line 43), fire the conversion event:

```typescript
if (visitorId && bookingId) {
  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId,
      eventType: 'booking_completed',
      bookingId,
      bookingValue: totalPrice,
      pageUrl: window.location.href,
    }),
  }).catch(() => {});
}
```

---

## Server-Side Architecture

### Route Registration

Add to `server/routes.ts`:

```typescript
import analyticsRouter from "./routes/analytics";
// ...
app.use("/api/analytics", analyticsRouter);
```

### New File: `server/routes/analytics.ts`

```
POST /api/analytics/session    — public (no auth)
POST /api/analytics/events     — public (no auth)
GET  /api/analytics/overview   — requireAdmin
GET  /api/analytics/campaigns  — requireAdmin
GET  /api/analytics/sources    — requireAdmin
GET  /api/analytics/conversions — requireAdmin
GET  /api/analytics/journey/:visitorId — requireAdmin
```

The session and event endpoints are public because they are called from the customer-facing site before any admin session exists. Rate limiting should be applied to these two endpoints (use the existing `canCreateBooking` / rate-limit lib as a reference, or add IP-based throttling in the route handler).

### Traffic Source Classification (server-side)

Classification runs in `server/lib/traffic-classifier.ts` (new small utility). The server is authoritative for classification because it avoids shipping a classification library to the client bundle. Logic:

```
if utm_medium == 'email'                          → 'email'
if utm_medium in ['cpc','ppc','paid','paidsearch'] → 'paid_search'
if utm_medium in ['paid_social','paidsocial']      → 'paid_social'
if utm_source matches SEARCH_ENGINES list          → 'organic_search'
if utm_source matches SOCIAL_NETWORKS list         → 'organic_social'
if referrer matches SEARCH_ENGINES list (no UTM)   → 'organic_search'
if referrer matches SOCIAL_NETWORKS list (no UTM)  → 'organic_social'
if referrer is non-empty and not self              → 'referral'
if no referrer and no UTM                          → 'direct'
default                                            → 'unknown'
```

Known search engines: google, bing, yahoo, duckduckgo, baidu, yandex, ecosia.
Known social networks: facebook, instagram, twitter, x.com, linkedin, pinterest, tiktok, youtube, snapchat.

### Upsert Logic in `server/storage/analytics.ts`

`upsertVisitorSession(payload)`:

```
1. SELECT * FROM visitor_sessions WHERE id = payload.visitorId
2. If not found:
   → INSERT with first_* and last_* columns both set from payload
   → Set traffic_source from classifier
   → visit_count = 1
3. If found:
   → UPDATE last_* columns from payload (if payload has UTM signal)
   → INCREMENT visit_count
   → Keep first_* columns unchanged (never overwrite)
4. Return the row
```

`linkBookingToAttribution(bookingId, visitorId)`:

```
1. UPDATE bookings SET utm_session_id = visitorId WHERE id = bookingId
2. UPDATE visitor_sessions SET
     converted_at = NOW() (if null),
     total_bookings = total_bookings + 1
   WHERE id = visitorId
```

`recordConversionEvent(payload)`:

```
1. Fetch visitor_sessions row for visitorId
2. Build two conversion_event rows:
   - one with attribution_model = 'first_touch' (first_* cols)
   - one with attribution_model = 'last_touch'  (last_* cols)
3. INSERT both rows
4. If eventType == 'booking_completed': call linkBookingToAttribution()
```

Writing both first-touch and last-touch rows at conversion time means dashboard queries never need to join `visitor_sessions` — they simply filter `conversion_events` by `attribution_model`.

### New File: `server/storage/analytics.ts`

Follows the same pattern as `server/storage/bookings.ts`:
- Named exports (not class methods)
- Drizzle queries with `db.select()`, `db.insert()`, `db.update()`
- Re-exported from `server/storage/index.ts`

---

## Admin Dashboard Data Layer

### API Endpoint Shapes

**GET `/api/analytics/overview?from=&to=`**
Returns:
```json
{
  "totalVisitors": 142,
  "totalConversions": 18,
  "conversionRate": 12.7,
  "totalRevenue": 3240.00,
  "topSource": "google / organic",
  "topCampaign": "spring-cleaning-2026",
  "topLandingPage": "/services",
  "trendByDay": [{ "date": "2026-04-01", "visitors": 12, "conversions": 2 }]
}
```

**GET `/api/analytics/campaigns?from=&to=`**
```json
[{
  "campaign": "spring-cleaning-2026",
  "source": "google",
  "medium": "cpc",
  "visitors": 48,
  "conversions": 7,
  "conversionRate": 14.6,
  "revenue": 1260.00,
  "landingPages": ["/services", "/"]
}]
```

**GET `/api/analytics/sources?from=&to=`**
```json
[{
  "source": "google",
  "medium": "organic",
  "trafficSource": "organic_search",
  "visitors": 62,
  "conversions": 9,
  "conversionRate": 14.5,
  "revenue": 1620.00,
  "bestCampaign": "(none)"
}]
```

**GET `/api/analytics/conversions?from=&to=&type=&source=`**
Returns paginated list of individual conversion events with full attribution context.

**GET `/api/analytics/journey/:visitorId`**
Returns ordered list of session touches and events for a single visitor.

### Query Strategy

All dashboard queries operate on `conversion_events` joined to `visitor_sessions` only when the visitor journey is needed. The heavy reporting queries (`overview`, `campaigns`, `sources`) use only `conversion_events.attributed_*` columns — no joins required. This is why the denormalized snapshot at event time pays off.

Example Drizzle pattern for campaign performance:
```typescript
db.select({
  campaign: conversionEvents.attributedCampaign,
  source: conversionEvents.attributedSource,
  conversions: count(),
  revenue: sum(conversionEvents.bookingValue),
})
.from(conversionEvents)
.where(
  and(
    gte(conversionEvents.occurredAt, fromDate),
    lte(conversionEvents.occurredAt, toDate),
    eq(conversionEvents.attributionModel, 'last_touch'),
    eq(conversionEvents.eventType, 'booking_completed'),
  )
)
.groupBy(conversionEvents.attributedCampaign, conversionEvents.attributedSource)
```

### Frontend Admin Section

**New file: `client/src/components/admin/MarketingSection.tsx`**

Follows the exact pattern of `DashboardSection.tsx` and `BookingsSection.tsx`:
- Uses `useQuery` from React Query
- Uses `authenticatedRequest` for admin-protected endpoints
- Uses `Card`, `CardContent` from shadcn/ui
- Uses `recharts` (already installed — `recharts 2.15.2`) for trend charts
- Uses `Select` for date range and dimension filters
- Tab-based sub-navigation: Overview | Campaigns | Sources | Conversions | Visitor Journey

**Register in `client/src/pages/Admin.tsx`:**
1. Add `{ id: 'marketing', title: 'Marketing', icon: TrendingUp }` to `menuItems` array
2. Import `MarketingSection` component
3. Add `case 'marketing':` to the section renderer

---

## Data Flow

### UTM Capture Flow

```
Visitor arrives at /?utm_source=google&utm_medium=cpc
    ↓
App.tsx AnalyticsProvider mounts → useUTMCapture() fires
    ↓
localStorage check: no visitor_id found
    → generate UUID → store as skleanings_visitor_id
    → store first_touch JSON locally (idempotency)
    ↓
POST /api/analytics/session  { visitorId, utmSource, utmMedium, ... }
    ↓
server/routes/analytics.ts → no auth required
    ↓
traffic-classifier.ts → classifies as 'paid_search'
    ↓
storage.upsertVisitorSession() → INSERT new row
    ↓
200 OK (client ignores response — fire and forget)
```

### Booking Conversion Flow

```
Customer completes booking form on BookingPage.tsx
    ↓
Form reads visitorId from localStorage
    ↓
POST /api/bookings  { ...formData, visitorId: "uuid-here" }
    ↓
server/routes/bookings.ts (existing handler — modified)
    ↓
storage.createBooking() — unchanged
    ↓  (after booking is created, non-blocking)
storage.linkBookingToAttribution(booking.id, visitorId)
    → UPDATE bookings SET utm_session_id = visitorId
    → UPDATE visitor_sessions SET total_bookings++, converted_at
    ↓
Redirect to /confirmation?...
    ↓
Confirmation.tsx mounts → fires POST /api/analytics/events
    { visitorId, eventType: 'booking_completed', bookingId, bookingValue }
    ↓
storage.recordConversionEvent()
    → INSERT two conversion_events rows (first_touch + last_touch)
    ↓
Admin dashboard queries conversion_events for reports
```

### Admin Dashboard Query Flow

```
Admin navigates to /admin/marketing
    ↓
MarketingSection.tsx mounts → useQuery(['/api/analytics/overview', filters])
    ↓
GET /api/analytics/overview?from=2026-04-01&to=2026-04-30
    ↓
requireAdmin middleware → session check
    ↓
storage.getMarketingOverview(from, to)
    ↓
Drizzle SELECT + GROUP BY on conversion_events table
    (no JOIN to visitor_sessions — denormalized columns used)
    ↓
JSON response → recharts AreaChart renders trend line
```

---

## Build Order and Dependencies

The following order is mandatory because each step depends on the previous.

### Step 1: Database Schema (blocks everything)

**Files modified/created:**
- `shared/schema.ts` — add `visitorSessions` table, `conversionEvents` table, `utmSessionId` column to `bookings`
- Supabase migration via CLI

No code can reference these tables until the migration runs.

### Step 2: Server Storage Layer

**Files created:**
- `server/storage/analytics.ts` — all Drizzle queries
- `server/lib/traffic-classifier.ts` — source classification utility
- `server/storage/index.ts` — add `import * as analytics from "./analytics"` and re-export

Depends on: Step 1 (tables must exist for Drizzle to type-check).

### Step 3: Server Routes

**Files created:**
- `server/routes/analytics.ts` — all endpoints

**Files modified:**
- `server/routes.ts` — register analytics router
- `server/routes/bookings.ts` — add `visitorId` handling after `createBooking()` call

Depends on: Step 2 (storage functions must exist).

### Step 4: Client UTM Capture Hook

**Files created:**
- `client/src/hooks/use-utm-capture.ts`

**Files modified:**
- `client/src/App.tsx` — call `useUTMCapture()` inside `AnalyticsProvider`

Depends on: Step 3 (the hook fires POST /api/analytics/session).

### Step 5: Booking Flow Integration

**Files modified:**
- `client/src/pages/BookingPage.tsx` — read `visitorId` from localStorage, append to POST body
- `client/src/pages/Confirmation.tsx` — fire `booking_completed` conversion event

Depends on: Step 4 (visitor UUID must be available in localStorage).

### Step 6: Admin Dashboard UI

**Files created:**
- `client/src/components/admin/MarketingSection.tsx` (and sub-components)

**Files modified:**
- `client/src/pages/Admin.tsx` — add `marketing` to `menuItems`, register section component

Depends on: Step 3 (API endpoints must respond) + Step 5 (data must be flowing in).

---

## Integration Points with Existing Code

| Existing File | Change | Scope |
|---------------|--------|-------|
| `shared/schema.ts` | Add 2 new tables + 1 column to `bookings` | Low risk — additive |
| `server/routes.ts` | Add `app.use("/api/analytics", analyticsRouter)` | 1 line |
| `server/routes/bookings.ts` | After `storage.createBooking()` call (~line 94), call `storage.linkBookingToAttribution()` non-blocking | Low risk — same pattern as GHL sync |
| `server/storage/index.ts` | Add `import * as analytics` and spread into exported object | Pattern already established |
| `client/src/App.tsx` | Add `useUTMCapture()` call inside `AnalyticsProvider` (line ~84) | 1 line inside existing component |
| `client/src/pages/BookingPage.tsx` | Read `localStorage.getItem('skleanings_visitor_id')` and append to form submit payload | 2-3 lines |
| `client/src/pages/Confirmation.tsx` | Fire analytics conversion event after `trackPurchase` (line ~43) | ~10 lines |
| `client/src/pages/Admin.tsx` | Add `marketing` menu item to `menuItems` array + import + render case | ~5 lines |

---

## Architectural Patterns

### Pattern 1: Fire-and-Forget for All Analytics Writes

**What:** Every client-side analytics call uses `.catch(() => {})` and never awaits.
**When to use:** All analytics endpoint calls from the customer frontend.
**Trade-offs:** Analytics data may be occasionally missing for users with network issues, but the booking flow is never blocked or broken.

### Pattern 2: Server-Side Classification, Client-Side Capture

**What:** Client reads raw URL params and sends them as-is. Server runs the classification algorithm and writes the `traffic_source` label.
**When to use:** Classification logic involves lists of known domains that would bloat the client bundle.
**Trade-offs:** Server sees slightly delayed classification (one network hop after page load). Not a problem for reporting.

### Pattern 3: Dual-Row Conversion Events (first_touch + last_touch)

**What:** When a conversion fires, two rows are inserted into `conversion_events` — one for first-touch attribution, one for last-touch.
**When to use:** When both models need to appear in the same dashboard.
**Trade-offs:** Doubles conversion_events write volume. For a cleaning company booking a few hundred bookings per month, this is completely acceptable. Avoids complex SQL CASE logic in every report query.

### Pattern 4: Denormalized Attribution Snapshot at Event Time

**What:** `conversion_events` stores `attributed_source`, `attributed_medium`, `attributed_campaign` directly, copied from the visitor session at the moment of conversion.
**When to use:** Any system where reporting queries need to be fast and the source data (visitor session) can change over time.
**Trade-offs:** Data duplication. If you want to retroactively change how a session was classified, it does not affect already-recorded conversion events. This is correct behavior for an attribution system.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Sending Attribution Data as Part of the Booking POST Body to Store it in Bookings

**What people do:** Add `utm_source`, `utm_medium`, etc. as columns on the `bookings` table and populate them from the form.
**Why it's wrong:** The bookings table is customer PII territory. Mixing attribution data there makes the schema messy, makes it impossible to track visits that did not convert, and prevents cross-booking attribution analysis per visitor.
**Do this instead:** Foreign key (`utm_session_id`) on bookings pointing to `visitor_sessions`. Attribution data lives in its own table.

### Anti-Pattern 2: Capturing UTMs on Every Page Navigation Without Deduplication

**What people do:** Fire a session upsert on every `useLocation` change regardless of whether there are any UTM params.
**Why it's wrong:** It creates noise in visit_count, makes "last touch" meaningless (every internal navigation updates it), and generates unnecessary server load.
**Do this instead:** Only fire when there is a UTM signal (`utm_source` present) OR a new external referrer OR the visitor is brand new. Internal navigations (same domain referrer, no UTMs) should be silently skipped.

### Anti-Pattern 3: Making the Analytics Session POST Block the Booking Flow

**What people do:** `await fetch('/api/analytics/session')` before letting the booking proceed.
**Why it's wrong:** If the analytics endpoint is slow or fails, the customer cannot book. Analytics must never be a dependency of the core booking flow.
**Do this instead:** All analytics calls are fire-and-forget. The `visitorId` is already in `localStorage` from the initial capture, so the booking POST can include it without waiting for any analytics response.

### Anti-Pattern 4: Relying on `sessionStorage` for the Visitor UUID

**What people do:** Use `sessionStorage` because it feels safer and auto-expires.
**Why it's wrong:** A user who visits Monday and returns Thursday has lost their first-touch attribution. For a booking platform with multi-session journeys, `sessionStorage` makes first-touch analysis impossible.
**Do this instead:** `localStorage` for the UUID (persists indefinitely). The server's `visitor_sessions` table is the authoritative record anyway — if `localStorage` clears (Safari ITP), the next visit creates a new UUID, which is acceptable.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-10k bookings/year | Current design is exactly right — monolith, single PostgreSQL, all in same DB |
| 10k-100k visitors/month | Add index on `conversion_events(occurred_at, attributed_source)` as composite; consider partitioning `conversion_events` by month |
| 100k+ visitors/month | Move analytics writes to a write queue (existing Node process or simple pg LISTEN/NOTIFY); dashboard queries may need materialized views for overview aggregates |

At the expected volume for a single cleaning company (hundreds of bookings per month, thousands of visitors per month), the current design handles reporting queries in under 100ms with the indexes defined above.

---

## Sources

- PostHog first-touch/last-touch attribution tutorial: https://posthog.com/tutorials/first-last-touch-attribution
- Umami analytics DB schema breakdown: https://memo.d.foundation/breakdown/umami
- Persistent UTM tracking guide (localStorage rationale): https://fiveninestrategy.com/persistent-utm-tracking-guide/
- Drizzle ORM aggregation docs: https://orm.drizzle.team/docs/select
- Drizzle date grouping discussion: https://github.com/drizzle-team/drizzle-orm/discussions/2893
- GA4 traffic classification algorithm: https://analyticsdetectives.com/blog/direct-traffic-in-ga4
- UTM persistence best practices 2025: https://voxxycreativelab.com/utm-parameters-to-first-party-cookies/

---
*Architecture research for: First-party UTM tracking, Skleanings booking platform*
*Researched: 2026-04-25*
