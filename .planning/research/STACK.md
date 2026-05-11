# Stack Research

**Domain:** Transactional email, reliable sync queues, flexible service catalog — additions to existing Express.js + React 18 + Drizzle ORM booking platform
**Researched:** 2026-05-11
**Confidence:** HIGH (all library versions verified via official releases and npm registry)

---

## New Libraries Required

These are the ONLY net-new packages. The existing stack (Express, Drizzle, postgres.js, node-cron, nodemailer, React Query, shadcn/ui) is unchanged except where explicitly noted below.

### Core Technologies (net-new)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `resend` | `^4.5.1` | HTTP API client for sending transactional email via Resend | Official SDK. Destructured `{ data, error }` response — never throws, matches the codebase fire-and-forget error handling style. Resend chosen in SEED-019; no reason to revisit. |
| `react-email` | `^6.1.1` | JSX-based email template authoring and server-side rendering | v6 consolidates all components into one package. `Html`, `Body`, `Container`, `Button`, `Text`, `Heading`, `Img`, `Section`, `Preview` all imported from `react-email`. Replaces the deprecated `@react-email/components` umbrella. |

**Note on `resend` version:** Latest release is `6.12.3` (May 6, 2026). Versions 4.x through 6.x all expose the same `resend.emails.send()` API — no breaking changes on the send path. Pin `^4.5.1` for a minimal footprint (no svix webhook dependency). Pin `^6.12.3` if you want latest security patches. Either works; this document uses `^4.5.1` as the conservative default.

**Note on `react-email` version:** Latest stable is `6.1.1` (May 6, 2026). `@react-email/components` is no longer maintained as of React Email v6 (May 2025) — components were merged into the main `react-email` package. Do not install `@react-email/components`.

---

### Libraries NOT Needed

| Skip | Why |
|------|-----|
| `@react-email/components` | Deprecated as of React Email v6. All components (`Html`, `Body`, `Container`, `Button`, `Text`, `Heading`, etc.) now live in `react-email` directly. |
| `pg-boss` | SEED-002 explicitly defers it: "simple worker with SELECT FOR UPDATE SKIP LOCKED in 1min cron is enough for initial volume." pg-boss (v12.18.2) adds its own schema, migrations, and a persistent manager process. Not justified at current queue depth. |
| `bull` / `bullmq` | Requires Redis. This project has no Redis and no plans for it. |
| Any additional cron library | `node-cron ^4.2.1` is already installed and running in `server/services/cron.ts`. The queue worker cron is added there using the same pattern. |
| Nodemailer (removal) | Do NOT remove `nodemailer ^8.0.7`. It powers `server/lib/email.ts` which the v4.0 recurring subscription reminder service uses. The new Resend integration is a parallel addition in `server/lib/email-resend.ts`. Both coexist. |

---

## Installation

```bash
# Net-new dependencies only — two packages
npm install resend react-email
```

No dev dependencies needed for the new packages. React Email templates render server-side; the `react-email` package includes its own server renderer. The existing `react` and `react-dom` peer deps (React 18.3.1) satisfy `react-email` v6's requirements.

---

## Integration Points by Feature

### SEED-019 — Branded Email via Resend

**New module:** `server/lib/email-resend.ts`

Pattern: read API key and from-address from DB (`emailSettings` table) or env var fallback. Call `resend.emails.send({ from, to, subject, react: <Template /> })`. Return `{ data, error }` — log error, never throw (consistent with existing fire-and-forget analytics pattern).

```typescript
import { Resend } from 'resend';
import type { ReactElement } from 'react';

export async function sendResendEmail(to: string, subject: string, jsx: ReactElement): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn('[Resend] RESEND_API_KEY not set — skipping'); return; }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'no-reply@example.com',
    to,
    subject,
    react: jsx,
  });
  if (error) console.error('[Resend] Send error:', error);
}
```

**New template files:** `server/emails/BookingConfirmation.tsx`, `server/emails/BookingReminder24h.tsx`, `server/emails/BookingCancellation.tsx`

Import pattern for templates:

```typescript
import { Html, Body, Container, Heading, Text, Button, Preview } from 'react-email';
```

**New DB table:** `emailSettings` — mirrors `twilioSettings` pattern. Stores `resendApiKey`, `fromAddress`, `enabled`. Admin UI configures it. Env vars are the dev/fallback path.

**New env vars:**
- `RESEND_API_KEY` — Resend API key from resend.com dashboard
- `RESEND_FROM` — verified sender address e.g. `"Skleanings <no-reply@skleanings.com>"`

**Existing `notificationLogs` table** already tracks SMS/Telegram channels. Email is a new `channel` value — no new table needed for logging, just a new row type.

