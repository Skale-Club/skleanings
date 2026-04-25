# Pitfalls Research

**Domain:** First-party UTM attribution added to an existing booking platform
**Researched:** 2026-04-25
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: UTM Data Lost on Stripe Redirect

**What goes wrong:**
The booking form submits `POST /api/payments/checkout`, which redirects the browser to `stripe.com/pay/...`. Any UTM data stored only in `localStorage` or `sessionStorage` is **not guaranteed to survive** the cross-origin redirect chain. On return (`/confirmation?session_id=...`), the UTM context that existed when the customer first visited is gone. The booking is recorded in the database with no source attribution.

**Why it happens:**
The existing `Confirmation.tsx` calls `trackPurchase()` inside a `useEffect` that fires after cart items are cleared. The cart is the only context available at that point. There is no mechanism to carry attribution data through the Stripe round-trip. The same gap exists in `POST /api/bookings` (pay-on-site flow) — the route currently accepts no attribution fields.

**How to avoid:**
Send the session/attribution ID in `POST /api/payments/checkout` and `POST /api/bookings` as a request body field (not a header). The server stores it alongside the booking row. When the Stripe webhook fires `checkout.session.completed`, the booking already has its attribution. This is more reliable than rebuilding attribution after redirect.

**Warning signs:**
- Attribution dashboard shows "Direct" for most bookings even when paid campaigns are running
- Stripe-flow bookings have null `utmSessionId` while pay-on-site bookings do not

**Phase to address:**
Phase 1 (UTM capture) and Phase 2 (conversion recording) must be designed together. The `bookings` and `payments/checkout` routes must accept an optional `attributionSessionId` in the same phase that creates the UTM session table.

---

### Pitfall 2: Safari ITP Strips UTM Params on Same-Domain Redirects

**What goes wrong:**
Safari's Intelligent Tracking Prevention (ITP 2.x+) strips query parameters from cross-site navigations. Google Ads and Facebook Ads redirect through their own domains before landing on the site — Safari ITP treats the UTM params as tracking and may strip them from the final URL. The visitor lands on `/services?` with no params, gets classified as "Direct," and the paid campaign gets zero credit.

**Why it happens:**
The capture logic reads `window.location.search` on page load. If ITP has stripped the params before the JS executes, there is nothing to read. This is a browser-enforced privacy behavior, not a bug.

**How to avoid:**
1. Capture UTMs from `document.referrer` as a fallback — if params are missing but referrer is `google.com`, classify as Organic Search.
2. Use Facebook's `_fbc` / `_fbp` cookies as a secondary signal for Facebook traffic (set before ITP strips URL params).
3. Build traffic classification logic (Pitfall 3) as a required companion to raw UTM capture — not an afterthought.
4. Do NOT use Google Click ID (`gclid`) storage as the sole attribution signal; treat it as supplementary.

**Warning signs:**
- Attribution data shows high "Direct" share despite known paid campaigns
- Mobile Safari traffic heavily skewed toward Direct vs. desktop Chrome traffic from same campaigns

**Phase to address:**
Phase 1 (UTM capture) — the traffic classification fallback logic must be built in the same pass, not deferred to a later phase.

---

### Pitfall 3: UTM Case Sensitivity Corrupts Reporting

**What goes wrong:**
`utm_source=Google`, `utm_source=google`, and `utm_source=GOOGLE` are stored as three separate values. The admin dashboard shows three rows where there should be one. Conversion rates look lower per row than they are. The business owner sees "Google" and "google" as different channels and gets confused.

**Why it happens:**
UTM parameters are set by ad platforms, email service providers, link shorteners, and humans — there is no enforced standard. Facebook often sends `utm_source=facebook`, but some campaigns are configured with `utm_source=Facebook`. Google Ads auto-tagging may differ from manually tagged links.

**How to avoid:**
Normalize all UTM values to lowercase before writing to the database. Apply normalization at the capture layer (the JS that reads URL params), not at query time. Normalization at query time (via `LOWER()` in SQL) is slower and creates index bypass issues.

```
// In UTM capture code:
const normalize = (v: string | null) => v?.trim().toLowerCase() ?? null;
const utmSource = normalize(params.get('utm_source'));
```

