# Phase 11: Booking Flow Attribution — Research

**Researched:** 2026-04-25
**Domain:** First-party conversion attribution wired through Express.js booking routes and React booking page
**Confidence:** HIGH — all findings from direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `booking_started` fires on `BookingPage` component mount — `useEffect(() => { ... }, [])`. Not on form submit.
- **D-02:** `chat_initiated` fires inside existing `toggleOpen` function in `ChatWidget.tsx` (line 532), only when `willOpen === true`, alongside existing `trackChatOpen()` call.
- **D-03:** `visitorId` missing = silent skip. Server checks `req.body.visitorId` — if absent or falsy, skips `linkBookingToAttribution()`. Booking is never blocked or delayed.
- **D-04:** Stripe webhook null attribution is acceptable. If `utm_session_id` is null on the booking row when webhook fires, `booking_completed` is still recorded with `visitor_id = null` and null attributed fields.
- **D-05:** `booking_completed` is server-only. Direct path: `bookings.ts` after contact upsert. Stripe path: webhook handler after `updateBooking(bookingId, { paymentStatus: 'paid' })`.
- **D-06:** Dual-row write — `first_touch` + `last_touch` rows in `conversion_events`, protected by the partial unique index `(booking_id, event_type, attribution_model)` from Phase 10.
- **D-07:** `visitorId` is outside `insertBookingSchema`. Server reads `req.body.visitorId` directly. Not added to Zod schema.
- **D-08:** `booking_started` and `chat_initiated` fire to `POST /api/analytics/events` (new endpoint on the analytics router).

### Claude's Discretion

- Order of server-side calls in `bookings.ts`: `createBooking()` → contact upsert (try-catch) → `linkBookingToAttribution()` (try-catch) → `recordConversionEvent()` (try-catch). All post-booking calls are independent try-catch blocks.
- `booking_started` payload: `{ visitorId, eventType: 'booking_started', pageUrl: window.location.pathname }`.
- `chat_initiated` payload: `{ visitorId, eventType: 'chat_initiated', pageUrl: window.location.pathname }`.
- `linkBookingToAttribution(bookingId, visitorId)`: (1) look up `visitor_sessions` by `visitorId`, (2) update `bookings.utm_session_id = visitorSessions.id`, (3) increment `visitor_sessions.total_bookings`, set `converted_at` if first conversion.
- `recordConversionEvent(eventType, bookingId?, visitorId?, pageUrl?)`: looks up session from `bookingId→utm_session_id` or `visitorId` directly. Writes two rows (first_touch + last_touch). If no session found, writes two rows with null attribution.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ATTR-01 | Each conversion event records both first-touch and last-touch attribution as separate fields | `conversionEvents` table has `attributionModel` column; dual-row write pattern documented; `first_*` and `last_*` fields from `visitorSessions` provide the data |
| ATTR-02 | Booking attribution survives the Stripe checkout redirect — visitorId passed in POST body before redirect | `checkoutMutation` in `BookingPage.tsx` sends `bookingPayload` including the new `visitorId` field; server stores it on the booking row before Stripe redirect happens |
| EVENTS-01 | `booking_completed` event recorded with full first/last-touch attribution context | Server-side dual-row write in `bookings.ts` and Stripe webhook; `recordConversionEvent` reads session snapshot at event time |
| EVENTS-02 | `booking_started` event recorded when visitor reaches booking flow | `useEffect` on `BookingPage` mount fires `POST /api/analytics/events`; attribution comes from `visitorId` lookup |
| EVENTS-03 | `chat_initiated` event recorded when chat widget opens | `toggleOpen` in `ChatWidget.tsx` fires `POST /api/analytics/events` when `willOpen === true` |
| EVENTS-04 | Conversion event recording never delays or blocks the booking flow | All server-side analytics calls in independent try-catch blocks; client calls are fire-and-forget `.catch(() => {})` |
| EVENTS-05 | Admin can see each conversion event linked to the booking it represents | `conversionEvents.bookingId` FK column already exists; dashboard queries (Phase 12) will join on this |

