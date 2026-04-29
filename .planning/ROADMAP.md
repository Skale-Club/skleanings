# Roadmap: Skleanings v1.0 Marketing Attribution

**Milestone:** v1.0 Marketing Attribution
**Defined:** 2026-04-25
**Phases:** 4 (Phase 10 through Phase 13)
**Requirements:** 40 v1 requirements — 40/40 mapped

---

## Phases

- [x] **Phase 10: Schema, Capture & Classification** — Database tables, Supabase migration, traffic classifier, session endpoint, and UTM capture hook (completed 2026-04-25)
- [x] **Phase 11: Booking Flow Attribution** — Link bookings to sessions, conversion event recording with dual first/last-touch writes, Stripe attribution preservation (completed 2026-04-25)
- [x] **Phase 12: Marketing Dashboard UI** — Admin marketing section with Overview, Sources, Campaigns, Conversions, filters, and empty states (completed 2026-04-25)
- [x] **Phase 13: Visitor Journey & GHL Sync** — Visitor journey view, Conversions detail list, GoHighLevel UTM field sync (completed 2026-04-26)

---

## Phase Details

### Phase 10: Schema, Capture & Classification
**Goal**: UTM data flows from visitor browser to the database on first page load — server can classify traffic and persist sessions
**Depends on**: Nothing (first phase in this milestone)
**Requirements**: CAPTURE-01, CAPTURE-02, CAPTURE-03, CAPTURE-04, CAPTURE-05, CAPTURE-06, ATTR-03
**Success Criteria** (what must be TRUE):
  1. A POST to /api/analytics/session with UTM params records a row in visitor_sessions with correct source, medium, campaign, referrer, landing page, and normalized lowercase values
  2. A second POST with the same visitor UUID updates only last_* columns — the first_* columns remain unchanged, confirming first-touch immutability
  3. A POST with no UTM params but a Google referrer records traffic_source as "organic_search" — confirming server-side classification
  4. A POST from a brand-new visitor (no prior localStorage) generates and persists a UUID so subsequent visits use the same session ID
  5. The Supabase migration runs cleanly and visitor_sessions, conversion_events tables and all indexes exist in the database
**Plans**: 3 plans
  - [x] 10-01-PLAN.md — Drizzle schema + Supabase SQL migration for visitor_sessions, conversion_events, bookings.utm_session_id
  - [x] 10-02-PLAN.md — Traffic classifier, upsertVisitorSession storage function, POST /api/analytics/session route + registration
  - [x] 10-03-PLAN.md — useUTMCapture client hook + mount in AnalyticsProvider
**UI hint**: yes

### Phase 11: Booking Flow Attribution
**Goal**: Every completed booking is permanently linked to the marketing session that drove it — attribution survives the Stripe redirect and cannot be double-recorded
**Depends on**: Phase 10
**Requirements**: ATTR-01, ATTR-02, EVENTS-01, EVENTS-02, EVENTS-03, EVENTS-04, EVENTS-05
**Success Criteria** (what must be TRUE):
  1. A booking made after clicking a UTM-tagged link has utm_session_id populated on the bookings row and two rows in conversion_events (one first_touch, one last_touch) with correct attributed_source and attributed_campaign
  2. A booking completed through the Stripe payment path (redirect + webhook) has attribution data — the visitorId is present on the booking row even when the webhook fires, not just on confirmation page load
  3. Completing the same booking twice (webhook + confirmation page race) produces exactly two conversion_events rows (one per attribution model), not four — the unique constraint on (booking_id, event_type) prevents duplicates
  4. Reaching the first step of the booking flow records a booking_started event in conversion_events without delaying or blocking the booking page load
  5. The booking flow completes successfully for users who have no visitorId in localStorage (attribution is skipped gracefully, booking is not blocked)
**Plans**: 3 plans
  - [x] 11-01-PLAN.md — linkBookingToAttribution + recordConversionEvent storage functions + POST /api/analytics/events endpoint
  - [x] 11-02-PLAN.md — BookingPage visitorId threading + booking_started event + bookings.ts + payments.ts wiring
  - [x] 11-03-PLAN.md — ChatWidget chat_initiated event

