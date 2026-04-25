---
phase: 11-booking-flow-attribution
verified: 2026-04-25T22:00:00Z
status: gaps_found
score: 9/10 must-haves verified
gaps:
  - truth: "Admin can see each conversion event linked to the booking or action it represents (EVENTS-05)"
    status: partial
    reason: "The conversion_events.booking_id FK is populated correctly by both booking paths, satisfying the data-linkage half of EVENTS-05. However, the requirement text says 'Admin can SEE' — no admin UI, API read endpoint, or BookingsSection column exposes this data visually. The RESEARCH.md explicitly defers the view to Phase 12 ('dashboard queries (Phase 12) will join on this'), making this a deliberate deferral rather than an oversight. The gap is real but bounded."
    artifacts:
      - path: "client/src/components/admin/BookingsSection.tsx"
        issue: "No utmSessionId, attributed_source, or conversion event data rendered — admin cannot currently see attribution data for a booking"
      - path: "server/routes/analytics.ts"
        issue: "Only POST endpoints exist — no GET endpoint for admin to query conversion events linked to a booking"
      - path: "server/storage/analytics.ts"
        issue: "No getConversionEvents or getConversionEventsByBooking query function exists"
    missing:
      - "Admin GET endpoint (e.g., GET /api/analytics/conversions or GET /api/bookings/:id/attribution) to expose conversion events per booking"
      - "Admin UI in BookingsSection or a dedicated conversions view to display first-touch/last-touch attribution per booking"
      - "Note: Phase 11 RESEARCH.md explicitly scoped this visual to Phase 12 — this gap is planned, not accidental"
human_verification:
  - test: "Direct booking with UTM-tagged visitorId — verify utm_session_id populated"
    expected: "After booking POST with visitorId in body, bookings.utm_session_id matches visitor_sessions.id, and conversion_events has exactly 2 rows (first_touch + last_touch) with non-null attributed_source"
    why_human: "Requires live DB with migration applied (visitor_sessions + conversion_events tables) and a seeded visitor session"
  - test: "Stripe booking path — attribution survives redirect (ATTR-02)"
    expected: "After checkout POST with visitorId, booking row has utm_session_id set before Stripe redirect. After webhook fires, conversion_events has 2 rows with bookingId set"
    why_human: "Requires Stripe test mode and live DB — cannot verify without running both Stripe and the server"
  - test: "Missing visitorId — booking completes without error (EVENTS-04 null path)"
    expected: "Clear localStorage, make a booking, confirm 201 response and no errors in server log. utm_session_id on booking row is null"
    why_human: "Requires browser and live server"
  - test: "booking_started fires without blocking page load (EVENTS-02 timing)"
    expected: "Load /booking with cart items, Network tab shows POST /api/analytics/events fires asynchronously, booking page renders immediately without waiting for POST response"
    why_human: "Browser DevTools required to verify timing and non-blocking behavior"
  - test: "Duplicate prevention — webhook + confirmation race (ATTR-03)"
    expected: "Triggering both booking paths for same bookingId produces exactly 2 rows in conversion_events (not 4), due to unique partial index"
    why_human: "Requires live DB with the partial unique index from the migration applied"
---

# Phase 11: Booking Flow Attribution Verification Report

