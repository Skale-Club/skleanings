# Architecture Research

**Domain:** Booking platform — v5.0 Booking Experience milestone
**Researched:** 2026-05-11
**Confidence:** HIGH (based on direct codebase inspection)

---

## Existing Architecture Baseline

Before mapping new features, the current system structure:

```
shared/schema.ts              — single source of truth: Drizzle tables + Zod schemas + TS types
server/storage.ts             — IStorage interface + DatabaseStorage implementation (all DB I/O)
server/routes/                — domain-split Express routers (catalog, bookings, availability, staff...)
server/lib/                   — pure helpers (pricing, availability, email, booking-ghl-sync...)
server/services/              — stateful background services (cron, blog-generator, recurring-*)
server/integrations/          — thin wrappers for external APIs (ghl.ts, twilio, telegram)
server/lib/google-calendar.ts — Google Calendar OAuth + busy-time queries
client/src/pages/BookingPage.tsx — 5-step booking flow (39 KB monolith, step state via local state)
```

Key invariants to preserve:
- All DB queries go through `IStorage` — never raw SQL in routes
- Migrations via Supabase CLI only (`supabase migration new` + `supabase db push`) — never `drizzle-kit push`
- `shared/schema.ts` defines table + Drizzle type + Zod schema in one place
- Fire-and-forget pattern for any call that must not block the booking response (attribution, GHL sync)
- Admin pages use the existing sidebar layout and React Query patterns
- All enum-like values are plain `text` columns (not `pgEnum`) — established by `ghlSyncStatus`, `status` on bookings, `channel` on notificationLogs

---

## System Overview: v5.0 Changes

```
+----------------------------------------------------------------------+
|                          CLIENT (React 18)                           |
|                                                                      |
|  BookingPage.tsx (5-step flow)                                       |
|  +-- [NEW] Step 2.5: DurationSelector component                      |
|  |       renders when service has serviceDurations rows              |
|  |       sets selectedDurationMinutes + selectedDurationPrice        |
|  +-- Step 3: passes dynamic totalDurationMinutes to availability     |
|                                                                      |
|  Admin: ServicesSection.tsx                                          |
|  +-- [NEW] ServiceDurationsEditor sub-section (add/edit/delete)      |
|                                                                      |
|  Admin: [NEW] EmailSettingsSection.tsx                               |
|  +-- configure apiKey, fromAddress, enabled toggle                   |
|                                                                      |
|  Admin: [NEW] CalendarSyncHealthPanel.tsx                            |
|  +-- pending/failed counts per target + Retry button                 |
+----------------------------------------------------------------------+
                           | HTTP / React Query
+----------------------------------------------------------------------+
|                        SERVER (Express)                              |
|                                                                      |
|  server/routes/catalog.ts                                            |
|  +-- [MODIFIED] GET /api/services/:id includes durations[] in resp  |
|                                                                      |
|  server/routes/availability.ts                                       |
|  +-- [UNCHANGED] totalDurationMinutes already a query param         |
|      client sends chosen durationMinutes — no route change needed    |
|                                                                      |
|  server/routes/bookings.ts  (POST /)                                 |
|  +-- [MODIFIED] after booking saved:                                 |
|      - enqueue calendarSyncQueue rows instead of calling            |
|        syncBookingToGhl() directly                                   |
|      - call sendBookingConfirmationEmail() fire-and-forget           |
|                                                                      |
|  server/routes/[NEW] email-settings.ts                              |
|  +-- GET/PUT /api/admin/email-settings                               |
|                                                                      |
|  server/routes/[NEW] calendar-sync.ts                               |
|  +-- GET /api/admin/calendar-sync/health                            |
|      POST /api/admin/calendar-sync/:jobId/retry                     |
|                                                                      |
|  server/lib/booking-ghl-sync.ts                                      |
|  +-- [MODIFIED] extract pure executeSyncToGhl() for worker to call  |
|                                                                      |
|  server/lib/email.ts                                                 |
|  +-- [MODIFIED] replace nodemailer with Resend SDK (same signature) |
|                                                                      |
|  server/lib/email-templates.ts                                       |
|  +-- [MODIFIED] add 3 new booking email template functions          |
|                                                                      |
|  server/services/cron.ts                                             |
|  +-- [MODIFIED] add 1-min calendar sync worker tick                 |
|      add 24h-before email reminder scan (daily at 08:00 UTC)        |
|                                                                      |
|  server/services/[NEW] calendar-sync-worker.ts                      |
|  +-- SELECT FOR UPDATE SKIP LOCKED on calendarSyncQueue             |
|      processes pending rows, exponential backoff, marks status       |
+----------------------------------------------------------------------+
                           | Drizzle ORM
+----------------------------------------------------------------------+
|                       DATABASE (PostgreSQL)                          |
|                                                                      |
|  [EXISTING] serviceDurations  — already in schema.ts                |
|             IStorage methods declared but bodies may be unimplemented|
|             Supabase migration may or may not be applied yet         |
|                                                                      |
|  [NEW] emailSettings          — apiKey, fromAddress, enabled        |
|  [NEW] calendarSyncQueue      — retry queue for GCal + GHL jobs     |
+----------------------------------------------------------------------+
```