**Warning signs:**
- Dashboard shows duplicate source rows for the same platform
- Total conversion counts for a source look lower than expected
- Campaign names appear with mixed casing in the database

**Phase to address:**
Phase 1 (UTM capture) — normalization must happen at write time, enforced in the schema layer. Adding normalization later requires a data migration on existing rows.

---

### Pitfall 4: Double Conversion Recording from Stripe Webhook + Frontend

**What goes wrong:**
The system records a conversion in two places: (1) the frontend fires a conversion event when it sees `?session_id=...` on the Confirmation page, and (2) the Stripe webhook independently marks the booking as paid. If both paths also write a conversion event to the `conversionEvents` table, the same booking appears twice in the attribution dashboard. Conversion counts are inflated, conversion rate looks artificially high.

**Why it happens:**
`Confirmation.tsx` already calls `trackPurchase()` which fires GA4/GTM events. It is natural to also add a database write there. The Stripe webhook handler (`POST /api/payments/webhook`) is also a natural write point. Both paths fire for Stripe-flow bookings.

**How to avoid:**
The single authoritative write point for the `booking_completed` conversion event must be the **server side only** — specifically the Stripe webhook `checkout.session.completed` handler (for paid bookings) and the `POST /api/bookings` success path (for pay-on-site bookings). The frontend must not write conversion events directly. Frontend calls `trackPurchase` for GA4/GTM only, never for the first-party database.

Apply an idempotency key: use `booking.id` as the unique constraint on conversion events. A second write for the same `bookingId` with `event_type = 'booking_completed'` must be a no-op or upsert.

**Warning signs:**
- Conversion count is twice the booking count in the database
- Stripe-flow bookings appear twice in the Conversions view
- `conversionEvents` table has `count(*) > bookings` for `booking_completed` type

**Phase to address:**
Phase 2 (conversion recording) — the idempotency constraint belongs in the schema migration that creates the conversion events table, before any write logic is built.

---

### Pitfall 5: localStorage Cleared by User Breaks First-Touch Attribution

**What goes wrong:**
The visitor's first touch is stored in `localStorage` (e.g., `{utmSource: 'google', medium: 'cpc', ...}`). The visitor returns a week later after clearing their browser cache or history. `localStorage` is gone. The system creates a new session with no UTM params, classifies the visit as "Direct," and sets that as the new first touch. All previous attribution context is lost permanently.

**Why it happens:**
`localStorage` is the default choice for lightweight persistence in React apps. It is developer-visible and has no expiration, which makes it feel like a reliable store. In practice, users clear it, private browsing does not share it, and iOS 16.4+ limits it to 7 days for cross-site scenarios.

**How to avoid:**
First-touch attribution must be **written to the database** on the first visit and then referenced by session ID on subsequent visits. `localStorage` is acceptable for storing the session ID and caching the session data, but the authoritative record is the server-side row. If the session ID is missing from `localStorage` on a return visit, treat it as a new session — accept the data loss — do not try to reconstruct.

Set the session ID in a `SameSite=Lax; Secure` cookie **and** in `localStorage`. The cookie survives some cache clears that would wipe `localStorage`.

**Warning signs:**
- First-touch and last-touch attribution diverge dramatically for the same campaign periods
- High first-touch "Direct" even for known paid traffic months

**Phase to address:**
Phase 1 (UTM capture) — dual storage (cookie + localStorage for session ID; database for first-touch record) must be designed at the start, not added as a patch when data loss is noticed.

---

### Pitfall 6: Booking POST Failure Leaves Orphaned UTM Session With No Conversion

**What goes wrong:**
The client sends `POST /api/bookings` with an `attributionSessionId`. The booking fails (time slot conflict, Zod validation error, Stripe error). The client retries or the user corrects the form and submits again. The second submission succeeds. The conversion event correctly records. But depending on implementation, the first failed attempt may have created a partial record or incremented a counter, making the conversion data look wrong.

A subtler version: the booking succeeds server-side but the client never receives the 200 response (network timeout). The user submits again. Now there are two bookings for the same customer, and two conversion events, but only one intended transaction.

