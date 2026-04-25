# Phase 10: Schema, Capture & Classification — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the UTM data capture infrastructure: two new database tables with indexes, a Supabase CLI migration, a server-side traffic classifier utility, a public session endpoint, and a client-side hook mounted in the existing AnalyticsProvider. **No UI work in this phase.** No booking flow modifications (that is Phase 11). Data must flow from visitor browser to the database by the end of this phase.

Requirements in scope: CAPTURE-01, CAPTURE-02, CAPTURE-03, CAPTURE-04, CAPTURE-05, CAPTURE-06, ATTR-03.

</domain>

<decisions>
## Implementation Decisions

### Session Longevity
- **D-01:** No server-side session expiration. The localStorage UUID (`skleanings_visitor_id`) persists until the user clears browser data. No TTL enforced at the application layer. The `visitor_sessions` table row is never auto-deleted by the application (only by the data retention cron introduced separately). Rationale: a local cleaning business has customers with multi-month or annual booking cycles — session expiration would incorrectly re-attribute returning customers.

### Last-Touch Update Rule
- **D-02:** Last-touch columns (`last_utm_source`, `last_utm_medium`, `last_utm_campaign`, `last_utm_term`, `last_utm_content`, `last_utm_id`, `last_landing_page`, `last_referrer`, `last_traffic_source`) are **only updated when the inbound request contains UTM parameters OR an identifiable external referrer**. Direct navigation — empty referrer and no UTMs — does NOT overwrite last-touch. This preserves the last real marketing touch when a customer bookmarks the site after clicking a Google Ad. The `last_seen_at` timestamp is always updated on every session upsert.
- **D-03:** The trigger for "meaningful re-engagement" is evaluated server-side in `upsertVisitorSession()`. The client sends all URL params and the referrer header; the server decides whether the visit qualifies as a last-touch update.

### UTM Normalization
- **D-04:** All UTM parameter values are lowercased before writing. Normalization happens in the client hook before sending to the server, AND the server normalizes again as a safety net. Use `value.toLowerCase().trim()` — do not rely on SQL `LOWER()` as that bypasses indexes.

### Dev Environment
- **D-05:** The `useUTMCapture` hook returns early in the development environment — `if (import.meta.env.DEV) return`. This matches the existing `analytics.ts` pattern and prevents dev sessions from polluting the production database or the analytics reports. Developers who need to test UTM capture should use a staging environment.

### Public Endpoint Rate Limiting
- **D-06:** Apply a permissive IP-based rate limit to `POST /api/analytics/session` using the existing `server/lib/rate-limit.ts` pattern. Threshold: 60 requests per IP per minute (much higher than the booking endpoint — analytics endpoints receive many legitimate calls per session). Exceeding the limit returns 429, which the client ignores (fire-and-forget).

### Hook Placement
- **D-07:** Mount `useUTMCapture()` inside the existing `AnalyticsProvider` component in `client/src/App.tsx`. AnalyticsProvider already wraps all routes and fires on every location change — no new provider is needed. The hook reads the current URL on mount and on location changes.

### Session ID Storage
- **D-08:** Primary storage: `localStorage` key `skleanings_visitor_id`. The UUID is generated client-side using `crypto.randomUUID()` on first visit. No cookie fallback is needed for this phase — the server writes the first-touch row immediately on the first POST, so even if localStorage is cleared mid-journey, the worst case is a new UUID and a new first-touch row (not lost data).

### Schema: Unique Constraint (ATTR-03)
- **D-09:** The `conversion_events` table must include a unique constraint on `(booking_id, event_type, attribution_model)`. This prevents duplicate conversion rows if both the Stripe webhook and the confirmation page attempt to write the same event. This constraint is included in the Phase 10 schema migration even though conversion writes happen in Phase 11 — the constraint must exist before any writes occur.

### Migration Tooling
- **D-10:** Use Supabase CLI migration format: file named `YYYYMMDDHHMMSS_add_utm_tracking.sql` in `supabase/migrations/`. Never use `drizzle-kit push`. The Drizzle table definitions in `shared/schema.ts` are updated for type safety, but the actual migration is a hand-written SQL file applied via `supabase db push`.