</phase_requirements>

---

## Summary

Phase 11 is a pure wiring phase — no new UI components, no new npm packages, no new database tables or columns. All the schema, storage module skeleton, and analytics route already exist from Phase 10. The work is: (1) add `visitorId` to the booking POST body in `BookingPage.tsx` (one line, affects both direct and Stripe paths simultaneously), (2) add two new functions to `server/storage/analytics.ts` (`linkBookingToAttribution` and `recordConversionEvent`), (3) add `POST /api/analytics/events` endpoint to `server/routes/analytics.ts`, (4) wire the analytics calls into `server/routes/bookings.ts` and `server/routes/payments.ts`, and (5) add fire-and-forget `POST /api/analytics/events` calls in `BookingPage.tsx` (mount effect) and `ChatWidget.tsx` (`toggleOpen`).

Every integration point is independent and fire-and-forget. The booking flow is never blocked at any point. The dual-row unique constraint protecting against duplicate `booking_completed` events is already enforced via the Phase 10 SQL migration.

**Primary recommendation:** Implement in four independent tasks: (1) client-side `visitorId` threading + `booking_started` + `chat_initiated` events, (2) `linkBookingToAttribution` storage function, (3) `recordConversionEvent` storage function + `POST /api/analytics/events` endpoint, (4) server-route wiring in `bookings.ts` and `payments.ts` webhook.

---

## Standard Stack

No new packages required. All capabilities already installed.

