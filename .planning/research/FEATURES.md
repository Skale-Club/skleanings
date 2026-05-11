# Feature Research

**Domain:** Service booking platform — cleaning company (Booking Experience v5.0)
**Researched:** 2026-05-11
**Confidence:** HIGH (duration UX and email timing validated against Cal.com, Calendly, Apptoto, Booknetic official sources); MEDIUM (retry queue admin observability — synthesized from pg-boss, BullMQ, and practitioner sources)

---

## Scope of This Research

This file covers three features being added to an existing v4.0 platform. Each feature has its own table-stakes / differentiators / anti-features breakdown. The existing platform already has: custom booking questions per service, recurring subscriptions with 48h reminders (Nodemailer SMTP), staff availability, manual confirmation flow, GoHighLevel CRM integration (fire-and-forget), and Google Calendar sync (silent-fail).

---

## Feature 1: Multiple Durations Per Service (SEED-029)

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Duration selector appears before calendar | Cal.com and Calendly both surface duration before the time picker — the selected duration determines which slots are valid; showing slots before duration is logically wrong | LOW | Must appear at the step after service selection and before slot calendar in BookingPage.tsx |
| Each duration has its own price | "4h clean" and "2h clean" at the same price would feel broken; customers inherently expect more time = more money | LOW | Already planned in `serviceDurations.price`; mirrors the existing `areaSizes` pattern on the platform |
| Duration affects available time slots | A 4h service cannot be booked in a 2h slot; slot availability must be recomputed from the chosen duration | MEDIUM | `getAvailableSlots` must receive dynamic `durationMinutes` from the selected duration; existing multi-slot staff availability logic handles variable durations already |
| Default duration pre-selected | If a customer arrives at the calendar without selecting a duration, a sensible default must already be active — no blank or broken state | LOW | Calendly defaults to the configured default duration; platform must mirror this; use the first (lowest-order) `serviceDuration` as default |
| Duration label visible in booking summary | Confirmation step and order summary must show the chosen duration label alongside price — "Deep Clean 4h — $280" not just "Deep Clean" | LOW | Requires duration label stored at booking creation time on `bookingItems` |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Card-based selector (not dropdown) | Cards showing "Studio — 2h — $150 / 3BR — 4h — $280 / Large House — 8h — $480" communicate value and help customers self-select better than a dropdown listing "120min / 240min / 480min" | LOW | Calendly uses a dropdown (functional but cold); the platform already uses this card pattern for `areaSizes` — reuse it exactly; no new UI component needed |
| Optional description text per duration | "Ideal for apartments up to 60m²" under the 2h card helps customers match their space without calling — reduces booking mistakes | LOW | Add optional `description` column to `serviceDurations` table; display under the price; admin can leave empty |
| Duration label in email confirmation | "Your 4h Deep Clean is confirmed for Tuesday 3pm" reinforces the customer's choice post-booking | LOW | Natural output of storing duration label on `bookingItems`; feeds SEED-019 email templates |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-suggest duration from a booking question answer | "Based on your 3-bedroom home, we recommend 4h" | Creates hard coupling between custom booking questions (SEED-027, already shipped) and duration selection; mapping rules have edge cases; changes to questions break the suggestion; maintenance cost disproportionate to value | Name durations descriptively enough ("3 Bedrooms — 4h") that customers self-select correctly without automation |
| Customer types an arbitrary duration | Maximum flexibility | Scheduling chaos — slots, pricing, and staff planning all depend on predictable durations; any minute value breaks availability computation | Admin defines the allowed list; customer picks from it |
| Changing duration after slot is selected | Convenience | Invalidates the slot (a 2h slot cannot accommodate 4h); requires resetting and re-rendering the calendar step | Force customer back to duration step when they change selection; re-selecting duration resets slot picker — make this explicit with a visible "Change" link on the summary |

---

