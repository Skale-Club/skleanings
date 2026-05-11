const fs = require('fs');
const dest = 'c:/Users/Vanildo/Dev/skleanings/.planning/research/SUMMARY.md';

const content = `# Project Research Summary

**Project:** Skleanings v5.0 Booking Experience
**Domain:** Service booking platform — cleaning company (transactional email, retry queue, multi-duration UX)
**Researched:** 2026-05-11
**Confidence:** HIGH

## Executive Summary

v5.0 adds three self-contained but interconnected features to the existing v4.0 booking platform: multiple selectable durations per service (SEED-029), branded transactional email via Resend (SEED-019), and a durable calendar sync retry queue (SEED-002). The existing stack (Express, Drizzle ORM, React 18, shadcn/ui, node-cron) requires only two net-new packages — resend and react-email. The platform's established patterns (fire-and-forget notifications, IStorage interface, plain-text enum columns, Supabase CLI migrations) all extend cleanly to cover these features without introducing new architectural concepts.

The recommended build order is SEED-029 first (smallest scope, zero collision risk, de-risks schema early), SEED-019 second (replaces nodemailer with Resend SDK, independent of sync changes), and SEED-002 last (largest scope, modifies the booking POST handler — safest to do after the other two are stable). SEED-029 feeds SEED-019 in that the duration label stored in bookingItems at booking creation enriches confirmation email copy, so shipping in this order captures that value naturally. SEED-002 is architecturally orthogonal to both and can proceed independently once the booking handler is not simultaneously in flux.

The critical risks are: (1) the CartContext.totalDuration computation silently using the catalog default instead of the selected duration, causing staff double-booking; (2) the calendar sync worker using pg_advisory_lock instead of SELECT FOR UPDATE SKIP LOCKED, which is incompatible with Supabase's pgBouncer transaction pooling; and (3) Resend domain DNS records not verified before go-live, causing silent email failures during a 72-hour propagation window. Each of these is preventable with explicit plan constraints — see Pitfalls section below.

---

## Key Findings

### Recommended Stack

The v5.0 stack delta is minimal. Two packages are added: resend ^4.5.1 (official SDK for sending transactional email — returns { data, error }, never throws, consistent with the codebase's fire-and-forget error handling) and react-email ^6.1.1 (JSX email templates, server-side render only). The existing node-cron ^4.2.1, nodemailer ^8.0.7, and raw Drizzle db.execute(sql...) handle the remaining implementation. There is no Redis dependency and no new queue library — the SELECT FOR UPDATE SKIP LOCKED pattern on PostgreSQL is sufficient at current scale (under 500 bookings/month, single tenant).

**Core technologies (net-new):**
- resend ^4.5.1: Transactional email delivery — clean SDK, no SMTP config, returns structured { data, error }
- react-email ^6.1.1: Server-side JSX email templates — all components from react-email directly (not the deprecated @react-email/components)

**Critical version notes:**
- Do NOT install @react-email/components — deprecated since React Email v6 (May 2025); all components are now in react-email
- Do NOT use drizzle-orm query builder .for("update", { skipLocked: true }) — known bug #3554 generates malformed SQL; use raw db.execute with FOR UPDATE SKIP LOCKED instead
- Do NOT remove nodemailer — still powers v4.0 recurring subscription reminders; Resend is a parallel addition in server/lib/email-resend.ts

### Expected Features

**Must have (table stakes):**
- Duration cards (label, price, durationMinutes) rendering before the slot calendar — SEED-029
- Default duration pre-selected (lowest sortOrder serviceDuration row) — SEED-029
- Duration snapshot stored in bookingItems at booking creation — SEED-029
- Slot availability recomputed from the selected duration, not the catalog default — SEED-029
- Admin CRUD for service durations in ServicesSection — SEED-029
- Booking confirmation email sent within 60s of booking creation — SEED-019
- 24h-before reminder email via daily cron — SEED-019
- Cancellation notice on booking status change to cancelled — SEED-019
- emailSettings table (apiKey, fromAddress, enabled) + admin panel — SEED-019
- calendarSyncQueue table with exponential backoff worker — SEED-002
- Enqueue on booking create/update/cancel, replacing fire-and-forget GHL sync — SEED-002
- Admin sync health panel: counts by status/target, retry button — SEED-002

**Should have (differentiators, v5.x after validation):**
- Add-to-calendar ICS link in confirmation email
- Duration description text on cards ("Ideal for apartments up to 60m2")
- Connection health banner ("Reconnect Google Calendar") triggered by N consecutive failures
- Resend delivery webhook logged to notificationLogs

**Defer (v2+):**
- Admin-editable email body / WYSIWYG — support nightmare, breaks brand consistency
- Marketing content inside transactional emails — CAN-SPAM/GDPR violation risk
- Two-way calendar sync — conflict resolution scope is 5x the current feature
- pg-boss migration — only warranted when queue depth exceeds ~1,000 jobs/day

### Architecture Approach

All three features extend the existing layered architecture without new patterns. Schema changes go through shared/schema.ts + Supabase CLI migration (never drizzle-kit push). DB queries go through the IStorage interface in server/storage.ts. New routes (email-settings.ts, calendar-sync.ts) follow the existing domain-split Express router pattern and are mounted in server/index.ts. Cron additions go into server/services/cron.ts using the existing isServerless guard. Admin UI components follow the React Query + shadcn/ui pattern established by integrationSettings (GHL) and twilioSettings.

**Major components added/modified:**

1. shared/schema.ts — Add emailSettings and calendarSyncQueue tables; confirm serviceDurations migration status
2. server/storage.ts — Implement 4 existing stub methods for serviceDurations; add emailSettings and calendarSyncQueue IStorage methods
3. server/lib/email.ts — Replace nodemailer transport with Resend SDK, keeping same sendEmail() signature so all existing callers are unchanged
4. server/lib/email-templates.ts — Add 3 booking template functions using existing plain HTML string pattern (not React Email JSX — not justified for 3 templates)
5. server/services/calendar-sync-worker.ts — New file: SELECT FOR UPDATE SKIP LOCKED worker with 6-attempt exponential backoff
6. server/routes/bookings.ts — Add email fire-and-forget on create/cancel; replace direct syncBookingToGhl() with enqueueCalendarSync() calls
7. client/src/pages/BookingPage.tsx — Duration selector rendered inline (no new step — file is 39KB, step-machine bloat is a named pitfall)
8. client/src/components/admin/ — Three new admin panels: ServiceDurationsEditor, EmailSettingsSection, CalendarSyncHealthPanel

### Critical Pitfalls

1. **CartContext.totalDuration uses catalog default, not selected duration** — Override item.durationMinutes on the cart item at selection time (spread the override so totalDuration picks it up automatically). Verify with DevTools that totalDurationMinutes in the booking API payload equals the chosen duration, not the service catalog default. Failure mode: staff double-booked.

2. **pg_advisory_lock incompatible with pgBouncer transaction mode** — Use SELECT ... FOR UPDATE SKIP LOCKED exclusively, with the status update in one atomic transaction. server/db.ts already sets prepare: false, confirming pgBouncer transaction mode is active. Never add any pg_advisory_* call alongside the row lock.

3. **in_progress rows orphaned after worker crash** — Either keep the entire SELECT + external API call + status update in one transaction (acceptable for sub-5-second GHL/GCal calls), OR ship a stale-row reaper cron in the same phase that resets rows where status = 'in_progress' AND last_attempt_at < NOW() - INTERVAL '10 minutes'. Do not ship the worker without one of these two safeguards.

4. **Resend domain DNS not verified at launch — silent confirmation failures** — Verify DNS records (DKIM CNAME, SPF TXT) at least 72 hours before go-live. Always log Resend error responses to notificationLogs with status = 'failed'. Fallback to nodemailer SMTP if Resend is unconfigured.

5. **node-cron is a no-op on Vercel — worker never runs in production** — The calendar sync worker requires a GitHub Actions cron workflow (same pattern as recurring-bookings-cron.yml). This workflow is a required deliverable of the SEED-002 phase, not a follow-up task.

6. **Duration selector adds a new BookingPage step — bloat and step-machine regression** — Do not add a new step. Render the duration selector inline in step 2 (cart review) or in the AddToCartModal. BookingPage.tsx must not grow past 42KB.

7. **Recurring booking generator uses catalog durationMinutes after SEED-029 ships** — Add a resolved durationMinutes column to recurringBookings (defaulting to catalog value for existing rows). The generator reads this column instead of the service row. Must be included in the SEED-029 phase plan.

---

## Implications for Roadmap

Based on combined research, the recommended phase structure maps directly to the three seeds, ordered by scope risk and dependency chain.

### Phase 1: Multiple Durations per Service (SEED-029)

**Rationale:** Smallest scope. serviceDurations schema already exists in shared/schema.ts with 4 declared (but unimplemented) IStorage methods — this phase is mostly completing stubs and wiring UI. Does not touch server/routes/bookings.ts. Zero collision risk with SEED-019 and SEED-002. De-risks schema migration early. Produces the durationLabel and durationMinutes snapshot in bookingItems that SEED-019 email templates consume.

**Delivers:** Duration card selector in booking flow, admin duration CRUD, correct slot availability based on selected duration, duration snapshot in booking records, recurringBookings schema fix.

**Addresses:** Duration cards, default pre-selection, slot recompute, bookingItems snapshot, admin service edit, recurring booking generator correction.

**Avoids:** CartContext totalDuration bug (explicit fix required in same plan), BookingPage step bloat (inline rendering required), recurring bookings wrong duration (recurringBookings schema update required in same plan).

**Research flag:** Standard patterns — areaSizes card component is the exact model; no additional research needed.

### Phase 2: Branded Transactional Email via Resend (SEED-019)

**Rationale:** Standalone — the existing server/lib/email.ts and server/lib/email-templates.ts make this a replacement-and-extension, not greenfield. Should precede SEED-002 so that when booking status flows are hardened by the retry queue, emails fire correctly from a known-stable baseline. Duration label from Phase 1 enriches email copy naturally.

**Delivers:** Booking confirmation, 24h reminder, and cancellation emails via Resend SDK; emailSettings table and admin panel; email delivery logging to notificationLogs.

**Uses:** resend ^4.5.1, existing node-cron, existing notificationLogs table (new channel: 'email' rows, no migration needed for the channel column).

**Avoids:** Resend domain DNS gap (72h pre-flight checklist), React Email render in browser context (templates in server/lib/email-templates.ts only, plain HTML string pattern), nodemailer removal (keep as fallback).

**Research flag:** Standard patterns — matches twilioSettings/integrationSettings admin pattern exactly; no additional research needed.

### Phase 3: Calendar Harmony Retry Queue (SEED-002)

**Rationale:** Largest scope. Modifies server/routes/bookings.ts to replace the direct syncBookingToGhl() call — safest to do after Phases 1 and 2 are stable so the booking handler is not concurrently modified by all three features. Building last means Phase 1 and 2 bookings already work; Phase 3 hardens reliability without touching UX.

**Delivers:** Durable calendarSyncQueue table, exponential-backoff worker, admin sync health panel, replacement of fire-and-forget GHL/GCal calls with enqueued jobs, GitHub Actions cron workflow.

**Implements:** calendar-sync-worker.ts (SELECT FOR UPDATE SKIP LOCKED), server/routes/calendar-sync.ts (health + retry endpoints), CalendarSyncHealthPanel.tsx.

**Avoids:** pgBouncer advisory lock incompatibility (row-level locking only), orphaned in_progress rows (single-transaction or stale-row reaper, mandatory), Vercel serverless cron failure (GH Actions workflow is a required deliverable in this phase).

**Research flag:** The row-level locking pattern is well-documented. The Vercel/GH Actions cron integration has an existing precedent in recurring-bookings-cron.yml. No additional research needed — but the plan must explicitly mandate the GH Actions workflow file and the orphan-reaper strategy before implementation begins.

### Phase Ordering Rationale

- SEED-029 first: schema already scaffolded, zero impact on booking handler, areaSizes UI pattern exists. De-risks migration and produces the duration snapshot that SEED-019 emails consume.
- SEED-019 second: email path is independent of sync queue. Establishing correct email triggers before the booking handler is refactored in Phase 3 reduces regression surface.
- SEED-002 last: swapping out GHL sync in server/routes/bookings.ts is the highest-risk change. Doing it after the other two phases are stable isolates that risk cleanly.
- All three phase migrations can be applied independently via Supabase CLI — no ordering constraint on DB migrations specifically.

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1 (SEED-029):** areaSizes card pattern, existing IStorage stubs, well-understood duration UX from Cal.com/Calendly research
- **Phase 2 (SEED-019):** Direct analogue to existing twilioSettings/integrationSettings pattern; Resend SDK is straightforward
- **Phase 3 (SEED-002):** SELECT FOR UPDATE SKIP LOCKED is well-documented; GH Actions cron pattern already exists in repo (recurring-bookings-cron.yml)

No phase requires /gsd:research-phase before planning. All technical unknowns are resolved.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library versions verified against npm registry and official GitHub releases as of 2026-05-11. Drizzle SKIP LOCKED bug confirmed via issue tracker; raw SQL workaround is safe regardless of exact version overlap. |
| Features | HIGH | Duration UX validated against Cal.com and Calendly official docs. Email timing and content validated against Apptoto and Booknetic. Retry queue observability patterns are MEDIUM — synthesized from BullMQ docs and practitioner sources. |
| Architecture | HIGH | Based on direct codebase inspection — file sizes, line numbers, and existing patterns all verified. Integration points are grounded in actual code. |
| Pitfalls | HIGH | pgBouncer advisory lock incompatibility verified against Supabase official docs and pgBouncer GitHub issues. CartContext totalDuration bug verified against codebase lines 222-225. Vercel serverless no-op verified against Vercel docs. |

**Overall confidence:** HIGH

### Gaps to Address

- **service_durations migration status:** The Supabase migration for serviceDurations may or may not be applied. Phase 1 plan must begin with supabase db status verification before any implementation code is written.
- **recurringBookings schema update:** Adding durationMinutes column requires a Supabase migration with a default value of the service catalog duration for existing rows. Must be explicit in the Phase 1 plan to prevent data loss.
- **react-email React 18 peer dep conflict:** react-email v6 lists React 19 as peer dep; project is on React 18.3.1. Works in practice but npm may warn. Phase 2 plan should note --legacy-peer-deps as the resolution. Do not upgrade to React 19 for this milestone.
- **GitHub Actions secret for cron endpoint:** Phase 3 requires INTERNAL_CRON_SECRET env var in both Vercel and GitHub Actions secrets. This is a deployment prerequisite — must be in the Phase 3 pre-flight checklist.

---

## Sources

### Primary (HIGH confidence)
- github.com/resend/resend-node/releases — resend SDK versions and API stability confirmed
- github.com/resend/react-email/releases — react-email v6 component consolidation confirmed
- react.email/docs/integrations/resend — import patterns, server-side render API
- resend.com/blog/react-email-6 — deprecation of @react-email/components confirmed
- cal.com/docs/core-features/event-types/multiple-durations — duration selector UX patterns
- calendly.com/help/how-to-set-up-multiple-durations-for-an-event-type — duration UX precedent
- supabase.com/docs/guides/database/connecting-to-postgres — pgBouncer transaction mode, advisory lock incompatibility
- vercel.com/docs/cron-jobs/manage-cron-jobs — serverless function lifecycle, no persistent process
- Codebase inspection: shared/schema.ts, server/storage.ts, server/db.ts, server/services/cron.ts, server/lib/email.ts, client/src/context/CartContext.tsx, server/services/recurring-booking-generator.ts, package.json

### Secondary (MEDIUM confidence)
- apptoto.com/best-practices/email-appointment-reminders — 24h reminder timing validation
- booknetic.com/blog/appointment-confirmation-email-best-practices — required email content checklist
- github.com/drizzle-team/drizzle-orm/issues/3554 — SKIP LOCKED query builder bug (fix merged, exact version overlap uncertain — raw SQL workaround used regardless)
- last9.io/blog/background-job-observability — admin health dashboard patterns for queue workers
- github.com/actions/runner/issues/764 — GH Actions cron duplicate-fire, idempotency requirement

---
*Research completed: 2026-05-11*
*Ready for roadmap: yes*
`;

fs.writeFileSync(dest, content, 'utf-8');
console.log('Written successfully, bytes:', fs.statSync(dest).size);