### Phase 12: Marketing Dashboard UI
**Goal**: Admin can open the Marketing section and immediately understand where visitors are coming from and which sources produce bookings — all in plain business language
**Depends on**: Phase 11
**Requirements**: OVERVIEW-01, OVERVIEW-02, OVERVIEW-03, OVERVIEW-04, OVERVIEW-05, SOURCES-01, SOURCES-02, SOURCES-03, SOURCES-04, CAMP-01, CAMP-02, CAMP-03, CAMP-04, FILTER-01, FILTER-02, FILTER-03, UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. Navigating to the admin Marketing section loads without errors and shows the Overview tab with KPI cards (Visitors, Bookings, Conversion Rate, Revenue) and a trend chart — all labeled in plain business language with no raw UTM parameter names visible
  2. The Sources tab shows a table with business-friendly source names (e.g., "Google Ads", "Organic Search", "Direct") and Direct/Unknown sources are always present with a tooltip explaining what they mean
  3. The Campaigns tab shows campaigns grouped with their source, including a row for campaigns that had visitors but zero bookings
  4. All views respond correctly to date range filter changes — selecting "Last 7 days" re-fetches and updates all numbers; the default on first open is "Last 30 days"
  5. When the database has no conversion data for the selected period, every tab shows a meaningful empty state explaining what the view will show once data is collected — the dashboard does not look broken
**Plans**: 3 plans
  - [x] 12-01-PLAN.md — AdminSection type fix + analytics-display.ts utility + aggregate storage functions + GET endpoints
  - [x] 12-02-PLAN.md — MarketingSection shell + date filter state + tab navigation + Admin.tsx registration
  - [x] 12-03-PLAN.md — MarketingOverviewTab + MarketingSourcesTab + MarketingCampaignsTab full implementations
**UI hint**: yes

### Phase 13: Visitor Journey & GHL Sync
**Goal**: Admin can trace any individual conversion back to its full session journey, and GoHighLevel contact records reflect the attribution touchpoints from completed bookings
**Depends on**: Phase 12
**Requirements**: CONV-01, CONV-02, CONV-03, JOUR-01, JOUR-02, GHL-01, GHL-02
**Success Criteria** (what must be TRUE):
  1. The Conversions tab lists all recorded conversion events with source, campaign, landing page, attribution model, booking value, and a link to the booking detail
  2. Filtering the Conversions list by source and date range returns only matching rows — an empty filter state shows the "no results" message, not a broken table
  3. Clicking into a visitor session shows the journey: first-touch source/campaign, any subsequent UTM touches, and the final conversion event — clearly labeled so the admin can see whether first-touch and last-touch were the same source
  4. After a booking with attribution data is created, the corresponding GoHighLevel contact record has first-touch source and campaign populated in the configured custom fields
  5. The GoHighLevel contact record also reflects last-touch source and campaign as separate fields — the admin can see both attribution touchpoints in the CRM
**Plans**: 3 plans
  - [x] 13-01-PLAN.md — getConversionsData + getVisitorSession storage functions + GET /conversions + GET /session/:visitorId endpoints
  - [x] 13-02-PLAN.md — updateGHLContact customFields extension + syncBookingToGhl UTM write (fire-and-forget)
  - [x] 13-03-PLAN.md — MarketingConversionsTab + VisitorJourneyPanel + MarketingSection 4th tab
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 10. Schema, Capture & Classification | 3/3 | Complete   | 2026-04-25 |
| 11. Booking Flow Attribution | 3/3 | Complete    | 2026-04-25 |
| 12. Marketing Dashboard UI | 3/3 | Complete    | 2026-04-25 |
| 13. Visitor Journey & GHL Sync | 3/3 | Complete    | 2026-04-26 |

---

## Requirement Coverage

**40/40 v1 requirements mapped — no orphans**

| Phase | Requirements |
|-------|-------------|
| Phase 10 | CAPTURE-01, CAPTURE-02, CAPTURE-03, CAPTURE-04, CAPTURE-05, CAPTURE-06, ATTR-03 |
| Phase 11 | ATTR-01, ATTR-02, EVENTS-01, EVENTS-02, EVENTS-03, EVENTS-04, EVENTS-05 |
| Phase 12 | OVERVIEW-01, OVERVIEW-02, OVERVIEW-03, OVERVIEW-04, OVERVIEW-05, SOURCES-01, SOURCES-02, SOURCES-03, SOURCES-04, CAMP-01, CAMP-02, CAMP-03, CAMP-04, FILTER-01, FILTER-02, FILTER-03, UX-01, UX-02, UX-03 |
| Phase 13 | CONV-01, CONV-02, CONV-03, JOUR-01, JOUR-02, GHL-01, GHL-02 |

---

## Key Build Constraints

1. **Supabase CLI only for migrations** — never drizzle-kit push (TTY prompt issues in this environment)
2. **Schema must exist before any downstream code** — Phase 10 is the strict unblock for all other phases
3. **Analytics writes are always fire-and-forget** — the booking flow is never blocked or awaited on attribution
4. **Server is authoritative for classification** — client sends raw params; server runs traffic-classifier.ts
5. **First-touch immutability enforced at storage layer** — upsertVisitorSession() must never overwrite first_* columns on an existing row
6. **Empty states before chart components in Phase 12** — day-one experience is all empty states; trust depends on them