### Core
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Drizzle ORM | 0.39.3 | Database queries for new storage functions | Already installed |
| Zod | 3.24.2 | Validation schema for new `/api/analytics/events` endpoint | Already installed |
| Express 4 | installed | New route endpoint | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` `eq`, `and` | bundled | Drizzle query operators for the new storage functions | Used in `linkBookingToAttribution` and `recordConversionEvent` |

**Installation:** None required.

---

## Architecture Patterns

### Pattern 1: Fire-and-Forget on the Server (Express route handler)

**What:** Wrap non-blocking analytics calls in an independent try-catch after the main response is sent.
**When to use:** All three analytics calls in `bookings.ts` (contact upsert, `linkBookingToAttribution`, `recordConversionEvent`) follow this pattern. Do NOT await them before sending `res.status(201).json(...)`.
**Example (modeled on existing contact upsert at line 111):**

```typescript
// After res.status(201).json(latestBooking || booking) — analytics is non-blocking
Promise.resolve().then(async () => {
  try {
    const visitorId = req.body.visitorId as string | undefined;
    if (visitorId) {
      await storage.linkBookingToAttribution(booking.id, visitorId);
    }
    await storage.recordConversionEvent('booking_completed', {
      bookingId: booking.id,
      bookingValue: validatedData.totalPrice,
    });
  } catch (analyticsErr) {
    console.error('Attribution write error:', analyticsErr);
  }
}).catch(() => {});
```

Note: The existing pattern in `bookings.ts` uses `try { ... } catch (contactErr) { ... }` blocks BEFORE the response. For attribution, per D-05 the calls must fire AFTER the booking is confirmed. Use `Promise.resolve().then(...)` with `.catch(() => {})` to fire after the response is returned, or keep them before response but still independent try-catch blocks. Since the contact upsert pattern is already pre-response, match it for simplicity — the key invariant is that attribution errors NEVER cause a non-201 response.

### Pattern 2: Fire-and-Forget on the Client (React)

**What:** `fetch(...)` with no `await` in a `useEffect`, chained with `.catch(() => {})`.
**When to use:** `booking_started` in `BookingPage.tsx` mount effect; `chat_initiated` in `ChatWidget.tsx` `toggleOpen`.

```typescript
// In BookingPage.tsx useEffect with empty deps — modeled on existing trackBeginCheckout call at line 138
useEffect(() => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (items.length > 0) {
    trackBeginCheckout(...);
  }
  // NEW: fire-and-forget booking_started event
  const visitorId = localStorage.getItem('skleanings_visitor_id');
  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: visitorId ?? undefined,
      eventType: 'booking_started',
      pageUrl: window.location.pathname,
    }),
  }).catch(() => {});
}, []);
```

### Pattern 3: visitorId Appended to bookingPayload (BookingPage.tsx)

**What:** Add a single line to the `bookingPayload` object at line 172.
**When to use:** This affects both booking paths simultaneously — `createBooking.mutate(bookingPayload)` (direct) and `checkoutMutation.mutate(bookingPayload)` (Stripe). One change covers both paths (ATTR-02).

```typescript
const bookingPayload = {
  ...data,
  customerAddress: fullAddress,
  cartItems: getCartItemsForBooking(),
  bookingDate: selectedDate,
  startTime: selectedTime,
  endTime: endTime,
  totalDurationMinutes: totalDuration,
  totalPrice: String(finalPrice),
  staffMemberId: selectedStaff?.id ?? null,
  // NEW: attribution thread — D-07, D-03
  visitorId: localStorage.getItem('skleanings_visitor_id') ?? undefined,
};
```

### Pattern 4: Reading visitorId Server-Side Outside Zod (D-07)

**What:** `insertBookingSchema.parse(req.body)` strips unknown fields via Zod default behavior. `visitorId` is read from `req.body.visitorId` AFTER Zod parse, independently.
**When to use:** Both `bookings.ts` POST handler and `payments.ts` checkout handler.

```typescript
const validatedData = insertBookingSchema.parse(req.body);
// visitorId is outside the schema — read directly after parse
const visitorId = req.body.visitorId as string | undefined;
```

### Pattern 5: upsertVisitorSession Reference (for new storage functions)

The existing `upsertVisitorSession` in `server/storage/analytics.ts` is the canonical pattern. New functions follow identical structure: import from `@shared/schema`, use `db.select().from().where().limit(1)` to check existence before update, use `.returning()` on INSERT/UPDATE.

### Anti-Patterns to Avoid

- **Awaiting analytics before sending booking response:** Any analytics error would cause a 500 on a booking that was actually created. All analytics writes are post-response fire-and-forget.
- **Writing `booking_completed` from `Confirmation.tsx`:** Creates double writes for Stripe-flow bookings (Pitfall 4 in PITFALLS.md). Frontend fires GA4/GTM only.
- **Adding `visitorId` to `insertBookingSchema`:** Pollutes the booking schema with an analytics concern. Read directly from `req.body` after Zod parse (D-07).
- **Blocking the Stripe checkout on `visitorId` validity:** Never reject a checkout because attribution is missing. Silent skip on null (D-03).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplicate event prevention | Custom deduplication logic | Existing partial unique index `(booking_id, event_type, attribution_model)` from Phase 10 migration | Already enforced at database level; INSERT with ON CONFLICT DO NOTHING |
| Traffic classification | Any classification logic | Already in `server/lib/traffic-classifier.ts` (Phase 10) | Phase 10 already built this |
| Visitor session lookup | Raw SQL query | `db.select().from(visitorSessions).where(eq(...))` (Drizzle) | Consistent with existing `upsertVisitorSession` pattern |
| Rate limiting | Custom middleware | `isRateLimited()` from `server/lib/rate-limit.ts` | Already used in `POST /api/analytics/session` |
| localStorage visitor ID | Any custom UUID logic | `localStorage.getItem('skleanings_visitor_id')` | Canonical key established in Phase 10 (D-08 in Phase 10 context) |

---

## Exact Code Shapes — Load-Bearing Details

### 1. `useCreateBooking` Hook (use-booking.ts)

The hook accepts `InsertBooking` type from `@shared/schema` at line 131:
```typescript
mutationFn: async (bookingData: InsertBooking) => {
  const res = await fetch(api.bookings.create.path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bookingData),  // serialized as-is, including extra fields
  });