---

## Component-by-Component Integration Map

### SEED-029: Multiple Durations per Service

**Schema status:** `serviceDurations` table is already defined in `shared/schema.ts` (lines 111-118) with `insertServiceDurationSchema` and `ServiceDuration` / `InsertServiceDuration` types exported. The `IStorage` interface already declares all four methods (`getServiceDurations`, `createServiceDuration`, `updateServiceDuration`, `deleteServiceDuration`). The Supabase migration may not be applied yet — verify before writing any implementation code.

**Files modified:**

| File | Change |
|------|--------|
| `shared/schema.ts` | No schema change needed — table and schemas already exist |
| `supabase/migrations/` | New migration to `CREATE TABLE service_durations` if not yet applied |
| `server/storage.ts` | Implement the 4 already-declared `IStorage` methods (interface stubs exist, `DatabaseStorage` implementations likely missing) |
| `server/routes/catalog.ts` | `GET /api/services/:id` — join `serviceDurations` and include as `durations: ServiceDuration[]` in response |
| `client/src/pages/BookingPage.tsx` | Add duration selector step between service selection and calendar; pass `selectedDurationMinutes` to availability query and `selectedDurationPrice` to price total |
| `client/src/components/admin/ServicesSection.tsx` | Add "Available Durations" editor section (add/reorder/delete duration rows per service) |

**Data flow for booking with durations:**

```
Customer selects service
    -> BookingPage checks if service.durations.length > 0
    -> [YES] show DurationSelector step
              customer picks label (e.g. "4h — Medium house — $220")
              state: selectedDurationMinutes = 240, selectedDurationPrice = 220
    -> [NO]  use service.durationMinutes + service.price as before
    -> Step 3: GET /api/availability?totalDurationMinutes=240&...
    -> Step 5: POST /api/bookings { totalDurationMinutes: 240, totalPrice: "220.00" }
               (totalDurationMinutes and totalPrice already exist on bookings table)
```

No new API endpoints needed. `totalDurationMinutes` is already a parameter on the availability route and a column on `bookings`. The duration selection collapses to `totalDurationMinutes` + `price` before submission — `cartItemSchema` does not need a new field.

---

### SEED-019: Branded Transactional Email via Resend

**Current state:** `server/lib/email.ts` uses nodemailer with raw SMTP env vars. Templates in `server/lib/email-templates.ts` are plain HTML string functions (returns `{ subject, text, html }`). The `notificationLogs` table exists with a text `channel` column that already accepts arbitrary values. There is no `emailSettings` table yet.

**Files modified:**

