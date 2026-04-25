# Research Summary: Skleanings v1.0 Marketing Attribution
**Synthesized:** 2026-04-25
**Confidence:** HIGH across all four research areas

---

## Executive Summary

Building first-party UTM attribution into Skleanings requires zero new runtime npm packages. Every technical capability needed exists in the current stack (Express 4, Drizzle ORM, Recharts 2.15.2, React Query, date-fns, Zod). The system adds two new database tables (visitor_sessions, conversion_events), one nullable FK column on bookings, a new Express router, a new storage module, a new client-side hook, and a new admin dashboard section. All changes are additive and non-breaking to the existing booking flow.

The attribution chain must be unbroken at two points: (1) session capture on first visit, and (2) booking creation where the session ID is passed in the POST body before any Stripe redirect occurs. These two moments must be built together in the same phase. Every downstream dashboard view is only as good as the integrity of these two writes.

The dashboard audience is a non-technical business owner. Every design decision should be evaluated against: Where are my visitors coming from? Which sources are producing actual bookings? Is my marketing spend well-placed? Features that do not answer one of those three questions plainly are scope creep.

---

## Stack Additions

No new runtime packages required. All existing dependencies cover the full implementation.

| Capability | Tool | Status |
|-----------|------|--------|
| UTM session + conversion tables | Drizzle ORM + PostgreSQL | Already installed |
| Visitor UUID generation | crypto.randomUUID() Node.js built-in | No package needed |
| Trend and bar charts | Recharts 2.15.2 | Already installed |
| Date range formatting | date-fns 3.6.0 | Already installed |
| API input validation | Zod 3.24.2 | Already installed |
| Dashboard data fetching | React Query 5.60.5 | Already installed |
| Cookie parsing (optional) | cookie-parser ~1.4.7 | Add only if needed |

Do NOT add: Segment, Mixpanel, Amplitude, Google Tag Manager, the uuid npm package, recharts 3.x, InfluxDB, Redis, or any time-series database.

---

## Feature Table Stakes

Minimum features for a usable v1 attribution dashboard.

| Feature | Why Required |
|---------|-------------|
| UTM session capture (all 6 params + referrer + landing page) | Without this nothing else works |
| Auto-classification to friendly channel labels | Human labels not raw UTM values |
| Booking completion event linked to session | The core value: which source drove this booking |
| Overview KPI cards (Visitors, Bookings, Conversion Rate) | Mental model baseline |
| Source performance table (visitors, bookings, conversion rate per source) | Primary reporting view |
| Trend line (bookings per day/week) | Owner needs to see growth or decline |
| Date range presets (Last 7D, Last 30D, This Month, Last Month, Custom) | Default: Last 30 Days |
| Direct/Unknown source displayed with tooltip | Hiding it destroys trust in the numbers |
| First-touch preserved alongside last-touch | Never overwrite first-touch columns |
| Empty states with honest copy | Day-one experience will be all empty states |

Defer to v1.x: campaign performance table, revenue attribution, micro-conversion tracking, period comparison, UTM coverage warning banner.
Defer to v2+: visitor journey view, landing page performance view, CSV export.

---

## Key Architectural Decisions

**1. One row per visitor in visitor_sessions, not one row per page view.**
First-touch columns are written once on INSERT and never updated. Last-touch columns are overwritten on each subsequent visit with UTM signal. Session ID is a client-generated UUID stored in localStorage under key skleanings_visitor_id.

**2. Denormalized attribution snapshot in conversion_events.**
When a conversion fires, the server writes attributed_source, attributed_medium, attributed_campaign directly onto the conversion_events row, copied from the visitor session at event time. All dashboard aggregate queries run against conversion_events alone with no joins required.

**3. Dual-row conversion writes (first-touch + last-touch).**
A single booking_completed event writes two rows to conversion_events: one with attribution_model = first_touch and one with attribution_model = last_touch. Dashboard queries filter by model. This avoids SQL CASE branching in every report query.

**4. Analytics writes are fire-and-forget; booking flow is never blocked.**
All client-side analytics calls use .catch(() => {}) and never await. The visitorId is already in localStorage so the booking POST includes it synchronously without waiting for any analytics response.

**5. Server is authoritative for classification; client sends raw params.**
The client reads URL params as-is. The server runs traffic classification in server/lib/traffic-classifier.ts and writes the derived traffic_source label. Classification rules can be updated without a frontend deploy.

---

## Critical Pitfalls to Avoid

