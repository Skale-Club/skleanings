# Phase 31: Branded Transactional Email via Resend — Research

**Researched:** 2026-05-11
**Domain:** Transactional email delivery — Resend SDK, plain-HTML templates, singleton settings table, booking lifecycle triggers
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EMAIL-01 | Admin can configure Resend API key, from-address, and toggle transactional emails on/off from the admin Integrations panel | emailSettings singleton table mirrors twilioSettings pattern exactly; GHLTab / TwilioSection are direct UI templates to follow |
| EMAIL-02 | Customer receives booking confirmation email within 60 seconds of confirmed booking, with service name, date, time, address, and selected duration label | Trigger point: POST /api/bookings after storage.createBooking(); fire-and-forget void call; bookingItems already carry durationLabel from Phase 30 |
| EMAIL-03 | Customer receives reminder email ~24h before scheduled appointment via cron | daily cron at 08:00 UTC added to server/services/cron.ts following existing recurring-reminder pattern; production trigger via GitHub Actions |
| EMAIL-04 | Customer receives cancellation email immediately when booking is cancelled | Trigger point: PUT /api/bookings/:id/status + /approve + /reject routes, when status changes to 'cancelled'; fire-and-forget void call |
| EMAIL-05 | All email templates display company logo, name, and brand colors sourced from companySettings | companySettings.logoMain, companySettings.companyName available via storage.getCompanySettings(); primaryColor is hardcoded brand constant #1C53A3 (not a DB column) |
</phase_requirements>

---

## Summary

Phase 31 wires Resend transactional email into the existing booking lifecycle. The codebase already has the scaffolding: `server/lib/email.ts` (nodemailer, same `sendEmail()` signature to preserve), `server/lib/email-templates.ts` (plain-HTML string functions, the pattern for new templates), and `notificationLogs` (text `channel` column, no migration needed to add 'email' rows). The two gaps to fill are a new `emailSettings` DB table (singleton, mirrors `twilioSettings`) and three new template functions plus their trigger wiring.

The architecture decision already locked by milestone research is: plain HTML string templates in `server/lib/email-templates.ts` (not React Email JSX). This avoids esbuild/Vite build complexity and keeps templates consistent with the existing `buildReminderEmail()` and `buildManageEmail()` functions that already ship to customers. The Resend SDK is installed via `npm install resend react-email --legacy-peer-deps` — but react-email is NOT needed if staying with plain HTML. Only `resend` is strictly required.

The critical pre-flight constraint is DNS: Resend requires DKIM CNAME + SPF TXT records verified on the sending domain before any email can be delivered. DNS propagation takes up to 72 hours. This must be initiated before implementation begins, not after. If the DNS window is not complete at go-live, all confirmation emails silently fail — log to `notificationLogs` with `status = 'failed'` so failures are visible in the admin panel.

**Primary recommendation:** Add `emailSettings` table via Supabase CLI migration, build `server/lib/email-resend.ts` as a parallel module (keeps nodemailer untouched), add three plain-HTML template functions to `server/lib/email-templates.ts`, wire fire-and-forget triggers in `server/routes/bookings.ts`, add daily 08:00 UTC cron for 24h reminders, and build `EmailTab` inside `IntegrationsSection` following the established GHLTab/TwilioSection pattern.

---

## Project Constraints (from CLAUDE.md)

- Database migrations: Supabase CLI only (`supabase migration new` + `supabase db push`). NEVER `drizzle-kit push`.
- Stack: React 18, TypeScript, Vite (client), Express.js + esbuild (server), Drizzle ORM, PostgreSQL.
- All DB queries go through `IStorage` interface in `server/storage.ts` — never raw SQL in routes.
- `shared/schema.ts` is the single source of truth for tables, TypeScript types, and Zod schemas.
- Brand: Primary Blue `#1C53A3`, Brand Yellow `#FFFF01`, Outfit (headings), Inter (body).
- CTA buttons: Brand Yellow, black bold text, `rounded-full`.
- Admin UI: sidebar layout, React Query, shadcn/ui — follow existing admin component patterns.

---

## Standard Stack