| File | Change |
|------|--------|
| `shared/schema.ts` | Add `emailSettings` table (id, apiKey, fromAddress, enabled, createdAt, updatedAt) + insert schema + types |
| `supabase/migrations/` | New migration: `CREATE TABLE email_settings` |
| `server/storage.ts` | Add `getEmailSettings()`, `updateEmailSettings()` to IStorage + DatabaseStorage |
| `server/lib/email.ts` | Replace nodemailer transport with Resend SDK. Keep same `sendEmail(to, subject, text, html)` signature so all callers (recurring booking manage-link, reminders) are unchanged. Add `getResendClient()` that reads from `emailSettings` table, falls back to `RESEND_API_KEY` env var for local dev. |
| `server/lib/email-templates.ts` | Add `buildBookingConfirmationEmail()`, `build24hReminderEmail()`, `buildCancellationEmail()` functions. Keep existing `buildReminderEmail()` and `buildManageEmail()` unchanged. |
| `server/routes/email-settings.ts` | New file: `GET /api/admin/email-settings`, `PUT /api/admin/email-settings` |
| `server/routes/bookings.ts` | After `storage.createBooking()`: fire-and-forget `sendBookingConfirmationEmail(booking)` |
| `server/routes/bookings.ts` | On status change to `cancelled`: fire-and-forget `sendCancellationEmail(booking)` |
| `server/services/cron.ts` | Add daily cron at 08:00 UTC: scan bookings where `bookingDate = tomorrow` and status in confirmed/pending, send 24h reminder |
| `server/index.ts` | Mount `email-settings` router |
| `client/src/components/admin/EmailSettingsSection.tsx` | New file: API key input (masked), from address input, enabled toggle, test-send button |

**Resend vs nodemailer:** Resend requires only an API key — no SMTP host, port, or credentials. The key is stored in the `emailSettings` DB table (following the same pattern as `integrationSettings` for GHL). The `server/lib/email.ts` function signature stays identical so the existing manage-link and reminder callers in recurring bookings require zero changes.

**notificationLogs integration:** Email sends are logged to `notificationLogs` with `channel: 'email'`. The `trigger` field uses new values: `'booking_confirmed'`, `'appointment_reminder_24h'`, `'booking_cancelled'`. The `channel` column is `text` (not an enum), so no migration is needed to support the new channel value.

**Template approach:** Keep templates in `server/lib/email-templates.ts` as plain TypeScript string functions. React Email JSX requires server-side JSX compilation setup that is not justified for three templates. The existing `buildReminderEmail()` and `buildManageEmail()` functions establish this pattern and work correctly. Migrate to React Email only if template count grows significantly.

---

### SEED-002: Calendar Harmony Retry Queue

**Current state:** `syncBookingToGhl()` in `server/lib/booking-ghl-sync.ts` is called directly from the booking POST handler at line 226 of `server/routes/bookings.ts`. The result is logged but there is no retry. Google Calendar event creation happens inside staff availability helpers called at booking confirmation time. Neither sync path has durable retry.

**Files modified/created:**

| File | Change |
|------|--------|
| `shared/schema.ts` | Add `calendarSyncQueue` table (id, bookingId FK, target text, operation text, payload JSONB, status text, attempts int, lastAttemptAt timestamp, lastError text, scheduledFor timestamp, completedAt timestamp) + insert schema + types |
| `supabase/migrations/` | New migration: `CREATE TABLE calendar_sync_queue` with indexes on `(status, scheduled_for)` and `(booking_id, target)` |
| `server/storage.ts` | Add IStorage methods: `enqueueCalendarSync()`, `dequeueCalendarSyncJobs()` (SELECT FOR UPDATE SKIP LOCKED), `updateCalendarSyncJob()`, `getCalendarSyncHealth()`, `retryCalendarSyncJob()` |
| `server/routes/bookings.ts` | Replace `await syncBookingToGhl(booking)` call with: `await storage.enqueueCalendarSync(booking.id, 'ghl_contact', 'create', payload)` + `enqueueCalendarSync(booking.id, 'ghl_appointment', 'create', payload)` + `enqueueCalendarSync(booking.id, 'google_calendar', 'create', payload)`. Same pattern for booking update and cancel paths. |
| `server/lib/booking-ghl-sync.ts` | Extract pure `executeSyncToGhl(booking, settings)` function that the worker calls. Remove direct coupling to routes. |
| `server/services/calendar-sync-worker.ts` | New file. `runCalendarSyncWorker()`: dequeue up to N pending jobs with `scheduledFor <= now()`, mark `in_progress`, execute sync, mark `success` or compute next retry with exponential backoff, mark `failed_permanent` after 6 attempts. |
| `server/services/cron.ts` | Add 1-minute tick: `cron.schedule("* * * * *", runCalendarSyncWorker)` (non-serverless only). Add `POST /api/cron/calendar-sync` endpoint for GitHub Actions trigger in Vercel environment. |
| `server/routes/calendar-sync.ts` | New file: `GET /api/admin/calendar-sync/health` (pending/failed counts per target), `POST /api/admin/calendar-sync/:jobId/retry` (reset to pending, scheduledFor = now()) |
| `server/index.ts` | Mount `calendar-sync` router |
| `client/src/components/admin/CalendarSyncHealthPanel.tsx` | New file: table of targets with pending/failed counts, Retry button per failed job, auto-refresh every 30s via React Query |