**Phase Goal:** Every completed booking is permanently linked to the marketing session that drove it — attribution survives the Stripe redirect and cannot be double-recorded
**Verified:** 2026-04-25T22:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `storage.linkBookingToAttribution(bookingId, visitorId)` links booking to visitor session and increments total_bookings | VERIFIED | `server/storage/analytics.ts` lines 146-176: full implementation with DB select, update bookings.utmSessionId, increment visitorSessions.totalBookings, set convertedAt on first conversion |
| 2 | `storage.recordConversionEvent(eventType, options)` writes exactly two rows (first_touch + last_touch) using onConflictDoNothing | VERIFIED | `server/storage/analytics.ts` lines 194-264: dual-row insert with attribution_model values, `.onConflictDoNothing()` at line 263 |
| 3 | POST /api/analytics/events accepts { visitorId, eventType, pageUrl } and responds 200 without blocking | VERIFIED | `server/routes/analytics.ts` lines 57-86: Zod schema validates enum (booking_started, chat_initiated), rate-limited 60/IP/min, returns 200 even on unexpected errors |
| 4 | Both storage functions silently no-op when visitor session not found (D-03) | VERIFIED | `analytics.ts` line 157: `if (sessionRows.length === 0) return;` in linkBookingToAttribution; `recordConversionEvent` writes rows with null session fields rather than throwing |
| 5 | bookingPayload in BookingPage.tsx includes visitorId from localStorage — affects both direct and Stripe paths (ATTR-02) | VERIFIED | `client/src/pages/BookingPage.tsx` line 195: `visitorId: localStorage.getItem('skleanings_visitor_id') ?? undefined` in bookingPayload; both `checkoutMutation.mutate(bookingPayload)` and `createBooking.mutate(bookingPayload as any` use same payload |
| 6 | booking_started POST fires fire-and-forget from BookingPage useEffect when items.length > 0 (EVENTS-02) | VERIFIED | Lines 142-152: inline fetch inside `if (items.length > 0)` block with `.catch(() => {})` — no await |
| 7 | Direct booking path calls linkBookingToAttribution then recordConversionEvent in independent try-catch blocks (EVENTS-01, EVENTS-04) | VERIFIED | `server/routes/bookings.ts` lines 125-142: two independent try-catch blocks after contact upsert, both error-isolated, booking response sent at line 195 regardless |
| 8 | Stripe checkout path calls linkBookingToAttribution only — recordConversionEvent NOT called here (D-05) | VERIFIED | `server/routes/payments.ts` lines 90-97: only `linkBookingToAttribution` called in checkout handler. `grep -c "recordConversionEvent" payments.ts` = 1 (webhook only) |
| 9 | Stripe webhook calls recordConversionEvent after updateBooking confirms payment=paid (EVENTS-01, EVENTS-05 data linkage) | VERIFIED | `server/routes/payments.ts` lines 144-152: `recordConversionEvent('booking_completed', { bookingId })` inside `if (session.payment_status === "paid")` block with try-catch |
| 10 | Admin can see each conversion event linked to the booking (EVENTS-05 visibility) | PARTIAL | `conversion_events.booking_id` FK is populated correctly. No admin UI, read endpoint, or BookingsSection column surfaces this data — deferred to Phase 12 per RESEARCH.md |