### Phase 14: Admin calendar create booking from slot

**Goal:** Attendant can create a complete booking directly from a slot click on the admin calendar, without leaving the calendar — replacing the placeholder modal in `AppointmentsCalendarSection.tsx` with a real form that pre-fills date/start time/staff, supports type-ahead customer lookup, computes end time + estimated price, POSTs to /api/bookings, and refreshes the calendar on success.
**Requirements**: None (standalone admin-operations phase outside the v1.0 Marketing Attribution requirement set; scope captured in 14-CONTEXT.md decisions D-00 through D-19)
**Depends on:** Phase 13
**Plans:** 3/3 plans complete

Plans:
- [x] 14-01-PLAN.md — Form scaffold + slot pre-fill (react-hook-form + zodResolver, all fields, computed end time + estimated price, end-time-override toggle, placeholder onSubmit)
- [x] 14-02-PLAN.md — Customer type-ahead via debounced GET /api/contacts (Popover/Command list, free-text preserved)
- [x] 14-03-PLAN.md — Submit mutation + status PATCH (D-10) + 201/409/400 handling + calendar refresh + manual verification checkpoint

---

---

# Roadmap: Skleanings v2.0 White Label

**Milestone:** v2.0 White Label
**Defined:** 2026-04-28
**Phases:** 4 (Phase 15 through Phase 18)
**Requirements:** 24 v1 requirements — 24/24 mapped

---

## Phases

- [x] **Phase 15: Schema Foundation & Detokenization** — Add new companySettings fields to DB, run migration, replace all hardcoded brand strings in frontend and server code (completed 2026-04-29)
- [ ] **Phase 16: SEO Meta Injection** — Express middleware reads companySettings at request time and injects title, canonical, Open Graph, Twitter Card, and schema.org JSON-LD into index.html
- [ ] **Phase 17: Favicon, Legal & Company Type Admin UI** — Admin UI for favicon upload, legal page content editing, and service delivery model selector; public /privacy and /terms pages served from DB
- [ ] **Phase 18: Admin Calendar Improvements** — Fix time-line alignment, widen Create Booking modal, support multiple services per booking, editable end time, conditional address field, and brand button style

---

## Phase Details

### Phase 15: Schema Foundation & Detokenization
**Goal**: The database schema supports all white-label configurable fields and no hardcoded "Skleanings" strings remain in the frontend or server codebase — new tenant configuration is consumed from DB at runtime
**Depends on**: Phase 14
**Requirements**: WLTYPE-01, LEGAL-01, DETOK-01, DETOK-02, DETOK-03, SERV-01
**Success Criteria** (what must be TRUE):
  1. The Supabase migration runs cleanly and `companySettings` has `serviceDeliveryModel`, `privacyPolicyContent`, and `termsOfServiceContent` columns — a SELECT on the table returns these fields without error
  2. `ThemeContext.tsx` initializes `companyName` and `companyEmail` from the API response — loading the customer-facing site with a different `companyName` in the DB shows that name in the browser tab title and any components that display it
  3. The localStorage visitor key is derived from the company slug, not the literal string `"skleanings_visitor_id"` — changing the slug in companySettings causes a new key prefix to be used on next page load
  4. A full-text search of `client/src/` for the string `"Skleanings"` returns zero results in React component files (hardcoded display literals removed; only comments or non-display strings are permitted)
  5. `server/lib/openrouter.ts` reads the app title from `companySettings.companyName` — the blog generation prompt no longer contains the hardcoded word "Skleanings"
**Plans**: 3 plans
  - [x] 15-01-PLAN.md — Supabase migration + Drizzle schema extension (3 white-label columns) + getCompanySettings whitelist verification
  - [x] 15-02-PLAN.md — Client detokenization: visitor-key helper + useUTMCapture rewrite + ChatWidget/BookingPage read sites + App.tsx document.title effect + 8+ display-literal replacements
  - [x] 15-03-PLAN.md — Server detokenization: openrouter.ts companyName parameter injection + ai.ts and chat/message-handler.ts caller threading
**UI hint**: yes

