# Skleanings

## What This Is

Skleanings is a full-stack service booking platform for a residential and commercial cleaning company. Customers browse cleaning services by category, add to cart, select available time slots, and complete bookings. The platform includes an admin dashboard for managing bookings, services, staff, and business settings, plus integrations with GoHighLevel CRM, Stripe payments, and Google Calendar.

## Core Value

Customers can discover, book, and pay for cleaning services online without calling — and the business can manage everything from one admin panel.

## Current Milestone: v1.0 Marketing Attribution

**Goal:** Build a first-party marketing intelligence area inside the admin panel that captures UTM parameters, auto-classifies non-UTM traffic, supports first-touch and last-touch attribution, and lets the business owner clearly answer which sources and campaigns are generating real bookings.

**Target features:**
- UTM session capture (all 6 UTM params + referrer + landing page per visitor/session)
- Automatic traffic classification for non-UTM visitors (Google organic, social referrals, direct)
- First-touch + last-touch attribution with preservation of first-touch
- Conversion tracking (primary: booking completed; secondary: form submit, phone click, quote request)
- Admin marketing dashboard: Overview, Campaign Performance, Source Performance, Conversions, Visitor Journey
- Filters: date range, source, medium, campaign, landing page, conversion type
- Business-friendly language throughout (non-technical business owner audience)

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

### Active

None — v1.0 Marketing Attribution milestone complete.

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
*Last updated: 2026-04-25 after Phase 11 complete*