**Score:** 9/10 truths verified (1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/storage/analytics.ts` | linkBookingToAttribution and recordConversionEvent exported functions | VERIFIED | Both functions exported (lines 146, 194). Imports: `conversionEvents, bookings` added alongside existing `visitorSessions`. 265 lines total, substantive implementation |
| `server/routes/analytics.ts` | POST /events endpoint registered on the analytics router | VERIFIED | Lines 57-86: `router.post("/events"` present. Both `/session` and `/events` registered (2 POST handlers). `eventSchema` with enum validation present |
| `client/src/pages/BookingPage.tsx` | visitorId in bookingPayload + booking_started useEffect | VERIFIED | Line 195: `visitorId: localStorage.getItem('skleanings_visitor_id') ?? undefined`. Lines 142-152: fire-and-forget booking_started. `createBooking.mutate(bookingPayload as any` cast present |
| `server/routes/bookings.ts` | linkBookingToAttribution + recordConversionEvent after contact upsert | VERIFIED | Line 5: direct import from `../storage/analytics`. Lines 128-142: two independent try-catch attribution calls after contact upsert |
| `server/routes/payments.ts` | visitorId extracted before Zod parse; linkBookingToAttribution in checkout; recordConversionEvent in webhook | VERIFIED | Line 4: direct import. Line 32: `visitorId = req.body.visitorId` after Zod parse. Lines 91-97: linkBookingToAttribution in checkout. Lines 147-152: recordConversionEvent in webhook only |
| `client/src/components/chat/ChatWidget.tsx` | chat_initiated fetch inside toggleOpen willOpen=true block | VERIFIED | Lines 537-547: inline fetch with `eventType: 'chat_initiated'` inside `if (willOpen)` block. `.catch(() => {})` present. Not inside the `else` (close) branch |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `BookingPage.tsx bookingPayload.visitorId` | `server/routes/bookings.ts req.body.visitorId` and `server/routes/payments.ts req.body.visitorId` | JSON POST body outside Zod schema | WIRED | `visitorId: localStorage.getItem(...)` in bookingPayload; server reads `req.body.visitorId` directly after Zod parse (D-07) |
| `server/routes/analytics.ts POST /events` | `storage.recordConversionEvent` | direct call with parsed Zod payload | WIRED | Line 73: `await storage.recordConversionEvent(parsed.eventType, { visitorId: ..., pageUrl: ... })` |
| `recordConversionEvent` | `db.insert(conversionEvents).onConflictDoNothing()` | Drizzle insert with dual-row values array | WIRED | Lines 235-263: `db.insert(conversionEvents).values([first_touch_row, last_touch_row]).onConflictDoNothing()` |
| `server/routes/bookings.ts` | `linkBookingToAttribution` + `recordConversionEvent` | independent try-catch blocks | WIRED | Lines 128-142: two isolated try-catch blocks calling each function directly |
| `server/routes/payments.ts webhook checkout.session.completed` | `recordConversionEvent('booking_completed')` | inside `payment_status === 'paid'` block | WIRED | Lines 144-152: correct placement, correct event type, bookingId passed |
| `ChatWidget.tsx toggleOpen willOpen===true branch` | `POST /api/analytics/events` | inline fetch().catch(() => {}) with no await | WIRED | Lines 539-547: fetch inside `if (willOpen)` with `.catch(() => {})`. `else` branch contains only `trackChatClose` |
| `server/storage/index.ts` | `analytics.ts` exported functions | spread `...analytics` | WIRED | `server/storage/index.ts` lines 15, 104: `import * as analytics` then `...analytics` spread — all analytics exports available as `storage.*` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `server/storage/analytics.ts recordConversionEvent` | session (firstUtmSource, lastUtmSource etc.) | DB select from visitorSessions | Yes — reads real DB rows; falls back to null attribution if session not found (event still written) | FLOWING |
| `server/storage/analytics.ts linkBookingToAttribution` | session.totalBookings, session.convertedAt | DB select from visitorSessions | Yes — real DB read + two real DB writes | FLOWING |
| `client/src/pages/BookingPage.tsx booking_started` | visitorId | localStorage.getItem('skleanings_visitor_id') | Real — populated by useUTMCapture hook (Phase 10) | FLOWING |
| `client/src/components/chat/ChatWidget.tsx chat_initiated` | visitorId | localStorage.getItem('skleanings_visitor_id') | Real — same localStorage key as above | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation | `npm run check` | EXIT 0, no errors | PASS |
| `linkBookingToAttribution` exported | `grep -n "export async function linkBookingToAttribution" server/storage/analytics.ts` | Line 146 match | PASS |
| `recordConversionEvent` exported | `grep -n "export async function recordConversionEvent" server/storage/analytics.ts` | Line 194 match | PASS |
| `onConflictDoNothing` present | `grep -n "onConflictDoNothing" server/storage/analytics.ts` | Line 263 match | PASS |
| POST /events endpoint | `grep -n 'router.post("/events"' server/routes/analytics.ts` | Line 66 match | PASS |
| booking_started in BookingPage | `grep -n "booking_started" client/src/pages/BookingPage.tsx` | Line 149 match | PASS |
| visitorId in bookingPayload (2 occurrences) | `grep -n "visitorId.*localStorage" client/src/pages/BookingPage.tsx` | Lines 143, 195 | PASS |
| linkBookingToAttribution in bookings.ts | `grep -n "linkBookingToAttribution" server/routes/bookings.ts` | Lines 5, 130 | PASS |
| recordConversionEvent in bookings.ts | `grep -n "recordConversionEvent" server/routes/bookings.ts` | Lines 5, 136 | PASS |
| recordConversionEvent count in payments.ts | `grep -c "recordConversionEvent" server/routes/payments.ts` | 2 (import + webhook call — no checkout call) | PASS |
| chat_initiated in ChatWidget | `grep -n "chat_initiated" client/src/components/chat/ChatWidget.tsx` | Line 544 match | PASS |
| chat_initiated inside willOpen=true block | ChatWidget lines 534-553 | fetch inside `if (willOpen)` at line 535, not in `else` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ATTR-01 | 11-01, 11-02 | Each conversion event records both first-touch and last-touch attribution as separate fields | SATISFIED | `recordConversionEvent` writes two rows — `attributionModel: 'first_touch'` and `attributionModel: 'last_touch'` — using first_* and last_* columns from visitorSessions respectively |
| ATTR-02 | 11-02 | Booking attribution survives the Stripe checkout redirect | SATISFIED | `visitorId` in `bookingPayload` reaches `POST /api/payments/checkout` via JSON body; server reads `req.body.visitorId` before Zod strips unknown fields (line 32 of payments.ts); `linkBookingToAttribution` called after booking row created, before Stripe redirect |
| EVENTS-01 | 11-01, 11-02 | Booking completed event recorded with full first/last-touch attribution context | SATISFIED | `recordConversionEvent('booking_completed', { bookingId, bookingValue })` called in both bookings.ts (direct path) and payments.ts webhook; dual-row write captures attributed_source, attributed_medium, attributed_campaign, attributed_landing_page |
| EVENTS-02 | 11-01, 11-02 | Booking started event recorded when visitor reaches booking flow | SATISFIED | BookingPage.tsx mount useEffect fires `fetch('/api/analytics/events', { body: { eventType: 'booking_started', visitorId, pageUrl } })` with `.catch(() => {})` when `items.length > 0` |
| EVENTS-03 | 11-01, 11-03 | Chat initiated event recorded when chat widget opens | SATISFIED | ChatWidget.tsx `toggleOpen` fires `fetch('/api/analytics/events', { body: { eventType: 'chat_initiated', visitorId, pageUrl } })` with `.catch(() => {})` inside `if (willOpen)` block only |
| EVENTS-04 | 11-01, 11-02, 11-03 | Conversion event recording never delays or blocks the booking flow | SATISFIED (with caveat) | Client-side: genuine fire-and-forget (no await + .catch). Server-side: error-isolated try-catch blocks — attribution failures cannot kill the booking response. The response IS sent after these awaits complete, matching the same pattern as contact upsert and notifications already in the codebase. The CONTEXT defines "fire-and-forget" as "errors cannot propagate" not "true async detachment". |
| EVENTS-05 | 11-02 | Admin can see each conversion event linked to the booking or action it represents | PARTIAL | Data linkage: `conversion_events.booking_id` FK is populated for all `booking_completed` events. Visual access: no admin GET endpoint and no admin UI renders this data in Phase 11. RESEARCH.md explicitly defers the view to Phase 12 |

**EVENTS-05 gap note:** The project's own research document (`11-RESEARCH.md` line 50) documents the Phase 11 interpretation as "FK column already exists; dashboard queries (Phase 12) will join on this." The REQUIREMENTS.md traceability table marks EVENTS-05 as Phase 11/Complete, but the actual requirement text ("Admin can SEE") implies a visible surface. This is a deliberate scoping decision. The data infrastructure is complete; the visibility layer is deferred.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scanned for: TODO/FIXME/placeholder comments, empty return values, hardcoded empty data, console.log-only implementations. No anti-patterns found in the five files modified by this phase.

### Human Verification Required

#### 1. Direct Booking with UTM Attribution

**Test:** Seed a visitor session in the DB. Make a POST /api/bookings request with `visitorId` matching that session. Check the resulting booking row has `utm_session_id` populated and `conversion_events` contains exactly 2 rows with non-null `attributed_source`.
**Expected:** `bookings.utm_session_id = <visitor_session_uuid>`. Two rows in `conversion_events` — one `first_touch`, one `last_touch` — both with `booking_id` set and `attributed_source` matching the session's `first_utm_source` and `last_utm_source` respectively.
**Why human:** Requires live PostgreSQL DB with the migration from Phase 10 applied (`visitor_sessions`, `conversion_events` tables, `bookings.utm_session_id` column).

#### 2. Stripe Attribution Survives Redirect (ATTR-02 Critical Path)

**Test:** Click a UTM-tagged link to set up localStorage. Go through the Stripe checkout path. After Stripe redirect and webhook fires, check the booking row and conversion_events.
**Expected:** `bookings.utm_session_id` is non-null (set in checkout handler before Stripe redirect). After webhook fires, 2 rows in `conversion_events` with `booking_id` and attribution data.
**Why human:** Requires Stripe test mode, live server, and DB — the sequential flow of checkout then webhook cannot be verified statically.

#### 3. Missing visitorId — Booking Completes Without Error

**Test:** Clear localStorage or open a private window. Complete a direct booking and a Stripe booking. Confirm both succeed with 201/session URL responses and no server errors.
**Expected:** Bookings complete. `bookings.utm_session_id = null`. `conversion_events` has 2 rows for each booking with `visitor_id = null` and null attribution fields (event preserved, attribution null).
**Why human:** Requires live browser and server; the D-03 null path must be tested end-to-end.

#### 4. booking_started Does Not Block Page Load

**Test:** Open browser DevTools Network tab. Navigate to /booking with cart items. Observe POST /api/analytics/events timing relative to page render.
**Expected:** The `/api/analytics/events` POST fires and completes without preventing or visibly delaying the page from rendering. Chat and form UI appear immediately.
**Why human:** Timing and non-blocking behavior require browser observation — static analysis cannot measure this.

#### 5. Duplicate Prevention Under Race (ATTR-03)

**Test:** Simulate both the webhook path and a direct `recordConversionEvent` call for the same `bookingId`. Verify conversion_events count remains 2 (not 4), thanks to the partial unique index `(booking_id, event_type, attribution_model)`.
**Expected:** Exactly 2 rows per `booking_id` + `event_type` combination, regardless of how many times `recordConversionEvent` is called for the same booking.
**Why human:** Requires live DB with the partial unique index from the SQL migration applied — the Drizzle schema placeholder does not enforce this, only the raw SQL migration does.

### Gaps Summary

One gap found blocking full requirement satisfaction:

**EVENTS-05 — Admin visibility of conversion events linked to bookings**

The data infrastructure is fully implemented: `conversion_events.booking_id` is populated for all `booking_completed` events in both the direct booking path and the Stripe webhook path. The unique partial index prevents duplicates. The attribution data (first-touch and last-touch source, medium, campaign, landing page) is written correctly.

What is missing is the admin-facing surface: there is no GET endpoint to query conversion events, no `getConversionEventsByBooking` storage function, and no column in `BookingsSection.tsx` or any other admin component that shows attribution data per booking.

**Context:** The Phase 11 RESEARCH.md explicitly documents this as intentional: "conversionEvents.bookingId FK column already exists; dashboard queries (Phase 12) will join on this." The ROADMAP Success Criteria for Phase 11 (lines 42-46) focus entirely on data correctness (FK populated, Stripe timing, duplicate prevention, graceful null path) — none of the 5 success criteria mention an admin view. The admin view belongs to Phase 12 (CONV-01, CONV-02, CONV-03 in REQUIREMENTS.md).

The gap is real relative to the EVENTS-05 requirement text but is bounded: the project's own planning documents explicitly defer the admin UI to Phase 12.

---

_Verified: 2026-04-25T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
