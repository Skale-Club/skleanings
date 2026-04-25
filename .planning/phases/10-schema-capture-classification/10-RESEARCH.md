# Phase 10: Schema, Capture & Classification — Research

**Researched:** 2026-04-25
**Domain:** UTM session capture, traffic classification, Drizzle schema, Supabase migration
**Confidence:** HIGH — based on direct codebase inspection of actual files plus locked decisions from CONTEXT.md

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 Session Longevity:** No server-side session expiration. The localStorage UUID (`skleanings_visitor_id`) persists until user clears browser data. No TTL enforced at the application layer.
- **D-02 Last-Touch Update Rule:** Last-touch columns (`last_utm_source`, `last_utm_medium`, `last_utm_campaign`, `last_utm_term`, `last_utm_content`, `last_utm_id`, `last_landing_page`, `last_referrer`, `last_traffic_source`) are **only updated when the inbound request contains UTM parameters OR an identifiable external referrer**. Direct navigation does NOT overwrite last-touch. `last_seen_at` is always updated.
- **D-03:** Trigger for "meaningful re-engagement" evaluated server-side in `upsertVisitorSession()`. Client sends all URL params and referrer; server decides.
- **D-04 UTM Normalization:** All UTM values lowercased at client (`value.toLowerCase().trim()`) AND re-normalized at server. Do NOT rely on SQL `LOWER()`.
- **D-05 Dev Guard:** `useUTMCapture` returns early: `if (import.meta.env.DEV) return`. Matches `analytics.ts` pattern.
- **D-06 Rate Limit:** 60 req/IP/min on `POST /api/analytics/session` using existing `server/lib/rate-limit.ts` `isRateLimited()` function.
- **D-07 Hook Placement:** Mount `useUTMCapture()` inside existing `AnalyticsProvider` in `client/src/App.tsx` (line 77). No new provider needed.
- **D-08 Session ID Storage:** `localStorage` key `skleanings_visitor_id`. UUID generated client-side via `crypto.randomUUID()`. No cookie fallback in this phase.
- **D-09 Unique Constraint:** `conversion_events` must have unique constraint on `(booking_id, event_type, attribution_model)`. Included in Phase 10 migration even though writes happen in Phase 11.
- **D-10 Migration Tooling:** Supabase CLI format: `YYYYMMDDHHMMSS_add_utm_tracking.sql` in `supabase/migrations/`. Never `drizzle-kit push`. Drizzle definitions in `shared/schema.ts` for type safety; actual migration is hand-written SQL via `supabase db push`.

### Claude's Discretion

- Traffic classifier domain coverage: start with most common (Google, Bing, Yahoo, DuckDuckGo for organic; Facebook, Instagram, YouTube, TikTok, LinkedIn, Twitter/X, Pinterest for social).
- Exact index naming convention: follow existing Drizzle index naming patterns in `shared/schema.ts`.
- Response shape for `POST /api/analytics/session`: `{ sessionId: string, isNew: boolean }`.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAPTURE-01 | Capture all UTM params, referrer, landing page on first page load | Hook reads `URLSearchParams`, `document.referrer`, `window.location.pathname`; sends to POST /api/analytics/session |
| CAPTURE-02 | Anonymous visitor UUID persisted in localStorage so first-touch survives multi-page/multi-day journeys | `crypto.randomUUID()` on first visit; stored as `skleanings_visitor_id`; read on subsequent visits |
| CAPTURE-03 | All UTM values normalized to lowercase before storage | `value.toLowerCase().trim()` in hook before POST AND in server upsert function as safety net |
| CAPTURE-04 | Traffic without UTMs auto-classified: Organic Search, Social, Referral, Direct, Unknown | `server/lib/traffic-classifier.ts` — pure TS function, no bundle cost |
| CAPTURE-05 | First-touch attribution written once, never overwritten | `upsertVisitorSession()` ON CONFLICT DO UPDATE never sets `first_*` columns; explicit invariant comment required |
| CAPTURE-06 | Last-touch updated on each return with UTM signal or identifiable referrer | Server evaluates: if payload has `utm_source` OR referrer not matching own domain → update `last_*` columns |
| ATTR-03 | Prevent duplicate conversion events for same booking | UNIQUE constraint on `(booking_id, event_type, attribution_model)` in `conversion_events` schema — created now, used in Phase 11 |
</phase_requirements>

---

## Summary

Phase 10 is a pure infrastructure phase: no UI, no booking flow changes. It delivers the two-table schema (`visitor_sessions` + `conversion_events`), the nullable FK on `bookings`, a Supabase CLI migration, the server-side traffic classifier, the upsert storage function, the public session endpoint, and the client-side hook.

All seven items can be built in a strict dependency order: schema first (nothing type-checks without it), then storage layer, then the server route, then the client hook. The schema migration is the single gate that blocks all other work.

**Primary recommendation:** Write the Drizzle table definitions in `shared/schema.ts` first, write the Supabase SQL migration in parallel, run `supabase db push` to apply, then build the remaining pieces in sequence.

---

## Standard Stack

### Core (zero new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.39.3 | Table definitions, upsert queries | Already installed; `index().on()` API for BTREE indexes |
| drizzle-zod | installed | `createInsertSchema` for new tables | Already used on every table in `shared/schema.ts` |
| zod | 3.24.2 | Endpoint request validation | Already used on all routes |
| `crypto.randomUUID()` | Node.js 20.x built-in | Client UUID generation | Faster than `uuid` package; no import needed |
| Express 4 | 4.21.2 | Router for analytics endpoint | Existing `Router()` pattern in `server/routes/bookings.ts` |
| `isRateLimited()` | internal (`server/lib/rate-limit.ts`) | 60 req/IP/min on public endpoint | Existing utility, adapt limit value |

### No Additions Needed

All capabilities are covered by the existing stack. Do not add `uuid`, `express-rate-limit`, or any third-party analytics SDK.

---

## Architecture Patterns

### Recommended File Structure