**Why it happens:**
`BookingPage.tsx` calls a mutation and shows a success/error toast. There is no idempotency token in the current `POST /api/bookings` payload. The server has no way to detect that two identical submissions are the same attempt.

**How to avoid:**
Add an `idempotencyKey` field to the booking submission payload — a UUID generated client-side before the user clicks "Book Now," stored in component state. The server uses this as a unique constraint on booking creation attempts. Pair this with the idempotency constraint on conversion events (Pitfall 4). The attribution session link to the booking must use `ON CONFLICT DO NOTHING` semantics.

**Warning signs:**
- Duplicate bookings in the database for the same customer within a short time window
- Conversion count higher than expected for a campaign period
- Admin sees duplicate booking entries from the same customer in quick succession

**Phase to address:**
Phase 2 (conversion recording) — the idempotency key design must be specified before the booking POST mutation is modified to accept attribution fields.

---

### Pitfall 7: UTM Sessions Table Grows Unbounded

**What goes wrong:**
Every page load by every bot, crawler, health-check, and legitimate visitor creates a new UTM session row. After 12 months, the table has millions of rows. Reporting queries that scan the full table to compute "conversions by source" become slow. Vercel serverless functions start timing out on the dashboard's data queries. Supabase row counts look alarming.

**Why it happens:**
UTM session capture is the first time the codebase deliberately writes one row per visitor. There is no precedent in the existing schema for high-volume append tables. The pattern used for low-volume tables (bookings, contacts) does not scale automatically.

**How to avoid:**
From day one:
1. Add a `created_at` index on `utmSessions` and `conversionEvents` — all dashboard queries will filter by date range.
2. Add a composite index on `(utm_source, utm_medium, created_at)` for the Campaign Performance and Source Performance views.
3. Filter out obvious bots at capture time: check `navigator.webdriver`, `navigator.userAgent` patterns, and do not write a session if the request lacks a valid `User-Agent` header.
4. Design all dashboard queries with a mandatory date range parameter — no query should scan without a date bound.
5. Document a retention policy (e.g., delete UTM sessions older than 24 months) even if the cron job implementing it comes in a later phase.

**Warning signs:**
- Dashboard queries taking >2s on the Supabase dashboard
- `utmSessions` row count growing faster than the number of actual bookings
- Bot-like session patterns (no referrer, landing page is `/`, no conversion, high volume)

**Phase to address:**
Phase 1 (schema design) — indexes and bot-filtering must be in the initial migration, not added after the table has grown.

---

### Pitfall 8: Attribution Dashboard Shows Raw UTM Values to a Non-Technical Owner

**What goes wrong:**
The Campaign Performance view shows columns labeled "utm_source," "utm_medium," "utm_campaign." The business owner sees `utm_source = cpc` and does not know what "cpc" means. They see `utm_medium = email` and wonder if that is the same as "Email Marketing." The dashboard looks like a developer tool, not a business tool. The feature is built but not used.

**Why it happens:**
The raw UTM params are what is stored in the database. It is faster to query and display them directly. Mapping them to friendly names feels like cosmetic polish and gets deferred.

**How to avoid:**
The mapping is business logic, not cosmetics. Build a display layer from the start:
- "Source" maps `google` → "Google," `facebook` → "Facebook," `ig` → "Instagram," unknown values → title-case the raw value
- "Medium" maps `cpc` → "Paid Ad," `organic` → "Organic," `email` → "Email," `social` → "Social," `referral` → "Referral"
- "Campaign" shows the raw `utm_campaign` value (owner set it, they recognize it) but with title-casing

Build this mapping as a shared utility function so it is consistent across all dashboard views.

**Warning signs:**
- Business owner asks "what does cpc mean?" during review
- Dashboard screenshots include raw parameter strings in demo materials

**Phase to address:**
Phase 3 (admin dashboard) — the friendly-name mapping must be part of the initial dashboard spec, not a polish pass after the feature ships.

---

### Pitfall 9: Empty Dashboard on Day One Damages Trust

**What goes wrong:**
The marketing attribution dashboard ships. The business owner opens it. Every chart shows "No data." Every table is empty. There are no historical bookings linked to UTM sessions because the session capture code was not running before this milestone. The feature looks broken. The business owner loses confidence in it immediately.