```

**Finding:** The hook serializes `bookingData` directly to JSON. Any extra field appended to `bookingPayload` in `BookingPage.tsx` (including `visitorId`) will be included in the JSON body. TypeScript will complain about `visitorId` not being in `InsertBooking` — cast `bookingPayload as any` OR pass it as a raw object to `mutate()` without the type constraint. The `checkoutMutation` already uses `(bookingData: any)` at line 78, so no casting needed there.

**Action for planner:** `createBooking.mutate(bookingPayload as any, ...)` at line 187 in `BookingPage.tsx` — add the `as any` cast, or simply note that TypeScript will accept `bookingPayload` if `visitorId` is declared as `string | undefined | null` which Zod's `.passthrough()` / extra fields don't affect at runtime.

### 2. `bookings.ts` POST Handler — Exact Insertion Point

The direct booking POST handler at line 52 (`server/routes/bookings.ts`):
- Line 54: `insertBookingSchema.parse(req.body)` — Zod parse, strips unknowns
- Line 104: `storage.createBooking(...)` — booking created
- Line 111–121: contact upsert (try-catch, non-blocking)
- Line 124–127: GHL sync (awaited but non-blocking)
- Line 130–172: notifications (try-catch, non-blocking)
- Line 174: `storage.getBooking(booking.id)` — fetch final state
- Line 175: `res.status(201).json(latestBooking || booking)` — response sent

**Action for planner:** `linkBookingToAttribution()` and `recordConversionEvent()` calls go BEFORE line 175 (before response), following the same independent try-catch pattern as the contact upsert. Add between lines 121 and 124 (after contact upsert, before GHL sync), OR after line 174 but before res. The contact upsert pattern (pre-response try-catch) is simpler to follow.

### 3. `payments.ts` Checkout Handler — Where to Read visitorId

In `server/routes/payments.ts` POST `/checkout` handler (line 18):
- Line 29: `insertBookingSchema.parse(req.body)` — Zod parse
- Line 81: `storage.createBooking(...)` — booking created with `paymentStatus: 'pending_payment'`
- Line 88: `createCheckoutSession(...)` — Stripe session created
- Line 98: `storage.updateBookingStripeFields(booking.id, session.id)` — session ID stored
- Line 100: `res.json({ sessionUrl: session.url, bookingId: booking.id })` — redirect URL returned

**Action for planner:** After line 29, add `const visitorId = req.body.visitorId as string | undefined;`. After `storage.createBooking()` at line 81, call `linkBookingToAttribution(booking.id, visitorId)` in a try-catch before line 88. Do NOT call `recordConversionEvent` here — Stripe path fires it from the webhook (D-05).

### 4. `payments.ts` Webhook Handler — Exact Insertion Point

In the `checkout.session.completed` handler (line 123):
- Line 129: `storage.updateBookingStripeFields(bookingId, session.id, session.payment_status)`
- Line 130–132: `if (session.payment_status === 'paid') { await storage.updateBooking(bookingId, { paymentStatus: 'paid' }); }`

**Action for planner:** After line 132 (inside the `if (session.payment_status === 'paid')` block), add a try-catch block calling `storage.recordConversionEvent('booking_completed', { bookingId })`. The function looks up `utm_session_id` from the booking row — if null (timing gap), records with null attribution (D-04).

### 5. New Storage Functions — Exact Drizzle Query Patterns

**`linkBookingToAttribution(bookingId: number, visitorId: string)`:**
```typescript
// 1. Look up visitor session
const sessionRows = await db
  .select()
  .from(visitorSessions)
  .where(eq(visitorSessions.id, visitorId))
  .limit(1);

if (sessionRows.length === 0) return; // D-03: silent skip

const session = sessionRows[0];

// 2. Update bookings.utm_session_id
await db
  .update(bookings)
  .set({ utmSessionId: session.id })
  .where(eq(bookings.id, bookingId));

// 3. Increment total_bookings + set converted_at
const newTotal = (session.totalBookings ?? 0) + 1;
await db
  .update(visitorSessions)
  .set({
    totalBookings: newTotal,
    convertedAt: session.convertedAt ?? new Date(), // only set on first conversion
  })
  .where(eq(visitorSessions.id, visitorId));
