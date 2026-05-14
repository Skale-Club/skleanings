# Skleanings

## What This Is

Skleanings is a multi-tenant SaaS booking platform for residential and commercial cleaning companies. Customers browse cleaning services by category, add to cart, select available time slots, and complete bookings. The platform includes an admin dashboard for managing bookings, services, staff, and business settings, plus integrations with GoHighLevel CRM, Stripe payments, and Google Calendar. Every request is resolved to a tenant by hostname — complete data isolation per tenant, configurable via admin panel with no code changes required.

## Core Value

Customers can discover, book, and pay for cleaning services online without calling — and the business can manage everything from one admin panel.

## Current State

**Twelve milestones shipped:**

- **v1.0 Marketing Attribution** — First-party UTM tracking, booking flow attribution, marketing dashboard, GoHighLevel CRM UTM sync, admin calendar create-booking-from-slot
- **v2.0 White Label** — Hardcoded brand removed, DB-driven SEO/favicon/legal pages, receptionist multi-staff calendar view with drag-to-reassign and QuickBook walk-in flow
- **v3.0 Calendar Polish** — RBC component identity stabilized, CSS alignment fix, calendar view-switch hygiene, manual confirmation flow per service
- **v4.0 Booking Intelligence** — Multi-slot staff availability, custom booking questions per service, recurring subscriptions (weekly/biweekly/monthly) with 48h email reminders, admin subscription panel, customer self-serve pause/cancel via token link
- **v5.0 Booking Experience** — Multiple durations per service, branded transactional email via Resend (confirmation/reminder/cancellation), Calendar Harmony retry queue with admin observability panel
- **v6.0 Platform Quality** — Rate limiting on public endpoints, BookingPage + AppointmentsCalendarSection split into focused sub-components, blog cron migrated from Vercel to GitHub Actions
- **v7.0 Xkedule Foundation** — Locale settings (language/startOfWeek/dateFormat) per tenant, Super-admin panel at /superadmin with session auth, stats, health check, error logs
- **v8.0 Multi-Tenant Architecture** — tenantId on all 40 business tables, `DatabaseStorage.forTenant(id)` pattern, hostname-based LRU-cached tenant resolution middleware, Hetzner infra config files
- **v9.0 Tenant Onboarding** — Super-admin tenant/domain CRUD, atomic provisioning (user + company settings), LRU cache invalidation, 503 guard for inactive tenants, per-tenant stats
- **v10.0 Tenant Admin Auth** — Tenant-scoped login endpoint, timing-safe bcrypt, cross-tenant 403 guard, AdminTenantAuthContext, Supabase auth removed from admin panel
- **v11.0 Password Reset** — SHA-256 token flow (forgot/reset/change-password), branded Resend email, ForgotPassword + ResetPassword pages
- **v12.0 SaaS Billing** — tenant_subscriptions table, Stripe customer auto-created on tenant creation, subscribe endpoint, billing webhook, 402 enforcement with 3-day grace, /admin/billing self-service portal