### Core (net-new)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | `^6.12.3` (npm current) | HTTP API client for sending email via Resend | Official SDK. Returns `{ data, error }` — never throws. Matches project's fire-and-forget error handling. No SMTP credentials needed, only API key. |

**Note:** Milestone research pinned `^4.5.1` as conservative default. npm registry shows `6.12.3` as current (verified 2026-05-11). Both expose the identical `resend.emails.send()` API — no breaking changes on the send path between v4 and v6. Use `^6.12.3` for latest security patches. If `react-email` JSX templates are adopted later, v6 SDK includes `react-email` render support natively.

### NOT Needed (confirmed)

| Skip | Why |
|------|-----|
| `react-email` | Not needed for plain HTML string templates. Only required if switching to JSX templates. Milestone research confirmed plain HTML is the correct approach for 3 templates. |
| `@react-email/components` | Deprecated since React Email v6. Do not install. |
| Removing `nodemailer` | nodemailer powers `server/lib/email.ts` which is called by recurring subscription reminder (`server/routes/bookings.ts` line 202-208) and recurring-booking-reminder service. Must remain. |

### Installation

```bash
npm install resend
```

No `--legacy-peer-deps` needed — `resend` alone has no peer dep conflicts with React 18.

**Version verification (confirmed 2026-05-11):**
```
npm view resend version  → 6.12.3
```

---

## Architecture Patterns

### New File: `server/lib/email-resend.ts`

Parallel email module alongside `server/lib/email.ts`. Reads API key and from-address from `emailSettings` DB table (with env var fallback for local dev). Keeps same external interface so callers can be swapped cleanly.

```typescript
// server/lib/email-resend.ts
import { Resend } from 'resend';
import { storage } from '../storage';

let _resend: Resend | null = null;

async function getResendClient(): Promise<{ client: Resend; from: string } | null> {
  const settings = await storage.getEmailSettings();
  const apiKey = settings?.resendApiKey || process.env.RESEND_API_KEY;
  const from = settings?.fromAddress || process.env.RESEND_FROM || '';

  if (!apiKey) {
    console.warn('[Resend] API key not configured — skipping');
    return null;
  }
  return { client: new Resend(apiKey), from };
}

/**
 * Send transactional email via Resend SDK.
 * Non-throwing: logs error and returns silently if unconfigured or if Resend errors.
 * Logs outcome to notificationLogs via bookingId.
 */
export async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  bookingId?: number,
  trigger?: string
): Promise<void> {
  const ctx = await getResendClient();
  if (!ctx) return;

  const { error } = await ctx.client.emails.send({
    from: ctx.from,
    to,
    subject,
    html,
    text,
  });

  // Log outcome to notificationLogs (channel: 'email')
  try {
    await storage.createNotificationLog({
      bookingId: bookingId ?? null,
      channel: 'email',
      trigger: trigger ?? 'unknown',
      recipient: to,
      preview: subject,
      status: error ? 'failed' : 'sent',
      errorMessage: error ? JSON.stringify(error) : null,
      providerMessageId: null,
    });
  } catch (logErr) {
    console.error('[Resend] Failed to write notification log:', logErr);
  }

  if (error) {
    console.error('[Resend] Send error:', error);
  }
}
```

### New Schema: `emailSettings` Table

Mirrors `twilioSettings` pattern (singleton row, UPSERT on save):

```typescript
// Add to shared/schema.ts
export const emailSettings = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false),
  resendApiKey: text("resend_api_key"),
  fromAddress: text("from_address"),  // e.g. "Skleanings <no-reply@skleanings.com>"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type EmailSettings = typeof emailSettings.$inferSelect;
export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
```

### New Route Module: `server/routes/integrations/resend.ts`

Follows the exact `server/routes/integrations/twilio.ts` pattern:

```typescript
// GET /api/integrations/resend → returns settings (apiKey masked as "********")
// PUT /api/integrations/resend → upserts settings (preserves existing key if "********" sent)
// POST /api/integrations/resend/test → sends test email to currently configured fromAddress
```

Mount in `server/routes/integrations.ts` (where twilio, ghl, telegram routes are registered).

### New Templates: Add to `server/lib/email-templates.ts`