### Phase 16: SEO Meta Injection
**Goal**: Every page served by Express has accurate, tenant-specific meta tags injected server-side — search engines and social platforms receive correct title, canonical URL, Open Graph, Twitter Card, and structured data without any static "Skleanings" meta remaining in index.html
**Depends on**: Phase 15
**Requirements**: SEO-01, SEO-02, SEO-03, SEO-04, SEO-05
**Success Criteria** (what must be TRUE):
  1. Fetching any page URL with `curl` (bypassing the browser) returns HTML that includes a `<title>` tag matching `companySettings.seoTitle` — the static index.html title is gone
  2. The `curl` response includes `<meta property="og:title">`, `<meta property="og:description">`, `<meta property="og:image">`, and `<link rel="canonical">` all populated from companySettings values
  3. The `curl` response includes `<meta name="twitter:card">`, `<meta name="twitter:title">`, and `<meta name="twitter:description">` populated from companySettings
  4. The `curl` response body contains a `<script type="application/ld+json">` block with a valid LocalBusiness schema object whose `name` matches `companySettings.companyName`
  5. A text search of `client/index.html` finds no occurrence of the string `"Skleanings"` — all brand-specific meta has been removed from the static file
**Plans**: TBD

### Phase 17: Favicon, Legal & Company Type Admin UI
**Goal**: Admin can configure the favicon, privacy policy, terms of service, and service delivery model through the settings panel — and customers visiting /privacy or /terms see the content stored in the database rather than a 404 or placeholder
**Depends on**: Phase 15
**Requirements**: FAV-01, FAV-02, FAV-03, WLTYPE-02, LEGAL-02, LEGAL-03, LEGAL-04
**Success Criteria** (what must be TRUE):
  1. Admin can enter or upload a favicon URL in Company Settings and save it — a subsequent page load shows the new favicon in the browser tab
  2. When `faviconUrl` is empty, loading the site does not produce a broken image request or console error — the browser shows no favicon or the default gracefully
  3. Admin can select a service delivery model (`At Customer Location`, `Customer Comes In`, or `Both`) in Company Settings and save it — the saved value persists on page refresh
  4. Navigating to `/privacy` renders the Privacy Policy content stored in companySettings — editing the content in admin and refreshing the public page shows the updated text
  5. Navigating to `/terms` renders the Terms of Service content stored in companySettings — an empty field shows a clear placeholder message rather than a blank or broken page
**Plans**: TBD
**UI hint**: yes

### Phase 18: Admin Calendar Improvements
**Goal**: The admin calendar Create Booking modal is production-ready — time labels align with grid slots, the form is wide enough to use comfortably, multiple services can be added per booking, end time is directly editable, and the address field only appears when the job is at the customer's location
**Depends on**: Phase 15
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04, CAL-05, CAL-06
**Success Criteria** (what must be TRUE):
  1. Opening the admin calendar and viewing a day with appointments shows time slot labels (e.g., "9:00 AM") horizontally aligned with the correct grid row — no offset between label and slot
  2. Opening the Create Booking modal on any screen wider than 768px shows a modal at least 600px wide — form fields are not cramped or wrapping awkwardly
  3. The Create Booking form has an "+ Add service" button — clicking it adds a new row with a service selector and quantity input; at least two services can be added and both appear in the submitted booking
  4. The end time field is directly editable — manually typing a later end time overrides the auto-computed value and the override persists when the form is submitted
  5. With `serviceDeliveryModel` set to `at-customer`, the address field is visible in the Create Booking form; with it set to `customer-comes-in`, the address field is hidden
  6. The Create Booking submit button uses the brand yellow background with black bold text and spans the full modal width
**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 15. Schema Foundation & Detokenization | 3/3 | Complete    | 2026-04-29 |
| 16. SEO Meta Injection | 1/3 | In progress | - |
| 17. Favicon, Legal & Company Type Admin UI | 0/? | Not started | - |
| 18. Admin Calendar Improvements | 0/? | Not started | - |

---

## Requirement Coverage

**24/24 v1 requirements mapped — no orphans**

| Phase | Requirements |
|-------|-------------|
| Phase 15 | WLTYPE-01, LEGAL-01, DETOK-01, DETOK-02, DETOK-03, SERV-01 |
| Phase 16 | SEO-01, SEO-02, SEO-03, SEO-04, SEO-05 |
| Phase 17 | FAV-01, FAV-02, FAV-03, WLTYPE-02, LEGAL-02, LEGAL-03, LEGAL-04 |
| Phase 18 | CAL-01, CAL-02, CAL-03, CAL-04, CAL-05, CAL-06 |

---

## Key Build Constraints

1. **Supabase CLI only for migrations** — Phase 15 schema changes must go through a Supabase migration file, not drizzle-kit push
2. **companySettings is a singleton row** — all reads must handle the case where the row does not yet exist (fallback to safe defaults, never crash)
3. **SEO middleware fires before static file handler** — Phase 16 Express middleware must intercept the index.html request before `express.static` returns the cached file
4. **CAL-05 address field depends on Phase 15 schema** — Phase 18 plan must read `serviceDeliveryModel` from the API; Phase 15 must be complete before Phase 18 executes

---

*Roadmap defined: 2026-04-25*
*v2.0 section appended: 2026-04-28*