```

**`recordConversionEvent(eventType, options)`:**

The function needs to handle two lookup paths:
- If `bookingId` is provided: `SELECT utm_session_id FROM bookings WHERE id = bookingId` to get the session
- If only `visitorId` is provided: query `visitor_sessions` directly

Then write two rows (first_touch + last_touch) using the session's `first_*` and `last_*` fields respectively. Use INSERT with `onConflictDoNothing()` (Drizzle) to respect the unique constraint from Phase 10.

```typescript
// Drizzle INSERT with conflict handling (ATTR-03)
await db
  .insert(conversionEvents)
  .values([
    {
      visitorId: session?.id ?? null,
      eventType,
      bookingId: options.bookingId ?? null,
      bookingValue: options.bookingValue ?? null,
      attributedSource: session?.firstUtmSource ?? null,
      attributedMedium: session?.firstUtmMedium ?? null,
      attributedCampaign: session?.firstUtmCampaign ?? null,
      attributedLandingPage: session?.firstLandingPage ?? null,
      attributionModel: 'first_touch',
      pageUrl: options.pageUrl ?? null,
    },
    {
      visitorId: session?.id ?? null,
      eventType,
      bookingId: options.bookingId ?? null,
      bookingValue: options.bookingValue ?? null,
      attributedSource: session?.lastUtmSource ?? null,
      attributedMedium: session?.lastUtmMedium ?? null,
      attributedCampaign: session?.lastUtmCampaign ?? null,
      attributedLandingPage: session?.lastLandingPage ?? null,
      attributionModel: 'last_touch',
      pageUrl: options.pageUrl ?? null,
    },
  ])
  .onConflictDoNothing(); // Drizzle equivalent of ON CONFLICT DO NOTHING
```

### 6. New `POST /api/analytics/events` Endpoint Schema

Modeled exactly on the existing `POST /api/analytics/session` endpoint in `server/routes/analytics.ts`:

```typescript
const eventSchema = z.object({
  visitorId: z.string().uuid().optional().nullable(),
  eventType: z.enum(['booking_started', 'chat_initiated']),
  pageUrl:   z.string().max(2000).optional().nullable(),
});