Three new exported functions following the existing `buildReminderEmail()` / `buildManageEmail()` pattern. Each returns `{ subject: string; text: string; html: string }`. Brand constants used inline:

```typescript
// Brand constants (from CLAUDE.md — not DB columns)
const BRAND_BLUE = '#1C53A3';
const BRAND_YELLOW = '#FFFF01';
```

**Template 1: `buildBookingConfirmationEmail()`**

Data shape:
```typescript
export interface BookingConfirmationEmailData {
  customerName: string;
  bookingDate: string;      // YYYY-MM-DD
  startTime: string;        // HH:MM (24h)
  serviceName: string;
  serviceAddress: string;
  durationLabel: string | null;  // Phase 30 snapshot — null = use durationMinutes fallback
  durationMinutes: number;
  companyName: string;
  logoUrl: string;          // companySettings.logoMain
}
```

**Template 2: `build24hReminderEmail()`**

Data shape:
```typescript
export interface Reminder24hEmailData {
  customerName: string;
  bookingDate: string;
  startTime: string;
  serviceName: string;
  serviceAddress: string;
  durationLabel: string | null;
  durationMinutes: number;
  companyName: string;
  logoUrl: string;
}
```

**Template 3: `buildCancellationEmail()`**

Data shape:
```typescript
export interface BookingCancellationEmailData {
  customerName: string;
  bookingDate: string;
  startTime: string;
  serviceName: string;
  companyName: string;
  logoUrl: string;
}
```

### Trigger Wiring in `server/routes/bookings.ts`

**Confirmation (EMAIL-02):** Fire-and-forget after `storage.createBooking()` — same block as Twilio/Telegram notifications, lines 248-321:

```typescript
// After existing Twilio/Telegram notification block:
try {
  const emailSettings = await storage.getEmailSettings();
  if (emailSettings?.enabled && booking.customerEmail) {
    const companySettings = await storage.getCompanySettings();
    const bookingItems = await storage.getBookingItems(booking.id);
    const primaryItem = bookingItems[0];
    const { buildBookingConfirmationEmail } = await import('../lib/email-templates');
    const { sendResendEmail } = await import('../lib/email-resend');
    const content = buildBookingConfirmationEmail({
      customerName: booking.customerName,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      serviceName: primaryItem?.serviceName ?? 'Cleaning Service',
      serviceAddress: booking.customerAddress,
      durationLabel: primaryItem?.durationLabel ?? null,
      durationMinutes: booking.totalDurationMinutes,
      companyName: companySettings?.companyName ?? 'Your Cleaning Service',
      logoUrl: companySettings?.logoMain ?? '',
    });
    void sendResendEmail(
      booking.customerEmail,
      content.subject,
      content.html,
      content.text,
      booking.id,
      'booking_confirmed'
    ).catch(err => console.error('[Email] Confirmation error:', err));
  }
} catch (emailErr) {
  console.error('[Email] Confirmation setup error:', emailErr);
}
```

**Cancellation (EMAIL-04):** Cancellation can happen via three routes:
1. `PUT /api/bookings/:id/status` — generic status update (admin or system)
2. `PUT /api/bookings/:id/reject` — admin rejection of awaiting-approval booking

Both call `storage.updateBookingStatus(id, 'cancelled')`. The cancellation email fire-and-forget must be added to BOTH paths. Pattern is identical to the confirmation block above.

**Important:** The `DELETE /api/bookings/:id` route (hard delete) does NOT trigger a cancellation email — customer has no booking to cancel if the row is deleted without a status change.

### New Cron Entry: 24h Reminder (EMAIL-03)

Add to `server/services/cron.ts` following the existing `cron.schedule("30 6 * * *", ...)` reminder pattern:

```typescript
// Daily at 08:00 UTC: send 24h reminder emails for next-day bookings
// Production trigger is GitHub Actions (new workflow: booking-email-reminders-cron.yml)
cron.schedule("0 8 * * *", async () => {
  try {
    console.log("[CronService] Daily 24h email reminders...", new Date().toISOString());
    const { run24hEmailReminders } = await import("./booking-email-reminders");
    const result = await run24hEmailReminders();
    console.log(`[CronService] 24h reminders complete:`, result);
  } catch (error) {
    console.error("[CronService] Error in 24h email reminders:", error);
  }
});
```