**Pending human UAT:** Phase 19 (5 items), Phase 20 (4 CAL-FIX items), Phases 25–29 (browser-only checks), Phase 31 (4 Resend email delivery checks), Phase 34 (booking flow smoke test) — deferred to live session.
**Pending human actions:** Phase 35 — `supabase db push` (drop system_heartbeats) + add `BLOG_CRON_TOKEN` to GitHub Secrets. Phase 38 — `supabase db push` for multi-tenant schema migrations.
**Pending live verification:** Phase 41 infra — Caddy wildcard cert issuance and deploy.yml trigger require a real Hetzner VM.

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
- ✓ DB connection stability via postgres.js (SCRAM/pgBouncer fix) — Phase 09
- ✓ UTM session capture (all 6 params + referrer + landing page), traffic classification, first/last-touch attribution — Phase 10
- ✓ Booking flow attribution — visitorId wired through direct and Stripe paths, booking_started and chat_initiated events — Phase 11
- ✓ Marketing Dashboard UI — Overview (KPI cards, trend chart, recent conversions), Sources tab, Campaigns tab, date range filter with 7 presets, polished empty states — Phase 12
- ✓ Conversions tab, Visitor Journey slide-over (first/last-touch blocks, influence indicator), GHL UTM custom field sync (fire-and-forget on booking) — Phase 13
- ✓ Admin calendar create-booking-from-slot — pre-filled form, customer type-ahead, computed end time + estimated price, full submit mutation with status confirmation and calendar refresh — Phase 14
- ✓ Schema Foundation & Detokenization — 3 new white-label columns in companySettings, all hardcoded "Skleanings" strings removed, ThemeContext + OpenRouter read brand from DB — Phase 15
- ✓ SEO Meta Injection — Express middleware injects title, canonical, OG, Twitter Card, LocalBusiness JSON-LD per request; vercel.json routes HTML through Express; index.html retemplated with {{TOKEN}} markers — Phase 16
- ✓ Favicon, Legal & Company Type Admin UI — faviconUrl upload, service delivery model selector, Privacy Policy and Terms of Service DB-driven at /privacy-policy and /terms-of-service — Phase 17
- ✓ Admin Calendar Improvements — widened modal, multi-service useFieldArray, always-editable end time, conditional address field, brand yellow submit — Phase 18
- ✓ Receptionist Booking Flow & Multi-Staff View — "By Staff" parallel-column calendar, DnDCalendar drag-to-reassign with undo toast, QuickBookModal for walk-in booking, 30s polling, per-staff availability badges on customer BookingPage step 3 — Phase 19
- ✓ Calendar Timeline & Structure Audit — RBC component memoization, useCallback handlers, CSS gutter slot alignment, forced DnDCalendar remount on view+resource change — Phase 20
- ✓ Manual Confirmation Flow Per Service — requiresConfirmation boolean on services, awaiting_approval booking status, admin approve/reject endpoints, amber "Request Received" confirmation screen — Phase 24
- ✓ SLOTS-01–04: Multi-slot staff availability (split shifts, lunch breaks, migration-safe) — Phase 25
- ✓ QUEST-01–04: Custom booking questions per service (text/textarea/select, required validation, answer snapshot) — Phase 26
- ✓ RECUR-01–05: Recurring bookings — frequency selector, one-ahead cron generation, 48h email reminders, admin panel, customer self-serve pause/cancel — Phases 27–29
- ✓ DUR-01–06: Multiple durations per service — admin CRUD, customer duration cards before calendar, slot availability uses selected duration, booking snapshot — Phase 30
- ✓ EMAIL-01–05: Branded transactional email via Resend — emailSettings admin UI, confirmation/24h-reminder/cancellation templates, fire-and-forget triggers, GH Actions cron — Phase 31
- ✓ SYNC-01–07: Calendar Harmony retry queue — calendarSyncQueue table, atomic FOR UPDATE SKIP LOCKED worker, exponential backoff, admin health panel + retry, reconnect banner, GH Actions 5min cron — Phase 32
- ✓ MT-01–05: Multi-tenant schema — tenants/domains/user_tenants tables + tenant_id on all 40 business tables + Skleanings seeded as tenant 1 — Phase 38
- ✓ MT-06–08: DatabaseStorage.forTenant(id) factory — 220 tenantId references, all queries scoped, singleton preserved as forTenant(1) — Phase 39
- ✓ MT-09–13: Tenant resolution middleware — LRU cache (500 entries, 5-min TTL), 404 on unknown hostname, res.locals.storage in all 24 business routes, super-admin bypassed — Phase 40
- ✓ MT-14–17: Hetzner infra config — Caddyfile (wildcard TLS), systemd app.service, deploy.yml (workflow_dispatch), infra/README.md setup guide — Phase 41

### Active

### Out of Scope

- Replacing GA4 / Google Tag Manager — GA4/GTM is already in use; this is a first-party layer that complements it
- Building a standalone analytics product separate from the admin panel — marketing data lives inside the existing admin, not a separate app
- Real-time event streaming / websocket dashboards — standard query-based reporting is sufficient
- DNS cutover and live Hetzner deployment — v9.0 (infra config files committed, deployment is a human action)
- Tenant onboarding wizard — v9.0 or later
- SaaS billing per tenant — requires multi-tenant active first

## Context

**Tech stack:** React 18 + TypeScript + shadcn/ui + Tailwind (frontend) · Express.js + Drizzle ORM + PostgreSQL/Supabase (backend) · Wouter routing · React Query for server state · GoHighLevel, Stripe, Google Calendar integrations.

**Admin panel:** All admin views use the same sidebar navigation, card-based layout, and React Query patterns. New admin features must match existing UI conventions.

**Codebase state:** Nine milestones shipped (Phases 1–44, 83+ plans). Full multi-tenant SaaS backend operational — `DatabaseStorage.forTenant(tenantId)`, hostname LRU middleware, all routes use `res.locals.storage`. Super-admin panel at /superadmin with tenant CRUD (list, create, manage domains, provision admin, activate/deactivate), per-tenant stats, and LRU cache invalidation on domain changes. `users.password` column added — provisioned admins stored with bcrypt. Company settings auto-seeded on tenant creation. 503 guard for inactive tenants. Supabase CLI only for migrations. Three GH Actions cron workflows + manual deploy.yml. Caddy + systemd infra config in `infra/`.

**White-label / multi-tenant status:** All "Skleanings" literals removed. Brand identity fully configurable via `companySettings`. Complete data isolation per tenantId — platform ready for SaaS deployment with multiple tenants on Hetzner CX23.

**Pending UAT:** Phase 19 (5 browser checks) and Phase 20 (4 CAL-FIX checks) require a live browser session.

## Constraints