**Worker design pattern:**

```typescript
// server/services/calendar-sync-worker.ts (sketch)
const BACKOFF_MINUTES = [1, 5, 30, 120, 720, 1440]; // 6 attempts max

export async function runCalendarSyncWorker(): Promise<void> {
  const jobs = await storage.dequeueCalendarSyncJobs(5); // SELECT FOR UPDATE SKIP LOCKED
  for (const job of jobs) {
    try {
      await executeJob(job); // dispatches to google-calendar.ts or booking-ghl-sync.ts
      await storage.updateCalendarSyncJob(job.id, {
        status: 'success',
        completedAt: new Date(),
      });
    } catch (err) {
      const nextAttempt = job.attempts + 1;
      const permanent = nextAttempt >= BACKOFF_MINUTES.length;
      const backoff = BACKOFF_MINUTES[Math.min(job.attempts, BACKOFF_MINUTES.length - 1)];
      await storage.updateCalendarSyncJob(job.id, {
        status: permanent ? 'failed_permanent' : 'pending',
        attempts: nextAttempt,
        lastError: String(err),
        scheduledFor: permanent ? null : new Date(Date.now() + backoff * 60_000),
        lastAttemptAt: new Date(),
      });
    }
  }
}
```

**Target enum values (text, not pgEnum):** `'google_calendar'`, `'ghl_contact'`, `'ghl_appointment'`, `'ghl_utm'`. Text column following existing precedent (`ghlSyncStatus`, booking `status`, notificationLogs `channel` are all plain text).

**Priority ordering:** Process `google_calendar` jobs before `ghl_*` jobs for the same booking — GCal is the operational calendar that shows on staff phones; GHL is CRM. Simplest approach: `ORDER BY CASE WHEN target = 'google_calendar' THEN 0 ELSE 1 END, scheduled_for ASC` in the dequeue query.

**Payload JSONB:** Store enough data to re-execute the sync without re-fetching everything: `{ bookingId, customerName, customerEmail, customerPhone, customerAddress, bookingDate, startTime, endTime, staffMemberId, utmSessionId }`. Worker can re-fetch from DB if needed — payload is an optimization, not the authority.

---

## Recommended Build Order

The three features have no cross-dependencies on each other, but each has internal step dependencies. Build order is driven by scope risk and independence.

### Phase A: Multiple Durations (SEED-029) — Build First

**Rationale:** Smallest scope. Schema already exists in `shared/schema.ts`. Does not touch `server/routes/bookings.ts` (the most complex file). Zero collision risk with the other two features. Delivers visible UX improvement immediately and de-risks the schema migration early.

Steps:
1. Verify `service_durations` migration status; create and apply Supabase migration if absent
2. Implement `getServiceDurations`, `createServiceDuration`, `updateServiceDuration`, `deleteServiceDuration` in `DatabaseStorage` (interface stubs exist, bodies are likely missing)
3. Modify `GET /api/services/:id` in `catalog.ts` to join and include `durations[]`
4. Build `ServiceDurationsEditor` in admin `ServicesSection.tsx`
5. Add duration selector step in `BookingPage.tsx`; wire `selectedDurationMinutes` to availability query and price total

### Phase B: Branded Email via Resend (SEED-019) — Build Second

