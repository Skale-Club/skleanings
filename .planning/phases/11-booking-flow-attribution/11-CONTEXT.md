# Phase 11: Booking Flow Attribution — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `visitorId` through both booking creation paths (direct `POST /api/bookings` and Stripe `POST /api/payments/checkout`) so every completed booking is permanently linked to its visitor session. Record conversion events (`booking_completed`, `booking_started`, `chat_initiated`) with dual first-touch and last-touch attribution. Phase 11 adds no new UI components — it modifies existing pages and routes only.

Requirements in scope: ATTR-01, ATTR-02, EVENTS-01, EVENTS-02, EVENTS-03, EVENTS-04, EVENTS-05.

**Not in scope:** Admin dashboard (Phase 12), GoHighLevel sync (Phase 13), visitor journey UI (Phase 13).

</domain>

<decisions>
## Implementation Decisions

### booking_started Trigger
- **D-01:** `booking_started` fires on `BookingPage` component **mount** — not on form submit. Rationale: captures how many users entered the booking flow vs how many completed it. Form submit would record "booking attempted" which is nearly identical to booking_completed and loses early funnel data. Implementation: fire-and-forget `POST /api/analytics/events` in a `useEffect(() => { ... }, [])` inside `BookingPage.tsx`.

### chat_initiated Trigger
- **D-02:** `chat_initiated` fires inside the existing `toggleOpen` function in `ChatWidget.tsx` (line 532), only when `willOpen === true`. The function already calls `trackChatOpen()` there — add the fire-and-forget analytics POST alongside it. No new component or wrapper needed.

### visitorId Missing — Graceful Skip
- **D-03:** If `localStorage.getItem('skleanings_visitor_id')` returns `null` (user cleared storage, private browsing, fresh session before `useUTMCapture` ran), the `visitorId` field is simply omitted from the booking POST body. The server checks `req.body.visitorId` — if absent or falsy, it skips `linkBookingToAttribution()` entirely. **The booking is never blocked or delayed.** Attribution is silently null.

### Stripe Webhook Gap — Null Attribution Acceptable
- **D-04:** If the Stripe webhook fires before `utm_session_id` is written to the booking row (timing edge between checkout POST and Stripe firing the event), the webhook reads `utm_session_id` from the booking row. If null, it still records `booking_completed` with `visitor_id = null` and null attributed fields. The event is preserved; attribution is null. This is correct behaviour — don't lose the conversion record over an attribution gap.

### booking_completed Write Point — Server Only
- **D-05:** `booking_completed` is written server-side only. Two paths:
  1. **Direct booking** (`server/routes/bookings.ts`): call `recordConversionEvent('booking_completed', bookingId)` as fire-and-forget after the contact upsert block.
  2. **Stripe paid** (`server/routes/payments.ts` webhook): call `recordConversionEvent('booking_completed', bookingId)` inside the `checkout.session.completed` handler after `updateBooking(bookingId, { paymentStatus: 'paid' })` confirms payment.
  `Confirmation.tsx` fires GA4/GTM only (existing `trackPurchase()`) — no analytics POST from the client.

### Dual-Row Write — First-Touch and Last-Touch
- **D-06:** `recordConversionEvent('booking_completed', bookingId)` writes **two rows** to `conversion_events`: one with `attribution_model = 'first_touch'` (copies `first_*` fields from `visitor_sessions`) and one with `attribution_model = 'last_touch'` (copies `last_*` fields). The unique constraint `(booking_id, event_type, attribution_model)` prevents duplicates if both webhook and a retry fire. This was designed in Phase 10 schema — Phase 11 must respect it.

### visitorId in POST body — Outside insertBookingSchema
- **D-07:** `visitorId` is passed as an extra field in the booking POST body, **not added to `insertBookingSchema`**. Rationale: `visitorId` is not a database column on bookings — it maps to `visitor_sessions.id` and is used only to look up and set `utm_session_id`. Server reads it from `req.body.visitorId` directly after Zod validates the rest. This avoids polluting the booking schema with an analytics concern.

### Public Events Endpoint
- **D-08:** `booking_started` and `chat_initiated` fire to `POST /api/analytics/events` (a new endpoint on the analytics router built in Phase 10). This endpoint is public (no auth), validates `{ visitorId, eventType, pageUrl }` via Zod, and calls `recordConversionEvent()`. The same rate limit as `/api/analytics/session` (60 req/IP/min) applies.