```
shared/
└── schema.ts                          # ADD: visitorSessions, conversionEvents tables; ADD utm_session_id to bookings

server/
├── lib/
│   └── traffic-classifier.ts          # NEW: pure TS function, no dependencies
├── storage/
│   ├── analytics.ts                   # NEW: upsertVisitorSession()
│   └── index.ts                       # MODIFY: spread ...analytics into storage object
└── routes/
    ├── analytics.ts                   # NEW: POST /api/analytics/session (public)
    └── routes.ts                      # MODIFY: app.use("/api/analytics", analyticsRouter)

client/src/
└── hooks/
    └── use-utm-capture.ts             # NEW: fires on location change inside AnalyticsProvider

supabase/migrations/
└── 20260425000000_add_utm_tracking.sql # NEW: hand-written SQL migration
```

### Pattern 1: Drizzle Table with Explicit Index Syntax

The project uses `pgTable` with the index factory callback. Inspecting `shared/schema.ts`, all FK references use `.references(() => table.id, { onDelete: "set null" })`. New tables follow this pattern exactly.

```typescript
// Source: direct inspection of shared/schema.ts
import { pgTable, text, serial, integer, uuid, timestamp, numeric, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const visitorSessions = pgTable("visitor_sessions", {
  // ... columns ...
}, (table) => ({
  firstSourceIdx: index("visitor_sessions_first_source_idx").on(table.firstSource),
  // ...
}));
```

### Pattern 2: Storage Domain File

Every domain has a file in `server/storage/`. Functions are named exports. The file imports from `../db` and `@shared/schema`. Then `server/storage/index.ts` spreads the module:

```typescript
// server/storage/index.ts pattern (from direct inspection):
import * as analytics from "./analytics";
export const storage = { ...users, ...catalog, ...bookings, ...analytics, /* etc */ };
```

### Pattern 3: Express Router Registration

```typescript
// server/routes.ts pattern (from direct inspection):
import analyticsRouter from "./routes/analytics";
// inside registerRoutes():
app.use("/api/analytics", analyticsRouter);
```

### Pattern 4: Rate Limiting on Public Endpoint

The existing `isRateLimited(key, limit, windowMs)` from `server/lib/rate-limit.ts` takes a string key, limit, and window. Use `req.ip` as the key for the analytics endpoint:

```typescript
// Adapt the existing function — no new package needed:
import { isRateLimited } from "../lib/rate-limit";
// In route handler:
if (isRateLimited(`analytics:${req.ip}`, 60, 60_000)) {
  return res.status(429).json({ message: "Too many requests" });
}
```

### Anti-Patterns to Avoid

- **`drizzle-kit push` for migrations:** Forbidden per MEMORY.md. Always use `supabase db push` with a hand-written `.sql` file.
- **Calling `LOWER()` in SQL for normalization:** Bypasses indexes. Normalize at write time in TypeScript.
- **Updating `first_*` columns on conflict:** The ON CONFLICT clause must list only `last_*` and `last_seen_at` columns. First-touch columns must NOT appear in the DO UPDATE SET clause.
- **Awaiting the analytics fetch in the hook:** All analytics calls are fire-and-forget. `.catch(() => {})` required; never `await`.
- **Missing DEV guard:** Hook must return early with `if (import.meta.env.DEV) return` — first statement in `useEffect`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting on public endpoint | Custom counter logic | `isRateLimited()` from `server/lib/rate-limit.ts` | Already exists, tested, Map-based in-memory |
| UUID generation | UUID v4 library | `crypto.randomUUID()` | Node.js 20.x built-in, no import needed |
| Zod schema for endpoint | Ad-hoc validation | `z.object({...})` with `.parse()` in route | Matches all other route validation patterns |
| Traffic classification | External library | Plain TypeScript function in `server/lib/traffic-classifier.ts` | No bundle cost; domain list is project-owned |

---

## Question 1: Exact Drizzle Table Definition — `visitor_sessions`

```typescript
// Addition to shared/schema.ts — place after bookings table definition
// Import additions needed: add `index` to the import line from "drizzle-orm/pg-core"

export const visitorSessions = pgTable("visitor_sessions", {
  // Primary key — client-generated UUID from localStorage
  id: uuid("id").primaryKey(),

  // First-touch attribution (written once on INSERT, NEVER updated)
  firstUtmSource:    text("first_utm_source"),
  firstUtmMedium:    text("first_utm_medium"),
  firstUtmCampaign:  text("first_utm_campaign"),
  firstUtmTerm:      text("first_utm_term"),
  firstUtmContent:   text("first_utm_content"),
  firstUtmId:        text("first_utm_id"),
  firstLandingPage:  text("first_landing_page"),
  firstReferrer:     text("first_referrer"),
  firstTrafficSource: text("first_traffic_source").notNull().default("unknown"),
  firstSeenAt:       timestamp("first_seen_at").defaultNow().notNull(),

  // Last-touch attribution (updated on each meaningful visit: UTM or identifiable referrer)
  lastUtmSource:     text("last_utm_source"),
  lastUtmMedium:     text("last_utm_medium"),
  lastUtmCampaign:   text("last_utm_campaign"),
  lastUtmTerm:       text("last_utm_term"),
  lastUtmContent:    text("last_utm_content"),
  lastUtmId:         text("last_utm_id"),
  lastLandingPage:   text("last_landing_page"),
  lastReferrer:      text("last_referrer"),
  lastTrafficSource: text("last_traffic_source").notNull().default("unknown"),
  lastSeenAt:        timestamp("last_seen_at").defaultNow().notNull(),

  // Aggregate counters
  visitCount:    integer("visit_count").notNull().default(1),
  totalBookings: integer("total_bookings").notNull().default(0),
  convertedAt:   timestamp("converted_at"),  // First conversion timestamp, nullable
}, (table) => ({
  firstUtmSourceIdx:     index("visitor_sessions_first_utm_source_idx").on(table.firstUtmSource),
  firstTrafficSourceIdx: index("visitor_sessions_first_traffic_source_idx").on(table.firstTrafficSource),
  firstSeenAtIdx:        index("visitor_sessions_first_seen_at_idx").on(table.firstSeenAt),
  lastSeenAtIdx:         index("visitor_sessions_last_seen_at_idx").on(table.lastSeenAt),
  firstCampaignIdx:      index("visitor_sessions_first_campaign_idx").on(table.firstUtmCampaign),
}));

export type VisitorSession = typeof visitorSessions.$inferSelect;
export const insertVisitorSessionSchema = createInsertSchema(visitorSessions);
export type InsertVisitorSession = z.infer<typeof insertVisitorSessionSchema>;
```

