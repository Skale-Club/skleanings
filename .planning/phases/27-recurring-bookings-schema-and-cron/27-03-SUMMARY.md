---
phase: 27-recurring-bookings-schema-and-cron
plan: "03"
subsystem: recurring-bookings
tags: [cron, automation, recurring-bookings, github-actions, node-cron]
dependency_graph:
  requires: [27-01, 27-02]
  provides: [recurring-booking-generator, cron-http-endpoint, daily-schedule]
  affects: [server/routes.ts, server/services/cron.ts]
tech_stack:
  added: []
  patterns: [atomic-transaction, per-subscription-error-isolation, idempotency-via-date-advance]
key_files:
  created:
    - server/services/recurring-booking-generator.ts
    - server/routes/recurring-bookings.ts
    - .github/workflows/recurring-bookings-cron.yml
  modified:
    - server/routes.ts
    - server/services/cron.ts
decisions:
  - "Raw db.transaction used (not storage.createBooking) to bypass GHL/Twilio notifications — Phase 28 will decide notification strategy"
  - "nextBookingDate advance inside same tx as booking insert provides idempotency for GitHub Actions retries"
  - "advanceDate handles intervalDays=30 as calendar-month (not 30 literal days) with end-of-month clamp"
  - "storage.getService called outside tx (read-only) — safe to avoid nested transaction issues"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-11"
  tasks_completed: 3
  files_created: 3
  files_modified: 2
requirements: [RECUR-02]
---

# Phase 27 Plan 03: Recurring Booking Generator and Cron Automation Summary

**One-liner:** Atomic per-subscription booking generator with CRON_SECRET-secured HTTP endpoint, node-cron daily schedule (06:00 UTC), and GitHub Actions workflow.

## What Was Built

### server/services/recurring-booking-generator.ts
Core automation service. `runRecurringBookingGeneration(asOfDateOverride?)` fetches all active subscriptions due (`nextBookingDate <= today`), then for each:
1. Re-checks status inside a db transaction to guard against concurrent pause/cancel
2. Loads service for `durationMinutes` and `price`
3. Inserts a booking row with `recurringBookingId` set
4. Advances `nextBookingDate` in the same atomic transaction (idempotency key)
5. Catches per-subscription errors without aborting the rest of the run

Helper functions:
- `advanceDate()`: weekly/biweekly = simple day addition; monthly (intervalDays=30) = calendar-month advance with end-of-month clamp to prevent Jan 31 → Mar 2 drift
- `computeEndTime()`: derives HH:MM end time from start + durationMinutes

### server/routes/recurring-bookings.ts
Express router exposing `POST /cron/generate`. Auth: `Authorization: Bearer <CRON_SECRET>` (falls back to `req.body.secret`). Returns `{ checked, created, errors }`. Supports `asOfDate` body override for testing.

### server/routes.ts
Added import and `app.use("/api/recurring-bookings", recurringBookingsRouter)` mount.

### server/services/cron.ts
Added `cron.schedule("0 6 * * *", ...)` block after the existing hourly blog schedule. Uses dynamic import for `runRecurringBookingGeneration` (same pattern as blog generator). Updated startup log to mention both jobs.

### .github/workflows/recurring-bookings-cron.yml
Mirrors `blog-autopost.yml` exactly. Schedule: `0 6 * * *` (06:00 UTC daily). POSTs to `/api/recurring-bookings/cron/generate` with `Authorization: Bearer ${CRON_SECRET}`. Retries once on 5xx. Fails workflow on non-2xx responses. No new secrets needed.

## Commits

| Task | Hash | Description |
|------|------|-------------|
| Task 1 | 299ce63 | feat(27-03): create recurring-booking-generator service |
| Task 2a | ee35748 | feat(27-03): add recurring-bookings cron route and mount in routes.ts |
| Task 2b | 51acf0a | feat(27-03): extend cron.ts with daily schedule and add GitHub Actions workflow |

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing TypeScript errors in `server/index.ts` (express-rate-limit module not found, implicit any params) exist before this plan and were not introduced by these changes. No new errors in the three files created or two files modified.

## Known Stubs

The recurring booking generator inserts placeholder contact data:
- `customerName: "Recurring Booking"` — Phase 28 will populate from the linked contact record
- `customerPhone: "N/A"` — Phase 28 will populate from contact
- `customerAddress: "N/A"` — Phase 28 will populate from contact

These stubs are intentional and documented in code comments. They do not prevent the plan's goal (automation core) from being achieved — booking rows are created with correct date, time, price, and `recurringBookingId` linkage. Phase 28 will wire the contact lookup.

## Self-Check: PASSED

Files created:
- server/services/recurring-booking-generator.ts — FOUND
- server/routes/recurring-bookings.ts — FOUND
- .github/workflows/recurring-bookings-cron.yml — FOUND

Files modified:
- server/routes.ts — contains "recurring-bookings" (2 matches: import + mount)
- server/services/cron.ts — contains "0 6 * * *" (1 match)

Commits:
- 299ce63 — FOUND
- ee35748 — FOUND
- 51acf0a — FOUND