**Pitfall 1: UTM data lost on Stripe redirect (CRITICAL)**
Confirmation.tsx fires trackPurchase() after the Stripe return but localStorage context may be missing at that point. Prevention: send visitorId in the POST /api/bookings or POST /api/payments/checkout body before the Stripe redirect. The Stripe webhook reads visitorId from the booking row, not from the client. Build this in Phase 1 and Phase 2 together.

**Pitfall 2: Double conversion recording from Stripe webhook + frontend (CRITICAL)**
If Confirmation.tsx and the Stripe webhook both write to conversion_events, every Stripe-flow booking appears twice. Prevention: the server is the sole write point for booking_completed conversion events. Frontend fires GA4/GTM events only. Add a unique constraint on (booking_id, event_type) in the schema migration.

**Pitfall 3: UTM case sensitivity corrupts reporting (HIGH)**
utm_source=Google and utm_source=google become two separate rows. Prevention: normalize all UTM values to lowercase at capture time in the JS hook before writing to localStorage or sending to the server. Do not use LOWER() in SQL as that bypasses indexes.

**Pitfall 4: No indexes on new tables (HIGH)**
Without a created_at index, dashboard queries scan the full table and become slow at approximately 50k rows. Prevention: add created_at index and a composite (utm_source, utm_medium, created_at) index in the initial schema migration. Never add the tables without the indexes.

**Pitfall 5: Empty dashboard damages trust on day one (MEDIUM)**
The existing 40+ bookings have no utm_session_id. Day one the dashboard is empty and looks broken. Prevention: design explicit empty states before building any dashboard component. Offer a one-time backfill option to import existing bookings as Direct/Unknown so historical booking counts are not zero.

---

## Suggested Build Order

**Phase 1: Schema + Session Capture** (blocks everything)
- Add visitor_sessions and conversion_events tables to shared/schema.ts with all indexes
- Add utm_session_id nullable FK to bookings table
- Run Supabase CLI migration (per MEMORY.md -- never drizzle-kit push)
- Create server/lib/traffic-classifier.ts
- Create server/storage/analytics.ts with upsertVisitorSession()
- Create server/routes/analytics.ts with POST /api/analytics/session (public, no auth)
- Create client/src/hooks/use-utm-capture.ts
- Mount useUTMCapture() inside AnalyticsProvider in App.tsx

**Phase 2: Booking Flow Integration + Conversion Recording** (depends on Phase 1)
- Modify BookingPage.tsx: read visitorId from localStorage, append to POST body
- Modify server/routes/bookings.ts: call linkBookingToAttribution() non-blocking after createBooking()
- Ensure visitorId survives Stripe checkout path (pass in body; read from booking row in webhook)
- Add POST /api/analytics/events endpoint (public, no auth)
- Add storage.recordConversionEvent() with dual-row first/last touch writes
- Add unique constraint on (booking_id, event_type) in conversion_events
- Modify Confirmation.tsx: fire booking_completed event fire-and-forget after existing trackPurchase call

**Phase 3: Admin Dashboard UI** (depends on Phases 1 + 2)
- Add GET endpoints to analytics routes (all behind requireAdmin): overview, campaigns, sources, conversions
- Create client/src/components/admin/MarketingSection.tsx with tabs: Overview, Sources, Campaigns, Conversions
- Add marketing entry to menuItems in Admin.tsx
- Build all empty states before any data-filled states
- Recharts AreaChart for trend, BarChart for source/campaign comparisons
- All UTM values mapped through display-name utility -- no raw params in any primary view

---

## Watch Out For

**The Stripe attribution gap is the highest-risk item in the entire milestone.** If visitorId is not attached to the booking POST body before the Stripe redirect, every Stripe-flow booking will have null attribution permanently. There is no retroactive fix. This must be designed and verified in Phase 2 before any dashboard work begins.

**First-touch preservation requires immutability enforced at the storage layer, not just by convention.** The upsertVisitorSession() function must explicitly never update first_ columns on an existing row. Write a comment in the function making this invariant explicit.

**The empty state problem is a trust problem, not a UX detail.** If the dashboard opens empty on day one without clear context, the owner will conclude the feature is broken and stop using it. Empty states must be built before chart components, not polished afterward.

---

## Gaps Requiring Attention During Planning

- Rate limiting strategy for POST /api/analytics/session (public endpoint) -- specifics not yet designed
- Idempotency key mechanism for the booking POST retry scenario -- decision needed: client-generated UUID in payload vs. server-side deduplication
- GoHighLevel integration: UTM data should be added to GHL contact custom fields in syncBookingToGhl -- requires knowing the target GHL custom field names

---

*Synthesized from: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
*Research date: 2026-04-25*