**Why it happens:**
The existing 40+ bookings in the database have no `utmSessionId`. The dashboard only queries conversion events created after the new tables exist. Day-one data is structurally absent.

**How to avoid:**
1. Design an explicit empty state for the dashboard that says "Data collection started on [date]. Your first attributed booking will appear here after a customer visits through a tracked link." This is honest and not an error state.
2. On the Conversions view, offer a one-time backfill toggle: "Import existing bookings without attribution as Direct/Unknown." This populates historical booking counts (minus UTM detail) so the overview metrics are not zero.
3. The Overview page should show total bookings (all time) as a separate metric from "attributed bookings" so the owner can see real volume while attribution data builds up.

**Warning signs:**
- Business owner sends message asking "why is everything empty"
- Feature is dismissed as broken before it has time to collect data

**Phase to address:**
Phase 3 (admin dashboard) — empty states and historical context must be designed before the first UI component is built.

---

### Pitfall 10: Storing IP Addresses Without a Privacy Policy Basis

**What goes wrong:**
IP addresses are stored to help identify sessions or detect bots. In Europe, IP addresses are PII under GDPR. If a customer from Germany visits the site (realistic for a US cleaning company with expat clients), storing their IP without consent creates a compliance liability.

**Why it happens:**
IP addresses are available in `req.ip` on every request and feel like "just a number." Developers store them for debugging without considering their legal status.

**How to avoid:**
Do not store raw IP addresses in the UTM sessions table. Use the IP to:
1. Determine country/region at capture time (for filtering out non-US traffic if desired)
2. Detect obvious bot patterns (datacenter IP ranges)

Then discard the IP. Store the derived country code (`US`, `CA`, etc.) if useful for the dashboard, but not the IP itself. This is the approach taken by Plausible Analytics, which is GDPR-compliant by design.

If bot detection requires IP inspection server-side, do it in the API route and do not persist the IP to any table.

**Warning signs:**
- IP address column present in the UTM sessions schema migration
- `req.ip` being logged to a database row

**Phase to address:**
Phase 1 (schema design) — the UTM sessions table migration must not include an IP column. If bot filtering requires IP inspection, it must be done in-memory in the route handler.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store UTM data only in localStorage | No backend work for capture | Lost on cache clear, no cross-device, first-touch unreliable | Never — defeats the purpose of first-party attribution |
| Query dashboard without date indexes | Simpler schema migration | Slow queries after 6 months; may hit Supabase row limits | Never — add indexes in the initial migration |
| Display raw utm_source/medium values | No mapping code needed | Dashboard incomprehensible to non-technical owner | Never for primary views; acceptable in raw data export |
| Write conversion events from frontend only | Simpler client code | Double-counts, can be blocked by ad blockers, not authoritative | Never for primary conversion events |
| Skip idempotency on conversion writes | Simpler insert logic | Duplicate conversions inflate metrics | Never — add unique constraint in schema migration |
| Defer bot filtering to later | Faster MVP build | Corrupted early data is hard to clean retroactively | Acceptable only if traffic is <100 sessions/day |

---

## Integration Gotchas

Common mistakes when connecting to external services or existing system parts.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe Checkout redirect | Expecting UTM data to survive the stripe.com hop | Pass `attributionSessionId` in the booking POST body before redirect; read it from the booking row in the webhook handler |
| Stripe webhook | Recording conversion in webhook AND in frontend | Webhook is sole write point for `booking_completed` on Stripe-flow bookings; frontend fires GA4 events only |
| GoHighLevel sync | GHL contact creation already in `syncBookingToGhl`; UTM data should be sent as contact custom fields at the same time | Add UTM fields to the GHL contact upsert payload in the existing sync function, not in a separate API call |
| GA4 / GTM (existing) | Duplicating UTM capture that GA4 already does | This system captures for the first-party database only; do not replicate GA4's session model — different purpose |
| Drizzle schema | Adding UTM tables with raw SQL instead of schema.ts + Supabase CLI | Follow existing pattern: define tables in `shared/schema.ts`, generate migration with Supabase CLI per MEMORY.md |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No index on `utmSessions.created_at` | Dashboard queries scan full table | Add index in schema migration | ~50k rows / ~6 months of operation |
| No composite index on `(utm_source, utm_medium, created_at)` | Source Performance query is a full-table aggregation | Add composite index in schema migration | ~10k rows |
| Dashboard query fetches all rows then filters in JS | Works in dev (10 rows), slow in production | All filtering must be in SQL WHERE clauses with proper indexes | ~1k rows |
| Storing one row per page view instead of one row per session | Exponential table growth; page-reload users counted multiple times | Session deduplication: check if session ID already exists before INSERT | Day 1 if session model is wrong |
| No LIMIT on Visitor Journey query | Single visitor with many sessions returns enormous result set | Always paginate; cap session history to last 10 visits per visitor | Any visitor with >50 page views |

