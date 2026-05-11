---
phase: 28-recurring-bookings-customer-flow-and-notifications
plan: "03"
subsystem: recurring-bookings
tags: [cron, email, reminders, recurring]
dependency_graph:
  requires:
    - 28-01  # subscription schema + storage methods
    - 28-02  # email.ts + email-templates.ts
  provides:
    - runRecurringBookingReminders()
    - POST /api/recurring-bookings/cron/send-reminders
  affects:
    - server/services/cron.ts
    - .github/workflows/recurring-bookings-cron.yml
tech_stack:
  added:
    - date-fns (addDays, format — already in package.json)
  patterns:
    - Cron HTTP endpoint secured by CRON_SECRET Bearer token (mirrors /cron/generate)
    - Dynamic import in node-cron schedule (avoids circular init)
    - Per-booking error isolation (one failure does not stop others)
    - Natural idempotency via bookingDate as lookup key
key_files:
  created:
    - server/services/recurring-booking-reminder.ts
  modified:
    - server/routes/recurring-bookings.ts
    - server/services/cron.ts
    - .github/workflows/recurring-bookings-cron.yml
decisions:
  - "reminderDate = today + 2 days using date-fns addDays to avoid DST edge cases"
  - "No sent-flag needed — bookingDate as natural lookup key ensures once-daily idempotency"
  - "companyName fetched once before the loop (single DB call, non-fatal fallback)"
  - "Dynamic import of recurring-booking-reminder inside node-cron callback to avoid circular init at startup"
  - "GitHub Actions send-reminders step runs after generate step in same job — generation bookings exist before reminder query"
metrics:
  duration_seconds: 3004
  completed_date: "2026-05-11"
  tasks_completed: 2
  files_created: 1
  files_modified: 3
---

# Phase 28 Plan 03: Recurring Booking Reminder Pipeline Summary

**One-liner:** 48-hour reminder email pipeline wired end-to-end — DB query service, CRON_SECRET-secured HTTP endpoint, 06:30 UTC local-dev schedule, and GitHub Actions send-reminders step.

## What Was Built

### Task 1: server/services/recurring-booking-reminder.ts

Created `runRecurringBookingReminders(asOfDateOverride?)` which:

1. Computes `reminderDate = today + 2 days` (UTC) using `date-fns/addDays`
2. Queries `bookings INNER JOIN recurringBookings` for bookings where:
   - `bookingDate = reminderDate`
   - `recurringBookingId IS NOT NULL`
   - `bookings.status != 'cancelled'`
   - `recurringBookings.status = 'active'`
   - `customerEmail IS NOT NULL`
3. Fetches company name once from `storage.getCompanySettings()`
4. For each qualifying booking: fetches service name, builds reminder email via `buildReminderEmail()`, calls `sendEmail()`
5. Catches per-booking errors individually — one failure does not abort others
6. Returns `{ checked, sent, errors }` result shape

### Task 2: HTTP endpoint + local cron + GitHub Actions

**server/routes/recurring-bookings.ts** — added `POST /api/recurring-bookings/cron/send-reminders`:
- Same CRON_SECRET Bearer token auth pattern as `/cron/generate`
- Accepts optional `asOfDate` body parameter for testing
- Returns `{ checked, sent, errors }` JSON on success, 401 on bad auth, 500 on unhandled error

**server/services/cron.ts** — added daily 06:30 UTC schedule:
- Runs 30 minutes after the 06:00 UTC generation cron (generated bookings exist before reminder query)
- Uses dynamic import to avoid circular initialization at startup

**.github/workflows/recurring-bookings-cron.yml** — added "Send Recurring Booking Reminders" step:
- Runs after "Generate Recurring Bookings" step in same job
- Same retry-on-5xx pattern as generate step
- Fails the workflow if HTTP response is not 2xx

## Verification

All acceptance criteria passed:

- `runRecurringBookingReminders` exported from `server/services/recurring-booking-reminder.ts`
- `ReminderResult` interface exported
- `reminderDate` computed via `addDays(today, 2)`
- `sendEmail` imported and called per booking
- `buildReminderEmail` imported and called per booking
- `innerJoin(recurringBookings, ...)` filters active subscriptions
- `isNotNull(bookings.customerEmail)` in WHERE clause
- `POST /cron/send-reminders` route present in recurring-bookings.ts
- `30 6 * * *` schedule in cron.ts
- `send-reminders` and `Send Recurring Booking Reminders` in workflow YAML

`npm run check` — only 5 pre-existing catalog.ts errors (Phase 26 booking questions — out of scope).

## Deviations from Plan

### Pre-existing TypeScript Errors (Out of Scope)

`server/routes/catalog.ts` references 4 storage methods (`getServiceBookingQuestions`, `createServiceBookingQuestion`, `updateServiceBookingQuestion`, `deleteServiceBookingQuestion`) that were never implemented in `server/storage.ts`. These errors existed before this plan and are unrelated to Phase 28. Logged to deferred items.

None of my changes introduced new TypeScript errors.

## Known Stubs

None. The reminder service queries real data and calls real email infrastructure.

## Self-Check: PASSED

- server/services/recurring-booking-reminder.ts: FOUND
- server/routes/recurring-bookings.ts (updated): FOUND
- server/services/cron.ts (updated): FOUND
- .github/workflows/recurring-bookings-cron.yml (updated): FOUND
- Commit aa45944: feat(28-03): create recurring-booking-reminder.ts
- Commit d54bdf5: feat(28-03): add send-reminders endpoint, cron schedule, and GitHub Actions step
