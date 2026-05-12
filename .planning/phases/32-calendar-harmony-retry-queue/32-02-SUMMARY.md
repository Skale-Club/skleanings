---
phase: 32-calendar-harmony-retry-queue
plan: "02"
subsystem: calendar-sync
tags: [calendar-sync, retry-queue, worker, github-actions, bookings]
dependency_graph:
  requires: [32-01]
  provides: [32-03]
  affects: [server/routes/bookings.ts, server/routes.ts, server/services/cron.ts]
tech_stack:
  added: []
  patterns:
    - Atomic dequeue with raw SQL FOR UPDATE SKIP LOCKED (Drizzle bug #3554 workaround)
    - Exponential backoff with permanent failure after 6 attempts
    - Fire-and-forget enqueue replacing direct GHL sync call
    - Stale-row reaper for crash recovery
key_files:
  created:
    - server/services/calendar-sync-worker.ts
    - server/routes/calendar-sync.ts
    - .github/workflows/calendar-sync-cron.yml
  modified:
    - server/routes.ts
    - server/routes/bookings.ts
    - server/services/cron.ts
decisions:
  - "db.execute() returns RowList not {rows:[]}, cast with 'as unknown as Array<T>' pattern (matches booking-email-reminders.ts pattern)"
  - "syncBookingToGhl import fully removed from bookings.ts — no other usages existed"
  - "Cancel enqueue placed after Phase 31 cancellation email block in PUT /:id/status handler"
  - "calendarSyncRouter mounted BEFORE recurringBookingsRouter in routes.ts to avoid /api/integrations path conflicts"
metrics:
  duration_seconds: 1113
  completed_date: "2026-05-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3
---

# Phase 32 Plan 02: Calendar Sync Worker and Route Wiring Summary

**One-liner:** Calendar sync queue worker with atomic FOR UPDATE SKIP LOCKED dequeue, 6-attempt exponential backoff, and GH Actions 5-minute cron trigger replacing direct GHL fire-and-forget call.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create calendar-sync-worker.ts | 5df0c3d | server/services/calendar-sync-worker.ts |
| 2 | Routes, rewire bookings.ts, cron, GH Actions | 529731a | server/routes/calendar-sync.ts, server/routes.ts, server/routes/bookings.ts, server/services/cron.ts, .github/workflows/calendar-sync-cron.yml |

## Files Created

### server/services/calendar-sync-worker.ts
Exports `runCalendarSyncWorker()` — the core queue processing function.

Key behaviors:
- **Stale-row reaper:** Resets `in_progress` rows stuck > 10 minutes back to `pending`
- **Atomic dequeue:** Single `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)` — claims and marks in_progress atomically, no orphan risk
- **google_calendar graceful skip:** Jobs immediately marked success with log note (write scope not yet implemented)
- **Exponential backoff:** `BACKOFF_MINUTES = [1, 5, 30, 120, 720, 1440]` — 6 attempts then `failed_permanent`
- **Raw SQL:** Uses `db.execute(sql\`...\`)` cast with `as unknown as Array<T>` — Drizzle query builder's `.for("update", {skipLocked:true})` is broken (bug #3554)

### server/routes/calendar-sync.ts
Route prefix: `/api/integrations/calendar-sync`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /cron/run | CRON_SECRET Bearer token | GitHub Actions trigger — runs worker |
| GET | /health | requireAdmin | Returns pending/failed counts per target |
| POST | /:jobId/retry | requireAdmin | Resets failed job to pending |

### .github/workflows/calendar-sync-cron.yml
- Schedule: `*/5 * * * *` (every 5 minutes)
- `timeout-minutes: 4` — prevents overlap with next tick
- Validates `CRON_SECRET` and `APP_URL` before curl
- Hits `POST /api/integrations/calendar-sync/cron/run` with Bearer auth

## Files Modified

### server/routes/bookings.ts
- **Removed:** `import { syncBookingToGhl } from "../lib/booking-ghl-sync"` (line 11)
- **Replaced (POST /):** Direct `syncBookingToGhl(booking)` call → `void Promise.all([enqueueCalendarSync x3]).catch()`
  - Enqueues: `ghl_contact/create`, `ghl_appointment/create`, `google_calendar/create`
- **Added (PUT /:id/status):** After Phase 31 cancellation email block, enqueues cancel jobs:
  - `ghl_contact/cancel`, `ghl_appointment/cancel`, `google_calendar/cancel` (only when `status === 'cancelled'`)

### server/routes.ts
- Added import: `import { calendarSyncRouter } from "./routes/calendar-sync"`
- Added mount: `app.use("/api/integrations/calendar-sync", calendarSyncRouter)` — placed before recurringBookingsRouter

### server/services/cron.ts
- Added every-minute cron for local dev calendar sync worker
- Uses dynamic import: `await import("./calendar-sync-worker")` (consistent with other cron services)
- Updated summary console.log to mention calendar sync

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] db.execute() return type mismatch**
- **Found during:** Task 1 — TypeScript type error on `.rows` property
- **Issue:** `db.execute(sql\`...\`)` returns `RowList<Record<string, unknown>[]>` which does NOT have a `.rows` property (the plan specified `.rows` access)
- **Fix:** Used `as unknown as Array<T>` cast pattern, consistent with `server/services/booking-email-reminders.ts` existing pattern in the codebase
- **Files modified:** server/services/calendar-sync-worker.ts
- **Commit:** 5df0c3d

## Self-Check

### Files Exist
- server/services/calendar-sync-worker.ts: FOUND
- server/routes/calendar-sync.ts: FOUND
- .github/workflows/calendar-sync-cron.yml: FOUND

### Commits Exist
- 5df0c3d: FOUND (Task 1 — calendar-sync-worker.ts)
- 529731a: FOUND (Task 2 — all wiring files)

### Structural Checks
- `syncBookingToGhl` in bookings.ts: 0 results (removed)
- `enqueueCalendarSync` in bookings.ts: 6 calls (3 create + 3 cancel)
- `FOR UPDATE SKIP LOCKED` in calendar-sync-worker.ts: present
- `google_calendar` graceful-skip branch: present
- `*/5 * * * *` in calendar-sync-cron.yml: present
- npm run check: green
- npm run build: green

## Self-Check: PASSED