New file `server/services/booking-email-reminders.ts`:

```typescript
// run24hEmailReminders(): queries bookings WHERE bookingDate = tomorrow AND status IN ('confirmed', 'pending')
// Sends build24hReminderEmail() via sendResendEmail() for each booking with a customerEmail
// Returns { sent: number; skipped: number; failed: number }
```

GitHub Actions workflow: `.github/workflows/booking-email-reminders-cron.yml` — daily at 08:00 UTC, POSTs to `/api/cron/email-reminders/run` with `X-Internal-Secret` header (same pattern as `recurring-bookings-cron.yml`). Express endpoint added to `server/routes/integrations.ts` (or a dedicated cron route).

### Admin UI: New `EmailTab` inside `IntegrationsSection`

Add a new "Email" tab to `IntegrationsSection.tsx` following the existing tab pattern. New file: `client/src/components/admin/integrations/EmailTab.tsx`.

Fields:
- Enabled toggle (Switch)
- Resend API Key (Input, masked, shows "••••••••" if saved)
- From Address (Input, e.g. "Skleanings \<no-reply@skleanings.com\>")
- Save button
- Test Send button (sends test email to currently configured from-address or admin email)

Pattern to follow exactly: `GHLTab.tsx` — same `useQuery` + `authenticatedRequest('PUT', ...)` + masked-key preservation pattern. The "test send" button sends a POST to `/api/integrations/resend/test`.

### Recommended Project Structure Changes

```
shared/
└── schema.ts              — add emailSettings table + schemas + types

supabase/migrations/
└── 20260511000007_add_email_settings.sql  — CREATE TABLE email_settings

server/
├── lib/
│   ├── email.ts            — UNCHANGED (nodemailer, keeps existing callers)
│   ├── email-resend.ts     — NEW: Resend SDK client + sendResendEmail()
│   └── email-templates.ts  — ADD 3 new functions (buildBookingConfirmationEmail, build24hReminderEmail, buildCancellationEmail)
├── services/
│   ├── cron.ts             — ADD daily 08:00 UTC cron entry
│   └── booking-email-reminders.ts  — NEW: run24hEmailReminders()
├── routes/
│   ├── bookings.ts         — ADD fire-and-forget confirmation + cancellation email triggers
│   └── integrations/
│       └── resend.ts       — NEW: GET/PUT /api/integrations/resend + POST .../test
└── storage.ts              — ADD getEmailSettings(), saveEmailSettings()

client/src/
└── components/admin/
    └── integrations/
        └── EmailTab.tsx    — NEW: admin UI (apiKey, fromAddress, enabled, test-send)

IntegrationsSection.tsx — ADD 'email' tab entry
```

### Anti-Patterns to Avoid

- **Replacing nodemailer in `server/lib/email.ts`:** The existing module is called by recurring booking manage-link email (bookings.ts line 202) and recurring-booking-reminder service. Changing the implementation breaks v4.0 functionality. `email-resend.ts` is a parallel addition.
- **Blocking the booking response on email:** `await sendResendEmail(...)` in the POST handler body adds Resend API latency to customer-facing booking creation. Use `void sendResendEmail(...).catch(...)` — fire-and-forget identical to Twilio/Telegram notifications.
- **Storing Resend API key in env var only:** Admin must be able to rotate the key without a deploy. Env var is the local dev fallback only. DB is the production source.
- **Using pgEnum for `emailSettings.enabled`:** Stay consistent — all flag-like fields are `boolean`, all status-like fields are plain `text`. The `enabled` boolean follows `twilioSettings.enabled` precedent.
- **Sending cancellation email on hard DELETE:** Only `status = 'cancelled'` status changes trigger the cancellation email. The `DELETE /api/bookings/:id` route removes the row — no email.
- **Adding `companySettings.primaryColor` to DB:** The brand primary color `#1C53A3` is a CLAUDE.md brand constant, not a DB column. Hardcode it in templates. `logoMain` and `companyName` are the only companySettings fields used in templates.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | Custom SMTP sender for booking emails | `resend` SDK | Resend handles delivery, queuing, DKIM signing, bounce handling, unsubscribe headers. Building on raw SMTP is weeks of edge-case work. |
| API key masking | Custom "show/hide" credential UI | Exact pattern from `twilio.ts` route: return `"********"` if key exists; preserve existing key if `"********"` submitted | Already battle-tested in the codebase. |
| 24h reminder timing | Complex "send exactly 24h before" scheduler | Daily cron at 08:00 UTC + query `WHERE booking_date = tomorrow` | Simple, correct, idempotent. Customers get reminder 24h ± 8 hours depending on booking time — acceptable for appointment reminders. |
| Notification logging | Custom email audit table | `notificationLogs` table with `channel = 'email'` | Already exists. `channel` is plain text — no migration needed to add 'email' rows. |

