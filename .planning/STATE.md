---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Phase 18 context gathered
last_updated: "2026-04-30T14:09:19.182Z"
last_activity: 2026-04-30
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 15
  completed_plans: 15
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** Customers can discover, book, and pay for cleaning services online without calling — and the business can manage everything from one admin panel.
**Current focus:** Phase 17 — favicon-legal-company-type-admin-ui

## Current Position

Phase: 17
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-04-30

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*
| Phase 10-schema-capture-classification P01 | 3 | 2 tasks | 2 files |
| Phase 10-schema-capture-classification P03 | 2 | 2 tasks | 2 files |
| Phase 11-booking-flow-attribution P01 | 8 | 2 tasks | 2 files |
| Phase 11-booking-flow-attribution P02 | 6 | 2 tasks | 3 files |
| Phase 11-booking-flow-attribution P03 | 3 | 1 tasks | 1 files |
| Phase 12-marketing-dashboard-ui P02 | 8 | 2 tasks | 6 files |
| Phase 12-marketing-dashboard-ui P03 | 3 | 2 tasks | 3 files |
| Phase 13-visitor-journey-ghl-sync P01 | 289 | 2 tasks | 2 files |
| Phase 13-visitor-journey-ghl-sync P02 | 67 | 2 tasks | 2 files |
| Phase 13-visitor-journey-ghl-sync P03 | 67 | 2 tasks | 3 files |
| Phase 14 P01 | 3 | 2 tasks | 1 files |
| Phase 14-admin-calendar-create-booking-from-slot P02 | 2 | 1 tasks | 1 files |
| Phase 14-admin-calendar-create-booking-from-slot P03 | 1 | 2 tasks | 1 files |
| Phase 15-schema-foundation-detokenization P01 | 2m 5s | 2 tasks | 2 files |
| Phase 15-schema-foundation-detokenization P03 | 3m 23s | 3 tasks | 3 files |
| Phase 15-schema-foundation-detokenization P02 | 6m 0s | 5 tasks | 13 files |
| Phase 16-seo-meta-injection P01 | ~25m | 4 tasks | 6 files |
| Phase 16-seo-meta-injection P03 | 2m | 2 tasks | 2 files |
| Phase 17-favicon-legal-company-type-admin-ui P01 | 6min | 2 tasks | 6 files |
| Phase 17-favicon-legal-company-type-admin-ui P02 | 2m 53s | 2 tasks | 3 files |
| Phase 17-favicon-legal-company-type-admin-ui P03 | 3min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 09: DB connection stabilized via postgres.js (SCRAM/pgBouncer fix) — database layer is reliable
- v1.0 start: Two-table design chosen (visitor_sessions + conversion_events) with denormalized attribution snapshot at event time
- v1.0 start: Dual-row first-touch + last-touch writes on booking_completed event — avoids SQL CASE branching in reports
- v1.0 start: localStorage UUID (not sessionStorage) — must survive multi-day booking journeys
- v1.0 start: ATTR-03 placed in Phase 10 (schema) not Phase 11 — unique constraint must exist before any conversion writes
- [Phase 10-schema-capture-classification]: visitorSessions defined BEFORE bookings in schema.ts (required for FK forward-reference)
- [Phase 10-schema-capture-classification]: ATTR-03 partial unique index enforced via SQL migration only — Drizzle 0.39.3 cannot express partial unique indexes
- [Phase 10-schema-capture-classification]: Types/schemas collocated with table definitions (contacts pattern), not moved to bottom TYPES block
- [Phase 10-schema-capture-classification]: useUTMCapture() mounted at App.tsx line 85 inside AnalyticsProvider — zero new providers per D-07
- [Phase 10-schema-capture-classification]: localStorage key 'skleanings_visitor_id' — canonical cross-visit visitor identifier for Phase 11 attribution linkage
- [Phase 11-booking-flow-attribution]: linkBookingToAttribution silently no-ops when visitorId not found (D-03) — booking is never blocked by attribution failure
- [Phase 11-booking-flow-attribution]: recordConversionEvent writes two rows per event (first_touch + last_touch) with onConflictDoNothing for idempotency — dual attribution model without SQL CASE branching
- [Phase 11-booking-flow-attribution]: POST /api/analytics/events always returns 200 on unexpected errors — analytics never surfaces failures to the client (D-08)
- [Phase 11-booking-flow-attribution]: visitorId imported directly from storage/analytics in routes — server/storage.ts is a DatabaseStorage class that does not expose analytics module functions
- [Phase 11-booking-flow-attribution]: chat_initiated fires only when willOpen===true (D-02) — closing the chat does NOT trigger the event
- [Phase 11-booking-flow-attribution]: visitorId missing omits field from POST body, never blocks event or chat opening (D-03)
- [Phase 12-marketing-dashboard-ui]: AdminSection union extended with 'marketing' (required for TypeScript to accept new section id)
- [Phase 12-marketing-dashboard-ui]: MarketingSection uses local useState for tab switching (not useSlugTab) — consistent with BlogSection pattern (D-07)
- [Phase 12-marketing-dashboard-ui]: Brand yellow #FFFF01 used as chart Area fill only (not stroke/text on white) — amber-600 stroke for visibility per pitfall 6
- [Phase 12-marketing-dashboard-ui]: Empty-state-first principle applied: all three marketing tab components code empty states before data-render path
- [Phase 13-visitor-journey-ghl-sync]: getConversionsData enforces last_touch filter in SQL — first_touch rows excluded by design (D-02)
- [Phase 13-visitor-journey-ghl-sync]: Conversions endpoint limit capped at 200 server-side to prevent runaway queries
- [Phase 13-visitor-journey-ghl-sync]: updateGHLContact extended with optional customFields array — backward compatible, zero callers broken
- [Phase 13-visitor-journey-ghl-sync]: GHL UTM write is fire-and-forget via void IIFE — errors caught and logged, outer sync never affected (D-13)
- [Phase 13-visitor-journey-ghl-sync]: Skip UTM write entirely when booking.utmSessionId is null — no unnecessary GHL API calls for anonymous visitors (D-15)
- [Phase 13-visitor-journey-ghl-sync]: useEffect used for load-more row accumulation — React Query v5 removed onSuccess from useQuery
- [Phase 13-visitor-journey-ghl-sync]: Source filter options derived from loaded data (allRows) to avoid extra API round-trip
- [Phase 13-visitor-journey-ghl-sync]: VisitorJourneyPanel skips API when visitorId is null (enabled: open && !!visitorId) — shows D-08 message immediately
- [Phase 14]: Local bookingFormSchema chosen over insertBookingSchema for atomic field validation; cartItems mapping deferred to Plan 03 submit
- [Phase 14]: addMinutesToHHMM placed at module scope alongside hexToRgba — tiny pure helper, no date-fns dependency
- [Phase 14]: Plan 14-01 onSubmit left as console.log placeholder by design — Plan 03 wires the actual POST /api/bookings mutation
- [Phase 14-admin-calendar-create-booking-from-slot]: Customer type-ahead uses plain apiRequest (cookie auth) for /api/contacts — Bearer token authenticatedRequest would silently no-op since admin sessions lack the Supabase customer-portal token
- [Phase 14-admin-calendar-create-booking-from-slot]: Inline useDebounced<T>(value, ms=250) helper added at module scope — no new dependency, matches must_haves ≥250ms requirement
- [Phase 14-admin-calendar-create-booking-from-slot]: Popover open guarded by both state flag AND debouncedSearch.trim().length >= 2 — guarantees no popover for short input even if state is stale
- [Phase 14-admin-calendar-create-booking-from-slot]: Suggestion select uses form.setValue with shouldValidate: true on all four customer fields — instant Zod re-validation; free-text typing remains source of truth (D-06)
- [Phase 14-admin-calendar-create-booking-from-slot]: PUT /api/bookings/:id/status used to set status='confirmed' (D-10) — PATCH /api/bookings/:id would silently no-op because insertBookingSchemaBase strips status field
- [Phase 14-admin-calendar-create-booking-from-slot]: Status PUT is best-effort with try/catch — booking creation succeeds even if status update fails (booking exists, defaults to 'pending'); avoids confusing the attendant with a hard error after a successful create
- [Phase 14-admin-calendar-create-booking-from-slot]: createBookingMutation.mutationFn body intentionally minimal — no manual !res.ok branch and no err.status/err.data assignment because apiRequest+throwIfResNotOk already throw decorated errors
- [Phase 15-schema-foundation-detokenization]: Plain TEXT (no pgEnum, no CHECK constraint) chosen for serviceDeliveryModel — matches existing precedent (timeFormat, ogType, twitterCard) for enum-like values
- [Phase 15-schema-foundation-detokenization]: Risk 1 mitigated by inspection: getCompanySettings uses db.select().from(companySettings) full-row select — no whitelist, new columns flow through automatically without storage code changes
- [Phase 15-schema-foundation-detokenization]: Migration FILE created in this plan but DB push deferred to operator (Build Constraint #1 + matching the existing Phase 10 migration-pending pattern in STATE.md blockers); Plan 15-02/15-03 unblocked, Phase 17/18 require push first
- [Phase 15-schema-foundation-detokenization]: openrouter.ts companyName param is OPTIONAL (Risk 6) — back-compat preserved through DI typeof alias in dependencies.ts requiring zero code change there
- [Phase 15-schema-foundation-detokenization]: message-handler.ts uses Option A (reuse 'company' loaded at line 936) for openrouter call at line 1095 — avoids redundant DB fetch within a single chat request
- [Phase 15-schema-foundation-detokenization]: Title precedence: process.env.OPENROUTER_APP_TITLE > companyName arg > empty (X-Title header omitted by existing guard) — operator override preserved while removing brand literal
- [Phase 15-schema-foundation-detokenization]: BookingPage uses aliased { settings: csForKey } from useCompanySettings — the parallel useQuery 'companySettings' name collision required an alias rather than the plan's suggested 'companySettings' alias
- [Phase 15-schema-foundation-detokenization]: BookingPage booking_started effect protected by useRef fire-once guard — prevents re-fire when settingsReady gates flip and dep array expands beyond original [] semantics
- [Phase 15-schema-foundation-detokenization]: BlogSection authorName seeded from useCompanySettings.companyName (not '' fallback) per RESEARCH Open Question 1 — preserves white-label semantic 'use the actual tenant name'
- [Phase 15-schema-foundation-detokenization]: use-utm-capture.ts re-exports getVisitorIdKey/deriveCompanySlug from @/lib/visitor-key — canonical impl in lib, hook re-export honors D-07 literal text
- [Phase 16-seo-meta-injection]: replaceAll uses function replacer () => v to prevent $ special patterns ($$, $&, etc.) from corrupting JSON-LD replacement values — critical for priceRange and any admin content with dollar signs
- [Phase 16-seo-meta-injection]: escapeJsonLd uses String.fromCharCode(0x2028/0x2029) to avoid literal Unicode line-separator code points in source file
- [Phase 16-seo-meta-injection]: OG_IMAGE_BLOCK and TWITTER_IMAGE_BLOCK are whole-tag tokens (not per-attribute) — entire meta cluster absent when ogImage empty (D-07 compliance)
- [Phase 16-seo-meta-injection]: ogImageAbsolute computed once at top of injectSeoMeta, shared with og/twitter block AND buildLocalBusinessSchema argument — Pitfall 3 fix
- [Phase 16-seo-meta-injection]: @shared/seo alias used in client hook (not relative path) — confirmed in tsconfig.json paths AND vite.config.ts before editing
- [Phase 16-seo-meta-injection]: client useSEO hook delegates JSON-LD to buildLocalBusinessSchema via SeoSettings as unknown as CompanySettings cast — safe because builder reads optional fields only (D-12 fulfilled, Pitfall 8 closed)
- [Phase 17-favicon-legal-company-type-admin-ui]: faviconUrl appended after termsOfServiceContent in Drizzle schema (consistent with Phase 15 append pattern)
- [Phase 17-favicon-legal-company-type-admin-ui]: favicon.type=image/png removed from use-seo.ts — browser detects MIME from Supabase Content-Type header; hardcoding blocked SVG/ico formats
- [Phase 17-favicon-legal-company-type-admin-ui]: logoIcon retained in SeoSettings interface — only favicon href assignment redirected to faviconUrl; logo display unchanged
- [Phase 17-favicon-legal-company-type-admin-ui]: escapeAttr() wraps faviconUrl in token map — handles special chars in CDN URLs; fallback uses || (falsy) not ?? (nullish) to treat empty string as no favicon set
- [Phase 17-favicon-legal-company-type-admin-ui]: LegalBrandingTab uploads favicon via authenticatedRequest + updateField('faviconUrl') — no prop-drilling of saveSettings; null guard required before upload (TypeScript)
- [Phase 17-favicon-legal-company-type-admin-ui]: Legal pages (PrivacyPolicy, TermsOfService) are DB-driven rewrites: hasContent guard before dangerouslySetInnerHTML, LegalEmptyState shows contact info from settings when empty; no DOMPurify per D-14/D-15

### Pending Todos

- [Unify booking creation modal across Calendar and Bookings pages](todos/pending/2026-04-29-unify-booking-creation-modal-across-calendar-and-bookings-pages.md) — area: ui — schedule against Phase 18 (extend) or as new Phase 19 (refactor after feature work)

### Blockers/Concerns

- **MIGRATION PENDING** — `supabase/migrations/20260425000000_add_utm_tracking.sql` is written and ready. Needs `POSTGRES_URL_NON_POOLING` (direct connection URL) in `.env` to apply. Get from Supabase Dashboard > Settings > Database > Direct connection (port 5432). Then run `supabase db push` from the project root. Plan 10-02 TypeScript types are already available (shared/schema.ts compiles), but Plan 10-02 execution requires the DB tables to exist before the storage/endpoint can be tested.
- Rate limiting strategy for POST /api/analytics/session (public endpoint) — not yet designed; address in Phase 10 planning
- GoHighLevel custom field names for UTM sync — must be confirmed before Phase 13 plan execution
- Phase 15 migration file (20260428000000_add_white_label_columns.sql) ready but NOT applied. Required before Phase 17 (admin UI) and Phase 18 (calendar address-gating). Run supabase db push from project root with POSTGRES_URL_NON_POOLING set in .env. Plans 15-02 and 15-03 are unblocked even without DB push.

### Roadmap Evolution

- Phase 14 added: Admin calendar create booking from slot
- v2.0 White Label roadmap added: Phases 15-18 (2026-04-28)
- Phase 19 added (2026-04-29): Receptionist booking flow & multi-staff view — barbershop/salon/spa receptionist UX with parallel staff calendar columns, drag-to-reassign, walk-in booking. Depends on Phase 18.

## Session Continuity

Last session: 2026-04-30T14:09:19.160Z
Stopped at: Phase 18 context gathered
Resume file: .planning/phases/18-admin-calendar-improvements/18-CONTEXT.md
