# Skleanings

## What This Is

Skleanings is a full-stack service booking platform for a residential and commercial cleaning company. Customers browse cleaning services by category, add to cart, select available time slots, and complete bookings. The platform includes an admin dashboard for managing bookings, services, staff, and business settings, plus integrations with GoHighLevel CRM, Stripe payments, and Google Calendar.

## Core Value

Customers can discover, book, and pay for cleaning services online without calling — and the business can manage everything from one admin panel.

## Current Milestone: v2.0 White Label

**Goal:** Transform the platform into a white-label product — remove all hardcoded "Skleanings" references and make brand identity, SEO, favicon, and legal pages fully configurable via the admin panel, with no code changes required per tenant.

**Target features:**
- Dynamic favicon — `faviconUrl` field in `companySettings` + admin upload + Express dynamic serve
- Server-side SEO/meta injection — Express middleware reads `companySettings` and injects title, canonical, og:*, twitter:*, schema.org JSON-LD into `index.html` at request time
- Hardcoded-free frontend — ThemeContext defaults, localStorage key prefix, and all components reading values from DB
- Server-side brand tokens — `openrouter.ts` and other server files using `companySettings.companyName` from DB
- Configurable legal pages — Privacy Policy and Terms of Service content stored and served from DB

## Requirements

### Validated

- ✓ Customer can browse service catalog by category and subcategory — v0 core
- ✓ Customer can add services to cart and complete a booking with time slot selection — v0 core
- ✓ Admin can manage bookings, services, categories, and company settings — v0 core
- ✓ GoHighLevel CRM integration for lead capture — v0 core
- ✓ Stripe payment processing integrated into booking flow — v0 core
- ✓ Google Calendar integration for appointment sync — v0 core
- ✓ AI-powered blog generation on a cron schedule — v0 core
- ✓ Session-based admin authentication with bcrypt — v0 core
- ✓ Contacts, appointments calendar, staff roles, and user management in admin — v0 core
- ✓ Website/integrations admin tab with dynamic brand colors — v0 core
- ✓ DB connection stability via postgres.js (SCRAM/pgBouncer fix) — phase 09
- ✓ UTM session capture (all 6 params + referrer + landing page), traffic classification, first/last-touch attribution — Phase 10
- ✓ Booking flow attribution — visitorId wired through direct and Stripe paths, booking_started and chat_initiated events — Phase 11
- ✓ Marketing Dashboard UI — Overview (KPI cards, trend chart, recent conversions), Sources tab (per-source performance table), Campaigns tab (per-campaign table with zero-booking visibility), date range filter with 7 presets, polished empty states — Phase 12
- ✓ Conversions tab (last-touch event list with source filter + date range), Visitor Journey slide-over (first/last-touch blocks, influence indicator, conversion event), GHL UTM custom field sync (utm_first/last_source/campaign written fire-and-forget on booking) — Phase 13
- ✓ Schema Foundation & Detokenization — 3 new white-label columns in companySettings, all hardcoded "Skleanings" strings removed from frontend and server, ThemeContext reads companyName/email from DB, visitor localStorage key derived from company slug, OpenRouter blog titles read from DB — Phase 15
- ✓ SEO Meta Injection — Express middleware injects tenant-specific title, canonical, OG, Twitter Card, and LocalBusiness JSON-LD from companySettings into every HTML response; client/index.html fully retemplated with {{TOKEN}} markers (SEO-05); vercel.json routes HTML through Express (D-01); shared buildLocalBusinessSchema() used by both server injector and client useSEO hook — Phase 16
- ✓ Favicon, Legal & Company Type Admin UI — faviconUrl DB column + admin upload, {{FAVICON_URL}} SEO injector token with /favicon.png fallback, service delivery model radio, privacy/terms content textareas in admin "Legal & Branding" card, /privacy-policy and /terms-of-service pages rewritten as DB-driven with graceful empty states — Phase 17
- ✓ Admin Calendar Improvements — Create Booking modal widened to sm:max-w-2xl, customer name+phone in 2-col grid, useFieldArray multi-service rows with searchable combobox selector (Popover+Command), always-editable end time with auto-fill guard, conditional address field driven by serviceDeliveryModel, brand yellow submit button verified — Phase 18
- ✓ Receptionist Booking Flow & Multi-Staff View — "By Staff" parallel-column calendar view via RBC resources prop, DnDCalendar withDragAndDrop HOC for time+staff drag-to-reassign with undo toast, QuickBookModal for walk-in booking (name+service required, More options collapsible), 30s polling refetchInterval, per-staff availability badges on customer BookingPage step 3 — Phase 19

### Active

- v2.0 White Label milestone complete (Phases 15–19); human browser verification pending for Phase 19 UAT items (By Staff view, Quick Book flow, drag-to-reassign, customer staff badges)

### Out of Scope

- Replacing GA4 / Google Tag Manager — GA4/GTM is already in use; this is a first-party layer that complements it
- Building a standalone analytics product separate from the admin panel — marketing data lives inside the existing admin, not a separate app
- Real-time event streaming / websocket dashboards — standard query-based reporting is sufficient
- Multi-property / multi-account tracking — this is for a single cleaning business

## Context

**Existing admin panel:** React 18 + shadcn/ui + Tailwind. All new admin views must match existing patterns (sidebar navigation, card-based layout, React Query for data fetching, same color palette and typography).

**External analytics:** The business uses GA4 and GTM. This first-party system captures data independently — useful for cross-referencing and for attribution data the business fully controls.

**Database:** PostgreSQL via Drizzle ORM (Supabase). New tables for UTM sessions and conversion events will follow existing schema patterns in `shared/schema.ts`.

**Audience:** Non-technical business owner. Every label, chart title, and empty state should be written in plain business language. Avoid surfacing raw UTM parameter names in the primary views.

**Booking flow:** Bookings are the primary conversion event. The booking flow lives on the customer-facing site and currently has no attribution capture — this milestone adds it.

**Codebase state:** Large server files were recently split into domain modules. Follow the domain-module pattern established in `server/routes/` and `server/storage.ts` domains.

## Constraints

- **Tech Stack**: React 18 + TypeScript + shadcn/ui + Tailwind — no new UI frameworks
- **Database**: PostgreSQL via Drizzle ORM + Supabase migrations — no raw SQL migrations, always use Supabase CLI
- **Admin Patterns**: New admin sections must use the same sidebar navigation, route guard, and layout components as existing admin pages
- **First-Party Only**: Data captured by this system must live in the project's own database — no third-party tracking SDKs added to the customer-facing frontend
- **Privacy**: UTM and session data should not store PII beyond what's already captured in bookings (no email tracking, no fingerprinting)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| First-party UTM storage over relying solely on GA4 | Business owns its marketing data; can correlate with booking records directly | — Pending |
| First-touch preservation + last-touch update model | Covers both "what brought them in" and "what tipped them over" questions | — Pending |
| Session-level attribution (not user-level) | No login required for customers; cookie/localStorage session ID is most reliable | — Pending |
| Booking completed as primary conversion event | Highest-value action; directly tied to revenue | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-30 after Phase 17 complete (Favicon, Legal & Company Type Admin UI — v2.0 White Label milestone)*