---

## Common Pitfalls

### Pitfall 1: Resend Domain Not Verified — Silent Failures at Launch

**What goes wrong:** Resend returns a 422/403 error when `from` address uses an unverified domain. Fire-and-forget callers swallow the error. Customers receive no confirmation emails. `notificationLogs` shows no email rows.

**Why it happens:** DNS propagation takes up to 72 hours. Developers add DNS records on go-live day, not 3 days before.

**How to avoid:**
1. Add DNS verification as a BLOCKING pre-flight checklist item — must be done 72h before deployment.
2. Log Resend SDK `{ error }` response to `notificationLogs` with `status = 'failed'` (the `sendResendEmail()` module above does this).
3. When `emailSettings.enabled = false` or API key missing, log `status = 'skipped'` to `notificationLogs`.

**Warning signs:** Resend dashboard "Domains" tab shows "Pending" status. `notificationLogs` has no email rows after bookings are created.

**DNS records required:**
- DKIM: Two CNAME records on `send.yourdomain.com` (Resend provides exact values in dashboard)
- SPF: TXT record `v=spf1 include:amazonses.com ~all` on `yourdomain.com`
- Cloudflare users: append a trailing dot to CNAME values to prevent domain auto-appending

### Pitfall 2: Nodemailer Callers Broken If `email.ts` Is Modified

**What goes wrong:** Developer replaces nodemailer in `server/lib/email.ts` with Resend. The manage-link email (bookings.ts line 202) and recurring-booking-reminder service continue to call `sendEmail()` — but now silently skip when SMTP env vars are absent because the Resend path doesn't check for `EMAIL_HOST`.

**Why it happens:** The milestone plan says "replace nodemailer transport with Resend SDK, keeping same function signature." This is the ARCHITECTURE.md approach but contradicts the STACK.md approach of a parallel module.

**How to avoid:** Phase 31 uses the parallel module approach from STACK.md. `server/lib/email.ts` is NOT modified. `server/lib/email-resend.ts` is a new file. Existing callers of `sendEmail()` remain on nodemailer/SMTP. New booking lifecycle emails go through `sendResendEmail()`.

### Pitfall 3: Cancellation Email Not Wired to All Cancel Paths

**What goes wrong:** Email is added to `PUT /api/bookings/:id/status` but not to `PUT /api/bookings/:id/reject`. Admin rejections of "awaiting_approval" bookings never send a cancellation email.

**Why it happens:** There are three routes that can set status = 'cancelled': `/status`, `/reject`, and the generic `PATCH /id`. The plan must explicitly list all three.

**How to avoid:** Wire cancellation email to:
1. `PUT /api/bookings/:id/status` — when `status === 'cancelled'`
2. `PUT /api/bookings/:id/reject` — always fires cancellation email (reject always = cancelled)

The `PATCH /api/bookings/:id` handler (`handleBookingUpdate`) is generic — do NOT add email there; it would fire on every field edit.

### Pitfall 4: `emailSettings.enabled = false` Does Not Log Skipped Emails

**What goes wrong:** Admin disables emails, a booking is created, admin later re-enables emails and wonders "did any bookings get emailed while disabled?" No visibility because skipped sends are not logged.

**How to avoid:** Log `status = 'skipped'` to `notificationLogs` when `enabled = false`, just as `sendEmail()` logs a console.warn when SMTP is unconfigured. The planner should decide if this is required for EMAIL-01 or deferred.

### Pitfall 5: 24h Reminder Fires for Already-Cancelled Bookings

