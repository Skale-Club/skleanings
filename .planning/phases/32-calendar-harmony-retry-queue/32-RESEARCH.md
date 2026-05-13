# Phase 32: Calendar Harmony Retry Queue - Research

**Researched:** 2026-05-12
**Domain:** PostgreSQL job queue (SELECT FOR UPDATE SKIP LOCKED), GitHub Actions cron, Express worker pattern, React Query admin observability panel
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-01 | Booking create/update/cancel enqueue sync jobs — no direct GCal or GHL API calls remain in booking handler | `syncBookingToGhl()` at line 243 of `server/routes/bookings.ts` confirmed as the only direct sync call; GCal is currently read-only (no event writes in booking handler) — enqueue pattern replaces the GHL call and adds a slot for future GCal writes |
| SYNC-02 | Worker: SELECT FOR UPDATE SKIP LOCKED + 6 retries with exponential backoff → failed_permanent | Raw `db.execute(sql\`...\`)` pattern confirmed; Drizzle `.for("update", {skipLocked:true})` bug #3554 documented; backoff schedule `[1, 5, 30, 120, 720, 1440]` minutes maps to 6 attempts |
| SYNC-03 | Single-transaction pattern (no orphan in_progress) + stale-row reaper for rows stuck > 10min | pgBouncer transaction mode confirmed via `prepare: false` in `server/db.ts`; single-transaction is the mandated approach; reaper is a safety net |
| SYNC-04 | Admin sync health panel: pending/failed counts by target + recent failures table | GHLTab.tsx pattern in `client/src/components/admin/integrations/` is the exact UI model; React Query with 30s refetch established in other panels |
| SYNC-05 | Admin manual retry per booking | `POST /api/admin/calendar-sync/:jobId/retry` — resets status='pending', scheduledFor=now(); follows existing admin mutation pattern |
| SYNC-06 | Banner after 10+ consecutive failures from same target | `CalendarReconnectBanner.tsx` already exists — reuse or extend the banner component pattern; consecutive_failures column or derived count needed |
| SYNC-07 | GitHub Actions workflow fires worker every 5 minutes | `recurring-bookings-cron.yml` is the exact template; uses `CRON_SECRET` + `APP_URL` vars already in GitHub Actions secrets |
</phase_requirements>

---

## Summary

Phase 32 replaces the fire-and-forget `syncBookingToGhl()` call in `server/routes/bookings.ts` with a durable `calendarSyncQueue` table processed by a retry worker. All three external sync targets — `google_calendar`, `ghl_contact`, `ghl_appointment` — are enqueued as separate rows so each can retry independently. The worker uses `SELECT FOR UPDATE SKIP LOCKED` in a single atomic transaction (required by pgBouncer transaction mode already confirmed in `server/db.ts`). GitHub Actions fires the worker every 5 minutes using the identical curl-and-secret pattern established in `recurring-bookings-cron.yml`.

The admin observability side — sync health panel, manual retry, and consecutive-failure banner — maps cleanly onto the existing `IntegrationsSection` tab pattern (`GHLTab.tsx` structure, `CalendarReconnectBanner.tsx` banner). The `calendarSyncQueue` table and its IStorage methods are the only net-new schema additions in this phase; both `emailSettings` and `serviceDurations` were delivered in prior phases.

**Critical discovery:** Google Calendar integration in this codebase is currently **read-only** (scope `calendar.readonly` — used only for busy-time queries, not event writes). The phase spec mentions `google_calendar` as a sync target, but the system has no GCal event-creation path today. The worker must be built to call a `createGCalEvent()` function that does not yet exist. The plan must explicitly include creating `createGCalEvent()` in `server/lib/google-calendar.ts` with a write-capable OAuth scope (`calendar.events`). This is the largest hidden complexity in the phase.

**Primary recommendation:** Build in five sequential waves — (1) schema + migration, (2) IStorage methods, (3) worker + GCal write function, (4) route rewiring (replace syncBookingToGhl), (5) admin UI + GH Actions workflow.

---

## Standard Stack