## Feature 2: Branded Transactional Email via Resend (SEED-019)

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Immediate booking confirmation email (sent < 60s of booking) | Industry standard — every booking platform sends this; absence creates customer anxiety about whether the transaction went through | MEDIUM | Trigger on booking creation (or status change from `awaiting_approval` to `confirmed`); synchronous call or immediate enqueue |
| 24h-before reminder email | Reduces no-shows by ~30% (industry data); customers expect it from any professional service business | MEDIUM | Cron job checking bookings where `scheduledFor` is between now+23h and now+25h; send once, mark as sent |
| Cancellation notice (immediate) | When a booking is cancelled by admin or customer, they need written confirmation and clarity on refund status | LOW | Triggered on booking status change to `cancelled`; include original booking details and refund info |
| Tenant brand in every email | Logo, company name, colors — white-label requirement; showing a competitor's brand in a tenant's email is a product failure | MEDIUM | Pull `companySettings.logoMain`, `companyName`, `primaryColor` at send time — never hardcode any brand value |
| From address matching tenant domain | `no-reply@acme-cleaners.com` vs `no-reply@app.com` — professional credibility is materially different; DNS verification required | MEDIUM | Resend handles domain verification; expose `fromAddress` and `fromName` in admin email settings panel |
| Required content in every email: date, time, address, service name, booking reference | Customer's first action after receiving the email is to verify these details; missing any of them is a UX failure | LOW | Map directly from `bookings` + `bookingItems` + `companySettings`; all fields already exist |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Duration label in confirmation body | "Your 4h Deep Clean is confirmed" is more meaningful than "Your service is confirmed" | LOW | Requires duration label stored on `bookingItems` at booking creation (feeds from SEED-029); design `bookingItems` to hold this now even if SEED-029 ships first |
| Branded color in email header | Platform primary color (`#1C53A3` or tenant-configured) as a header accent bar or button color — visual consistency with booking site | LOW | React Email supports inline styles from variables; pull `companySettings.primaryColor`; fallback to `#1C53A3` if unset |
| Add-to-calendar link (ICS or Google Calendar deep link) | One-click calendar save reduces missed appointments; customers expect it from professional services | MEDIUM | Generate ICS payload from booking data; serve as a `/api/bookings/:id/ics` endpoint; link in email; Google Calendar deep link is simpler but less universal |
| Resend delivery webhook logged to `notificationLogs` | Platform already has `notificationLogs` for SMS/Telegram — email adds `channel: 'email'` row with delivery status | LOW | Resend sends webhooks on `delivered` / `bounced` / `complained`; store status; admin can see delivery receipts |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Admin-editable email body (rich text / WYSIWYG editor) | "We want to customize the message" | Custom HTML in DB is a support nightmare; broken tags corrupt every send; template drift causes brand inconsistency; i18n becomes impossible when admins edit HTML directly | Admin controls from-address, logo, colors, company name, and optionally a short custom note field (plain text, max 200 chars) — template structure is maintained in code |
| Marketing / promotional content inside transactional emails | "Add our spring promo in the confirmation" | Violates CAN-SPAM / GDPR distinction between transactional and commercial emails; can trigger spam filters and damage deliverability of all transactional mail | Separate marketing email campaign via dedicated send path with explicit consent; never piggyback on transactional sends |
| SMS + email sent in the same transaction | "Send both at once" | Existing Twilio SMS is fire-and-forget; coupling SMS failure to email delivery means a Twilio outage blocks email | Keep channels independent; enqueue separately; each has its own failure mode |
| 48h reminder for one-off bookings in addition to 24h | More reminders = fewer no-shows | Platform already sends 48h reminders for recurring subscriptions (RECUR-04); adding 48h for one-off bookings doubles cron complexity; customers with short-notice bookings (booked same-day) would receive both reminders within hours | 24h reminder for one-off bookings; 48h for recurring (already exists); different cadences for different booking types |
| Email open / click tracking in MVP | Deliverability metrics sound important | Tracking pixels and link rewrites break in some email clients (Apple Mail Privacy Protection blocks pixel tracking); adds complexity without clear action | Resend dashboard shows delivery and bounce status — sufficient for v1; detailed analytics are v2 |

---