**What goes wrong:** Daily cron queries `WHERE booking_date = tomorrow`. A booking was cancelled yesterday. Customer receives a 24h reminder for a booking that was cancelled.

**How to avoid:** Reminder query must include `AND status IN ('confirmed', 'pending')` — NOT 'cancelled', 'awaiting_approval', or 'completed'. Template plan must include this WHERE clause constraint explicitly.

### Pitfall 6: `durationLabel` Is Null for Services Without Duration Options (Phase 30)

**What goes wrong:** Template uses `durationLabel` directly: `"Duration: ${durationLabel}"`. For bookings made before Phase 30, or for services with no `serviceDurations` rows, `durationLabel` is null. Template renders "Duration: null".

**How to avoid:** Template must have a null fallback: `durationLabel ?? formatDuration(durationMinutes)` where `formatDuration(minutes)` renders "2 hours 30 minutes" from the integer. This is a template implementation detail the plan must specify.

---

## Code Examples

### Resend SDK Usage (verified pattern)

```typescript
// Source: resend.com/docs/send-with-nodejs (confirmed 2026-05-11)
import { Resend } from 'resend';

const resend = new Resend('re_...');
const { data, error } = await resend.emails.send({
  from: 'Skleanings <no-reply@skleanings.com>',
  to: 'customer@example.com',
  subject: 'Your booking is confirmed',
  html: '<p>Hi ...</p>',
  text: 'Hi ...',
});
// data = { id: string } on success
// error = { name, message, statusCode } on failure — never throws
```

### notificationLogs `channel: 'email'` Row (no migration needed)

```typescript
// channel is TEXT in shared/schema.ts line 1095 — accepts any string
// Existing triggers: 'new_chat', 'new_booking', 'calendar_disconnect', 'client_cancel'
// New triggers for Phase 31:
//   'booking_confirmed', 'appointment_reminder_24h', 'booking_cancelled'
await storage.createNotificationLog({
  bookingId: booking.id,
  channel: 'email',
  trigger: 'booking_confirmed',
  recipient: booking.customerEmail,
  preview: emailSubject.slice(0, 5000),
  status: error ? 'failed' : 'sent',
  errorMessage: error ? JSON.stringify(error) : null,
  providerMessageId: null,
  conversationId: null,
});
```

### companySettings Fields Available for Templates

```typescript
// From shared/schema.ts lines 741-794 (verified)
const settings = await storage.getCompanySettings();
// Available:
settings.companyName   // text — company display name
settings.logoMain      // text — URL to main logo
settings.logoDark      // text — URL to dark variant logo
settings.logoIcon      // text — URL to icon/favicon

// NOT a DB column (hardcode in templates):
const BRAND_PRIMARY = '#1C53A3';  // from CLAUDE.md
const BRAND_YELLOW  = '#FFFF01';  // from CLAUDE.md
```

### Booking Cancellation Trigger Points (verified in routes/bookings.ts)

```typescript
// Path 1: Generic status update (line 349-358)
router.put('/:id(\\d+)/status', requireAdmin, async (req, res) => {
  const { status } = req.body;  // status could be 'cancelled'
  const booking = await storage.updateBookingStatus(Number(req.params.id), status);
  // ADD: if (status === 'cancelled') fire cancellation email
});

// Path 2: Reject route (line 372-388)
router.put('/:id(\\d+)/reject', requireAdmin, async (req, res) => {
  await storage.updateBookingStatus(id, 'cancelled');
  // ADD: fire cancellation email (always fires here — reject always = cancelled)
});
```

### Existing Fire-and-Forget Pattern (reference — lines 248-321)

