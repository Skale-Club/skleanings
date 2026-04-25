# Stack Research

**Domain:** First-party UTM tracking and marketing attribution (Express + React + Drizzle + PostgreSQL)
**Researched:** 2026-04-25
**Confidence:** HIGH (no new packages needed beyond one optional addition; all core decisions verified against existing stack)

---

## Summary Verdict

**Zero new runtime dependencies required.** Every technical need for UTM capture, attribution modeling, and the analytics dashboard is already present in the existing stack. The only optional addition is `cookie-parser` to simplify reading the anonymous visitor cookie on the server — but even that can be replaced with raw `req.headers.cookie` parsing since Express does not include it natively.

---

## Recommended Stack

### Core Technologies (all already installed)

| Technology | Version | Role in This Milestone | Why This (Not Something Else) |
|------------|---------|------------------------|-------------------------------|
| Express 4 | 4.21.2 | Visitor cookie endpoint, UTM session write API | Already the server; cookie injection via `res.cookie()` needs no library |
| Drizzle ORM | 0.39.3 | `utm_sessions` and `conversion_events` table definitions, composite indexes | `index().using('btree', ...)` syntax supports composite indexes; BRIN syntax also available |
| PostgreSQL (Supabase) | — | Persistent attribution store | Row-level queries on small-to-medium attribution tables; no time-series DB needed at this scale |
| React Query (`@tanstack/react-query`) | 5.60.5 | Dashboard data fetching with stale-while-revalidate | Admin panel already uses this pattern exclusively |
| recharts | 2.15.2 | Trend line/area charts in marketing dashboard | Already installed; `AreaChart`, `LineChart`, `ResponsiveContainer`, `XAxis`, `YAxis`, `Tooltip` cover all needed chart types |
| date-fns | 3.6.0 | Date range formatting, relative labels (e.g., "Last 30 days") | Already installed; no moment.js needed |
| Zod | 3.24.2 | API schema validation for UTM capture endpoint | Consistent with all other route validation in the codebase |
| `crypto.randomUUID()` | Node.js built-in (v14.17+, running 20.x) | Anonymous visitor ID generation | Faster than the `uuid` npm package (350ns vs 1030ns); zero dependency; UUID v4 compatible |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cookie-parser` | ~1.4.7 | Parse inbound `Cookie` header on Express routes to read the `_vid` anonymous visitor cookie | **Optional.** Add only if direct `req.cookies` access is preferred over parsing `req.headers.cookie` manually. Very small package (~1KB). |

No other additions needed.

---

## UTM Capture Strategy

**Recommendation: dual-write — localStorage (first-touch persistence) + server-set HTTP cookie (ITP-safe last-touch)**

### Why Not sessionStorage Alone
sessionStorage is wiped when the tab closes. A user who opens a new tab loses attribution. Unusable for first-touch preservation.

### Why Not localStorage Alone
Safari Intelligent Tracking Prevention (ITP) expires all client-side storage (localStorage, sessionStorage, IndexedDB) after 7 days of site inactivity. A user who clicks a Google Ads link, then returns 10 days later on Safari is misidentified as direct traffic. For a cleaning service with long decision windows, this is a real attribution gap.

### The Dual-Write Pattern

**Step 1 — On page load (client-side, `useEffect`):**
1. Parse `window.location.search` for UTM parameters + `document.referrer` + `window.location.pathname` (landing page).
2. If UTM params are found:
   - Write to `localStorage` under key `_utm_first` **only if that key does not already exist** (first-touch preservation).
   - Always overwrite `localStorage` key `_utm_last` (last-touch update).
3. Call `POST /api/analytics/session` with the captured UTM payload + the anonymous visitor ID read from the `_vid` cookie (if it exists).

**Step 2 — Server-side (`POST /api/analytics/session`):**
1. If no `_vid` cookie exists on the request: generate a UUID v4 via `crypto.randomUUID()` and return it as a server-set `Set-Cookie: _vid=<uuid>; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly=false` (must be readable by JS for the booking flow to attach it to conversion events).
2. Server-set cookies survive Safari ITP (they are not JavaScript-set cookies). Max-Age of 1 year is appropriate for a residential service business where sales cycles can span months.
3. Write the UTM session row to the `utm_sessions` table.

**Why `HttpOnly=false` for `_vid`:**
The booking flow (client-side) needs to read `_vid` to attach it to conversion events when the booking is submitted. `HttpOnly=true` would prevent this. The `_vid` value is a random UUID with no PII — it carries no meaningful value to an attacker.

**Step 3 — On booking completion:**
The booking form submission (`POST /api/bookings`) reads `_vid` from `document.cookie` and includes it in the payload. The server joins `_vid` to `utm_sessions` to resolve the attribution chain and writes to `conversion_events`.

---

## PostgreSQL Indexing Strategy

Marketing attribution queries fall into two patterns:

**Pattern A — Aggregate reports (GROUP BY source, campaign, date range):**
Most dashboard queries. Filter on `created_at` date range + group on `utm_source`, `utm_medium`, `utm_campaign`.

**Pattern B — Lookup by visitor (JOIN path for visitor journey view):**
Filter on `visitor_id` to reconstruct a single visitor's session history.

### Recommended Indexes for `utm_sessions`

```typescript
// In shared/schema.ts — table definition
export const utmSessions = pgTable("utm_sessions", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),        // _vid cookie value
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  utmId: text("utm_id"),
  referrer: text("referrer"),
  landingPage: text("landing_page"),
  trafficType: text("traffic_type").notNull(),     // 'organic'|'paid'|'social'|'referral'|'direct'|'unknown'
  isFirstTouch: boolean("is_first_touch").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Pattern A: date-range + source/medium aggregations
  createdAtSourceIdx: index("utm_sessions_created_source_idx")
    .on(table.createdAt.desc(), table.utmSource, table.utmMedium),
  // Pattern B: visitor journey lookups
  visitorIdx: index("utm_sessions_visitor_idx")
    .on(table.visitorId, table.createdAt.desc()),
}));
```

```typescript
// In shared/schema.ts — conversion_events table
export const conversionEvents = pgTable("conversion_events", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  eventType: text("event_type").notNull(),         // 'booking_completed'|'form_submit'|'phone_click'|'quote_request'
  bookingId: integer("booking_id").references(() => bookings.id),
  utmSessionId: integer("utm_session_id").references(() => utmSessions.id),
  attributedSource: text("attributed_source"),
  attributedMedium: text("attributed_medium"),
  attributedCampaign: text("attributed_campaign"),
  attributedTouchModel: text("touch_model"),       // 'first_touch'|'last_touch'
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Conversion funnel reports filtered by date range + event type
  createdAtTypeIdx: index("conversion_events_created_type_idx")
    .on(table.createdAt.desc(), table.eventType),
  // Join back to visitor sessions
  visitorIdx: index("conversion_events_visitor_idx")
    .on(table.visitorId),
}));
```

**Why BTREE over BRIN here:**
BRIN becomes superior only above ~100K rows with purely insert-ordered data. A cleaning business UTM table will likely hold thousands to tens of thousands of rows, not millions. BTREE composite indexes give consistent fast responses on small-to-medium result sets (the typical dashboard query returning rows for one campaign over 30 days). Use BRIN if and when the table exceeds ~200K rows and query performance degrades.

**Index column ordering rationale:**
- `created_at DESC` first: most queries filter by date range; putting the highest-selectivity filter first reduces scanned rows.
- `utm_source`, `utm_medium` second: GROUP BY columns after the range filter.
- Visitor journey index is separate because its access pattern is completely different (point lookup by `visitor_id`).

---

## Recharts Assessment

**recharts 2.15.2 is fully sufficient. Do not add another charting library.**

The following recharts components cover all required chart types for the marketing dashboard:

| Dashboard View | Chart Type | Recharts Component |
|---------------|------------|--------------------|
| Overview — visitor/conversion trend | Smooth area | `AreaChart` + `Area` with `type="monotone"` |
| Campaign Performance — bar comparison | Grouped bar | `BarChart` + `Bar` |
| Source Performance — distribution | Horizontal bar | `BarChart` + `Bar` with `layout="vertical"` |
| Conversion rate over time | Line | `LineChart` + `Line` |

All wrapped in `ResponsiveContainer width="100%" height={300}` following the existing pattern in the admin panel.

recharts has TypeScript generics for `data` and `dataKey` props (added in 3.8.0), but 2.15.2 also has adequate TypeScript support. **Do not upgrade to recharts 3.x** for this milestone — it is a major version with breaking changes and is not installed.

---

## Traffic Auto-Classification Logic

No library needed. A pure TypeScript function resolves non-UTM traffic using referrer + UTM rules:

```typescript
function classifyTraffic(utmSource: string | null, utmMedium: string | null, referrer: string | null): TrafficType {
  if (utmSource) {
    if (utmMedium === 'cpc' || utmMedium === 'ppc' || utmMedium === 'paid') return 'paid';
    if (['facebook','instagram','twitter','linkedin','pinterest','tiktok'].includes(utmSource.toLowerCase())) return 'social';
    return 'referral';
  }
  if (!referrer) return 'direct';
  const ref = referrer.toLowerCase();
  if (ref.includes('google.') || ref.includes('bing.') || ref.includes('yahoo.') || ref.includes('duckduckgo.')) return 'organic';
  if (ref.includes('facebook.') || ref.includes('instagram.') || ref.includes('twitter.') || ref.includes('linkedin.') || ref.includes('tiktok.')) return 'social';
  return 'referral';
}
```

---

## Privacy / GDPR Considerations

| Concern | Assessment | Recommendation |
|---------|------------|----------------|
| Is `_vid` a personal cookie under GDPR/PECR? | MEDIUM confidence — grey area. It is a random UUID with no PII. UK ICO guidance treats analytics cookies as non-essential, but first-party analytics for internal business use (not advertising) sits in a lower-risk category. | Treat as analytics cookie. Include in cookie policy. For EU/UK visitors, surface a minimal cookie notice. Do NOT gate UTM capture behind consent banner for v1.0 — the business is US-focused (cleaning company). Revisit if EU traffic becomes significant. |
| localStorage — is it regulated? | localStorage falls under ePrivacy/PECR same as cookies. | Same notice as above. For the risk profile of a local cleaning business serving primarily US customers, this is acceptable. |
| Safari ITP 7-day expiry | Server-set cookies survive ITP; localStorage does not. | The dual-write pattern described above handles this. First-touch localStorage may be lost for inactive Safari users after 7 days, but the server-set `_vid` survives to enable last-touch attribution. |
| PII in UTM data | UTM parameters can contain PII if marketers embed email addresses in `utm_content` or `utm_term` (e.g., email campaign personalization). | Sanitize: strip any value matching an email pattern before writing to `utm_sessions`. Log a warning. |
| Session data lifetime | Retaining attribution data indefinitely creates unnecessary risk. | Add a `cleanup_policy` note to the schema: purge `utm_sessions` rows where `created_at < NOW() - INTERVAL '2 years'` and no associated conversion event exists. Implement as a monthly cron job (node-cron is already installed). |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Segment, Mixpanel, Amplitude SDKs | Third-party tracking SDKs violate the "first-party only" constraint in PROJECT.md and add significant bundle weight | Custom Express endpoints + Drizzle tables |
| Google Tag Manager for UTM capture | Adds a third-party dependency, requires GTM container setup, and puts business data outside the app's database | `useEffect` hook on the client + `POST /api/analytics/session` |
| `uuid` npm package | Already not installed; `crypto.randomUUID()` is built into Node.js 20.x and is 3x faster | `crypto.randomUUID()` |
| recharts 3.x upgrade | Major version with breaking changes; 2.15.2 meets all dashboard charting needs | recharts 2.15.2 (already installed) |
| Separate time-series database (InfluxDB, TimescaleDB) | Extreme overkill for a single cleaning business's UTM volume; adds infrastructure complexity | Standard PostgreSQL with composite BTREE indexes |
| Redis for UTM session caching | No hot-path performance requirement; dashboard is admin-only, not customer-facing | Direct Drizzle queries with indexed tables |
| `express-rate-limit` on the analytics endpoint | Not needed for v1.0; the UTM capture endpoint is called once per page load by real visitors | If spam becomes an issue, add later |

---

## Installation

```bash
# Optional only — add if server-side cookie parsing convenience is needed
npm install cookie-parser
npm install -D @types/cookie-parser
```

All other capabilities use existing dependencies. No other `npm install` commands needed for this milestone.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `crypto.randomUUID()` (built-in) | `uuid` npm package | Already not in the project; built-in is faster and has no version drift risk |
| Dual-write (localStorage + server cookie) | localStorage only | Safari ITP kills 7-day+ attribution; server cookie survives ITP |
| Dual-write (localStorage + server cookie) | Cookie only | Cookies require consent CMP infrastructure; localStorage is functionally equivalent and simpler for first-touch preservation |
| BTREE composite indexes | BRIN indexes | BRIN only outperforms BTREE above ~100K rows; expected attribution volume is thousands to low tens of thousands for this business |
| recharts (already installed) | Victory, Nivo, Chart.js | recharts is already in the bundle; adding a second charting library doubles charting bundle weight for no gain |

---

## Version Compatibility Notes

| Package | Version | Compatibility Note |
|---------|---------|-------------------|
| recharts | 2.15.2 | Compatible with React 18.3.x. Do not use 3.x API docs. |
| drizzle-orm index API | 0.39.3 | Uses new index API (available since 0.31.0): `index().on().using()`. Old `uniqueIndex()` / `index()` shorthand still works but new API is preferred. |
| date-fns | 3.6.0 | v3 API (named exports, no default export). Use `format`, `subDays`, `startOfDay`, `endOfDay`, `eachDayOfInterval` for dashboard date range helpers. |
| `crypto.randomUUID()` | Node.js 20.x | Available since Node.js 14.17.0. No polyfill needed. |

---

## Sources

- UTM persistent tracking guide — https://fiveninestrategy.com/persistent-utm-tracking-guide/ (MEDIUM confidence; practical patterns verified against known Safari ITP behavior)
- Safari ITP cookie survival via server-set cookies — https://stape.io/blog/safari-itp (MEDIUM confidence)
- Safari ITP localStorage 7-day expiry — https://snowplow.io/blog/tracking-cookies-length (MEDIUM confidence)
- GDPR analytics cookie consent (conservative interpretation) — https://www.auditzo.com/blog/gdpr-cookie-consent-rules-2025 (MEDIUM confidence)
- UK Data (Use and Access) Act 2025 first-party analytics exemption — https://usercentrics.com/knowledge-hub/ico-pecr-cookie-guidance/ (MEDIUM confidence; exemption scope not yet settled)
- PostgreSQL BRIN vs BTREE threshold — https://www.crunchydata.com/blog/postgres-indexing-when-does-brin-win (HIGH confidence; official Crunchy Data analysis)
- Drizzle ORM index API — https://orm.drizzle.team/docs/indexes-constraints (HIGH confidence; official docs)
- `crypto.randomUUID()` performance — https://dev.to/galkin/crypto-randomuuid-vs-uuid-v4-47i5 (MEDIUM confidence; benchmark article)
- recharts latest release notes — https://github.com/recharts/recharts/releases (HIGH confidence; official GitHub)
- Express `res.cookie` security best practices — https://web.dev/articles/first-party-cookie-recipes (HIGH confidence; Google web.dev)

---

*Stack research for: UTM Tracking & Marketing Attribution — Skleanings v1.0*
*Researched: 2026-04-25*