### Core (no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | existing | Schema definition + typed queries | Project standard — all DB through IStorage |
| `db.execute(sql\`...\`)` | existing | Raw SQL for SELECT FOR UPDATE SKIP LOCKED | Required workaround for Drizzle bug #3554 — `.for("update", {skipLocked:true})` generates malformed SQL |
| googleapis / google-auth-library | existing | Google Calendar OAuth + API | Already powering busy-time queries; extend to event writes |
| node-cron | existing | Local dev worker tick (non-Vercel only) | Pattern established in `server/services/cron.ts` with `isServerless` guard |
| GitHub Actions | existing | Production worker trigger every 5 minutes | Required — Vercel serverless cannot run persistent cron; CRON_SECRET already in repo secrets |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | existing | Admin health panel data fetching + 30s auto-refresh | Established pattern in all admin integration tabs |
| shadcn/ui (Card, Badge, Button, Table) | existing | Admin panel UI components | Standard admin component set |

### Alternatives Not Used

| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| pg-boss | Custom SELECT FOR UPDATE | Out of scope per REQUIREMENTS.md — volume < 500 bookings/month doesn't warrant it |
| Vercel Cron | GitHub Actions | Already have GH Actions infra + CRON_SECRET; Vercel Cron requires paid plan changes |
| pgEnum for status/target | text column | Codebase-wide convention: all enum-like values are plain text columns (ghlSyncStatus, booking status, notificationLogs channel) |
| Session-level advisory locks | Row-level FOR UPDATE SKIP LOCKED | pgBouncer transaction mode breaks session locks — confirmed by `prepare: false` in `server/db.ts` |

**No new npm packages required.** All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
server/
├── services/
│   └── calendar-sync-worker.ts        # NEW — runCalendarSyncWorker()
├── routes/
│   └── calendar-sync.ts               # NEW — health + retry endpoints
└── lib/
    └── google-calendar.ts             # MODIFIED — add createGCalEvent()

client/src/components/admin/integrations/
└── CalendarSyncTab.tsx                # NEW — health panel (mounted in IntegrationsSection)

supabase/migrations/
└── 20260512000000_add_calendar_sync_queue.sql  # NEW

shared/
└── schema.ts                          # MODIFIED — add calendarSyncQueue table

server/
└── storage.ts                         # MODIFIED — add queue IStorage methods

.github/workflows/
└── calendar-sync-cron.yml             # NEW — every 5 minutes
```

### Pattern 1: calendarSyncQueue Table Schema

```typescript
// shared/schema.ts addition
export const calendarSyncQueue = pgTable("calendar_sync_queue", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  target: text("target").notNull(),       // 'google_calendar' | 'ghl_contact' | 'ghl_appointment'
  operation: text("operation").notNull(), // 'create' | 'update' | 'cancel'
  payload: jsonb("payload").$type<CalendarSyncPayload>(),
  status: text("status").notNull().default("pending"),
  // 'pending' | 'in_progress' | 'success' | 'failed_permanent'
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  lastError: text("last_error"),
  scheduledFor: timestamp("scheduled_for").defaultNow(),
  completedAt: timestamp("completed_at"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  statusScheduledIdx: index("csq_status_scheduled_idx").on(table.status, table.scheduledFor),
  bookingTargetIdx: index("csq_booking_target_idx").on(table.bookingId, table.target),
}));
```

**Note:** `consecutiveFailures` is a per-row counter. For SYNC-06 (banner after 10+ consecutive failures from same target), the health endpoint aggregates across rows of the same target where status = 'failed_permanent' in a rolling window, OR you track it in a separate counter. The simplest approach: the health endpoint returns `failedPermanentCount` per target; the admin UI shows the banner when this count >= 10. No separate column needed.

### Pattern 2: SELECT FOR UPDATE SKIP LOCKED — The Only Safe Worker Pattern

```typescript
// server/services/calendar-sync-worker.ts
// Source: Supabase docs + pgBouncer compatibility requirement from server/db.ts

const BACKOFF_MINUTES = [1, 5, 30, 120, 720, 1440]; // 6 attempts → failed_permanent

