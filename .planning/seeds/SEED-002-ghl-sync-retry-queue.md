---
id: SEED-002
status: dormant
planted: 2026-05-10
last_revised: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when implementing Xkedule's bookings module — calendar harmony must be ready before the second tenant
scope: Large
---

# SEED-002: Calendar Harmony — robust sync with Google Calendar (prio 1) + GHL (prio 2)

## Why This Matters

Xkedule will have at least two external calendar systems that must stay in sync with internal bookings:

1. **Google Calendar** (priority 1) — the personal source of truth for each staff member. It's where the person tracks their own appointments, and where every confirmed booking must appear so the team sees their schedule on their phone.
2. **GoHighLevel** (priority 2) — the company CRM. Must receive the contact and the appointment so the sales/ops team sees pipeline and can act on post-sale.

Today:
- Google Calendar sync exists but fails silently in some cases (expired token, calendar disconnect)
- GHL sync is fire-and-forget (void IIFE) — if the API is slow or rate-limited, the record is lost with no retry

**Core problem:** the three systems (internal DB, Google Calendar, GHL) must stay consistent. Without that, staff appears in one place and not the other, customer is confirmed but missing from CRM, or internal calendar shows availability that Google Calendar says is busy.

**Why:** Calendar harmony isn't just "GHL retry" — it's the unified system that guarantees the three calendars (internal, Google, GHL) stay consistent even with temporary failures.

## When to Surface

**Trigger:** when implementing Xkedule's bookings module (together with SEED-013 multi-tenant), or when the first "booking confirmed but didn't show up in Google Calendar/GHL" report comes in.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Xkedule SaaS milestone (together with SEED-013)
- Calendar / scheduling robustness milestone
- External integrations milestone

## Scope Estimate

**Large** — A substantial phase. Components:

1. **Schema:**
   - `calendarSyncQueue` table (id, bookingId FK, target enum (`google_calendar` | `ghl_appointment` | `ghl_contact` | `ghl_utm`), operation enum (`create` | `update` | `delete`), payload JSONB, status (`pending` | `in_progress` | `success` | `failed_retryable` | `failed_permanent`), attempts, lastAttemptAt, lastError, scheduledFor, completedAt)
   - Reuse existing fields in `bookings`: `ghlSyncStatus`, `ghlAppointmentId`, `ghlContactId`

2. **Backend:**
   - Worker (cron every 1min via GH Actions or node-cron) that picks `pending` rows with `scheduledFor <= now()`, marks `in_progress`, processes
   - Exponential backoff: 1min → 5min → 30min → 2h → 12h → 24h → mark permanent failed
   - Idempotency: use `ghlAppointmentId` / Google `eventId` as key; if already exists, don't recreate
   - Both sync paths consolidated in one worker (Google + GHL) to enforce ordering: Google first (prio 1), then GHL (prio 2)

3. **Conflict resolution:**
   - When booking is edited/cancelled, enqueue update/delete in both calendars
   - Pessimistic lock per (bookingId, target) to prevent race conditions

4. **Admin observability:**
   - "Calendar sync health" panel in tenant admin: counter of pending/failed jobs per target
   - "Retry now" button to force manual reprocessing of a specific booking
   - Visual alert when a booking has failed_permanent sync

## Breadcrumbs

- `server/integrations/ghl.ts` — current retry logic (3 attempts) — becomes the consumer called by the worker
- `server/lib/google-calendar/` — current Google Calendar sync
- `server/routes.ts` — booking creation/update endpoints — replace synchronous calls with enqueue to `calendarSyncQueue`
- `shared/schema.ts` — `ghlSyncStatus`, `ghlAppointmentId`, `ghlContactId` fields in `bookings` — source of truth for last successful sync status
- Worker pattern: pg-boss or manual implementation with `SELECT ... FOR UPDATE SKIP LOCKED`

## Notes

**Priority Google > GHL:** when processing the queue, Google Calendar jobs run BEFORE GHL jobs for the same booking. Reason: Google Calendar is what shows on the phone of the staff who will execute the service — a failure here is an immediate operational problem. GHL is CRM — a failure is a sales pipeline problem, less urgent.

**Reconnect flow:** when Google token expires or GHL changes credentials, all jobs for that tenant enter `failed_retryable` in a loop. Worker detects the pattern (>10 consecutive failures from the same target/tenant) and marks `connection.needs_reconnect = true` — admin sees a "reconnect Google Calendar/GHL" banner in admin.

**Don't use pg-boss to start:** simple worker with `SELECT ... FOR UPDATE SKIP LOCKED` in 1min cron is enough for initial volume. Migrate to pg-boss if it becomes a bottleneck.