**Column naming rationale:** The ARCHITECTURE.md uses `first_source`/`last_source` but the CONTEXT.md decision list explicitly names `last_utm_source`, `last_utm_medium`, etc. Use the full `first_utm_*`/`last_utm_*` naming to be unambiguous and consistent with the UTM parameter names.

---

## Question 2: Exact Drizzle Table Definition — `conversion_events`

```typescript
// Addition to shared/schema.ts — place after visitorSessions definition
// Import additions needed: add `uniqueIndex`, `numeric` if not already imported

export const conversionEvents = pgTable("conversion_events", {
  id:           serial("id").primaryKey(),
  visitorId:    uuid("visitor_id").references(() => visitorSessions.id, { onDelete: "set null" }),
  eventType:    text("event_type").notNull(),
  // eventType values: 'booking_completed' | 'booking_started' | 'chat_initiated'

  bookingId:    integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  bookingValue: numeric("booking_value", { precision: 10, scale: 2 }),

  // Denormalized attribution snapshot at event time — no JOIN needed for reports
  attributedSource:    text("attributed_source"),
  attributedMedium:    text("attributed_medium"),
  attributedCampaign:  text("attributed_campaign"),
  attributedLandingPage: text("attributed_landing_page"),
  attributionModel:    text("attribution_model").notNull().default("last_touch"),
  // attributionModel values: 'first_touch' | 'last_touch'

  occurredAt:  timestamp("occurred_at").defaultNow().notNull(),
  pageUrl:     text("page_url"),
  metadata:    jsonb("metadata").default({}),
}, (table) => ({
  // ATTR-03: prevents duplicate conversion rows from webhook + confirmation page double-fire
  bookingEventModelUnique: uniqueIndex("conversion_events_booking_event_model_unique_idx")
    .on(table.bookingId, table.eventType, table.attributionModel),

  occurredAtIdx:       index("conversion_events_occurred_at_idx").on(table.occurredAt),
  eventTypeIdx:        index("conversion_events_event_type_idx").on(table.eventType),
  attributedSourceIdx: index("conversion_events_attributed_source_idx").on(table.attributedSource),
  attributedCampaignIdx: index("conversion_events_attributed_campaign_idx").on(table.attributedCampaign),
  visitorIdIdx:        index("conversion_events_visitor_id_idx").on(table.visitorId),
  bookingIdIdx:        index("conversion_events_booking_id_idx").on(table.bookingId),
}));

export type ConversionEvent = typeof conversionEvents.$inferSelect;
export const insertConversionEventSchema = createInsertSchema(conversionEvents).omit({ id: true, occurredAt: true });
export type InsertConversionEvent = z.infer<typeof insertConversionEventSchema>;
```

**Important:** The `uniqueIndex` for ATTR-03 must use `uniqueIndex()` not `index()`. The unique constraint only applies when `bookingId` is non-null (the SQL migration must handle this with `WHERE booking_id IS NOT NULL` as a partial index — see Question 4).

---

## Question 3: Column Addition to `bookings` Table

Inside the existing `bookings` `pgTable` call in `shared/schema.ts`, add one column at the end of the column list (before the closing `}`):

```typescript
// Inside existing bookings pgTable definition — add after stripePaymentStatus:
// UTM attribution FK (nullable — only set after Phase 10 hook fires)
utmSessionId: uuid("utm_session_id").references(() => visitorSessions.id, { onDelete: "set null" }),
```

**Dependency order:** `visitorSessions` table must be defined before `bookings` in `schema.ts` because `bookings.utmSessionId` references `visitorSessions.id`. Move the `visitorSessions` definition above `bookings`, or Drizzle will have a forward-reference issue.

Actually, since `conversionEvents` also references `bookings`, the safe order is:
1. `visitorSessions` (no FK deps on new tables)
2. `bookings` (references `visitorSessions` via `utmSessionId`)
3. `conversionEvents` (references both `visitorSessions` and `bookings`)

---

## Question 4: Supabase Migration SQL

File path: `supabase/migrations/20260425000000_add_utm_tracking.sql`