---

## Security Mistakes

Domain-specific security issues.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing raw IP addresses in UTM session table | GDPR PII liability for EU visitors | Do not persist IPs; derive country code at request time and discard IP |
| No rate limit on `POST /api/utm-sessions` | Attacker floods table with fake sessions, corrupts attribution data | Apply same rate-limit pattern as bookings (`canCreateBooking` equivalent) |
| Accepting arbitrary `attributionSessionId` from client without validation | Client can claim any session ID, linking bookings to fake sessions | Validate that session ID exists in the `utmSessions` table before accepting it on a booking; reject unknown IDs silently |
| Admin dashboard API endpoints not behind `requireAdmin` | Attribution data exposed to public (reveals campaign names, landing pages, traffic volumes — competitive intelligence) | All `/api/marketing/*` routes must use `requireAdmin` middleware from the start |
| UTM parameters used in ad URLs without encoding | Malicious `utm_campaign` values with SQL-special chars | Drizzle parameterized queries prevent injection; still normalize and trim values at capture |

---

## UX Pitfalls

Common user experience mistakes specific to the non-technical admin audience.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing "First Touch" and "Last Touch" without explanation | Owner does not know which to trust; ignores the feature | Always show both with a one-line tooltip: "First visit source" and "Most recent visit before booking" |
| Showing conversion rate as 0.3% for a campaign with 3 visits and 0 conversions | Statistically meaningless but looks like failure | Add sample size warning: "Less than 30 visits — rate not meaningful yet" |
| No date range filter defaulting to last 30 days | Owner opens dashboard, sees all-time data dominated by early direct traffic, concludes paid ads don't work | Default to last 30 days; make the date range prominent and easy to change |
| "No data" empty state with no context | Owner thinks the feature is broken | Empty state must say when data collection started and what to expect |
| Showing utm_campaign raw values like `spring_2026_fb_a` | Owner recognizes their own campaign names; this is fine | Show raw campaign names with title-casing but no mapping needed |
| Visitor Journey view showing all sessions including bot sessions | Table cluttered with noise | Filter out sessions with no page interactions before displaying in the UI |

---

## "Looks Done But Isn't" Checklist

