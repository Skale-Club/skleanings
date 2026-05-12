---
phase: 32-calendar-harmony-retry-queue
plan: 01
subsystem: database
tags: [drizzle, postgresql, queue, calendar-sync, ghl, google-calendar]

requires: []
provides:
  - calendarSyncQueue Drizzle table with two indexes (status/scheduled, booking/target)
  - CalendarSyncJob and InsertCalendarSyncJob TypeScript types
  - CalendarSyncHealth interface for admin panel health endpoint
  - IStorage methods: enqueueCalendarSync, getCalendarSyncHealth, retryCalendarSyncJob, listRecentSyncFailures
  - DatabaseStorage implementation of all four methods
  - Migration SQL: supabase/migrations/20260512000000_add_calendar_sync_queue.sql
affects:
  - 32-02 (worker that reads/writes queue rows)
  - 32-03 (admin panel UI consuming getCalendarSyncHealth and listRecentSyncFailures)

tech-stack:
  added: []
  patterns:
    - "Durable retry queue pattern — status enum (pending/in_progress/success/failed_retryable/failed_permanent) with scheduled_for for delayed retry"
    - "Array.from(db.execute(sql\`...\`)) for raw SQL result sets (RowList type has no .rows property)"

key-files:
  created:
    - supabase/migrations/20260512000000_add_calendar_sync_queue.sql
  modified:
    - shared/schema.ts
    - server/storage.ts

key-decisions:
  - "db.execute() returns a RowList directly — use Array.from(result) not result.rows to iterate; plan code used .rows which caused TS2339 errors"
  - "CalendarSyncHealth.failedPermanentCount counts only last-24h rows to serve the SYNC-06 alert banner"
  - "Migration applied via supabase db push (Supabase CLI), NOT drizzle-kit push"

patterns-established:
  - "Pattern: enqueue-on-booking — call storage.enqueueCalendarSync(bookingId, target, operation, payload) from routes when a booking is created/updated/cancelled"
  - "Pattern: health-per-target — getCalendarSyncHealth returns one CalendarSyncHealth object per target string (ghl_contact, ghl_appointment, google_calendar)"

requirements-completed: [SYNC-01, SYNC-02, SYNC-03]

duration: 20min
completed: 2026-05-11
---

# Phase 32 Plan 01: Calendar Sync Queue — Schema and Storage Layer Summary

**Durable PostgreSQL job queue for GHL and Google Calendar sync with per-target health metrics and manual retry support.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-11T17:30:00Z
- **Completed:** 2026-05-11T17:50:00Z
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

### Task 1 — calendarSyncQueue Drizzle table + migration SQL

Added `calendarSyncQueue` to `shared/schema.ts` after the existing `notificationLogs` table:

- `pgTable("calendar_sync_queue", ...)` with columns: `id`, `bookingId` (FK -> bookings CASCADE), `target`, `operation`, `payload` (jsonb), `status` (default "pending"), `attempts`, `lastAttemptAt`, `lastError`, `scheduledFor`, `completedAt`, `createdAt`
- Two compound indexes: `csq_status_scheduled_idx(status, scheduledFor)` for worker polling; `csq_booking_target_idx(bookingId, target)` for deduplication checks
- Exported: `CalendarSyncJob`, `InsertCalendarSyncJob`, `insertCalendarSyncJobSchema`
- Exported `CalendarSyncHealth` interface (used by Plan 03 UI and Plan 02 worker health endpoint)

Created `supabase/migrations/20260512000000_add_calendar_sync_queue.sql` with `CREATE TABLE IF NOT EXISTS calendar_sync_queue` and both `CREATE INDEX IF NOT EXISTS` statements.

### Task 2 — IStorage interface + DatabaseStorage implementation

Added to `server/storage.ts`:

- Imports: `calendarSyncQueue`, `CalendarSyncHealth`, `CalendarSyncJob` from `@shared/schema`
- 4 method signatures in `IStorage`
- 4 method implementations in `DatabaseStorage`:
  - `enqueueCalendarSync` — `db.insert(calendarSyncQueue).values({...})`
  - `getCalendarSyncHealth` — iterates 3 targets, runs count queries + recent-failures query, returns `CalendarSyncHealth[]`
  - `retryCalendarSyncJob` — raw UPDATE sets status back to 'pending' and clears last_error
  - `listRecentSyncFailures` — optional target filter, returns CalendarSyncJob[] ordered by last_attempt_at DESC

## CalendarSyncHealth Interface (for Plan 03 UI executor reference)

```typescript
export interface CalendarSyncHealth {
  target: string;               // 'ghl_contact' | 'ghl_appointment' | 'google_calendar'
  pendingCount: number;         // jobs currently pending (real-time queue depth)
  failedPermanentCount: number; // failed_permanent in last 24h (drives alert banner)
  recentFailures: {
    id: number;
    bookingId: number;
    lastError: string | null;
    lastAttemptAt: Date | null;
    attempts: number;
  }[];                          // up to 20 most-recent failed_permanent rows for this target
}
```

The admin panel GET `/api/admin/calendar-sync/health` (Plan 03) should call `storage.getCalendarSyncHealth()` and return the array directly.

## Migration

**File:** `supabase/migrations/20260512000000_add_calendar_sync_queue.sql`

**IMPORTANT:** User must apply this migration manually:
```
supabase db push
```
Or paste the SQL into Supabase Dashboard > SQL Editor. Do NOT run `drizzle-kit push`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed .rows property access on db.execute() result**
- **Found during:** Task 2 verification (npm run check)
- **Issue:** Plan code used `result.rows[0]` and `rows.rows as CalendarSyncJob[]` — but `db.execute()` in this project's Drizzle setup returns a `RowList<Record<string, unknown>[]>` directly (no `.rows` property). TypeScript reported TS2339 errors on 5 lines.
- **Fix:** Changed `result.rows[0]` to `result[0]`, and `rows.rows as CalendarSyncJob[]` to `Array.from(rows) as CalendarSyncJob[]`
- **Files modified:** `server/storage.ts`
- **Commit:** 0107db1

## Known Stubs

None — this plan is pure data-layer. No UI components.

## Self-Check: PASSED

- `shared/schema.ts` contains `calendarSyncQueue` (lines 1130, 1149, 1150, 1151) and `CalendarSyncHealth` (line 1153)
- `supabase/migrations/20260512000000_add_calendar_sync_queue.sql` exists with CREATE TABLE + 2 CREATE INDEX statements
- `server/storage.ts` has all 4 method signatures (lines 408-411) and 4 implementations (lines 2159, 2169, 2213, 2224)
- `npm run check` exits 0
- `npm run build` exits 0 (3 pre-existing warnings, no errors)