**Rationale:** Standalone. The existing nodemailer scaffolding (`server/lib/email.ts`, `server/lib/email-templates.ts`) makes this a replacement + extension rather than greenfield. The 24h-reminder cron is independent of the sync worker cron. Should be done before SEED-002 so that if SEED-002 changes booking status flows, emails fire correctly from the start.

Steps:
1. Add `emailSettings` table to `shared/schema.ts` + Supabase migration
2. Add `getEmailSettings()` / `updateEmailSettings()` to IStorage + DatabaseStorage
3. Replace nodemailer in `server/lib/email.ts` with Resend SDK (keep same function signature)
4. Add `buildBookingConfirmationEmail()`, `build24hReminderEmail()`, `buildCancellationEmail()` to `server/lib/email-templates.ts`
5. Create `server/routes/email-settings.ts` (admin CRUD) and mount in `server/index.ts`
6. Wire confirmation email fire-and-forget in `server/routes/bookings.ts` POST handler
7. Wire cancellation email fire-and-forget in `server/routes/bookings.ts` on status change to cancelled
8. Add daily 08:00 UTC cron for 24h-reminder scan in `server/services/cron.ts`
9. Build `EmailSettingsSection.tsx` admin UI

### Phase C: Calendar Harmony Retry Queue (SEED-002) — Build Last

**Rationale:** Largest scope. Touches `server/routes/bookings.ts` (removing the direct GHL sync call) — do this only after Phase A and B are stable so the booking handler is not in flux during all three phases simultaneously. Building last means Phase A and B bookings already work; Phase C then hardens reliability without touching UX.

Steps:
1. Add `calendarSyncQueue` table to `shared/schema.ts` + Supabase migration (with compound indexes)
2. Add IStorage methods for queue operations (`enqueue`, `dequeue` with SKIP LOCKED, `update`, `health`, `retry`)
3. Build `server/services/calendar-sync-worker.ts` with the SELECT FOR UPDATE SKIP LOCKED pattern
4. Create `server/routes/calendar-sync.ts` (health + retry endpoints) and mount in `server/index.ts`
5. Refactor `server/lib/booking-ghl-sync.ts`: extract `executeSyncToGhl()` pure function used by worker
6. Modify `server/routes/bookings.ts`: replace direct `syncBookingToGhl()` call with `enqueueCalendarSync()` calls for all three targets (google_calendar, ghl_contact, ghl_appointment)
7. Wire booking update and cancel paths to enqueue update/delete operations
8. Add 1-min worker tick in `server/services/cron.ts` + `POST /api/cron/calendar-sync` endpoint for Vercel
9. Build `CalendarSyncHealthPanel.tsx` admin UI

---

## Data Flow Diagrams

### Duration Selection Flow

```
BookingPage Step 2 (service selected)
    -> GET /api/services/:id  (includes durations[])
    -> durations.length > 0?
       [YES] -> Step 2.5: DurationSelector
                  customer picks -> selectedDurationMinutes=240, selectedDurationPrice=220
       [NO]  -> use service.durationMinutes, service.price
    -> Step 3: GET /api/availability?totalDurationMinutes=240&...  (no route change)
    -> Step 5: POST /api/bookings { totalDurationMinutes: 240, totalPrice: "220.00" }
               (both fields already exist on bookings table)
```

### Email Trigger Flow

```
POST /api/bookings -> booking created
    -> fire-and-forget: sendBookingConfirmationEmail(booking)
        -> storage.getEmailSettings() -> Resend API
        -> logNotification({ channel: 'email', trigger: 'booking_confirmed' })

Daily cron 08:00 UTC
    -> scan bookings WHERE bookingDate = tomorrow AND status IN ('confirmed','pending')
    -> for each: send24hReminderEmail(booking)
        -> logNotification({ channel: 'email', trigger: 'appointment_reminder_24h' })

PATCH /api/bookings/:id (status -> 'cancelled')
    -> fire-and-forget: sendCancellationEmail(booking)
        -> logNotification({ channel: 'email', trigger: 'booking_cancelled' })
```

### Calendar Sync Queue Flow