export async function runCalendarSyncWorker(): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  // Dequeue up to 5 pending jobs — one transaction per job (not batch)
  // ORDER: google_calendar first (operational calendar, shows on staff phones)
  const jobs = await db.execute(sql`
    SELECT * FROM calendar_sync_queue
    WHERE status = 'pending'
      AND scheduled_for <= NOW()
    ORDER BY
      CASE WHEN target = 'google_calendar' THEN 0 ELSE 1 END,
      scheduled_for ASC
    LIMIT 5
    FOR UPDATE SKIP LOCKED
  `);
  // NOTE: The above SELECT must be inside a transaction that also does the UPDATE
  // Use db.transaction() to keep the lock alive through the API call

  for (const job of jobs.rows) {
    try {
      await db.transaction(async (tx) => {
        // Re-lock the specific row atomically
        const [locked] = await tx.execute(sql`
          UPDATE calendar_sync_queue
          SET status = 'in_progress', last_attempt_at = NOW()
          WHERE id = ${job.id} AND status = 'pending'
          RETURNING *
        `);
        if (!locked) return; // another worker got it first

        try {
          await executeJob(job); // dispatches to GHL or GCal

          await tx.execute(sql`
            UPDATE calendar_sync_queue
            SET status = 'success', completed_at = NOW()
            WHERE id = ${job.id}
          `);
          processed++;
        } catch (err) {
          const nextAttempt = (job.attempts as number) + 1;
          const permanent = nextAttempt >= BACKOFF_MINUTES.length;
          const backoffMs = BACKOFF_MINUTES[Math.min(job.attempts as number, BACKOFF_MINUTES.length - 1)] * 60_000;

          await tx.execute(sql`
            UPDATE calendar_sync_queue
            SET
              status = ${permanent ? 'failed_permanent' : 'pending'},
              attempts = ${nextAttempt},
              last_error = ${String(err)},
              scheduled_for = ${permanent ? null : new Date(Date.now() + backoffMs)},
              last_attempt_at = NOW()
            WHERE id = ${job.id}
          `);
          errors++;
        }
      });
    } catch (txErr) {
      console.error('[CalendarSyncWorker] Transaction error:', txErr);
    }
  }

  return { processed, errors };
}
```

**CRITICAL:** The outer `SELECT ... FOR UPDATE SKIP LOCKED` must be inside the same transaction as the UPDATE. Do NOT do: select outside tx, then update inside tx. This is the two-phase orphan bug. The correct pattern is `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`.

### Pattern 3: Single-Statement Dequeue (preferred over two-step)

```sql
-- Preferred dequeue pattern — atomically claims AND marks in_progress in one statement
UPDATE calendar_sync_queue
SET status = 'in_progress', last_attempt_at = NOW()
WHERE id IN (
  SELECT id FROM calendar_sync_queue
  WHERE status = 'pending' AND scheduled_for <= NOW()
  ORDER BY
    CASE WHEN target = 'google_calendar' THEN 0 ELSE 1 END,
    scheduled_for ASC
  LIMIT 5
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

This pattern is safer than checking for a locked row after the fact. The `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)` is one statement, one round-trip, no orphan risk if the worker crashes AFTER this statement (the row is already `in_progress`, but the stale-row reaper handles that).

### Pattern 4: Stale-Row Reaper (safety net for in_progress orphans)

```sql
-- Add to runCalendarSyncWorker() before the main dequeue
UPDATE calendar_sync_queue
SET
  status = 'pending',
  scheduled_for = NOW(),
  last_error = 'Reaped: stuck in_progress > 10min'
WHERE
  status = 'in_progress'
  AND last_attempt_at < NOW() - INTERVAL '10 minutes';
```

Run this at the TOP of `runCalendarSyncWorker()` before dequeuing new jobs. This means even if the single-transaction approach is implemented correctly, the reaper provides a second layer of defense against process-kill crashes or Vercel function timeouts.

### Pattern 5: Enqueue on Booking Events

```typescript
// server/routes/bookings.ts — replace syncBookingToGhl() block

// Build payload once — contains enough data to re-execute without re-fetching
const syncPayload = {
  bookingId: booking.id,
  customerName: booking.customerName,
  customerEmail: booking.customerEmail,
  customerPhone: booking.customerPhone,
  customerAddress: booking.customerAddress,
  bookingDate: booking.bookingDate,
  startTime: booking.startTime,
  endTime: booking.endTime,
  staffMemberId: booking.staffMemberId,
  utmSessionId: booking.utmSessionId,
};

// Replace direct syncBookingToGhl() call — fire-and-forget enqueue
void Promise.all([
  storage.enqueueCalendarSync(booking.id, 'ghl_contact', 'create', syncPayload),
  storage.enqueueCalendarSync(booking.id, 'ghl_appointment', 'create', syncPayload),
  storage.enqueueCalendarSync(booking.id, 'google_calendar', 'create', syncPayload),
]).catch(err => console.error('[CalendarSync] Enqueue error:', err));
```

### Pattern 6: GitHub Actions Workflow (based on recurring-bookings-cron.yml)

```yaml
# .github/workflows/calendar-sync-cron.yml
name: Calendar Sync Worker

on:
  schedule:
    - cron: '*/5 * * * *'   # every 5 minutes
  workflow_dispatch:
    inputs:
      reason:
        description: 'Reason for manual trigger'
        required: false
        default: 'Manual trigger'

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 4          # must complete before next 5-min tick
    steps:
      - name: Run Calendar Sync Worker
        env:
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
          APP_URL: ${{ vars.APP_URL }}
        run: |
          APP_URL="${APP_URL%/}"
          RESPONSE=$(curl -L -s -w "\n%{http_code}" -X POST \
            "${APP_URL}/api/integrations/calendar-sync/cron/run" \
            -H "Authorization: Bearer ${CRON_SECRET}" \
            -H "Content-Type: application/json" \
            --max-time 60)
          HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
          BODY=$(echo "$RESPONSE" | sed '$d')
          echo "Response: $BODY"
          echo "HTTP Status: $HTTP_CODE"
          if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
            echo "Calendar sync cron failed with HTTP $HTTP_CODE"
            exit 1
          fi
```

**Note on endpoint path:** Use `/api/integrations/calendar-sync/cron/run` to match the project's integration router mount pattern (integrations.ts mounts subrouters). The cron endpoint validates `Authorization: Bearer ${CRON_SECRET}` header.

### Pattern 7: Admin Health Panel (CalendarSyncTab.tsx)

```typescript
// Mount in IntegrationsSection.tsx — add 'calendar-sync' to INTEGRATION_TABS
// Add <CalendarSyncTab> as a new TabsContent

// Health data shape from GET /api/admin/calendar-sync/health
interface SyncHealthData {
  targets: {
    target: string;           // 'ghl_contact' | 'ghl_appointment' | 'google_calendar'
    pendingCount: number;
    failedPermanentCount: number;
    recentFailures: {
      id: number;
      bookingId: number;
      customerName: string;
      lastError: string;
      lastAttemptAt: string;
      attempts: number;
    }[];
  }[];
}

// React Query with 30s auto-refresh — established pattern
const { data } = useQuery({
  queryKey: ['/api/admin/calendar-sync/health'],
  refetchInterval: 30_000,
  queryFn: async () => { /* fetch with auth token */ }
});

// Banner condition for SYNC-06
const hasConsecutiveFailures = (data?.targets ?? []).some(t => t.failedPermanentCount >= 10);
```

### Anti-Patterns to Avoid

- **Two-transaction worker:** Never do SELECT (tx1 commits) then UPDATE (tx2). The row stays `in_progress` permanently if the process dies between the two commits. Use single-transaction with the atomic UPDATE...RETURNING pattern.
- **`pg_advisory_lock` alongside row locking:** Never add advisory locks on a pgBouncer-pooled connection. `server/db.ts` already uses `prepare: false` confirming transaction pooling is active.
- **Keeping `syncBookingToGhl()` alongside queue:** Remove the direct call entirely on the same commit that adds enqueue. Dual paths cause double-sync, race conditions on `ghlAppointmentId`, and two sources of truth.
- **Drizzle `.for("update", { skipLocked: true })`:** Bug #3554 — generates malformed SQL. Use `db.execute(sql\`...\`)` exclusively for the lock query.
- **GCal write with `calendar.readonly` scope:** Current scope is read-only. Event creation requires `calendar.events` scope. The existing OAuth flow must be updated AND staff must reconnect their calendars after scope change (breaks existing tokens).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotency on duplicate GH Actions fire | Custom dedup table | SELECT FOR UPDATE SKIP LOCKED | Second invocation finds no unlocked rows and exits cleanly — idempotency is built into the locking pattern |
| Admin table with manual pagination | Custom pagination component | shadcn/ui Table + limit=20 query param | Health panel only needs last 20 failures per target — not a high-volume reporting surface |
| GCal event creation library | google-api-nodejs-client full SDK setup | Direct fetch to `https://www.googleapis.com/calendar/v3/calendars/{id}/events` | Already using raw fetch for busy-time queries; no new SDK needed, reuse existing OAuth token pattern |
| Retry scheduling math | Custom time arithmetic | `new Date(Date.now() + backoffMinutes * 60_000)` | Trivial — no library needed |

---

## Runtime State Inventory

> This is a modification phase (replacing direct API calls with queue), not a rename/refactor. No runtime state with old string keys is affected. The section is included to confirm explicitly.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `ghlSyncStatus` column on bookings still tracks legacy sync state — not removed by this phase | No action — preserved as-is; new status tracked in `calendar_sync_queue` rows |
| Live service config | GHL integration settings in `integrationSettings` table — unchanged | None |
| OS-registered state | None — no task scheduler registrations | None |
| Secrets/env vars | `CRON_SECRET` already in GitHub Actions secrets (used by recurring-bookings-cron.yml); `APP_URL` already in GitHub Actions vars | None for existing; Phase 32 cron uses the same values — no new secrets needed |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: GCal Is Read-Only — No Event Creation Path Exists Yet

**What goes wrong:** The phase spec treats `google_calendar` as a sync target like GHL, but `server/lib/google-calendar.ts` only exposes `getStaffBusyTimes()` and `getAuthUrl()`. There is no `createGCalEvent()` function. The OAuth scope is `calendar.readonly` — event creation requires `calendar.events`. If the worker dispatches a `google_calendar` job, it has nothing to call.

**Why it happens:** Prior phases only needed to READ Google Calendar (for availability queries). Event creation was never implemented.

**How to avoid:** The plan must include creating `createGCalEvent(staffMemberId, booking)` in `server/lib/google-calendar.ts` with the `calendar.events` scope. The scope change means existing staff calendar tokens (which authorized `calendar.readonly`) will not have the write permission — staff must be prompted to reconnect. Options: (a) add write scope alongside read in the same OAuth flow, (b) ship google_calendar enqueue but mark it as a "future target" that the worker skips until properly authorized.

**Recommended approach:** Enqueue `google_calendar` jobs but have the worker skip them gracefully (log + immediately mark success) until `createGCalEvent()` is implemented and the OAuth scope is upgraded. This ships the queue infrastructure without breaking anything. The GCal write feature becomes a follow-up.

**Warning signs:** Worker crashes with "TypeError: executeJob is not a function" or "createGCalEvent is not defined" when processing `google_calendar` rows.

### Pitfall 2: pgBouncer Breaks Advisory Locks — Use Row-Level Locking Only

**What goes wrong:** Any `pg_advisory_lock()` or session-level lock will silently fail or deadlock under Supabase's pgBouncer transaction mode.

**Why it happens:** `server/db.ts` has `prepare: false` — this is the pgBouncer transaction mode flag. Session-level state (including advisory locks) does not persist across statements in transaction mode.

**How to avoid:** Use only `SELECT ... FOR UPDATE SKIP LOCKED` inside a `db.transaction()`. Never add `pg_advisory_*` calls.

**Warning signs:** Two workers both believe they hold a lock on the same job; jobs processed twice producing duplicate GHL contacts.

### Pitfall 3: Two-Phase Worker Creates Permanent in_progress Orphans

**What goes wrong:** If the worker marks a row `in_progress` (commits that transaction), then the Vercel function times out or the process crashes before marking `success` or `failed`, the row stays `in_progress` forever.

**Why it happens:** Developers split "claim the job" and "update result" into separate transactions for performance, not realizing the commit is irreversible.

**How to avoid:** Single-transaction pattern: `db.transaction()` wraps the entire dequeue + API call + status update. Also add stale-row reaper at the top of `runCalendarSyncWorker()`: reset rows where `status = 'in_progress' AND last_attempt_at < NOW() - INTERVAL '10 minutes'`.

**Warning signs:** `in_progress` count grows in the admin health panel after worker runs; jobs never progress.

### Pitfall 4: GH Actions Minimum Granularity is 5 Minutes — Not 1 Minute

**What goes wrong:** The original milestone research says "1-minute tick" but GitHub Actions cron minimum is 5 minutes (`*/1 * * * *` is not valid — GitHub silently rounds to 5 minutes minimum). Under load, GH Actions can also fire 1-2 minutes late.

**Why it happens:** GitHub Actions cron is not a real-time scheduler. It uses a shared job queue.

**How to avoid:** Use `*/5 * * * *` (every 5 minutes) as the canonical schedule. The worker processes up to 5 jobs per run, so even at 5-minute intervals, queue depth stays manageable at current booking volume (< 500/month). The node-cron local dev tick can remain at 1 minute since it runs in a persistent process.

**Warning signs:** Expecting sub-minute sync latency — this system provides ~5-minute eventual consistency, not real-time.

### Pitfall 5: CRON_SECRET Endpoint Must Be Auth-Protected

**What goes wrong:** `POST /api/integrations/calendar-sync/cron/run` exposed without authentication allows anyone to trigger unlimited GHL/GCal API calls.

**How to avoid:** Validate `Authorization: Bearer ${CRON_SECRET}` header matching `process.env.CRON_SECRET` env var. Pattern already established in `server/routes/recurring-bookings.ts` — copy it exactly.

### Pitfall 6: Booking Cancel/Update Paths Also Need Enqueue

**What goes wrong:** The phase spec says "create/update/cancel" but the codebase currently only has GHL sync on booking CREATE (line 243 of bookings.ts). The booking PATCH (status change to `cancelled`) and booking UPDATE paths do not currently call any sync. Phase 32 must add enqueue to these paths too.

**Why it happens:** The existing fire-and-forget GHL sync was only wired to the POST (create) handler. Cancellations and updates are not synced today.

**How to avoid:** Grep for all booking status-change handlers in `server/routes/bookings.ts` and add `enqueueCalendarSync()` calls with `operation: 'cancel'` and `operation: 'update'` respectively.

**Warning signs:** GHL contacts updated in the system but calendar appointments never reflect cancellations.

---

## Code Examples

### Verified: Booking Routes File — Current Direct Call (to be replaced)

```typescript
// server/routes/bookings.ts line 242-246 — CURRENT (verified by codebase read)
// Sync to GHL if enabled (non-blocking for booking creation)
const ghlSync = await syncBookingToGhl(booking);
if (ghlSync.attempted && !ghlSync.synced) {
    console.error("GHL Sync Error:", ghlSync.reason || "Unknown error");
}
// Replace the above 4 lines with enqueueCalendarSync() calls
```

### Verified: GH Actions Curl Pattern (from recurring-bookings-cron.yml)

```bash
# Exact pattern to replicate in calendar-sync-cron.yml
curl -L -s -w "\n%{http_code}" -X POST \
  "${APP_URL}/api/integrations/calendar-sync/cron/run" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 60
```

### Verified: IStorage Method Addition Pattern (from emailSettings)

```typescript
// server/storage.ts — pattern for new queue methods (mirrors emailSettings pattern lines 284-285)
// Interface declaration (in IStorage):
enqueueCalendarSync(bookingId: number, target: string, operation: string, payload: object): Promise<void>;
getCalendarSyncHealth(): Promise<CalendarSyncHealth[]>;
retryCalendarSyncJob(jobId: number): Promise<void>;

// Implementation (in DatabaseStorage):
async enqueueCalendarSync(bookingId: number, target: string, operation: string, payload: object): Promise<void> {
  await db.insert(calendarSyncQueue).values({ bookingId, target, operation, payload, status: 'pending' });
}
```

### Verified: node-cron Serverless Guard Pattern (from cron.ts)

```typescript
// server/services/cron.ts — existing guard pattern (verified)
const isServerless = !!process.env.VERCEL;

// Add inside the existing cron.schedule block (non-serverless only):
cron.schedule("* * * * *", async () => {
  try {
    const { runCalendarSyncWorker } = await import("./calendar-sync-worker");
    await runCalendarSyncWorker();
  } catch (error) {
    console.error("[CronService] Calendar sync worker error:", error);
  }
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pg-boss / Bull for job queues | Raw SELECT FOR UPDATE SKIP LOCKED | Postgres 9.5+ (2016) | Sufficient for < 1K jobs/day; no extra infra |
| Advisory locks for worker coordination | Row-level FOR UPDATE SKIP LOCKED | Standard since pgBouncer adoption | pgBouncer transaction mode breaks advisory locks |
| Vercel Cron (paid) | GitHub Actions cron | Always been the project pattern | Free, already configured, CRON_SECRET already exists |

**Deprecated/outdated in this codebase:**
- `syncBookingToGhl()` direct call in booking POST handler — replaced by `enqueueCalendarSync()` in this phase

---

## Open Questions

1. **GCal event creation scope upgrade**
   - What we know: Current scope is `calendar.readonly`; event creation requires `calendar.events`
   - What's unclear: Whether the plan should include the OAuth scope upgrade + `createGCalEvent()` implementation in this phase, or treat GCal writes as a follow-up
   - Recommendation: Enqueue `google_calendar` jobs but have the worker skip them gracefully (return success immediately without API call) until the GCal write feature is explicitly scoped. This keeps the queue infrastructure complete and unblocks GHL sync now.

2. **SYNC-06 consecutive failures definition**
   - What we know: "10+ consecutive failures from same target" — the word "consecutive" is ambiguous (per-booking? across all bookings for same target? in a rolling time window?)
   - What's unclear: Whether two bookings each failing 5 times = 10 consecutive failures, or one booking must fail 10 times
   - Recommendation: Define as "10 or more `failed_permanent` rows with the same target in the past 24 hours" — this is the most actionable signal for an admin (it means the integration is down, not just one difficult booking). Query: `COUNT(*) >= 10 WHERE status = 'failed_permanent' AND target = ? AND created_at > NOW() - INTERVAL '24 hours'`

3. **Payload completeness vs. DB re-fetch**
   - What we know: The milestone research recommends storing enough data in payload to re-execute without re-fetching
   - What's unclear: Whether to denormalize customer data into payload (simpler worker) or re-fetch from DB (payload stays small, no stale data risk)
   - Recommendation: Store minimal payload (`bookingId`, `operation`, `target`); worker always re-fetches booking + items from DB before executing. Stale payload data (e.g., if booking is updated between enqueue and execute) is a correctness risk not worth taking.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | calendarSyncQueue table | Yes (Supabase) | 15+ | — |
| `CRON_SECRET` secret in GitHub Actions | calendar-sync-cron.yml | Yes (used by recurring-bookings-cron.yml) | — | — |
| `APP_URL` var in GitHub Actions | calendar-sync-cron.yml | Yes (used by recurring-bookings-cron.yml) | — | — |
| GHL API credentials | ghl_contact/ghl_appointment worker | Conditionally (admin must configure) | — | Worker skips gracefully if not configured |
| Google Calendar OAuth + write scope | google_calendar worker | No (currently read-only scope) | — | Skip GCal jobs gracefully; implement in follow-up |

**Missing dependencies with no fallback:** None that block queue infrastructure.

**Missing dependencies with fallback:**
- GCal write scope — existing scope is read-only; worker gracefully skips `google_calendar` jobs until scope upgrade

---

## Validation Architecture

Nyquist validation: manual verification steps (no automated test framework detected for this stack).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Manual Verification |
|--------|----------|-----------|---------------------|
| SYNC-01 | POST /api/bookings creates 2-3 rows in calendar_sync_queue; no direct syncBookingToGhl() call | Manual | Check DB after booking; `grep -r "syncBookingToGhl" server/routes/bookings.ts` returns nothing |
| SYNC-02 | Worker processes pending rows with exponential backoff; failed_permanent after 6 attempts | Manual | Force a GHL error (wrong API key); observe row transitions over time |
| SYNC-03 | No orphan in_progress: kill worker mid-run; row reverts to pending within 10min | Manual | `kill -9` the dev server mid-worker; observe row status in DB |
| SYNC-04 | Admin panel shows pending/failed counts per target with recent failures | Manual | Create failing job; verify admin UI shows it within 30s |
| SYNC-05 | Retry button resets job to pending; job processes on next worker tick | Manual | Click Retry in admin UI; observe job status transition in DB |
| SYNC-06 | Banner appears when failedPermanentCount >= 10 for a target | Manual | Insert 10 failed_permanent rows for same target; verify banner renders |
| SYNC-07 | GH Actions fires cron endpoint; worker processes jobs in Vercel environment | Manual | Push to main; check GitHub Actions logs for successful POST; verify jobs transition |

### Wave 0 Gaps (pre-implementation)
- No test files exist for this feature — this phase is infrastructure/integration; rely on the manual checklist above
- Framework: Express test harness would require supertest setup not currently in project; out of scope

---

## Project Constraints (from CLAUDE.md)

- **Migrations:** Always use `supabase migration new` + `supabase db push` — never `drizzle-kit push` (TTY prompt issues confirmed in project memory)
- **Migration sequence:** Latest migration is `20260511000007_add_email_settings.sql`; next migration must use timestamp `20260512000000` or later
- **DB queries through IStorage:** All database operations go through `server/storage.ts` implementing `IStorage` — no raw SQL in routes (worker uses `db.execute` directly in `calendar-sync-worker.ts`, which is a service not a route — this is acceptable)
- **Enum-like values:** Plain `text` columns — no `pgEnum` (established by ghlSyncStatus, booking status, notificationLogs channel)
- **Fire-and-forget pattern:** Secondary operations that must not block booking response use `void promise.catch(err => console.error(...))` pattern
- **Admin UI pattern:** React Query + shadcn/ui; new admin panels follow IntegrationsSection tab model
- **Colors:** CTA buttons use Brand Yellow `#FFFF01` with black bold text; admin panels use existing muted color scheme
- **Fonts:** Outfit (headings), Inter (body) — already applied globally

---

## Sources

### Primary (HIGH confidence)
- Codebase inspection (verified 2026-05-12):
  - `server/routes/bookings.ts` line 243 — `syncBookingToGhl()` direct call (confirmed exists)
  - `server/lib/google-calendar.ts` line 32 — `calendar.readonly` scope (confirmed read-only)
  - `server/db.ts` — `prepare: false` (confirms pgBouncer transaction mode)
  - `server/services/cron.ts` — `isServerless` guard pattern
  - `.github/workflows/recurring-bookings-cron.yml` — exact curl+secret pattern to replicate
  - `server/storage.ts` lines 282-285 — IStorage emailSettings pattern
  - `shared/schema.ts` — `emailSettings` table exists; `calendarSyncQueue` does NOT exist yet
  - `supabase/migrations/` — latest migration is `20260511000007_add_email_settings.sql`
  - `client/src/components/admin/integrations/GHLTab.tsx` — React Query + authenticatedRequest admin pattern
  - `client/src/components/admin/CalendarReconnectBanner.tsx` — existing banner component to reuse/model
- `.planning/research/ARCHITECTURE.md` — SEED-002 architecture section
- `.planning/research/PITFALLS.md` — pgBouncer advisory lock, orphan reaper pitfalls

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — SEED-002 critical findings and stack decisions
- Milestone research: Drizzle bug #3554 (SKIP LOCKED query builder) — raw SQL workaround mandated
- GitHub Actions runner docs: minimum cron granularity is 5 minutes (confirmed in research notes)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all verified in installed package.json
- Architecture: HIGH — all integration points verified by direct file inspection
- Pitfalls: HIGH — pgBouncer issue verified via `prepare: false` in db.ts; GCal read-only verified via scope string in google-calendar.ts
- GCal write path: LOW confidence on exact implementation — `createGCalEvent()` does not exist and must be designed from scratch; OAuth scope upgrade impact on existing tokens is an open risk

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (stable domain — PostgreSQL locking patterns, GitHub Actions, Express patterns)