- **Tech Stack**: React 18 + TypeScript + shadcn/ui + Tailwind — no new UI frameworks
- **Database**: PostgreSQL via Drizzle ORM + Supabase migrations — Supabase CLI only, never drizzle-kit push (TTY prompt issues)
- **Admin Patterns**: New admin sections must use the same sidebar navigation, route guard, and layout components as existing admin pages
- **White-label**: All brand identity, copy, and configuration must come from `companySettings` — no new hardcoded brand strings
- **Multi-tenant**: All new business queries must use `res.locals.storage` in routes; lib functions must accept `IStorage` as parameter — never import global `storage` in business routes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| First-party UTM storage over relying solely on GA4 | Business owns its marketing data; can correlate with booking records directly | ✓ Shipped v1.0 — working in production |
| First-touch preservation + last-touch update model | Covers both "what brought them in" and "what tipped them over" questions | ✓ Shipped — dual-row write pattern, first_* columns immutable |
| Session-level attribution (not user-level) | No login required for customers; localStorage session ID is most reliable | ✓ Shipped — localStorage UUID survives multi-day journeys |
| Booking completed as primary conversion event | Highest-value action; directly tied to revenue | ✓ Shipped — dual first/last-touch rows on booking_completed |
| Analytics writes always fire-and-forget | Booking flow must never be blocked or delayed by attribution | ✓ Enforced — all attribution calls use void IIFE or Promise.catch |
| Plain TEXT for serviceDeliveryModel (no pgEnum) | Matches existing precedent (timeFormat, ogType) for enum-like values | ✓ Shipped — migration applied, admin UI reads/writes correctly |
| SEO injector token replacement uses function replacer | Prevents $ special patterns ($$, $&) from corrupting JSON-LD values | ✓ Shipped — replaceAll uses () => v replacer throughout |
| DnDCalendar withDragAndDrop at module scope | DnD HOC must be outside any render function to avoid re-creation | ✓ Shipped — line 146 in AppointmentsCalendarSection.tsx |
| QuickBookModal two-field minimal UI (name + service) | Walk-in flow goal is < 30 seconds — extra fields hidden under collapsible | ✓ Shipped — Collapsible "More options" with phone/email/address |
| selectedDurationId override on cart item (not ID ref) | CartContext.totalDuration reads item.durationMinutes directly — must override the field at selection time | ✓ Shipped Phase 30 — updateItem overrides durationMinutes; snapshot captured at booking creation |
| Resend as parallel module (not nodemailer replacement) | nodemailer still powers recurring subscription reminders; adding a second transport avoids breaking existing flows | ✓ Shipped Phase 31 — server/lib/email-resend.ts coexists with server/lib/email.ts |
| SELECT FOR UPDATE SKIP LOCKED via raw SQL (not Drizzle builder) | Drizzle query builder .for("update", { skipLocked: true }) has known bug #3554 that generates invalid SQL | ✓ Shipped Phase 32 — all queue dequeue uses db.execute(sql`...`) |
| GCal worker graceful skip (no write implementation) | GCal OAuth scope is calendar.readonly — no createGCalEvent exists; shipping write out of scope avoids blocking queue infrastructure | ✓ Shipped Phase 32 — google_calendar jobs marked success with log note; write deferred |
| DatabaseStorage.forTenant() factory + private constructor | Prevents accidental unscoped instantiation; `this.tenantId` flows to all 220 query methods automatically | ✓ Shipped Phase 39 — singleton preserved as forTenant(1) for zero route breakage |
| IStorage as explicit parameter in all lib functions | Lib functions called from routes with res.locals.storage — no req/res access at lib level | ✓ Shipped Phase 40 — 11 lib files, Express auth middleware reads res.locals.storage directly |
| Caddy + xcaddy (not nginx) for reverse proxy | Automatic HTTPS via Let's Encrypt, simpler config, wildcard TLS via caddy-dns/cloudflare plugin | ✓ Shipped Phase 41 — infra/Caddyfile committed |
| systemd Type=simple (not PM2) for process management | Single-process Node app — PM2 adds no value; systemd Restart=always is simpler and more robust | ✓ Shipped Phase 41 — infra/app.service with Restart=always |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

## Current Milestone: v13.0 Self-Serve Signup

**Goal:** Any business can sign up independently via a public page — no super-admin action required to onboard a new tenant, with a 14-day free trial auto-started on signup.

**Target features:**
- Public /signup page (company name, subdomain slug, email, password)
- Atomic signup: tenant + domain + admin user + company settings + Stripe customer + trial subscription in one transaction
- Subdomain uniqueness validation with friendly error
- Post-signup redirect to /admin at the new tenant's subdomain
- Trial status visible in /admin/billing (days remaining countdown)
- Stripe webhook for `customer.subscription.trial_end` → update status to active/past_due
- Super-admin sees self-serve signups in tenant list (source indicator)

---

*Last updated: 2026-05-14 — v13.0 Self-Serve Signup started*