```
POST /api/bookings -> booking created
    -> storage.enqueueCalendarSync(bookingId, 'google_calendar', 'create', payload)
    -> storage.enqueueCalendarSync(bookingId, 'ghl_contact', 'create', payload)
    -> storage.enqueueCalendarSync(bookingId, 'ghl_appointment', 'create', payload)
    -> response returned immediately (no sync latency in booking flow)

Every 1 minute (node-cron in non-Vercel, or GitHub Actions -> POST /api/cron/calendar-sync)
    -> calendar-sync-worker.runCalendarSyncWorker()
        -> SELECT FOR UPDATE SKIP LOCKED WHERE status='pending' AND scheduledFor<=now()
           ORDER BY CASE WHEN target='google_calendar' THEN 0 ELSE 1 END, scheduled_for
        -> process up to 5 jobs
           [google_calendar]  -> google-calendar.ts: createEvent()
           [ghl_contact]      -> booking-ghl-sync.ts: executeSyncToGhl() contact step
           [ghl_appointment]  -> booking-ghl-sync.ts: executeSyncToGhl() appointment step
        -> success: status='success', completedAt=now()
        -> fail:    status='pending', scheduledFor=now()+backoff (or 'failed_permanent' after 6)

Admin -> GET /api/admin/calendar-sync/health
    -> counts by (target, status) from calendarSyncQueue
    -> POST /api/admin/calendar-sync/:jobId/retry -> reset status='pending', scheduledFor=now()
```

---

## Files: New vs Modified Summary

### New Files

| File | Feature |
|------|---------|
| `server/routes/email-settings.ts` | SEED-019 |
| `server/routes/calendar-sync.ts` | SEED-002 |
| `server/services/calendar-sync-worker.ts` | SEED-002 |
| `client/src/components/admin/EmailSettingsSection.tsx` | SEED-019 |
| `client/src/components/admin/CalendarSyncHealthPanel.tsx` | SEED-002 |
| `supabase/migrations/*_add_email_settings.sql` | SEED-019 |
| `supabase/migrations/*_add_calendar_sync_queue.sql` | SEED-002 |
| `supabase/migrations/*_add_service_durations.sql` | SEED-029 (if not yet applied) |

### Modified Files

| File | Feature | Change |
|------|---------|--------|
| `shared/schema.ts` | SEED-019, SEED-002 | Add emailSettings + calendarSyncQueue tables, schemas, types |
| `server/storage.ts` | All three | Implement serviceDuration method bodies; add emailSettings + calendarSyncQueue methods |
| `server/lib/email.ts` | SEED-019 | Replace nodemailer with Resend SDK (same function signature) |
| `server/lib/email-templates.ts` | SEED-019 | Add 3 new template functions |
| `server/lib/booking-ghl-sync.ts` | SEED-002 | Extract `executeSyncToGhl()` pure function; remove route coupling |
| `server/routes/catalog.ts` | SEED-029 | Include durations[] in service GET response |
| `server/routes/bookings.ts` | SEED-019, SEED-002 | Add email fire-and-forget; replace direct GHL sync with enqueue |
| `server/services/cron.ts` | SEED-019, SEED-002 | Add 24h reminder scan + 1-min sync worker tick |
| `client/src/pages/BookingPage.tsx` | SEED-029 | Add duration selector step |
| `client/src/components/admin/ServicesSection.tsx` | SEED-029 | Add durations editor sub-section |
| `server/index.ts` | SEED-019, SEED-002 | Mount new route modules |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Leaving the Direct syncBookingToGhl() Call Alongside the Queue

**What people do:** Keep `syncBookingToGhl()` as a "fast path" fallback while also enqueueing.
**Why it's wrong:** Creates duplicate sync — both immediate (failing silently) and queued. Race conditions on `ghlAppointmentId` writes. Two sources of truth for sync state.
**Do this instead:** Remove the direct call entirely on the same commit that adds enqueue. The queue is the only sync path after SEED-002.

### Anti-Pattern 2: Storing Resend API Key Only in Env Vars