### Claude's Discretion
- Traffic classifier domain coverage: start with the most common sources (Google, Bing, Yahoo, DuckDuckGo for organic; Facebook, Instagram, YouTube, TikTok, LinkedIn, Twitter/X, Pinterest for social). More domains can be added incrementally without a schema change.
- Exact index naming convention: follow existing Drizzle index naming patterns in `shared/schema.ts`.
- Response shape for `POST /api/analytics/session`: return `{ sessionId: string, isNew: boolean }` — simple, useful for the client to confirm the UUID was accepted.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database & Schema
- `shared/schema.ts` — Existing Drizzle table definitions and type patterns. New tables (visitor_sessions, conversion_events) must follow the same column naming, type imports, and `createInsertSchema` pattern.
- `supabase/migrations/` — Existing migration file examples. New migration must follow `YYYYMMDDHHMMSS_*.sql` naming.
- `.planning/research/ARCHITECTURE.md` — Full schema design: visitor_sessions columns, conversion_events columns, recommended indexes, and the two-table rationale (denormalized attribution snapshot at event time).

### Requirements
- `.planning/REQUIREMENTS.md` §Session Capture & Traffic Classification — CAPTURE-01 through CAPTURE-06 (the requirements this phase must satisfy)
- `.planning/REQUIREMENTS.md` §Attribution Model — ATTR-03 (unique constraint requirement)

### Research
- `.planning/research/SUMMARY.md` — Executive summary of all research findings, critical pitfalls, and the confirmed build order.
- `.planning/research/STACK.md` — Zero new packages needed; `crypto.randomUUID()` available in Node.js 20.x; BTREE composite indexes recommended over BRIN at this data volume.
- `.planning/research/PITFALLS.md` — Pitfall 3 (UTM case normalization), Pitfall 4 (no indexes), Pitfall 5 (empty dashboard day one — relevant to schema design choices).

### Existing Patterns to Match
- `client/src/App.tsx` §AnalyticsProvider (line 77) — Where `useUTMCapture()` hook is mounted. The provider wraps all routes and fires on location changes.
- `client/src/lib/analytics.ts` — Existing analytics lib. Note the `if (import.meta.env.DEV) return` pattern that `useUTMCapture` must replicate.
- `server/lib/rate-limit.ts` — Rate limiting utility to adapt for the analytics endpoint.
- `server/lib/logger.ts` — Logging utility pattern used across server code.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/App.tsx` AnalyticsProvider (line 77): The `useUTMCapture` hook belongs inside this component — it already triggers on every `useLocation()` change. One-line addition.
- `client/src/lib/analytics.ts`: Established pattern for fire-and-forget analytics calls with dev-mode guard. The `useUTMCapture` hook should follow the same pattern.
- `server/lib/rate-limit.ts`: Existing rate limiting utility. Adapt threshold for analytics endpoint (much more permissive than booking endpoints).
- `server/lib/logger.ts` `log()` function: Use for server-side analytics logging.
- `crypto.randomUUID()`: Available in Node.js 20.x (already in use) and modern browsers — no UUID package needed.

### Established Patterns
- **Schema tables**: `pgTable` from `drizzle-orm/pg-core`, `uuid` type, `timestamp().defaultNow()`, `createInsertSchema` from `drizzle-zod`.
- **Server routes**: Named exports from domain files (e.g., `server/routes/bookings.ts`), registered in `server/routes.ts`.
- **Storage layer**: Functions in `server/storage.ts` (or domain-specific storage files for large modules) called by route handlers.
- **Import aliases**: `@/` for `client/src/`, `@shared/` for `shared/`.

### Integration Points
- `client/src/App.tsx` line 77: Mount point for `useUTMCapture()` hook.
- `server/routes.ts`: Register `analyticsRouter` (new route file for `POST /api/analytics/session`).
- `shared/schema.ts`: Add `visitorSessions` and `conversionEvents` table definitions.
- `server/storage.ts` or new `server/storage/analytics.ts`: Add `upsertVisitorSession()` storage function.

</code_context>

<specifics>
## Specific Ideas

- The `upsertVisitorSession()` function must contain an explicit comment marking the first-touch immutability invariant: "Never update first_* columns on an existing row — this is the architectural guarantee of first-touch preservation."
- Client-side hook should read UTM params from `window.location.search` using `URLSearchParams`, not a third-party library.
- The referrer should be captured from `document.referrer` (available at page load time, empty string on direct visits).
- Landing page should be `window.location.pathname` (path only, no query string, to avoid storing UTM params twice in the landing page field).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-schema-capture-classification*
*Context gathered: 2026-04-25*