```typescript
// The pattern already used for Twilio/Telegram in routes/bookings.ts:
try {
  const [twilioSettings, telegramSettings, companySettings] = await Promise.all([...]);
  if (twilioSettings?.enabled && ...) {
    try {
      await sendBookingNotification(...);
    } catch (twilioError) {
      console.error("Twilio Notification Error:", twilioError);
    }
  }
} catch (error) {
  console.error("Booking Notification Error:", error);
}
// Email block follows same outer try/catch, inner try/catch per provider pattern
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `resend` npm package | EMAIL-02, EMAIL-03, EMAIL-04 | NOT INSTALLED | — | Must install |
| `nodemailer` npm package | Existing recurring booking emails | Already installed | ^8.0.7 | Keep as-is |
| `node-cron` npm package | EMAIL-03 cron | Already installed | ^4.2.1 | GH Actions trigger |
| Resend API key | All email sends | NOT CONFIGURED (env var absent) | — | emails skip with warning |
| Resend verified sending domain | Production email delivery | UNKNOWN — requires DNS | — | 72h DNS propagation window |
| GitHub Actions (for Vercel cron) | EMAIL-03 production trigger | Exists (recurring-bookings-cron.yml) | — | node-cron (local only) |
| Supabase CLI | emailSettings migration | Available | — | — |

**Missing dependencies with no fallback:**
- `resend` package (not in package.json) — must install before implementation
- Resend account + verified sending domain — must be set up 72h before go-live

**Missing dependencies with fallback:**
- RESEND_API_KEY env var — falls back to `emailSettings.resendApiKey` DB value; local dev needs env var if DB row not yet seeded

---

## Validation Architecture

No automated test framework detected in the project (no `jest.config.*`, `vitest.config.*`, or `tests/` directory). Validation is manual / integration.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Command / Method |
|--------|----------|-----------|------------------|
| EMAIL-01 | Admin saves Resend API key + from-address; toggle enables/disables | Manual browser | Load `/admin/integrations`, email tab; save + reload; confirm data persists |
| EMAIL-01 | "Test Send" button dispatches to sendEmail flow | Manual browser | Click test-send; check Resend dashboard for delivery; check `notificationLogs` for 'sent' row |
| EMAIL-02 | Confirmation email arrives within 60s of booking creation | Manual integration | Create booking with email; check inbox + notificationLogs |
| EMAIL-02 | Confirmation email contains service name, date, time, address, duration label | Manual inspection | Review received email content |
| EMAIL-03 | 24h reminder fires for next-day bookings | Manual cron trigger | Seed a booking for tomorrow; POST to cron endpoint; check inbox |
| EMAIL-03 | 24h reminder does NOT fire for cancelled bookings | Manual | Seed cancelled booking for tomorrow; run cron; confirm no email in notificationLogs |
| EMAIL-04 | Cancellation email fires on status → 'cancelled' via /status route | Manual admin | Cancel a booking via admin UI; check inbox + notificationLogs |
| EMAIL-04 | Cancellation email fires on /reject route | Manual admin | Reject an awaiting-approval booking; check inbox |
| EMAIL-05 | Email templates display logo, company name, brand colors | Manual inspection | Receive test email; confirm logo renders (img src = logoMain URL), name in header |

### Sampling Rate
- Per task commit: Manual smoke test (create booking → check notificationLogs for email row)
- Per wave merge: Full manual checklist above
- Phase gate: All EMAIL-01 through EMAIL-05 manually verified before `/gsd:verify-work`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nodemailer SMTP for all transactional email | Resend SDK for booking lifecycle; Nodemailer retained for recurring subscription reminders | Phase 31 | No SMTP credentials needed for booking emails; Resend handles deliverability |
| Plain text `channel` values in notificationLogs ('sms', 'telegram', 'ghl') | Add 'email' as new channel value | Phase 31 | No migration; text column accepts it directly |
| No customer-facing emails for one-time bookings | Confirmation, 24h reminder, cancellation | Phase 31 | Customer communication loop closed |

---

## Open Questions

1. **Should `emailSettings.enabled = false` log skipped emails to `notificationLogs`?**
   - What we know: Twilio/Telegram skip silently (no notificationLogs row) when disabled
   - What's unclear: Is audit trail for skipped emails required for EMAIL-01 acceptance?
   - Recommendation: Log skipped sends with `status = 'skipped'` — cheap to add, valuable for admin debugging

2. **Is a test-send button required for EMAIL-01?**
   - What we know: GHLTab has a test-connection button; TwilioSection has a test-send button (confirmed in TwilioSection.tsx)
   - What's unclear: REQUIREMENTS.md doesn't explicitly specify a test-send for EMAIL-01
   - Recommendation: Include test-send button — consistent with existing integration pattern; low effort; high admin confidence value

3. **What `from` format should be pre-populated in the admin UI?**
   - What we know: Resend accepts `"Name <email@domain.com>"` or bare `"email@domain.com"`
   - What's unclear: Does the DB store just the email or the full display-name format?
   - Recommendation: Store the full display-name string in `fromAddress`; show placeholder `"Skleanings <no-reply@skleanings.com>"` in the admin input

4. **Should the 24h reminder cron also cover one-time (non-recurring) bookings?**
   - What we know: EMAIL-03 says "24h before their scheduled appointment" — no restriction to recurring
   - What we know: Existing reminders in cron.ts (line 49) are for recurring bookings only
   - Recommendation: EMAIL-03 applies to ALL bookings (recurring and one-time) — the query scans `bookings` table by date, not `recurringBookings`

5. **Next migration filename after `20260511000006_add_duration_snapshot_columns.sql`**
   - What we know: Latest migration is `20260511000006_...`
   - Recommendation: Use `20260511000007_add_email_settings.sql` — same date prefix, sequential index

---

## Sources

### Primary (HIGH confidence)

- Codebase: `server/lib/email.ts` — confirmed nodemailer implementation, `sendEmail(to, subject, text, html)` signature, graceful skip pattern
- Codebase: `server/lib/email-templates.ts` — confirmed plain HTML string pattern (`buildReminderEmail`, `buildManageEmail`), brand colors used inline, `{ subject, text, html }` return shape
- Codebase: `server/routes/bookings.ts` (full file, verified) — confirmed fire-and-forget notification pattern (lines 248-321), recurring-booking email call (lines 184-214), two cancellation paths (lines 349-388)
- Codebase: `shared/schema.ts` — confirmed `notificationLogs` table structure (lines 1091-1111), `emailSettings` table absent (not yet added), `companySettings.logoMain` + `companyName` available (lines 741-794), `twilioSettings` pattern (lines 369-379)
- Codebase: `server/routes/integrations/twilio.ts` — confirmed masked-key pattern, UPSERT-on-save pattern
- Codebase: `client/src/components/admin/integrations/GHLTab.tsx` — confirmed React Query + `authenticatedRequest` + masked key UI pattern
- Codebase: `client/src/components/admin/IntegrationsSection.tsx` — confirmed tab structure; Email tab must be added to `INTEGRATION_TABS` array and `TabsList`
- Codebase: `server/services/cron.ts` — confirmed `isServerless` guard, dynamic import pattern for cron handlers, existing daily cron entries
- Codebase: `supabase/migrations/` — latest migration: `20260511000006_add_duration_snapshot_columns.sql`; next: `20260511000007_add_email_settings.sql`
- npm registry: `npm view resend version` → `6.12.3` (verified 2026-05-11)
- npm registry: `npm view react-email version` → `6.1.1` (verified 2026-05-11)

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md` — verified Resend API returns `{ data, error }`, never throws; `sendEmail()` signature preservation requirement; parallel module approach
- `.planning/research/ARCHITECTURE.md` — confirmed email trigger data flow diagram; plain HTML template decision; emailSettings singleton pattern
- `.planning/research/PITFALLS.md` — confirmed DNS 72h propagation risk; nodemailer preservation requirement; fire-and-forget blocking risk

### Tertiary (LOW confidence — from milestone research, pre-codebase-inspection)

- resend.com/docs — Resend SDK `emails.send()` API and DNS verification requirements (HIGH confidence for SDK usage pattern, MEDIUM for DNS record specifics)
- Milestone research SUMMARY.md: `@react-email/components` deprecated since v6 — confirmed by npm (LOW confidence on exact deprecation date, HIGH on "do not use" conclusion)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `resend` version verified against npm registry; nodemailer retention confirmed by codebase read
- Architecture: HIGH — all trigger points, file paths, and data shapes verified by direct codebase inspection
- Pitfalls: HIGH — cancellation paths and DNS risk verified; nodemailer-Resend coexistence verified in code

**Research date:** 2026-05-11
**Valid until:** 2026-06-10 (stable stack — Resend SDK API is stable across v4-v6; 30-day window)