- [ ] **UTM capture:** Captures all 6 params — verify `utm_content` and `utm_term` are captured, not just source/medium/campaign
- [ ] **Case normalization:** All UTM values lowercased — verify by checking the database after clicking a link with `utm_source=Google`
- [ ] **Stripe attribution:** Booking created via Stripe flow has non-null `attributionSessionId` in the bookings table — verify by checking DB row after a test Stripe checkout
- [ ] **Pay-on-site attribution:** Booking created via direct form submit also has `attributionSessionId` — this path is separate from Stripe and must be verified independently
- [ ] **First-touch preservation:** Returning visitor with a new UTM does not overwrite their first-touch record — verify by simulating two visits with different UTM params
- [ ] **Bot filtering:** Sessions from automated health checks (Vercel uptime, monitoring tools) are not counted — verify by checking if `/api/health` or similar hits create session rows
- [ ] **Idempotency:** Submitting the booking form twice (simulating double-click) does not create two conversion events — verify in the database
- [ ] **Admin protection:** `/api/marketing/*` endpoints return 401 without admin session — verify with a curl request without auth
- [ ] **Empty state:** Dashboard shows a useful message when there are zero sessions — verify by testing against a fresh database schema
- [ ] **Date range filter:** All dashboard charts update when date range changes — verify that the filter actually changes the SQL query parameters, not just the UI display

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| UTM case not normalized — mixed-case data in DB | MEDIUM | Write a one-time migration SQL to `UPDATE utmSessions SET utm_source = lower(utm_source)` for all rows; add normalization to capture code going forward |
| Double conversion events from frontend + webhook | MEDIUM | `DELETE FROM conversionEvents WHERE id NOT IN (SELECT MIN(id) FROM conversionEvents GROUP BY booking_id, event_type)` to deduplicate; add unique constraint |
| IP addresses accidentally stored | MEDIUM | `ALTER TABLE utmSessions DROP COLUMN ip_address` via Supabase migration; review whether any backups include PII |
| UTM sessions table has months of bot traffic | HIGH | Identify bot pattern (user agent, landing page, zero conversions); `DELETE FROM utmSessions WHERE ...` with specific criteria; rebuild aggregated metrics |
| Stripe-flow bookings all have null attribution | HIGH | Cannot retroactively attribute bookings that completed before attribution capture was deployed; document cutoff date in the admin dashboard |
| First-touch overwritten for existing visitors | HIGH | Cannot recover overwritten data; add database-level trigger to prevent first-touch updates going forward; accept data loss for the affected period |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| UTM case not normalized | Phase 1: Schema + capture | Query DB after test visit with `utm_source=Google` — verify lowercase stored |
| Safari ITP strips params | Phase 1: Capture + classification | Test on iOS Safari with a UTM link; verify referrer-based fallback fires |
| localStorage cleared | Phase 1: Session persistence design | Simulate cache clear; verify new session created, first-touch in DB preserved from original |
| IP stored as PII | Phase 1: Schema design | Review migration — no `ip_address` or `ip` column present |
| UTM sessions table unbounded | Phase 1: Schema + indexes | `\d utmSessions` in Supabase — verify `created_at` index and composite index present |
| Bot filtering absent | Phase 1: Capture route | Check `utmSessions` after Vercel health check fires — no row created |
| Stripe attribution gap | Phase 2: Booking integration | Complete a Stripe test checkout; verify `attributionSessionId` on the booking row |
| Double conversion from webhook + frontend | Phase 2: Conversion recording | Submit booking twice in test; verify single row in `conversionEvents` |
| Booking POST retry creates duplicates | Phase 2: Booking integration | Simulate double-submit; verify idempotency key prevents duplicate booking |
| Admin routes unprotected | Phase 2 or 3: API layer | `curl /api/marketing/overview` without auth — expect 401 |
| Raw UTM values in dashboard | Phase 3: Dashboard design | Check every table/chart for "utm_source," "utm_medium," "cpc" text in UI |
| Empty dashboard day one | Phase 3: Dashboard design | Open dashboard on fresh schema — verify useful empty state visible |
| Percentage with small sample | Phase 3: Dashboard design | Test with 2 sessions, 1 conversion — verify sample size warning shown |
| First-touch vs last-touch unexplained | Phase 3: Dashboard design | Check that both metrics have tooltip/label explaining the difference |

---

## Sources

- Codebase analysis of `server/routes/payments.ts`, `server/routes/bookings.ts`, `client/src/pages/Confirmation.tsx`, `client/src/lib/analytics.ts` — direct inspection (HIGH confidence)
- `.planning/PROJECT.md` milestone requirements and constraints (HIGH confidence)
- `.planning/codebase/CONCERNS.md` — existing error handling gaps, session memory store, missing input validation (HIGH confidence)
- Plausible Analytics open-source implementation — GDPR-by-design approach to avoiding IP storage (HIGH confidence)
- Safari ITP documentation and webkit.org changelog — cross-site query param stripping behavior (HIGH confidence)
- Facebook Attribution documentation — `_fbc`/`_fbp` cookie signals as ITP fallback (MEDIUM confidence — platform behavior can change)
- Stripe Checkout documentation — metadata survival through redirect round-trip (HIGH confidence)

---
*Pitfalls research for: First-party UTM attribution on Skleanings booking platform*
*Researched: 2026-04-25*