router.post("/events", async (req, res) => {
  try {
    const ip = req.ip || "unknown";
    if (isRateLimited(`analytics:${ip}`, 60, 60_000)) {
      return res.status(429).json({ message: "Too many requests" });
    }
    const parsed = eventSchema.parse(req.body);
    await storage.recordConversionEvent(parsed.eventType, {
      visitorId: parsed.visitorId ?? undefined,
      pageUrl: parsed.pageUrl ?? undefined,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    // Return 200 on unexpected errors — analytics is fire-and-forget
    return res.status(200).json({ ok: false });
  }
});
```

### 7. ChatWidget.tsx — What to Add

Current imports at line 9–17 already import from `@/lib/analytics` (trackChatOpen, trackChatClose, etc.). No new import from analytics.ts needed. The `chat_initiated` event fires directly via `fetch()` (fire-and-forget POST to `/api/analytics/events`), not via `trackEvent()`.

The `toggleOpen` function at line 532:
```typescript
const toggleOpen = () => {
  setIsOpen((prev) => {
    const willOpen = !prev;
    if (willOpen) {
      trackChatOpen(window.location.pathname);
      // NEW: fire-and-forget chat_initiated (D-02)
      const visitorId = localStorage.getItem('skleanings_visitor_id');
      fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: visitorId ?? undefined,
          eventType: 'chat_initiated',
          pageUrl: window.location.pathname,
        }),
      }).catch(() => {});
    } else {
      trackChatClose(window.location.pathname, messages.length);
    }
    return willOpen;
  });
};
```

No new imports needed in `ChatWidget.tsx` — the `fetch` call is inline.

### 8. Storage Index (server/storage/index.ts)

The storage index at line 93 already spreads `...analytics`. Any new exported functions from `server/storage/analytics.ts` are automatically available as `storage.linkBookingToAttribution()` and `storage.recordConversionEvent()` with no changes to `index.ts`.

---

## Common Pitfalls

### Pitfall 1: booking_completed Written Twice for Stripe Bookings

**What goes wrong:** If `recordConversionEvent('booking_completed')` is called from both `payments.ts` checkout handler AND the webhook, the booking appears twice in conversion reports. Confirmed by PITFALLS.md Pitfall 4.
**Why it happens:** Checkout handler and webhook are both natural write points.
**How to avoid:** Per D-05, `booking_completed` is webhook-only for Stripe path. The checkout handler only calls `linkBookingToAttribution()` — NOT `recordConversionEvent()`.
**Warning signs:** `SELECT count(*) FROM conversion_events WHERE event_type = 'booking_completed' GROUP BY booking_id HAVING count(*) > 2` returns rows (> 2 because dual-row write = 2 is expected).

### Pitfall 2: visitorId Lost Before Stripe Redirect (CRITICAL)

**What goes wrong:** If `visitorId` is not in the `bookingPayload` sent to `POST /api/payments/checkout`, the booking row gets `utm_session_id = null`. The webhook then reads null and records booking_completed with null attribution. Every Stripe-flow booking shows as Direct/Unknown.
**How to avoid:** The single-line change to `bookingPayload` in `BookingPage.tsx` (adding `visitorId`) must be verified by checking the booking row's `utm_session_id` after a test checkout.
**Verification:** After test Stripe checkout, `SELECT utm_session_id FROM bookings WHERE id = X` must be non-null.

### Pitfall 3: Drizzle onConflictDoNothing() vs INSERT OR IGNORE

**What goes wrong:** The schema uses a PARTIAL unique index (WHERE booking_id IS NOT NULL) enforced via raw SQL in the migration. Drizzle's `onConflictDoNothing()` respects it, but only if the constraint name is referenced correctly. For `booking_started` and `chat_initiated` events, `bookingId` is null — the partial index does NOT apply to these rows. Multiple `booking_started` events from the same visitor are allowed (each page mount fires one). This is correct behavior, not a bug.
**How to avoid:** Understand that `onConflictDoNothing()` only deduplicates rows with non-null `bookingId`. Rows with `bookingId = null` are always inserted without constraint conflict.

### Pitfall 4: TypeScript Error on bookingPayload

**What goes wrong:** `createBooking.mutate(bookingPayload)` will get a TypeScript error because `InsertBooking` doesn't include `visitorId`. `checkoutMutation.mutate(bookingPayload)` uses `(bookingData: any)` so it's fine.
**How to avoid:** Use `createBooking.mutate(bookingPayload as any, ...)` OR extend the payload type with `& { visitorId?: string }`. The `as any` cast is the simplest approach and consistent with the checkout mutation's pattern.

### Pitfall 5: `booking_started` Fires Even When Cart is Empty

**What goes wrong:** The existing `useEffect` scroll/trackBeginCheckout block already has `if (items.length > 0)` guard for GA4 tracking. The `booking_started` fire-and-forget POST should fire unconditionally (or guard on items.length > 0). If `BookingPage` renders with an empty cart, the component shows an empty state and the user never enters the booking flow — firing `booking_started` in this case would inflate funnel entry counts.
**How to avoid:** Wrap the `booking_started` POST inside the `if (items.length > 0)` condition, or fire it only when the cart is non-empty. The page's empty-cart guard (line 202) returns early before rendering the booking flow, so the effect still runs but items.length is 0 — guard it.

---

## Validation Architecture

`nyquist_validation` is enabled (not explicitly set to false in config.json). Include validation section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No dedicated test framework detected in the project |
| Config file | None found |
| Quick run command | Manual testing via curl + DB inspection |
| Full suite command | Manual testing via curl + DB inspection |

No test framework (Jest/Vitest/pytest) was found in the project. All validation for Phase 11 is integration testing via curl and direct Supabase DB inspection.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ATTR-01 | conversion_events has both first_touch and last_touch rows per booking | SQL query | `SELECT attribution_model, COUNT(*) FROM conversion_events WHERE booking_id=X GROUP BY attribution_model` | Manual — no test file |
| ATTR-02 | Stripe-flow booking has non-null utm_session_id | SQL query | `SELECT utm_session_id FROM bookings WHERE id=X` after test Stripe checkout | Manual |
| EVENTS-01 | booking_completed rows have attributed_source/campaign values | SQL query | `SELECT * FROM conversion_events WHERE event_type='booking_completed'` | Manual |
| EVENTS-02 | booking_started rows created on BookingPage mount | SQL query + browser | Visit /booking, `SELECT * FROM conversion_events WHERE event_type='booking_started'` | Manual |
| EVENTS-03 | chat_initiated rows created on chat open | SQL query + browser | Open chat widget, `SELECT * FROM conversion_events WHERE event_type='chat_initiated'` | Manual |
| EVENTS-04 | Booking still succeeds when analytics DB fails | Manual test | Mock storage.recordConversionEvent to throw, verify booking 201 response | Manual |
| EVENTS-05 | conversion_events.booking_id FK populated for booking_completed | SQL query | `SELECT booking_id FROM conversion_events WHERE event_type='booking_completed'` — all non-null | Manual |

### Wave 0 Gaps
No test framework is present in the project. No test files to create. Validation is manual integration testing per the verification map above.

---

## Environment Availability

Step 2.6: SKIPPED — This phase is code-only modifications to existing files. No new external dependencies beyond the already-running project stack (Supabase PostgreSQL, Express). The only dependency is the DB migration from Phase 10 (`20260425000000_add_utm_tracking.sql`) being applied — this is documented as a blocker in STATE.md. If the migration is not yet applied, storage functions will fail at runtime (tables don't exist).

**Critical pre-condition (from STATE.md):** The Phase 10 migration must be applied before Phase 11 can be tested. Run `supabase db push` with `POSTGRES_URL_NON_POOLING` set. This is a known blocker.

---

## Sources

### Primary (HIGH confidence)
All findings are from direct codebase inspection:
- `server/routes/bookings.ts` — exact line numbers for insertion points
- `server/routes/payments.ts` — exact line numbers for checkout and webhook handlers
- `server/routes/analytics.ts` — existing session endpoint pattern (template for events endpoint)
- `server/storage/analytics.ts` — `upsertVisitorSession` implementation (template for new functions)
- `server/storage/index.ts` — confirms `...analytics` spread; new functions auto-available as `storage.*`
- `client/src/pages/BookingPage.tsx` — `bookingPayload` at line 172; existing `useEffect` at line 135; both booking paths at line 184–199
- `client/src/hooks/use-booking.ts` — `useCreateBooking` mutationFn signature, `InsertBooking` type constraint
- `client/src/components/chat/ChatWidget.tsx` — `toggleOpen` at line 532; existing analytics imports at line 9–17
- `client/src/lib/analytics.ts` — fire-and-forget pattern (GA4/GTM only; no DB writes from client)
- `shared/schema.ts` — `visitorSessions`, `conversionEvents`, `bookings.utmSessionId` shapes; `insertBookingSchema` definition; `insertBookingSchemaBase` strips `utmSessionId` via Zod omit
- `.planning/phases/11-booking-flow-attribution/11-CONTEXT.md` — all locked decisions
- `.planning/research/PITFALLS.md` — Pitfall 1 (Stripe redirect gap), Pitfall 4 (double conversion)
- `.planning/research/SUMMARY.md` — build order constraints, fire-and-forget invariant

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing dependencies verified present
- Architecture patterns: HIGH — copied from live codebase, not hypothetical
- Pitfalls: HIGH — sourced from direct code analysis and existing PITFALLS.md research
- Insertion points (exact line numbers): HIGH — read directly from files

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable codebase; expires if BookingPage.tsx, bookings.ts, or payments.ts are modified before Phase 11 executes)