```sql
-- Migration: add_utm_tracking
-- Adds visitor_sessions and conversion_events tables for first-party UTM attribution.
-- Adds utm_session_id nullable FK to bookings for direct attribution join.

-- ============================================================
-- TABLE: visitor_sessions
-- One row per anonymous visitor (identified by client-generated UUID).
-- first_* columns: written once on INSERT, NEVER updated.
-- last_* columns: updated on each visit with UTM signal or external referrer.
-- ============================================================
CREATE TABLE IF NOT EXISTS visitor_sessions (
  id UUID PRIMARY KEY,

  -- First-touch attribution (immutable after INSERT)
  first_utm_source      TEXT,
  first_utm_medium      TEXT,
  first_utm_campaign    TEXT,
  first_utm_term        TEXT,
  first_utm_content     TEXT,
  first_utm_id          TEXT,
  first_landing_page    TEXT,
  first_referrer        TEXT,
  first_traffic_source  TEXT NOT NULL DEFAULT 'unknown',
  first_seen_at         TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Last-touch attribution (updated on meaningful re-engagement)
  last_utm_source       TEXT,
  last_utm_medium       TEXT,
  last_utm_campaign     TEXT,
  last_utm_term         TEXT,
  last_utm_content      TEXT,
  last_utm_id           TEXT,
  last_landing_page     TEXT,
  last_referrer         TEXT,
  last_traffic_source   TEXT NOT NULL DEFAULT 'unknown',
  last_seen_at          TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Aggregate counters
  visit_count           INTEGER NOT NULL DEFAULT 1,
  total_bookings        INTEGER NOT NULL DEFAULT 0,
  converted_at          TIMESTAMP
);

-- Indexes for dashboard queries (all BTREE — appropriate at this data volume)
CREATE INDEX IF NOT EXISTS visitor_sessions_first_utm_source_idx
  ON visitor_sessions(first_utm_source);
CREATE INDEX IF NOT EXISTS visitor_sessions_first_traffic_source_idx
  ON visitor_sessions(first_traffic_source);
CREATE INDEX IF NOT EXISTS visitor_sessions_first_seen_at_idx
  ON visitor_sessions(first_seen_at);
CREATE INDEX IF NOT EXISTS visitor_sessions_last_seen_at_idx
  ON visitor_sessions(last_seen_at);
CREATE INDEX IF NOT EXISTS visitor_sessions_first_campaign_idx
  ON visitor_sessions(first_utm_campaign);

-- ============================================================
-- TABLE: conversion_events
-- One row per tracked action. Denormalized attribution snapshot at event time.
-- ============================================================
CREATE TABLE IF NOT EXISTS conversion_events (
  id               SERIAL PRIMARY KEY,
  visitor_id       UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL,
  booking_id       INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  booking_value    NUMERIC(10, 2),

  -- Attribution snapshot (no JOIN to visitor_sessions needed for reports)
  attributed_source       TEXT,
  attributed_medium       TEXT,
  attributed_campaign     TEXT,
  attributed_landing_page TEXT,
  attribution_model       TEXT NOT NULL DEFAULT 'last_touch',

  occurred_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  page_url       TEXT,
  metadata       JSONB DEFAULT '{}'
);

-- Indexes for reporting
CREATE INDEX IF NOT EXISTS conversion_events_occurred_at_idx
  ON conversion_events(occurred_at);
CREATE INDEX IF NOT EXISTS conversion_events_event_type_idx
  ON conversion_events(event_type);
CREATE INDEX IF NOT EXISTS conversion_events_attributed_source_idx
  ON conversion_events(attributed_source);
CREATE INDEX IF NOT EXISTS conversion_events_attributed_campaign_idx
  ON conversion_events(attributed_campaign);
CREATE INDEX IF NOT EXISTS conversion_events_visitor_id_idx
  ON conversion_events(visitor_id);
CREATE INDEX IF NOT EXISTS conversion_events_booking_id_idx
  ON conversion_events(booking_id);

-- ATTR-03: Unique constraint to prevent duplicate conversion events
-- Partial index: only enforces uniqueness when booking_id is non-null
-- (NULL booking_id rows are for non-booking events like chat_initiated)
CREATE UNIQUE INDEX IF NOT EXISTS conversion_events_booking_event_model_unique_idx
  ON conversion_events(booking_id, event_type, attribution_model)
  WHERE booking_id IS NOT NULL;

-- ============================================================
-- MODIFY: bookings table
-- Add nullable FK to visitor_sessions for direct attribution join.
-- ============================================================
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS utm_session_id UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL;
```

---

## Question 5: `upsertVisitorSession()` Implementation

**File:** `server/storage/analytics.ts`

```typescript
import { db } from "../db";
import { visitorSessions, type VisitorSession } from "@shared/schema";
import { eq } from "drizzle-orm";
import { classifyTraffic } from "../lib/traffic-classifier";

export interface UpsertSessionPayload {
  visitorId: string;
  utmSource:   string | null;
  utmMedium:   string | null;
  utmCampaign: string | null;
  utmTerm:     string | null;
  utmContent:  string | null;
  utmId:       string | null;
  referrer:    string | null;
  landingPage: string | null;
}

/**
 * Upsert a visitor session row.
 *
 * FIRST-TOUCH IMMUTABILITY INVARIANT:
 * Never update first_* columns on an existing row — this is the architectural
 * guarantee of first-touch preservation. The ON CONFLICT DO UPDATE clause
 * intentionally omits all first_* columns. Violating this invariant corrupts
 * attribution data permanently.
 *
 * LAST-TOUCH UPDATE RULE (D-02):
 * last_* columns are only updated when the request contains UTM parameters OR
 * an identifiable external referrer. Direct navigation (empty referrer + no UTMs)
 * increments visit_count and updates last_seen_at only — it does not overwrite
 * the last real marketing touch.
 */
export async function upsertVisitorSession(
  payload: UpsertSessionPayload,
): Promise<{ session: VisitorSession; isNew: boolean }> {
  // Server-side normalization safety net (D-04) — client should already normalize
  const normalize = (v: string | null | undefined): string | null =>
    v ? v.trim().toLowerCase() : null;

  const norm = {
    utmSource:   normalize(payload.utmSource),
    utmMedium:   normalize(payload.utmMedium),
    utmCampaign: normalize(payload.utmCampaign),
    utmTerm:     normalize(payload.utmTerm),
    utmContent:  normalize(payload.utmContent),
    utmId:       normalize(payload.utmId),
    referrer:    payload.referrer?.trim() || null,
    landingPage: payload.landingPage?.trim() || null,
  };

  const trafficSource = classifyTraffic(norm.utmSource, norm.utmMedium, norm.referrer);

  // Determine if this visit qualifies for a last-touch update (D-02)
  const hasMeaningfulSignal = !!(
    norm.utmSource ||
    (norm.referrer && !isSameDomain(norm.referrer))
  );

  // Check if row exists
  const existing = await db
    .select({ id: visitorSessions.id })
    .from(visitorSessions)
    .where(eq(visitorSessions.id, payload.visitorId as any))
    .limit(1);

  if (existing.length === 0) {
    // INSERT — new visitor: write both first_* and last_* from this visit
    const [inserted] = await db
      .insert(visitorSessions)
      .values({
        id: payload.visitorId as any,
        firstUtmSource:    norm.utmSource,
        firstUtmMedium:    norm.utmMedium,
        firstUtmCampaign:  norm.utmCampaign,
        firstUtmTerm:      norm.utmTerm,
        firstUtmContent:   norm.utmContent,
        firstUtmId:        norm.utmId,
        firstLandingPage:  norm.landingPage,
        firstReferrer:     norm.referrer,
        firstTrafficSource: trafficSource,
        firstSeenAt:       new Date(),
        lastUtmSource:     norm.utmSource,
        lastUtmMedium:     norm.utmMedium,
        lastUtmCampaign:   norm.utmCampaign,
        lastUtmTerm:       norm.utmTerm,
        lastUtmContent:    norm.utmContent,
        lastUtmId:         norm.utmId,
        lastLandingPage:   norm.landingPage,
        lastReferrer:      norm.referrer,
        lastTrafficSource: trafficSource,
        lastSeenAt:        new Date(),
        visitCount:        1,
      })
      .returning();
    return { session: inserted, isNew: true };
  }

  // UPDATE — returning visitor
  // NEVER include first_* columns here — that is the invariant.
  const updateFields: Record<string, any> = {
    lastSeenAt:  new Date(),
    visitCount:  db.sql`visit_count + 1`,
  };

  if (hasMeaningfulSignal) {
    updateFields.lastUtmSource    = norm.utmSource;
    updateFields.lastUtmMedium    = norm.utmMedium;
    updateFields.lastUtmCampaign  = norm.utmCampaign;
    updateFields.lastUtmTerm      = norm.utmTerm;
    updateFields.lastUtmContent   = norm.utmContent;
    updateFields.lastUtmId        = norm.utmId;
    updateFields.lastLandingPage  = norm.landingPage;
    updateFields.lastReferrer     = norm.referrer;
    updateFields.lastTrafficSource = trafficSource;
  }

  const [updated] = await db
    .update(visitorSessions)
    .set(updateFields)
    .where(eq(visitorSessions.id, payload.visitorId as any))
    .returning();

  return { session: updated, isNew: false };
}

/** Returns true if the referrer is from the same domain as the site */
function isSameDomain(referrer: string): boolean {
  try {
    const ref = new URL(referrer);
    // SERVER_URL or VITE_APP_URL env var; fallback to checking the hostname
    const appHost = process.env.APP_DOMAIN || process.env.VITE_APP_URL || "";
    if (!appHost) return false;
    const appHostname = new URL(appHost).hostname;
    return ref.hostname === appHostname || ref.hostname.endsWith(`.${appHostname}`);
  } catch {
    return false;
  }
}
```