## Feature 3: Calendar Harmony Retry Queue (SEED-002)

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sync failures are automatically retried | Any booking platform with external calendar sync is expected to be resilient to transient API errors; silent failure is worse than no sync at all | MEDIUM | Exponential backoff: 1min → 5min → 30min → 2h → 12h → 24h → `failed_permanent`; implemented via node-cron + `SELECT FOR UPDATE SKIP LOCKED` on `calendarSyncQueue` |
| Admin can see sync status per booking | Admin must know "did this booking sync to Google Calendar and GHL?" — especially critical for the manual confirmation flow where timing matters operationally | LOW | Status badge on booking detail: Pending / Synced / Failed; one row per target (Google, GHL) |
| Admin can manually retry a failed sync | When a token expires and is reconnected, admin must be able to force re-sync without recreating the booking | LOW | "Retry Sync" button on booking detail (or in sync health panel); sets status back to `pending`, resets `attempts`, `scheduledFor = now()` |
| `failed_permanent` jobs surfaced clearly | Permanent failures must not be invisible; admin must know they require intervention | LOW | Red badge or count on admin nav or booking card; permanent failures require human action (token reconnect, etc.) |
| Google Calendar sync runs before GHL sync | Google Calendar is operational (staff sees schedule on their phone); GHL is CRM (sales pipeline); operational failure is more urgent than sales pipeline failure | LOW | Worker processes Google jobs before GHL for the same `bookingId`; ordering enforced in query |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Connection health banner ("Reconnect Google Calendar") | When 10+ consecutive failures occur from the same target, surface a persistent admin banner — not just an obscure failed-job count | MEDIUM | Detect N consecutive failures from same tenant+target; set a `connectionHealth` flag; admin UI reads this flag and renders a dismissible banner with reconnect link |
| Sync health dashboard panel | Gives admin visibility into queue state (pending / in_progress / success / failed / permanent counts by target) without writing SQL | MEDIUM | Simple aggregate counts by `status` and `target`; table of recent failures with error message and last attempt time; "Retry all failed" bulk action |
| Idempotent sync (update not recreate) | If `ghlAppointmentId` or Google `eventId` already exists, update instead of creating a duplicate — prevents double-entries in external calendars | LOW | Check for existing IDs before create; use update/patch if ID exists; critical for reliability |
| `SELECT FOR UPDATE SKIP LOCKED` worker | Deadlock-free, multi-worker-safe job pickup without Redis or external queue dependency | LOW | Leverages existing PostgreSQL — no new infrastructure; well-established pattern used by pg-boss, Solid Queue, and others |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time sync (sub-second, webhook-driven) | "We want calendar changes to appear instantly" | External webhooks from GHL/Google into the platform require public endpoints, signature verification, and replay protection — significant complexity; 1-min cron gives < 2min sync which is sufficient for cleaning bookings | Enqueue on booking write + 1-min cron = effectively real-time for this use case |
| Full two-way sync (external changes reflected back in DB) | "If I edit in Google Calendar, update the booking" | Conflict resolution, last-writer-wins logic, field mapping from external calendar events back to booking schema — scope is 5x the current feature; creates circular update loops | One-way sync (internal → external) is correct for v1; external edits go through the admin panel |
| pg-boss from day one | Feature-rich queue with retries, concurrency, DLQs built in | Adds a new dependency; for < 100 sync jobs/day, manual `SELECT FOR UPDATE SKIP LOCKED` in node-cron is simpler, transparent, already on-stack | Start with native PostgreSQL pattern; migrate to pg-boss only if throughput becomes a measurable bottleneck |
| Per-job failure notification (email/SMS to admin) | "Alert me when a sync job fails" | At < 100 jobs/day, per-job alerts create noise; a token expiry causes 50 consecutive failures — admin receives 50 notifications | Admin health dashboard + connection health banner surface the signal; per-job notification is a v3 feature |
| Separate worker process / microservice | "Better separation of concerns" | Two processes to deploy, monitor, and restart; for single-tenant at current scale, node-cron inside the Express process is battle-tested | Keep worker in same process; externalize only when scale genuinely requires it |

---

## Feature Dependencies