### Claude's Discretion
- Order of server-side calls in `bookings.ts`: `createBooking()` → contact upsert (try-catch) → `linkBookingToAttribution()` (try-catch) → `recordConversionEvent()` (try-catch). All post-booking calls are independent try-catch blocks; none block the booking response.
- `useCreateBooking` hook: check if it already includes request body construction or if `BookingPage.tsx` constructs the raw payload before passing — read `client/src/hooks/use-booking.ts` before editing.
- `booking_started` payload: `{ visitorId, eventType: 'booking_started', pageUrl: window.location.pathname }`. No `bookingId` (booking doesn't exist yet).
- `chat_initiated` payload: `{ visitorId, eventType: 'chat_initiated', pageUrl: window.location.pathname }`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Booking Paths (files to modify)
- `client/src/pages/BookingPage.tsx` — `bookingPayload` at line 172; `onSubmit` at line 162; both booking paths (direct + Stripe checkout)
- `server/routes/bookings.ts` — direct booking POST handler; where `recordConversionEvent` fires for non-Stripe bookings
- `server/routes/payments.ts` — Stripe checkout POST (line 18) and webhook handler (line 112); where `recordConversionEvent` fires for Stripe bookings

### Chat Widget
- `client/src/components/chat/ChatWidget.tsx` — `toggleOpen` at line 532; `trackChatOpen()` call at line 536; `chat_initiated` event fires here

### Analytics Infrastructure (Phase 10 outputs — read before implementing)
- `server/storage/analytics.ts` — `upsertVisitorSession()`, `recordConversionEvent()` (to be created in Phase 11), `linkBookingToAttribution()` function signatures
- `server/routes/analytics.ts` — existing `/session` endpoint; new `/events` endpoint goes here
- `shared/schema.ts` — `visitorSessions`, `conversionEvents` table definitions; FK `bookings.utmSessionId`

### Phase 10 Context (locked decisions to honour)
- `.planning/phases/10-schema-capture-classification/10-CONTEXT.md` — D-02 (last-touch update rule), D-04 (lowercase normalisation), D-08 (localStorage key `skleanings_visitor_id`)

### Requirements
- `.planning/REQUIREMENTS.md` §Attribution Model — ATTR-01, ATTR-02 (booking attribution must survive Stripe redirect)
- `.planning/REQUIREMENTS.md` §Conversion Event Tracking — EVENTS-01 through EVENTS-05

### Research
- `.planning/research/PITFALLS.md` — Pitfall 1 (Stripe redirect gap, critical), Pitfall 2 (double conversion recording)
- `.planning/research/SUMMARY.md` — Build order constraints; "booking flow is never blocked"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/pages/BookingPage.tsx:172` — `bookingPayload` object already consolidates all booking fields; add `visitorId: localStorage.getItem('skleanings_visitor_id') ?? undefined` here (affects both paths simultaneously)
- `client/src/components/chat/ChatWidget.tsx:535` — `if (willOpen)` block already guards `trackChatOpen()` — add analytics POST in same block
- `client/src/lib/analytics.ts` — fire-and-forget pattern already used here (model for the analytics POST calls)
- `server/routes/bookings.ts:112` — contact upsert is already in a non-blocking try-catch; `linkBookingToAttribution()` and `recordConversionEvent()` follow the same pattern

### Established Patterns
- Fire-and-forget: `.catch(() => {})` with no `await` in React effects; `Promise.resolve().then(fn).catch(() => {})` in Express route handlers
- Zod extra fields: server reads `req.body.visitorId` directly, not via Zod (schema strips unknown fields by default with `.parse()`)

### Integration Points
- `server/routes/analytics.ts` (Phase 10): add `POST /events` endpoint alongside existing `POST /session`
- `server/storage/analytics.ts` (Phase 10): add `recordConversionEvent()` and `linkBookingToAttribution()` functions
- `shared/schema.ts` (Phase 10): `bookings.utmSessionId` FK column already exists for the attribution link

</code_context>

<specifics>
## Specific Ideas

- `linkBookingToAttribution(bookingId, visitorId)` should: (1) look up `visitor_sessions` row by `visitorId`, (2) update `bookings.utm_session_id = visitorSessions.id`, (3) increment `visitor_sessions.total_bookings` and set `visitor_sessions.converted_at` if first conversion. All in one function, called once per booking.
- `recordConversionEvent(eventType, bookingId?, visitorId?, pageUrl?)`: looks up session from either `bookingId→utm_session_id` or `visitorId` directly, writes two rows (first_touch + last_touch). If no session found, writes two rows with null attribution (the event is preserved, attribution is null).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-booking-flow-attribution*
*Context gathered: 2026-04-25*