**Note on `visitCount` increment:** Drizzle does not have a built-in `.increment()` shorthand at version 0.39.3. Use a raw SQL expression: `sql\`visit_count + 1\`` imported from `drizzle-orm`. Check the exact syntax needed at runtime — alternatively use a `SELECT` then `UPDATE` pattern to avoid any SQL expression issues.

**Simpler alternative for `visitCount` increment** (avoids raw SQL):
```typescript
// Fetch current count in the SELECT above, then:
const current = existing[0] as { id: string; visitCount: number };
updateFields.visitCount = (current.visitCount ?? 0) + 1;
```
This requires selecting `visitCount` in the initial query. This approach is safer and avoids any Drizzle version-specific SQL expression concerns.

---

## Question 6: Traffic Classifier Implementation

**File:** `server/lib/traffic-classifier.ts`

```typescript
// Authoritative traffic source labels
export type TrafficSource =
  | "organic_search"
  | "paid_search"
  | "organic_social"
  | "paid_social"
  | "email"
  | "referral"
  | "direct"
  | "unknown";

// Known search engine hostnames (subdomain-matched: google.com, www.google.com, google.co.uk etc.)
const SEARCH_ENGINE_PATTERNS = [
  "google.", "bing.", "yahoo.", "duckduckgo.", "baidu.", "yandex.", "ecosia.",
];

// Known social network hostnames
const SOCIAL_NETWORK_PATTERNS = [
  "facebook.", "instagram.", "twitter.", "x.com", "linkedin.",
  "pinterest.", "tiktok.", "youtube.", "snapchat.", "reddit.",
];

// UTM medium values that signal paid search
const PAID_SEARCH_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsearch", "paid_search"]);

// UTM medium values that signal paid social
const PAID_SOCIAL_MEDIUMS = new Set(["paid_social", "paidsocial", "social_paid"]);

function matchesDomainList(referrer: string, patterns: string[]): boolean {
  try {
    const hostname = new URL(referrer).hostname.toLowerCase();
    return patterns.some((p) => hostname === p || hostname.endsWith(`.${p}`) || hostname.includes(p));
  } catch {
    return false;
  }
}

/**
 * Classify a visit into a human-readable traffic source channel.
 * All inputs must already be lowercased and trimmed (D-04).
 * Classification is server-authoritative — never runs in client bundle.
 */
export function classifyTraffic(
  utmSource: string | null,
  utmMedium: string | null,
  referrer: string | null,
): TrafficSource {
  // 1. UTM medium overrides take highest priority
  if (utmMedium) {
    if (utmMedium === "email" || utmMedium === "e-mail") return "email";
    if (PAID_SEARCH_MEDIUMS.has(utmMedium)) return "paid_search";
    if (PAID_SOCIAL_MEDIUMS.has(utmMedium)) return "paid_social";
  }

  // 2. UTM source classification
  if (utmSource) {
    if (SEARCH_ENGINE_PATTERNS.some((p) => utmSource.includes(p.replace(".", "")))) {
      return "organic_search";
    }
    if (SOCIAL_NETWORK_PATTERNS.some((p) => utmSource.includes(p.replace(".", "")))) {
      return "organic_social";
    }
    // Has UTM source but not in known lists — treat as referral
    return "referral";
  }

  // 3. No UTM params — use referrer for classification
  if (!referrer) return "direct";

  if (matchesDomainList(referrer, SEARCH_ENGINE_PATTERNS)) return "organic_search";
  if (matchesDomainList(referrer, SOCIAL_NETWORK_PATTERNS)) return "organic_social";

  // External referrer that isn't a known search/social domain
  return "referral";
}
```