```
[Duration Selection (SEED-029)]
    └──feeds──> [Branded Email (SEED-019)]
                    (duration label enriches confirmation email body)

[Duration Selection (SEED-029)]
    └──requires──> [bookingItems schema update]
                       (duration label + durationMinutes stored as snapshot at booking creation)

[Duration Selection (SEED-029)]
    └──requires──> [getAvailableSlots route update]
                       (must accept dynamic durationMinutes from chosen duration)

[Branded Email (SEED-019)]
    └──depends on──> [companySettings: logoMain, companyName, primaryColor]
                         (already exists — no new schema required)

[Branded Email (SEED-019)]
    └──coexists with──> [Existing 48h recurring reminder (RECUR-04)]
                            (different trigger, different template, different cron — not the same code path)

[Calendar Harmony (SEED-002)]
    └──replaces──> [Fire-and-forget GHL sync in routes.ts]
    └──replaces──> [Silent-fail Google Calendar sync in server/lib/google-calendar/]
    └──requires──> [calendarSyncQueue table — new schema]

[Calendar Harmony (SEED-002)]
    └──feeds──> [Admin sync health panel]
                    (aggregate queries over calendarSyncQueue by status + target)
```

### Dependency Notes

- **SEED-029 feeds SEED-019:** Duration label must be stored in `bookingItems` at booking creation so email templates can read it. Build SEED-029 first, or design `bookingItems` to accept a nullable `durationLabel` column from the start so SEED-019 can be built independently.
- **SEED-029 requires slot recomputation:** `getAvailableSlots` must accept a `durationMinutes` parameter from the selected service duration. This is a breaking change to the availability endpoint signature — coordinate with any existing callers.
- **SEED-002 is a replacement, not an addition:** The existing fire-and-forget GHL call in routes and the silent-fail Google Calendar call must be removed and replaced by `enqueueSync()`. This is a migration of existing behavior, not purely new code. Risk of regression if not tested against both create, update, and cancel booking flows.
- **SEED-019 does NOT depend on SEED-002:** Emails are sent via Resend (HTTP), not via the calendar sync queue. Email failures are handled by Resend's own delivery retry — they are a different system. Do not route email through `calendarSyncQueue`.

---

## MVP Definition

### Launch With (v5.0 — all three seeds)

- [ ] Duration cards in booking flow with label, price, durationMinutes — SEED-029
- [ ] Default duration pre-selected (lowest order `serviceDuration`) — SEED-029
- [ ] Duration stored as snapshot in `bookingItems` (label + durationMinutes) — SEED-029
- [ ] Slot availability recomputed from selected duration — SEED-029
- [ ] Admin service edit UI: "Available Durations" CRUD section — SEED-029
- [ ] Booking confirmation email via Resend (immediate, branded, required content) — SEED-019
- [ ] 24h-before reminder email via cron — SEED-019
- [ ] Cancellation notice email triggered on status change — SEED-019
- [ ] `emailSettings` table with apiKey, fromAddress, fromName, enabled — SEED-019
- [ ] Admin email settings panel (configure from address, enable/disable) — SEED-019
- [ ] `calendarSyncQueue` table + worker with exponential backoff — SEED-002
- [ ] Enqueue on booking create / update / cancel (replaces fire-and-forget) — SEED-002
- [ ] Admin sync health panel: counts by status, recent failures table, retry button — SEED-002

### Add After Validation (v5.x)

- [ ] Add-to-calendar ICS link in confirmation email — add when customers ask
- [ ] Duration description text on cards — add when admin requests descriptive labels
- [ ] Connection health banner (reconnect warning) — add after first expired-token incident
- [ ] Resend webhook → `notificationLogs` — add after email volume warrants tracking

### Future Consideration (v2+)

- [ ] Admin-configurable plain-text custom note in emails — low value, design carefully to avoid HTML injection
- [ ] Per-job failure notification (email/SMS to admin) — alert fatigue risk at current scale
- [ ] pg-boss migration — only if cron worker becomes a measured bottleneck
- [ ] Two-way calendar sync — entirely different scope; validate one-way first

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Duration cards with price (SEED-029) | HIGH | LOW | P1 |
| Slot recompute from selected duration (SEED-029) | HIGH | MEDIUM | P1 |
| Duration snapshot in bookingItems (SEED-029) | HIGH | LOW | P1 |
| Admin service edit — durations CRUD (SEED-029) | HIGH | LOW | P1 |
| Booking confirmation email (SEED-019) | HIGH | MEDIUM | P1 |
| 24h reminder email (SEED-019) | HIGH | MEDIUM | P1 |
| Cancellation notice email (SEED-019) | MEDIUM | LOW | P1 |
| emailSettings table + admin panel (SEED-019) | HIGH | LOW | P1 |
| Calendar sync retry queue + worker (SEED-002) | HIGH | MEDIUM | P1 |
| Admin sync health panel (SEED-002) | MEDIUM | LOW | P1 |
| Branded color in email header (SEED-019) | MEDIUM | LOW | P1 |
| Connection health banner (SEED-002) | MEDIUM | MEDIUM | P2 |
| Add-to-calendar ICS link (SEED-019) | MEDIUM | MEDIUM | P2 |
| Duration description text on cards (SEED-029) | LOW | LOW | P2 |
| Resend webhook → notificationLogs (SEED-019) | LOW | LOW | P2 |

