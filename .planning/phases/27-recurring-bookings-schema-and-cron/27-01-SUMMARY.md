---
phase: 27-recurring-bookings-schema-and-cron
plan: "01"
subsystem: database-schema
tags: [recurring-bookings, schema, migration, drizzle]
dependency_graph:
  requires: []
  provides: [recurring_bookings-table, RecurringBooking-types, bookings.recurringBookingId]
  affects: [shared/schema.ts, supabase/migrations]
tech_stack:
  added: []
  patterns: [drizzle-pgTable, createInsertSchema, supabase-migration]
key_files:
  created:
    - supabase/migrations/20260511000003_add_recurring_bookings.sql
  modified:
    - shared/schema.ts
decisions:
  - "originBookingId stored as plain integer() in Drizzle (no .references()) to avoid circular reference; SQL migration enforces FK at DB level"
  - "recurringBookings defined before bookings in schema.ts to satisfy Drizzle forward-reference constraint for bookings.recurringBookingId FK"
  - "cancelledAt and pausedAt omitted from insertRecurringBookingSchema — set by server-side status transitions only"
metrics:
  duration: "15 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 27 Plan 01: Recurring Bookings Schema Foundation Summary

Drizzle table definition and Supabase migration for recurring booking subscriptions — one-row-per-schedule data model with cron-ready index and bookings FK column.

## What Was Built

**Migration SQL** (`supabase/migrations/20260511000003_add_recurring_bookings.sql`):
- `CREATE TABLE recurring_bookings` with all required columns: contact/service/frequency FKs, discount snapshot, interval_days, frequency_name, date fields, preferred staff, status check constraint, timestamps
- `CREATE INDEX idx_recurring_bookings_status_next_date` on (status, next_booking_date) for efficient cron queries
- `ALTER TABLE bookings ADD COLUMN recurring_booking_id` nullable FK referencing recurring_bookings
- `CREATE UNIQUE INDEX idx_bookings_recurring_date_unique` partial index to prevent duplicate cron generation for same subscription + booking date

**Schema changes** (`shared/schema.ts`):
- `recurringBookings` pgTable defined at line 184 — before `bookings` at line 218 (required ordering for Drizzle FK)
- `insertRecurringBookingSchema` exported — omits id, createdAt, updatedAt, cancelledAt, pausedAt
- `RecurringBooking` and `InsertRecurringBooking` types exported
- `recurringBookingId` nullable FK column added to `bookings` table

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Migration SQL | db83755 | feat(27-01): add recurring_bookings migration SQL |
| Task 2: Schema types | 57cca5e | feat(27-01): add recurringBookings Drizzle table and FK to bookings |

## Deviations from Plan

None — plan executed exactly as written.

The only TypeScript check errors (`server/index.ts` — `express-rate-limit` missing types, untyped params) are pre-existing and were verified to exist before any changes in this plan.

## Known Stubs

None. This plan is a schema/type-definition plan only; no UI or data flows are wired.

## Self-Check: PASSED

- [x] `supabase/migrations/20260511000003_add_recurring_bookings.sql` exists
- [x] `grep -c "CREATE TABLE recurring_bookings"` = 1
- [x] `grep -c "ALTER TABLE bookings"` = 1
- [x] `grep -c "idx_recurring_bookings_status_next_date"` = 1
- [x] `grep -c "idx_bookings_recurring_date_unique"` = 1
- [x] `export const recurringBookings` at line 184, `export const bookings` at line 218 (correct ordering)
- [x] `RecurringBooking`, `InsertRecurringBooking`, `insertRecurringBookingSchema` all exported
- [x] `recurringBookingId` column in bookings table
- [x] `npm run check` — no new TypeScript errors introduced
- [x] Commits db83755 and 57cca5e verified in git log
