# Pitfalls Research

**Domain:** Booking Experience v5.0 — Multiple durations, branded email (Resend), Calendar Harmony retry queue
**Researched:** 2026-05-11
**Confidence:** HIGH (codebase read + official docs verified where noted; LOW confidence items flagged)

---

## Critical Pitfalls

### Pitfall 1: pgBouncer Transaction Mode Breaks Advisory Locks — Use Row-Level Locking Only

**What goes wrong:**
The SEED-002 worker spec mentions "pessimistic lock per (bookingId, target)" without specifying which PostgreSQL locking primitive. If the implementation reaches for `pg_advisory_lock()` or `pg_advisory_xact_lock()` — a natural choice for lightweight coordination — it will fail silently or deadlock under Supabase's pgBouncer/Supavisor transaction pooling.

Session-level advisory locks (`pg_advisory_lock`) require a persistent session connection. pgBouncer in transaction mode assigns a server connection only for the duration of one transaction, then returns it to the pool. The lock acquired in transaction N is tied to that server session — by the time transaction N+1 runs from the same client, it is on a different server connection and the lock is gone. This causes two workers to both believe they hold a lock on the same job.

**Why it happens:**
`server/db.ts` already sets `prepare: false` (required for pgBouncer transaction mode) and the connection is pooled. The project explicitly routes through Supabase's pooled endpoint in production. Developers who know about `FOR UPDATE SKIP LOCKED` sometimes add `pg_advisory_lock` alongside it as an "extra safety" measure — this breaks atomicity silently.

**How to avoid:**
Use `SELECT ... FOR UPDATE SKIP LOCKED` exclusively, inside a transaction, with the status column set atomically in the same statement. The pattern is:

```sql
-- Worker picks one row
UPDATE calendar_sync_queue
SET status = 'in_progress', last_attempt_at = NOW()
WHERE id = (
  SELECT id FROM calendar_sync_queue
  WHERE status = 'pending' AND scheduled_for <= NOW()
  ORDER BY scheduled_for ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

This is safe under pgBouncer transaction mode because the entire read-then-update happens in one transaction, one server connection. If the worker crashes, the transaction is rolled back and the row reverts to `pending` automatically.

If coordination beyond row locking is needed, use `pg_advisory_xact_lock()` (transaction-scoped, not session-scoped). Never use `pg_advisory_lock()` on a pooled connection.

**Warning signs:**
- Two admin observability entries for the same job showing `in_progress` simultaneously
- Jobs stuck in `in_progress` forever after a worker crash (this means the UPDATE happened but COMMIT did not, which under a correctly implemented approach should auto-revert — if it doesn't, advisory locks are leaking)
- Migration errors from Drizzle or Supabase CLI mentioning "advisory lock" failures (a completely separate pgBouncer advisory-lock incompatibility that affects schema migrations)

**Phase to address:**
SEED-002 implementation phase (Calendar Harmony). The `calendarSyncQueue` schema design and worker implementation must both be reviewed. The schema migration itself must use `supabase db diff` + Supabase CLI — never `drizzle-kit push` — because Drizzle's push command acquires advisory locks that hang on pgBouncer.

---

### Pitfall 2: `in_progress` Rows Orphaned Forever After Worker Crash

**What goes wrong:**
If a worker selects a row, sets `status = 'in_progress'`, commits that UPDATE (ending the transaction), then crashes before completing the job and committing the final status update, the row stays `in_progress` indefinitely. No automatic mechanism reverts it to `pending`. Jobs that affect Google Calendar or GHL never retry, bookings stay unsynced, and the admin observability panel shows a growing `in_progress` count with no resolution.

**Why it happens:**
The two-phase approach ("mark in_progress, then process, then mark success/failed") requires two separate transactions. The first commit is permanent. If the process dies between commit-1 and commit-2, commit-1 is not rolled back.

The seed spec uses an "optimistic single-transaction" description but is ambiguous. If someone interprets it as two transactions for performance reasons (e.g., holding a transaction open for the full duration of a GHL HTTP call is considered bad practice), they accidentally introduce this orphaning bug.

**How to avoid:**
Keep the worker's processing entirely within one database transaction — mark `in_progress`, call the external API, mark `success/failed`, all in one `db.transaction()` block. The transaction stays open for the duration of the HTTP call. This is acceptable for single-minute cron runs; the GHL/GCal calls are fast (under 5 seconds in normal conditions). pgBouncer does not time out open transactions by default — only the server's `idle_in_transaction_session_timeout` can cut them, so set that to at least 30 seconds.

Alternatively, if keeping the transaction open is not acceptable, add a `stale_in_progress_reaper`: a cron step that finds rows where `status = 'in_progress' AND last_attempt_at < NOW() - INTERVAL '10 minutes'` and resets them to `pending` with an incremented attempt count. Ship this reaper in the same phase as the worker, not as a follow-up.

**Warning signs:**
- `in_progress` counter grows after Vercel function timeouts or network errors
- Admin retry panel shows "Retry now" button on jobs that are `in_progress`, not `failed_retryable`
- `last_attempt_at` timestamp is old but status has not progressed

**Phase to address:**
SEED-002 implementation phase. The worker transaction boundary design must be explicit in the plan. One of the two approaches (single-transaction or two-transaction + reaper) must be chosen and implemented in the same phase.

---

### Pitfall 3: Duration Selector Breaks `totalDuration` in CartContext — Slots Show Wrong Availability

**What goes wrong:**
`CartContext.tsx` line 222 computes `totalDuration` as `item.durationMinutes * item.quantity`. The `durationMinutes` field is read directly from the `Service` object stored in the cart. When a customer selects a `serviceDuration` option (e.g., "4h — 3 bedrooms — $280"), the new duration (240 minutes) is stored as `selectedDurationId` in the cart item but `item.durationMinutes` still reflects the service's default duration from the catalog row.

The `useAvailability` hook receives `totalDuration` to query `GET /api/availability?totalDurationMinutes=...`. If `totalDuration` is still the default (e.g., 120 minutes for a 2h service), the API returns slots sized for 2 hours even though the customer chose 4 hours. A customer who books the 4h slot but the system only blocks 2h will cause staff to be double-booked.

**Why it happens:**
SEED-029 adds `selectedDurationId` to `AddToCartData` and `CartItem` but does not modify the `totalDuration` computation. The `Service` type's `durationMinutes` is the catalog default — it is immutable from the cart's perspective unless explicitly overridden on the cart item object. The disconnect is invisible in the UI because the date picker renders and accepts a slot; the error only manifests operationally.

**How to avoid:**
When a `serviceDuration` is selected, the cart item's effective `durationMinutes` must be overridden. Two correct approaches:

Option A — Override `durationMinutes` on the cart item at selection time (simplest): when `updateItem` is called with a `selectedDurationId`, also pass `service: { ...item, durationMinutes: selectedDuration.durationMinutes }` so `totalDuration` picks it up automatically via the spread in `CartContext.tsx` line 199.

Option B — Change `totalDuration` computation to check `selectedDurationId` and resolve the duration from the `serviceDurations` data loaded alongside the cart: `item.selectedDurationId ? resolvedDuration : item.durationMinutes`.

Option A is simpler and less error-prone. Choose it.

Also update `getCartItemsForBooking` to include the resolved duration so the server-side booking creation uses the correct `totalDurationMinutes`.

**Warning signs:**
- Selecting a 4h option shows the same available slots as the 2h option
- `totalDurationMinutes` in the booking API payload equals the catalog default, not the selected duration
- Admin calendar shows a 2h event for what the customer believed was a 4h booking

**Phase to address:**
SEED-029 implementation phase. Both the duration selector UI and the `CartContext` `totalDuration` computation must be updated atomically in the same plan. Write an integration test (or a manual test step) that confirms `totalDuration` equals the selected duration, not the catalog default.

---

### Pitfall 4: `BookingPage.tsx` Already at 39KB — Duration Selector Must Not Add Another Step

**What goes wrong:**
Adding a "Choose duration" step as a new `step` value (e.g., `step = 1.5` or a new `step = 2` pushing existing steps to 3-6) in `BookingPage.tsx` is the obvious implementation path but the file is already at 39KB with steps 2-5. Adding another step compounds the already-dangerous file size, increases the cognitive load of the step machine, and risks breaking the staff-count auto-skip logic (`useEffect` at line 72).

**Why it happens:**
The seed spec says "show a duration selector before going to the calendar" which sounds like a separate step. The naive implementation adds a step in the existing state machine.

**How to avoid:**
Do not add a step. Instead, render the duration selector inline in the service cart review (step 2 or alongside the cart items before step 3). Duration is a property of a cart item — it belongs near the cart item row, not as a standalone booking flow step. Implementation path:
- In the services catalog `ServiceCard` or `AddToCartModal`, show the duration options when the service has `serviceDurations`. Customer picks duration before adding to cart.
- If the customer must change duration in the booking flow, add the selector inside the cart item row in step 2, not as a new step.

This keeps `BookingPage.tsx` from growing further and avoids step-machine regressions.

**Warning signs:**
- `BookingPage.tsx` grows past 45KB
- The auto-skip `useEffect` for staff count stops working after step numbering changes
- Customers can reach the calendar without having selected a duration, resulting in the default duration being used silently

**Phase to address:**
SEED-029 implementation phase. The plan must explicitly state "no new step added" and describe where the selector renders.

---

### Pitfall 5: Resend `from` Address Blocked Until DNS Verifies — Emails Silently Drop at Launch

**What goes wrong:**
Resend requires a verified sending domain before it will deliver email from that domain. If the `from` address is `no-reply@skleanings.com` (or the tenant's domain) and the DNS records (DKIM CNAME, SPF TXT, optional MX) have not propagated, Resend returns a 403/422 error and the confirmation email is never sent. The Resend SDK throws or returns an error object — if the call site swallows errors (common for "fire-and-forget" notification patterns), customers receive no confirmation email with no indication anything failed.

DNS propagation can take up to 72 hours. During this window — which includes the go-live day — every booking produces a silent failure.

**Why it happens:**
Email sending is typically added in a non-blocking async call at the end of the booking creation handler, mirroring the existing `void` GHL/Twilio patterns. The developer tests with a personal Resend-verified domain during development but the production domain has not been through verification. The code ships; DNS records are added; the 72h window is not communicated to stakeholders.

**How to avoid:**
Three specific actions:
1. Add domain verification as a prerequisite checklist item in the deployment plan for the email phase — it must be done 72h before go-live, not after.
2. Log Resend errors explicitly (not just swallow them) and write to `notificationLogs` with `status = 'failed'` and `error = resendError.message`. This makes failures visible in the admin panel even when silent to the customer.
3. Implement a fallback: if the Resend domain is not yet verified or the API key is absent, fall back to the existing Nodemailer SMTP path (`server/lib/email.ts` already exists). This ensures basic delivery continues during the DNS window.

For Resend's DNS requirements specifically: two CNAME records for DKIM and one TXT record for SPF are required. The MX record is needed only for tracking replies. Some DNS providers (Cloudflare, Namecheap) auto-append the domain to record names — add a trailing period to CNAME values to prevent this. Verify with `dig TXT send.yourdomain.com` before go-live.

**Warning signs:**
- Resend dashboard shows 0 sent emails but booking API logs show no errors (swallowed error)
- `notificationLogs` has no email rows despite bookings being created
- Resend dashboard "Domains" tab shows "Pending" or "Failed" status for the sending domain

**Phase to address:**
SEED-019 implementation phase. The plan must include: (a) DNS setup instructions, (b) 72h lead time requirement, (c) Resend error logging wired to `notificationLogs`, (d) fallback to Nodemailer if Resend is unconfigured.

---

### Pitfall 6: React Email `render()` Called in a Browser Context Throws — Must Be Server-Only

**What goes wrong:**
`@react-email/render` uses `react-dom/server`'s `renderToStaticMarkup` (or the newer async `renderToStaticNodeStream`) internally. In React Email v3+, `render()` is always async. If a developer imports and calls `render()` from a file that is bundled for the client side (e.g., placed in `client/src/` instead of `server/`), it throws at runtime because `react-dom/server` is not available in the browser.

In this codebase, Vite bundles `client/src/` and esbuild bundles `server/`. A React Email template placed in `client/src/emails/` will be included in the Vite bundle and crash the browser.

**Why it happens:**
The React Email documentation shows templates as `.tsx` files which look like React components — it is natural to put them in the `client/` directory. The mistake is invisible during development if the template is only imported in server code via a relative path that Vite does not traverse.

**How to avoid:**
- Place all React Email template files under `server/emails/` (or `server/lib/emails/`), never under `client/src/`.
- Import `@react-email/render` only in server-side modules.
- Add `"@react-email/render"` to the `external` list in the esbuild config if it is not already excluded from the Vite client bundle.
- Use `renderAsync` in React Email v2 or `await render()` in v3+ (the sync `render()` was removed in v3 — check the installed version before writing templates).

**Warning signs:**
- Browser console error: `Module "react-dom/server" is not available in browser environment`
- Vite bundle size grows unexpectedly after adding email templates
- Email templates import but produce empty output (silent failure from a try/catch around the render call)

**Phase to address:**
SEED-019 implementation phase. The plan must specify `server/emails/` as the canonical template location and include a note on the async render API version.

---

### Pitfall 7: Vercel Serverless Functions Cannot Run a Persistent Worker — node-cron Is a No-Op

**What goes wrong:**
The SEED-002 spec mentions "node-cron every 1min" as the worker trigger. `node-cron` schedules cron callbacks inside the running Node.js process. On Vercel, the Express server runs as a serverless function — the process is created for the duration of a single HTTP request and then destroyed. There is no persistent process for `node-cron` to schedule against. The `cron.schedule()` call executes, registers a timer, and then the process exits. The next invocation of the serverless function is a cold start with no memory of the previous schedule.

The seed also mentions "GH Actions or node-cron" as alternatives. On Vercel, only the GH Actions path works.

**Why it happens:**
The codebase currently uses `node-cron` for the recurring booking generator in development. The `server/index.ts` initializes it during startup. This works locally (long-running process) and in any always-on server environment, but Vercel's serverless runtime makes it a dead letter.

**How to avoid:**
Use GitHub Actions cron (already in use for the recurring booking generator) as the exclusive trigger for the calendar sync worker in production. Configure a workflow that:
1. Runs every minute (`*/1 * * * *` — note: GitHub Actions minimum granularity is 1 minute but may lag up to 1 minute under high load)
2. Makes an authenticated HTTP `POST` to `/api/internal/calendar-sync/run` with a shared secret header
3. The Express route handler runs the worker and returns

Keep `node-cron` as a local development convenience only, guarded by `if (!process.env.VERCEL)`.

GitHub Actions cron can fire twice for the same minute under high load — the worker must be idempotent. `SELECT FOR UPDATE SKIP LOCKED` naturally provides this: the second invocation finds no unlocked pending rows and exits cleanly.

**Warning signs:**
- Calendar sync jobs accumulate in `pending` status and never transition
- `console.log` from the worker never appears in Vercel function logs
- GH Actions cron workflow is absent from `.github/workflows/`

**Phase to address:**
SEED-002 implementation phase. The plan must include the GitHub Actions workflow file as a deliverable, not as a "follow-up task."

---

### Pitfall 8: Recurring Bookings Generated with Default `durationMinutes` After Duration Feature Ships

**What goes wrong:**
`server/services/recurring-booking-generator.ts` line 79 reads `durationMinutes` from the service row directly: `const durationMinutes = service.durationMinutes`. After SEED-029 ships, a recurring subscription that was created when the customer chose a 4h duration (stored as `selectedDurationId` in the subscription snapshot) will generate future bookings with the service's catalog default duration — not the chosen 4h. Every recurring occurrence will be 2h shorter than expected.

**Why it happens:**
The recurring booking generator was written before multiple durations existed. It does not know about `selectedDurationId` and has no path to resolve a `serviceDuration` row.

**How to avoid:**
When SEED-029 ships, update the `recurringBookings` table to store the resolved `durationMinutes` at subscription creation time (not just `selectedDurationId`). Add a `durationMinutes` column to `recurringBookings` (defaulting to the service's catalog value for existing rows via migration). The generator reads this column instead of going to the service row. This is more robust because service catalog durations can be edited after subscription creation.

**Warning signs:**
- Admin calendar shows recurring occurrences shorter than the original booking
- Customer complaints about cleaners arriving for fewer hours than they paid for
- `totalDurationMinutes` on auto-generated bookings differs from the first occurrence

**Phase to address:**
SEED-029 phase must include updating the `recurringBookings` schema. If SEED-002 and SEED-029 ship in the same milestone, verify that the recurring booking generator update is explicitly in the SEED-029 plan.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Swallowing Resend errors with `void sendEmail(...)` | Mirrors existing GHL fire-and-forget pattern | Silent confirmation failures with no admin visibility | Never — always log to `notificationLogs` |
| Using `node-cron` for the sync worker on Vercel | No GH Actions workflow to write | Worker never runs in production | Development-only; never in production |
| Two-transaction worker (mark in_progress, then process separately) | Shorter open transactions | Orphaned `in_progress` rows on crash | Only if stale-row reaper ships in same phase |
| Putting React Email templates in `shared/` or `client/` | Seems reusable | Vite bundles them, browser throws | Never — server-only |
| Skipping `stale_in_progress_reaper` | Faster to ship | Jobs permanently stuck after any crash | Never — ship it with the worker |
| Using service catalog `durationMinutes` in recurring generator | No schema change | Future bookings wrong duration after SEED-029 | Never — add column to `recurringBookings` |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Resend | Call `new Resend(apiKey).emails.send()` without checking response | Destructure `{ data, error }` from send(), log `error` to `notificationLogs` if set |
| Resend domain | Add DNS records at root domain instead of send subdomain | Records go on `send.yourdomain.com`, not `yourdomain.com` |
| Resend + Nodemailer | Remove Nodemailer when Resend ships | Keep Nodemailer as fallback for subscription reminders and unconfigured tenants |
| Google Calendar sync in worker | Call GCal sync inline in the booking route (existing behavior) | Enqueue to `calendarSyncQueue`; worker handles retry |
| GHL sync | Replace existing `booking-ghl-sync.ts` entirely | Wrap existing functions as the "consumer" called by the worker — do not rewrite |
| pgBouncer + worker | Open transaction for SELECT, close, open new transaction for UPDATE | Do the SELECT FOR UPDATE and status UPDATE in one atomic statement in one transaction |
| GitHub Actions cron | Assume exactly-once delivery | Design worker to be idempotent; duplicate runs must be harmless |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `getAvailabilityForDate` called N times for monthly calendar with new duration | Slow date picker for multi-duration services (30 calls × duration resolution) | Batch duration resolution before calling availability | At ~10 concurrent bookings; visible immediately |
| `calendarSyncQueue` table grows unbounded without cleanup | Query slow-down for `pending` status scan | Add periodic hard-delete of `completedAt > 30 days` rows | At ~10K rows with no index on `(status, scheduled_for)` |
| React Email `render()` called on every booking request without caching | Slow booking confirmation (30-100ms per render) | Cache rendered HTML per template type (LRU, or pre-render at startup) | At >10 concurrent bookings |
| Monthly availability endpoint iterates all 31 days calling DB per day | Slow month picker for large calendars | Already handled with GHL fast-path; for staff-based path, batch the DB queries | At >5 staff members, already borderline |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Internal calendar sync trigger endpoint (`/api/internal/calendar-sync/run`) exposed without auth | Anyone can trigger unlimited GHL/GCal API calls, exhausting rate limits | Require `X-Internal-Secret` header matching a `INTERNAL_CRON_SECRET` env var; validate in middleware |
| Resend API key stored in `companySettings` JSONB without encryption | DB read = API key exposure | Store in `integrationSettings` table (consistent with existing GHL/Twilio pattern); do not put in `companySettings` |
| Email template renders unescaped customer data | XSS in email clients that render HTML | React Email components escape by default; never use `dangerouslySetInnerHTML` in templates |
| Duration override not validated server-side | Customer sends `durationMinutes=1` in booking payload, blocks a slot that is too short | Server must resolve `durationMinutes` from `serviceDurations` by ID; never trust the client-supplied duration value |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Duration selector appears as a booking step before the calendar | Adds friction; users don't understand why they're choosing before seeing dates | Show duration selector inline in the cart / service card before the booking flow starts |
| Calendar shows "no available slots" because duration calculation was wrong | Customer abandons; thinks the business is unavailable | Test that selecting 4h duration correctly reduces available slots vs 2h on the same day |
| Confirmation email sent with plain text fallback because Resend domain not verified | Professional appearance lost; email looks like spam | Verify domain before launch; Nodemailer fallback must also send HTML, not just text |
| Admin sync health panel shows only counts, not which bookings are affected | Admin can't act — no way to identify which customer's calendar didn't sync | Each `failed_permanent` row must be linkable to the booking ID and customer name |
| Duration change mid-cart (customer changes their mind) resets selected time slot | Confusing — customer must re-pick a time | After duration change, clear `selectedTime` and `selectedDate` so the calendar re-renders for the new duration |

---

## "Looks Done But Isn't" Checklist

- [ ] **Duration selector:** Verify `totalDuration` in `useAvailability` hook equals the selected duration, not the catalog default — check the network request `totalDurationMinutes` param in DevTools
- [ ] **Resend emails:** Check `notificationLogs` table for email rows after booking, not just "no error in console"
- [ ] **Calendar Harmony worker:** Confirm jobs transition from `pending` → `success` in the DB after a real booking — do not rely only on logs
- [ ] **Worker idempotency:** Trigger the GH Actions workflow manually twice in quick succession and confirm no duplicate GCal events are created
- [ ] **Orphan reaper:** Kill the worker process mid-job (or simulate with a timeout) and confirm the row eventually reverts to `pending`
- [ ] **Resend domain:** Check Resend dashboard "Domains" tab shows green "Verified" before go-live
- [ ] **React Email templates:** Open rendered HTML in Gmail, Apple Mail, and Outlook (use Litmus or Email on Acid) — Tailwind grid/flex classes do not work in all clients
- [ ] **Duration in recurring bookings:** Create a recurring subscription with a non-default duration, advance `nextBookingDate`, run the generator, and confirm the generated booking has the correct `totalDurationMinutes`
- [ ] **Internal endpoint auth:** Attempt to call `/api/internal/calendar-sync/run` without the secret header and confirm 401

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| pgBouncer advisory lock deadlock in worker | HIGH | Identify and kill blocked sessions in Supabase SQL editor; rewrite worker to use only row-level locking; re-run failed jobs |
| Orphaned `in_progress` rows | LOW | Run SQL to reset: `UPDATE calendar_sync_queue SET status = 'pending' WHERE status = 'in_progress' AND last_attempt_at < NOW() - INTERVAL '1 hour'` |
| Emails not sent due to Resend domain unverified | MEDIUM | Add DNS records, wait propagation, use "Retry now" on failed `notificationLogs` rows, or re-send manually via admin action |
| Slots showing wrong availability due to duration bug | HIGH | Hotfix `CartContext.totalDuration` computation; cancel any double-booked appointments manually; notify affected customers |
| GH Actions cron never triggers worker on Vercel | LOW | Add `workflow_dispatch` trigger to the cron workflow for manual runs; verify `VERCEL_URL` env var is set in Actions secrets |
| React Email templates crash browser | MEDIUM | Move template files to `server/emails/`; rebuild; redeploy |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| pgBouncer advisory lock incompatibility | SEED-002 schema + worker phase | SQL: confirm worker uses only `FOR UPDATE SKIP LOCKED`, no `pg_advisory_*` calls |
| `in_progress` orphan rows | SEED-002 worker phase | Kill worker mid-run; confirm row reverts to `pending` within 10 minutes |
| `totalDuration` uses catalog default not selected duration | SEED-029 duration selector phase | DevTools: confirm `totalDurationMinutes` param equals selected duration in API call |
| `BookingPage.tsx` bloat from new step | SEED-029 duration selector phase | `wc -c client/src/pages/BookingPage.tsx` must not exceed 42KB |
| Resend domain not verified at launch | SEED-019 email phase (pre-flight checklist) | Resend dashboard green; send test email from prod environment |
| React Email render in browser | SEED-019 email phase | Template files are in `server/` only; `grep -r "@react-email/render" client/` returns nothing |
| node-cron dead on Vercel | SEED-002 worker phase | Vercel function logs show no cron output; GH Actions logs show worker run |
| Recurring bookings wrong duration after SEED-029 | SEED-029 phase (recurringBookings schema update) | Generator test with non-default duration produces correct `totalDurationMinutes` |

---

## Sources

- Supabase Docs: pgBouncer / Supavisor connection pooling — transaction mode incompatibilities with advisory locks (verified: [supabase.com/docs/guides/database/connecting-to-postgres](https://supabase.com/docs/guides/database/connecting-to-postgres))
- PgBouncer GitHub Issue #102: Session advisory locks incompatible with transaction pooling ([github.com/pgbouncer/pgbouncer/issues/102](https://github.com/pgbouncer/pgbouncer/issues/102))
- River Queue docs: pgBouncer + SELECT FOR UPDATE SKIP LOCKED worker coordination ([riverqueue.com/docs/pgbouncer](https://riverqueue.com/docs/pgbouncer))
- SupaExplorer: SKIP LOCKED best practice for Supabase queue ([supaexplorer.com/best-practices/supabase-postgres/lock-skip-locked](https://supaexplorer.com/best-practices/supabase-postgres/lock-skip-locked/))
- Resend Docs: Domain verification failure modes and DNS requirements ([resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying](https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying))
- React Email changelog: `renderAsync` deprecated, `render()` is now async in v3+ ([react.email/docs/changelog](https://react.email/docs/changelog))
- React Email GitHub Issue #977: `@react-email/render` requires `serverComponentsExternalPackages` in Next.js — confirms server-only constraint ([github.com/resend/react-email/issues/977](https://github.com/resend/react-email/issues/977))
- Vercel docs: Serverless functions cannot run persistent processes; cron jobs must use Vercel Cron or external triggers ([vercel.com/docs/cron-jobs/manage-cron-jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs))
- GitHub Actions runner Issue #764: Cron jobs can fire twice — idempotency required ([github.com/actions/runner/issues/764](https://github.com/actions/runner/issues/764))
- Codebase: `client/src/context/CartContext.tsx` lines 222–225 — `totalDuration` computation (direct read)
- Codebase: `server/services/recurring-booking-generator.ts` line 79 — `service.durationMinutes` direct read
- Codebase: `server/db.ts` line 119 — `prepare: false` confirms pgBouncer transaction mode

---

*Pitfalls research for: v5.0 Booking Experience (SEED-002, SEED-019, SEED-029)*
*Researched: 2026-05-11*