---

## Competitor Feature Analysis

| Feature | Cal.com | Calendly | Our Approach |
|---------|---------|---------|--------------|
| Duration selector position | Before calendar (step 1 of booking) | Below event name, dropdown, before time picker | Cards before calendar — step 2 of BookingPage (after service selection, before slot picker) |
| Duration UI pattern | Buttons / pills | Dropdown with clock icon | Selection cards with label + duration + price — reuse existing `areaSizes` card component |
| Email provider | Pluggable (SMTP, SendGrid, etc.) | Managed (Calendly's own infra) | Resend with React Email templates; tenant provides from-address after DNS verification |
| Transactional email branding | Workspace logo + name | Event-type colors | Full tenant brand: logo, name, primary color from `companySettings` |
| Calendar sync failures | Visible in dashboard with reconnect prompt | Reconnect alert in integrations tab | Admin sync health panel + connection health banner; `failed_permanent` badge on booking detail |
| Retry mechanism | Not publicly documented | Not publicly documented | `SELECT FOR UPDATE SKIP LOCKED` with exponential backoff in node-cron; no Redis required |
| Sync priority | N/A | N/A | Google Calendar before GHL for same bookingId (operational > CRM urgency) |

---

## Sources

- [Cal.com — Multiple Durations docs](https://cal.com/docs/core-features/event-types/multiple-durations) — HIGH confidence; official Cal.com documentation
- [Calendly — Multiple Durations help](https://calendly.com/help/how-to-set-up-multiple-durations-for-an-event-type) — HIGH confidence; official Calendly documentation
- [Apptoto — Appointment Reminder Email Best Practices](https://www.apptoto.com/best-practices/email-appointment-reminders) — HIGH confidence; authoritative scheduling tool practitioner
- [Booknetic — Appointment Confirmation Email Best Practices](https://www.booknetic.com/blog/appointment-confirmation-email-best-practices) — MEDIUM confidence; booking software practitioner
- [Xola — Booking Confirmation Best Practices](https://www.xola.com/articles/booking-confirmation-best-practices-email-sms-and-timing-for-tour-operators/) — MEDIUM confidence; booking platform practitioner
- [Moosend — Cancellation Email Best Practices](https://moosend.com/blog/cancellation-emails/) — MEDIUM confidence; email marketing practitioner
- [React Email GitHub](https://github.com/resend/react-email) — HIGH confidence; official library
- [Resend — React Email 5.0](https://resend.com/blog/react-email-5) — HIGH confidence; official Resend release notes
- [Netdata — PostgreSQL FOR UPDATE SKIP LOCKED](https://www.netdata.cloud/academy/update-skip-locked/) — HIGH confidence; official technical documentation
- [Inferable — Unreasonable Effectiveness of SKIP LOCKED](https://www.inferable.ai/blog/posts/postgres-skip-locked) — MEDIUM confidence; verified against official Postgres docs
- [BullMQ — Retrying Failing Jobs](https://docs.bullmq.io/guide/retrying-failing-jobs) — HIGH confidence; official BullMQ documentation
- [Queue-Based Exponential Backoff — DEV Community](https://dev.to/andreparis/queue-based-exponential-backoff-a-resilient-retry-pattern-for-distributed-systems-37f3) — MEDIUM confidence; practitioner source
- [Background Job Observability — Last9](https://last9.io/blog/background-job-observability/) — MEDIUM confidence; practitioner source

---

*Feature research for: Booking Experience v5.0 — Skleanings*
*Researched: 2026-05-11*