**Domain coverage (per Claude's discretion):** Google, Bing, Yahoo, DuckDuckGo, Baidu, Yandex, Ecosia for search. Facebook, Instagram, Twitter/X, LinkedIn, Pinterest, TikTok, YouTube, Snapchat, Reddit for social. Additional domains can be added to the arrays without any schema change.

---

## Question 7: `useUTMCapture` Hook Implementation

**File:** `client/src/hooks/use-utm-capture.ts`

```typescript
import { useEffect } from "react";
import { useLocation } from "wouter";

const VISITOR_ID_KEY = "skleanings_visitor_id";
const FIRST_TOUCH_KEY = "skleanings_first_touch";

/** Normalize a UTM value: lowercase + trim. Returns null if empty. */
function norm(v: string | null): string | null {
  const t = v?.trim().toLowerCase();
  return t || null;
}

/**
 * Fires a POST /api/analytics/session on each meaningful location change.
 * "Meaningful" = new visitor OR has UTM params OR has an external referrer.
 *
 * DEV guard: returns immediately in development to prevent dev sessions
 * polluting production data. (Matches analytics.ts pattern.)
 *
 * Fire-and-forget: never awaited, errors are silently swallowed.
 * Analytics must never block rendering or the booking flow.
 */
export function useUTMCapture() {
  const [location] = useLocation();

  useEffect(() => {
    // D-05: DEV guard — must be first statement
    if (import.meta.env.DEV) return;

    // 1. Generate or retrieve visitor UUID (D-08)
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);
    const isNewVisitor = !visitorId;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }

    // 2. Read UTM params from current URL (D-04: normalize at source)
    const params = new URLSearchParams(window.location.search);
    const utmSource   = norm(params.get("utm_source"));
    const utmMedium   = norm(params.get("utm_medium"));
    const utmCampaign = norm(params.get("utm_campaign"));
    const utmTerm     = norm(params.get("utm_term"));
    const utmContent  = norm(params.get("utm_content"));
    const utmId       = norm(params.get("utm_id"));

    // 3. Capture referrer and landing page
    // Landing page: pathname only — no query string (D per SPECIFICS)
    const referrer    = document.referrer || null;
    const landingPage = window.location.pathname;

    // 4. Only fire when there is attribution signal (avoid noisy direct returns)
    const hasUtm = !!(utmSource || utmMedium || utmCampaign);
    const hasSignal = isNewVisitor || hasUtm || !!referrer;
    if (!hasSignal) return;

    // 5. Client-side first-touch idempotency marker (prevents re-writing to localStorage)
    if (isNewVisitor) {
      localStorage.setItem(
        FIRST_TOUCH_KEY,
        JSON.stringify({ utmSource, utmMedium, utmCampaign, landingPage, referrer, capturedAt: Date.now() }),
      );
    }

    // 6. Fire-and-forget POST — never await, never block rendering
    fetch("/api/analytics/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId,
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
        utmId,
        referrer,
        landingPage,
      }),
    }).catch(() => {
      // Silent — analytics must never break UX
    });
  }, [location]); // Re-runs on every navigation; signal check prevents noise
}
```

**Mount point in `App.tsx` (line 83 area, inside `AnalyticsProvider`):**

```typescript
// client/src/App.tsx — inside AnalyticsProvider function body
import { useUTMCapture } from "@/hooks/use-utm-capture";

function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ['/api/company-settings'] });
  const [location] = useLocation();
  useUTMCapture(); // ADD THIS LINE — one-line addition, no other changes needed

  useEffect(() => { /* existing initAnalytics effect */ }, [settings]);
  useEffect(() => { trackPageView(location); }, [location]);

  return <>{children}</>;
}
```

The existing `AnalyticsProvider` already has `useLocation()` and runs inside `QueryClientProvider`. `useUTMCapture` needs no additional context.

---

## Question 8: POST `/api/analytics/session` Endpoint Logic

**File:** `server/routes/analytics.ts`

```typescript
import { Router } from "express";
import { z } from "zod";
import { isRateLimited } from "../lib/rate-limit";
import { upsertVisitorSession } from "../storage/analytics";
import { log } from "../lib/logger";

const router = Router();

// Zod schema for session POST body (see Question 9)
const sessionSchema = z.object({
  visitorId:   z.string().uuid(),
  utmSource:   z.string().nullable().optional(),
  utmMedium:   z.string().nullable().optional(),
  utmCampaign: z.string().nullable().optional(),
  utmTerm:     z.string().nullable().optional(),
  utmContent:  z.string().nullable().optional(),
  utmId:       z.string().nullable().optional(),
  referrer:    z.string().nullable().optional(),
  landingPage: z.string().max(2000).nullable().optional(),
});

// POST /api/analytics/session — PUBLIC (no auth required)
// Called by useUTMCapture hook on first visit and on return visits with UTM signal.
router.post("/session", async (req, res) => {
  try {
    // D-06: Rate limit 60 req/IP/min
    const ip = req.ip || "unknown";
    if (isRateLimited(`analytics:${ip}`, 60, 60_000)) {
      return res.status(429).json({ message: "Too many requests" });
    }

    const parsed = sessionSchema.parse(req.body);

    const { session, isNew } = await upsertVisitorSession({
      visitorId:   parsed.visitorId,
      utmSource:   parsed.utmSource ?? null,
      utmMedium:   parsed.utmMedium ?? null,
      utmCampaign: parsed.utmCampaign ?? null,
      utmTerm:     parsed.utmTerm ?? null,
      utmContent:  parsed.utmContent ?? null,
      utmId:       parsed.utmId ?? null,
      referrer:    parsed.referrer ?? null,
      landingPage: parsed.landingPage ?? null,
    });

    // Response shape (per Claude's Discretion in CONTEXT.md)
    return res.status(200).json({ sessionId: session.id, isNew });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    log(`Analytics session error: ${(err as Error).message}`, "analytics");
    // Return 200 even on unexpected errors — analytics must never surface errors to the client
    return res.status(200).json({ sessionId: null, isNew: false });
  }
});

export default router;
```

**Error handling note:** The endpoint returns 200 even on unexpected storage errors (with `sessionId: null`). The client is fire-and-forget; a 500 would be logged in the browser console and potentially alarm developers. Returning 200 with null sessionId is acceptable because the client does not use the response value.

---

## Question 9: Zod Validation Schema

```typescript
// Inside server/routes/analytics.ts

const sessionSchema = z.object({
  visitorId:   z.string().uuid("visitorId must be a valid UUID"),
  utmSource:   z.string().max(500).nullable().optional().default(null),
  utmMedium:   z.string().max(500).nullable().optional().default(null),
  utmCampaign: z.string().max(500).nullable().optional().default(null),
  utmTerm:     z.string().max(500).nullable().optional().default(null),
  utmContent:  z.string().max(500).nullable().optional().default(null),
  utmId:       z.string().max(500).nullable().optional().default(null),
  referrer:    z.string().max(2000).nullable().optional().default(null),
  landingPage: z.string().max(2000).nullable().optional().default(null),
});
```

**Key decisions:**
- `visitorId` must be a valid UUID (`.uuid()` validator rejects malformed IDs, preventing junk rows).
- All UTM fields are optional — a new visitor with no UTMs is valid.
- `max(500)` on UTM values prevents maliciously long strings from being stored.
- `max(2000)` on URL fields mirrors the standard URL length limit.
- `.default(null)` means missing keys are treated as null, not undefined, matching the storage function signature.

---

## Question 10: Router Registration in `server/routes.ts`

```typescript
// server/routes.ts — add import at top with other router imports:
import analyticsRouter from "./routes/analytics";

// Inside registerRoutes() — add after paymentsRouter registration:
// Analytics routes (public POST /api/analytics/session; admin GET endpoints in later phases)
app.use("/api/analytics", analyticsRouter);
```

**Placement matters:** Register `analyticsRouter` BEFORE the catch-all vite middleware (which is already handled — `registerRoutes` runs before vite setup in `server/index.ts`). Order within `registerRoutes` does not affect this phase since the endpoint is `/api/analytics/session` with no path conflicts.

---

## Common Pitfalls

### Pitfall 1: `visitorSessions` Defined After `bookings` in schema.ts

**What goes wrong:** If `visitorSessions` is placed after `bookings` in `shared/schema.ts`, the `bookings.utmSessionId` column references a table that hasn't been declared yet, causing a Drizzle type error and potential circular reference.

**How to avoid:** Place the `visitorSessions` table definition ABOVE the `bookings` table definition. Then `conversionEvents` goes below `bookings` (since it references both).

### Pitfall 2: `uniqueIndex` for ATTR-03 Blocks Non-Booking Events

**What goes wrong:** If the unique index on `(booking_id, event_type, attribution_model)` doesn't exclude NULL `booking_id`, then two non-booking events (e.g., two `chat_initiated` events for different visitors, both with `booking_id = NULL`) would conflict on the unique index and fail to insert.

**How to avoid:** The SQL migration must use a PARTIAL unique index: `WHERE booking_id IS NOT NULL`. The Drizzle `uniqueIndex()` call should also use `.where(isNotNull(table.bookingId))`.

### Pitfall 3: visit_count Increment with Drizzle

**What goes wrong:** Drizzle 0.39.3 does not have a standalone `.increment()` method. Using `sql\`visit_count + 1\`` in a `.set()` call requires importing `sql` from `drizzle-orm` and using it correctly. Testing this at runtime is necessary.

**How to avoid:** Use the select-first pattern: fetch `visitCount` in the initial SELECT, then pass `existing.visitCount + 1` to the UPDATE. This is two queries but is unambiguous and avoids any Drizzle version-specific behavior.

### Pitfall 4: UTM Values of `""` (Empty String) Stored Instead of `null`

**What goes wrong:** `URLSearchParams.get("utm_source")` returns `null` if absent, but may return `""` for `?utm_source=` (parameter present but empty). Storing `""` means rows have non-null source values that are blank.

**How to avoid:** The normalize function `norm()` already handles this: `const t = v?.trim().toLowerCase(); return t || null;` — empty string after trim returns `null`.

### Pitfall 5: Rate Limiter Key Collision

**What goes wrong:** The existing `isRateLimited` is used by chat routes with `conversationId` as the key. If the analytics endpoint uses just `req.ip` as key (without namespacing), it may interfere with other rate limits sharing the same Map.

**How to avoid:** Namespace the key: `\`analytics:${req.ip}\`` — this is distinct from any chat or booking rate limit key.

### Pitfall 6: Missing `uniqueIndex` Import in schema.ts

**What goes wrong:** `uniqueIndex` is not currently imported in `shared/schema.ts` (the file uses `serial`, `uuid`, etc. but not `uniqueIndex`). Adding a unique index on `conversionEvents` without the import causes a TypeScript error.

**How to avoid:** Add `uniqueIndex` to the import line at the top of `shared/schema.ts`:
```typescript
import { pgTable, text, serial, integer, numeric, timestamp, boolean, date, jsonb, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
```

---

## Code Examples

### Existing Pattern: Foreign Key with `onDelete: "set null"` (from schema.ts)

```typescript
// Source: direct inspection of shared/schema.ts line 145
contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
```

The `utmSessionId` FK follows this exact pattern with `uuid` type instead of `integer`.

### Existing Pattern: Storage Domain File Header (from server/storage/contacts.ts)

```typescript
// Source: direct inspection of server/storage/contacts.ts
import { db } from "../db";
import { contacts, bookings, type Contact, type Booking } from "@shared/schema";
import { eq, or, asc, desc, ilike, sql } from "drizzle-orm";
```

`server/storage/analytics.ts` follows this exact import pattern.

### Existing Pattern: Router with Rate Limit (from server/routes/bookings.ts)

```typescript
// Source: direct inspection of server/routes/bookings.ts lines 1-14
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../lib/auth";
import { canCreateBooking, recordBookingCreation } from "../lib/rate-limit";
```

### Existing Pattern: Adding to storage/index.ts

```typescript
// Source: direct inspection of server/storage/index.ts lines 5-14
import * as analytics from "./analytics";  // ADD THIS
export const storage = {
  ...users, ...catalog, ...bookings, ...company,
  ...integrations, ...chat, ...blog, ...timeSlots,
  ...contacts, ...staff,
  ...analytics,  // ADD THIS
  initializeRuntimeState,
};
```

---

## Environment Availability

Step 2.6: No external dependencies beyond the existing project stack. Supabase CLI is used for migrations — already established by MEMORY.md. No environment audit needed.

---

## Validation Architecture

No test framework is currently present in this project (no `pytest.ini`, `jest.config.*`, `vitest.config.*`, or `tests/` directory found in the codebase). The project verifies correctness via success criteria described in CONTEXT.md. Manual verification steps based on the phase success criteria are:

| Req ID | Success Criterion | Verification Method |
|--------|-------------------|---------------------|
| CAPTURE-01 through CAPTURE-06, ATTR-03 | POST to /api/analytics/session with UTM params records correct row | Manual: `curl -X POST /api/analytics/session` + `SELECT * FROM visitor_sessions` in Supabase dashboard |
| CAPTURE-02 | New visitor UUID generated and persisted | Manual: check localStorage in browser DevTools after first visit |
| CAPTURE-03 | Lowercase normalization | Manual: send `utm_source=Google`, verify stored as `google` |
| CAPTURE-04 | Google referrer → `organic_search` | Manual: POST with no UTMs but `referrer: "https://www.google.com"` |
| CAPTURE-05 | First-touch immutable on second POST | Manual: POST twice with different `utmSource`; verify `first_utm_source` unchanged |
| CAPTURE-06 | Last-touch updates on re-engagement | Manual: verify `last_utm_source` changes on second POST with new UTMs |
| ATTR-03 | Duplicate prevention constraint exists | `\d conversion_events` in psql — verify unique index present |
| Migration | Tables and indexes exist | `supabase db push` completes without error |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `drizzle-kit push` for migrations | Supabase CLI (`supabase db push`) | Per MEMORY.md — TTY prompt issues discovered | All migrations are hand-written SQL in `supabase/migrations/` |
| One row per page view (naive capture) | One row per visitor with upsert | Architecture decision | Prevents session noise; `visit_count` tracks re-engagement |
| `uuid` npm package | `crypto.randomUUID()` built-in | Node.js 14.17+ | Zero dependency, 3x faster |

---

## Open Questions

1. **`visitCount` increment syntax in Drizzle 0.39.3**
   - What we know: Drizzle supports `sql\`column + 1\`` in `.set()` calls
   - What's unclear: Whether the exact syntax compiles correctly without a raw SQL template in the version in use
   - Recommendation: Use select-first pattern (fetch current count, add 1, pass integer to update) as a safe fallback

2. **`APP_DOMAIN` env var for same-domain referrer check in `isSameDomain()`**
   - What we know: `server/lib/runtime-env.ts` validates env vars; `process.env.APP_DOMAIN` is not currently defined
   - What's unclear: What env var to use for the production domain
   - Recommendation: Use `process.env.VITE_APP_URL` (already set for Vercel deploys) or hardcode the production hostname as a fallback

3. **Partial index syntax in Drizzle's `uniqueIndex()` for ATTR-03**
   - What we know: PostgreSQL supports partial indexes; the SQL migration uses `WHERE booking_id IS NOT NULL`
   - What's unclear: Whether Drizzle 0.39.3's `uniqueIndex().where(isNotNull(...))` generates the correct partial index DDL, or whether it needs raw SQL
   - Recommendation: The SQL migration is authoritative. The Drizzle definition is for TypeScript types only; if Drizzle can't express the partial index, add a comment and rely on the migration SQL.

---

## Sources

### Primary (HIGH confidence)
- `shared/schema.ts` — Direct inspection of all table definitions, type patterns, import lines
- `server/storage/index.ts` — Direct inspection of assembled storage object pattern
- `server/routes/bookings.ts` — Direct inspection of Router pattern, Zod validation, error handling
- `server/lib/rate-limit.ts` — Direct inspection of `isRateLimited()` signature and Map-based implementation
- `client/src/App.tsx` — Direct inspection of `AnalyticsProvider` at line 77 and `useLocation()` pattern
- `client/src/lib/analytics.ts` — Direct inspection of `if (import.meta.env.DEV) return` guard pattern
- `server/routes.ts` — Direct inspection of `registerRoutes()` and `app.use()` pattern
- `supabase/migrations/20260409000000_add_contacts.sql` — Direct inspection of migration SQL format (adds FK to bookings, same pattern as `utm_session_id`)
- `.planning/phases/10-schema-capture-classification/10-CONTEXT.md` — All locked decisions (D-01 through D-10)
- `.planning/research/ARCHITECTURE.md` — Full schema column list, index list, upsert logic pseudocode
- `.planning/research/STACK.md` — Version verification, zero new packages confirmed
- `.planning/research/PITFALLS.md` — Critical pitfalls, especially case normalization and double conversion

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — Executive summary confirming build order and critical risks

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed by direct file inspection; zero new packages
- Schema definitions: HIGH — column-level detail drawn from ARCHITECTURE.md + confirmed patterns in schema.ts
- upsertVisitorSession logic: HIGH — pseudocode in ARCHITECTURE.md + confirmed patterns from contacts.ts upsert
- Traffic classifier: HIGH — domain list drawn from CONTEXT.md Claude's Discretion + ARCHITECTURE.md
- Hook implementation: HIGH — exact patterns from analytics.ts DEV guard + ARCHITECTURE.md pseudocode + App.tsx inspection
- Migration SQL: HIGH — exact format from existing migration files in supabase/migrations/
- Pitfalls: HIGH — grounded in direct schema.ts inspection (uniqueIndex import, table ordering)

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable stack, no fast-moving dependencies)