**What people do:** Skip the `emailSettings` table and read `RESEND_API_KEY` from env.
**Why it's wrong:** White-label requirement — admin must be able to configure sending without a code deploy. Env-only also breaks the admin UI pattern established by `integrationSettings` (GHL) and `twilioSettings`.
**Do this instead:** Store in `emailSettings` table. Fall back to `RESEND_API_KEY` env var for local dev only — the same graceful fallback pattern used by `server/lib/email.ts` with `EMAIL_HOST`.

### Anti-Pattern 3: Using pgEnum for calendarSyncQueue Status or Target

**What people do:** Define `target` and `status` as pgEnum to enforce values at DB level.
**Why it's wrong:** Adding a new target (e.g. a future integration) requires a DB migration just to add an enum value. The existing codebase uses plain text for all enum-like values (`ghlSyncStatus`, booking `status`, `channel` on notificationLogs).
**Do this instead:** Text columns with TypeScript union types defined in `shared/schema.ts`. Pattern is established throughout the codebase.

### Anti-Pattern 4: Blocking the Booking Response on Email

**What people do:** `await sendBookingConfirmationEmail(booking)` inline in the POST handler.
**Why it's wrong:** Resend API latency (100-500ms) adds directly to booking response time. If Resend is down, bookings fail. The booking flow must never be blocked by secondary notifications.
**Do this instead:** `void sendBookingConfirmationEmail(booking).catch(err => console.error('[Email]', err))` — fire-and-forget, same pattern as the existing Twilio and Telegram notifications in `server/routes/bookings.ts`.

### Anti-Pattern 5: React Email JSX Templates

**What people do:** Install `@react-email/components` and write templates as `.tsx` files compiled server-side.
**Why it's wrong:** Requires server-side JSX rendering configuration in esbuild, adds a non-trivial build dependency, and is not justified for three templates. The existing `buildReminderEmail()` and `buildManageEmail()` functions in `server/lib/email-templates.ts` are plain TypeScript returning `{ subject, text, html }` and work correctly.
**Do this instead:** Add the three new booking template functions to `server/lib/email-templates.ts` using the same plain HTML string pattern. Migrate to React Email only if template count grows to 10+.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Resend | `resend` npm SDK + `emailSettings` DB singleton | Replaces nodemailer; keep `sendEmail()` function signature |
| GoHighLevel | Existing `server/integrations/ghl.ts` | SEED-002 calls via worker, not directly from routes |
| Google Calendar | Existing `server/lib/google-calendar.ts` | SEED-002 calls via worker for GCal event creation |
| Supabase | `supabase migration new` + `supabase db push` | Never `drizzle-kit push` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `routes/bookings.ts` -> `calendarSyncQueue` | `storage.enqueueCalendarSync()` | Replaces direct `syncBookingToGhl()` call |
| `calendar-sync-worker` -> `booking-ghl-sync.ts` | Direct function call `executeSyncToGhl()` | Worker owns retry logic; sync lib owns HTTP calls |
| `calendar-sync-worker` -> `google-calendar.ts` | Direct function call | Same pattern as above |
| `routes/bookings.ts` -> `email-resend.ts` | Fire-and-forget async call | Same pattern as current Twilio/Telegram notifications |
| Admin `CalendarSyncHealthPanel` -> `routes/calendar-sync.ts` | React Query GET + POST | Standard admin query pattern with 30s refetchInterval |
| Admin `EmailSettingsSection` -> `routes/email-settings.ts` | React Query GET + useMutation PUT | Standard admin settings pattern matching twilioSettings |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (single tenant, under 500 bookings/month) | All three features as described — monolith is correct |
| 10 tenants (Xkedule SaaS) | `calendarSyncQueue` needs `tenantId` FK; `emailSettings` needs `tenantId`; worker runs once and processes all tenants |
| 100+ tenants | Worker needs per-tenant concurrency limits; consider pg-boss for queue management instead of manual SELECT FOR UPDATE |

The SELECT FOR UPDATE SKIP LOCKED pattern is production-grade for this scale. pg-boss adds value only when queue depth regularly exceeds ~1000 rows or multi-worker fan-out is needed.

---

*Architecture research for: Skleanings v5.0 Booking Experience (SEED-029 + SEED-019 + SEED-002)*
*Researched: 2026-05-11*