**Existing nodemailer path is untouched.** The recurring subscription reminder service (`server/services/recurring-booking-reminder.ts` → `server/lib/email.ts`) continues to use nodemailer SMTP. SEED-019 templates go through `server/lib/email-resend.ts` (Resend SDK). The two email paths target different use cases and coexist cleanly.

---

### SEED-002 — Calendar Harmony Retry Queue

**No new packages.** Pure schema + worker implementation using existing `postgres.js` and `node-cron`.

**Raw SQL for queue pick-up** — use `db.execute(sql`...`)` from Drizzle, not the `.for("update", { skipLocked: true })` query builder method. That method has a known syntax bug (drizzle-team/drizzle-orm #3554 — generates `FOR UPDATE SKIP LOCKED` with incorrect spacing; fix merged but version is uncertain relative to project's `^0.39.3`). Raw SQL is explicit and correct:

```typescript
import { sql } from 'drizzle-orm';

const rows = await db.execute(sql`
  SELECT * FROM calendar_sync_queue
  WHERE status = 'pending'
    AND scheduled_for <= NOW()
  ORDER BY scheduled_for ASC
  LIMIT 10
  FOR UPDATE SKIP LOCKED
`);
```

**New DB table:** `calendarSyncQueue` per SEED-002 spec:
- Columns: `id`, `bookingId` (FK → bookings), `target` (enum: `google_calendar | ghl_appointment | ghl_contact | ghl_utm`), `operation` (enum: `create | update | delete`), `payload` JSONB, `status` (enum: `pending | in_progress | success | failed_retryable | failed_permanent`), `attempts` int, `lastAttemptAt`, `lastError` text, `scheduledFor`, `completedAt`
- Required index: `(status, scheduled_for)` — without this, the queue scan degrades to sequential scan as the table grows

**Exponential backoff** — pure arithmetic, no library:

| Attempt | Next `scheduledFor` offset |
|---------|---------------------------|
| 1 | +1 minute |
| 2 | +5 minutes |
| 3 | +30 minutes |
| 4 | +2 hours |
| 5 | +12 hours |
| 6 | +24 hours → set `status = 'failed_permanent'` |

**Cron registration** — add to existing `server/services/cron.ts` following the existing pattern:

```typescript
// Every 1 minute — calendar sync queue worker
cron.schedule("* * * * *", async () => {
  const { runCalendarSyncWorker } = await import("./calendar-sync-worker");
  await runCalendarSyncWorker();
});
```

**Serverless guard** — `server/services/cron.ts` already guards against Vercel with `if (isServerless) return`. The queue worker must follow the same pattern: no-op on Vercel, triggered instead via a new GitHub Actions workflow (`calendar-sync-cron.yml`) that POSTs to `/api/calendar-sync/cron/process` — same pattern as `recurring-bookings-cron.yml`. GitHub Actions minimum schedule is 5 minutes, so production on Vercel gets 5-minute resolution; persistent Node.js environments get 1-minute resolution.

**New worker file:** `server/services/calendar-sync-worker.ts` — picks rows with the `FOR UPDATE SKIP LOCKED` query, marks `in_progress`, calls `server/lib/google-calendar.ts` (Google, priority 1) then `server/integrations/ghl.ts` (GHL, priority 2), updates row status on success or failure, computes next `scheduledFor` on retry.

---

### SEED-029 — Multiple Durations per Service

**No new packages.** Schema + UI only:

- **Schema:** New Drizzle table `serviceDurations` in `shared/schema.ts`: `id`, `serviceId` (FK → services), `label` text (e.g. "2h — Small apartment"), `durationMinutes` int, `price` numeric, `sortOrder` int
- **Booking flow:** Duration selector in `client/src/pages/BookingPage.tsx` using existing shadcn/ui Button or Card components — same visual pattern as `areaSizes` for `area_based` services
- **Availability query:** `server/routes/availability.ts` receives dynamic `durationMinutes` from the selected duration rather than reading from `services.durationMinutes`
- **Admin UI:** "Available durations" section in `client/src/components/admin/ServicesSection.tsx` using `react-hook-form` + `useFieldArray` (already used in booking form — no new pattern)
- **Fallback:** When a service has no `serviceDurations` rows, `services.durationMinutes` is used as-is — backward compatible with all existing services

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `resend` SDK | `nodemailer` via Resend's SMTP relay | Never — the native SDK is simpler, returns `{ data, error }` without throw, and gives access to delivery webhooks. SMTP relay is a generic fallback for mailers that don't have an API client. |
| `react-email` v6 (unified `react-email` pkg) | `@react-email/components` v1.x | Never — `@react-email/components` is no longer maintained. Components merged into `react-email` v6. |
| Raw SQL `FOR UPDATE SKIP LOCKED` | `pg-boss` v12 | Use pg-boss when queue depth exceeds ~10K jobs/day, or when you need priority queues, dead letter routing, or pub/sub fan-out. Not needed at current scale. |
| Raw SQL `FOR UPDATE SKIP LOCKED` | `bullmq` | Only if Redis is already in the infrastructure. This project has no Redis. |
| `node-cron` (already installed) | GitHub Actions for 1-minute queue | GitHub Actions minimum schedule is 5 minutes. The ideal queue polling interval is 1 minute. Use node-cron for persistent environments; GitHub Actions at 5-minute resolution is acceptable for Vercel. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@react-email/components` | Deprecated as of React Email v6 (May 2025). npm page says "no longer supported." | `react-email` — import `Html`, `Body`, `Container`, `Button`, `Text`, etc. directly from `react-email` |
| `drizzle-orm` query builder `.for("update", { skipLocked: true })` | Known bug #3554 — generates malformed SQL for `SKIP LOCKED`. Fix was merged but the affected version range overlaps with the project's `^0.39.3` pin. | `db.execute(sql\`... FOR UPDATE SKIP LOCKED\`)` raw SQL |
| `pg-boss` | Introduces its own migration schema, long-lived `PgBoss` instance, and infra surface area. SEED-002 explicitly defers it. | Raw `SELECT FOR UPDATE SKIP LOCKED` in `server/services/calendar-sync-worker.ts` |
| Removing `nodemailer` | Breaks `server/lib/email.ts` and the v4.0 recurring subscription reminder emails. | Add Resend as a parallel module (`server/lib/email-resend.ts`). Do not touch the nodemailer path. |
| GitHub Actions as the only queue trigger | Min 5-minute interval. Queue worker needs 1-minute polling in persistent envs. | `node-cron` inside Express for local/persistent environments; GitHub Actions as the Vercel trigger at 5-minute resolution. |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `resend` | `^4.5.1` – `^6.12.3` | Node 18+, React 18 | `resend.emails.send({ react: <Component /> })` API is stable across all v4–v6. No breaking changes on the send path. |
| `react-email` | `^6.1.1` | React 18 (peer dep), Node 18+ | React Email v6 lists React 19 as peer dep. React 18.3.1 (project's version) works in practice. If npm reports a peer dep conflict, add `--legacy-peer-deps`. Do not upgrade the project to React 19 for this milestone. |
| `node-cron` | `^4.2.1` (already installed) | Node 18+ | v4 requires Node 18+. Project already runs Node 18+. No change needed. |
| `postgres` | `^3.4.8` (already installed) | PostgreSQL 14+ (Supabase) | The `sql` tagged template from `drizzle-orm` generates parameterized queries compatible with `postgres.js`. For the raw `FOR UPDATE SKIP LOCKED` query, use `db.execute(sql`...`)` which routes through the existing connection pool. |

---

## Sources

- `github.com/resend/resend-node/releases` — confirmed latest stable: `v6.12.3` (May 6, 2026). HIGH confidence.
- `github.com/resend/react-email/releases` — confirmed latest stable: `react-email@6.1.1` (May 6, 2026). HIGH confidence.
- `react.email/docs/integrations/resend` — confirmed import pattern `import { Html, Button } from 'react-email'` and `resend.emails.send({ react: <Component /> })`. HIGH confidence.
- `resend.com/blog/react-email-6` — confirmed `@react-email/components` deprecated, all components consolidated into `react-email` v6. HIGH confidence.
- `github.com/timgit/pg-boss` — confirmed latest: `v12.18.2` (May 2, 2026); Drizzle adapter exists. SEED-002 explicitly defers it. HIGH confidence.
- `github.com/drizzle-team/drizzle-orm/issues/3554` — confirmed `SKIP LOCKED` query builder bug, closed with fix PR #3555. Exact fix version relative to `^0.39.3` unclear. MEDIUM confidence — raw SQL workaround is safe and explicit regardless.
- `package.json` (project) — confirmed: `node-cron ^4.2.1`, `nodemailer ^8.0.7`, `pg ^8.16.3`, `postgres ^3.4.8` already installed. HIGH confidence.
- `server/services/cron.ts` (project) — confirmed: isServerless guard + dynamic import pattern. The queue worker cron follows the same pattern. HIGH confidence.
- `server/lib/email.ts` (project) — confirmed: nodemailer active for recurring subscription reminders. Must not be removed. HIGH confidence.

---

*Stack research for: v5.0 Booking Experience — Resend branded email (SEED-019), Calendar Harmony retry queue (SEED-002), multiple service durations (SEED-029)*
*Researched: 2026-05-11*
