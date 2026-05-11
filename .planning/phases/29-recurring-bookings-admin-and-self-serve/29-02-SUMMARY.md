---
phase: 29-recurring-bookings-admin-and-self-serve
plan: "02"
subsystem: backend-api
tags:
  - recurring-bookings
  - email-templates
  - admin-routes
  - self-serve
dependency_graph:
  requires:
    - "29-01: manageToken column + getRecurringBookingByToken/getRecurringBookingsWithDetails"
    - "28-02: sendEmail utility in server/lib/email.ts"
    - "28-01: createRecurringBooking in storage + recurring booking creation in bookings.ts"
  provides:
    - "GET /api/admin/recurring-bookings — admin subscription list with contact/service details"
    - "PATCH /api/admin/recurring-bookings/:id — admin pause/unpause/cancel state machine"
    - "GET /api/subscriptions/manage/:token — public self-serve subscription status"
    - "POST /api/subscriptions/manage/:token/action — public self-serve pause/unpause/cancel"
    - "buildManageEmail — brand-consistent email template with yellow CTA button"
    - "manage-link email sent after createRecurringBooking() succeeds"
  affects:
    - "server/routes.ts — two new router mounts"
    - "server/routes/bookings.ts — manage-link email in POST /api/bookings"
tech_stack:
  added: []
  patterns:
    - "named Router exports (adminRecurringRouter, publicRecurringRouter) from single route file"
    - "dynamic import for email utilities (non-fatal email path)"
    - "token-as-auth pattern for public self-serve routes"
key_files:
  created:
    - "supabase/migrations/20260511000005_add_manage_token_to_recurring_bookings.sql"
  modified:
    - "server/lib/email-templates.ts"
    - "server/routes/recurring-bookings.ts"
    - "server/routes.ts"
    - "server/routes/bookings.ts"
    - "server/storage.ts"
    - "shared/schema.ts"
    - ".env.example"
decisions:
  - "Named Router exports from single file (adminRecurringRouter, publicRecurringRouter) — single source of truth without splitting into 3 files"
  - "APP_URL falls back to SITE_URL so existing deployments without APP_URL still send emails"
  - "Manage-link email uses dynamic import (await import) to stay non-fatal — consistent with existing email pattern in the codebase"
  - "Plan 29-01 schema changes (manageToken, RecurringBookingWithDetails, storage methods) incorporated into this worktree to achieve passing TypeScript check"
metrics:
  duration_seconds: 506
  completed_date: "2026-05-11"
  tasks_completed: 3
  tasks_planned: 3
  files_modified: 7
  files_created: 1
---

# Phase 29 Plan 02: Admin Routes, Public Token Routes, and Manage-Link Email

**One-liner:** Four Express route handlers (2 admin-protected, 2 public token-auth) plus brand-consistent manage-link email wired into recurring subscription creation.

## What Was Built

### Task 1: buildManageEmail template
Appended `ManageEmailData` interface and `buildManageEmail()` function to `server/lib/email-templates.ts`. The HTML uses brand yellow `#FFFF01` for the pill-shaped CTA button and blue `#1C53A3` for the heading, following the same 520px container pattern as the existing `buildReminderEmail`. Plain-text fallback included.

### Task 2: Admin and public recurring subscription route handlers
Rewrote `server/routes/recurring-bookings.ts` to export three Router instances:
- **`router` (default)** — existing cron endpoints, unchanged
- **`adminRecurringRouter`** — `GET /` list (via `getRecurringBookingsWithDetails`), `PATCH /:id` state machine
- **`publicRecurringRouter`** — `GET /:token` status lookup, `POST /:token/action` state machine

State machine enforced in both admin and public PATCH/POST: cancelled is terminal (409), unpause only from paused (409). Registered all three in `server/routes.ts`.

Also incorporated Plan 29-01 foundations to achieve TypeScript-clean build:
- `manageToken` UUID column added to `recurringBookings` Drizzle table
- `RecurringBookingWithDetails` interface exported from `shared/schema.ts`
- `getRecurringBookingByToken` and `getRecurringBookingsWithDetails` added to IStorage + DatabaseStorage
- Migration SQL file `20260511000005_add_manage_token_to_recurring_bookings.sql` created

### Task 3: Wire manage-link email into booking creation
In `server/routes/bookings.ts`, after `createRecurringBooking()` succeeds, a manage-link email is sent (non-fatal try/catch). Uses `APP_URL` (falls back to `SITE_URL`) combined with `sub.manageToken` to build the URL. Skips gracefully when `APP_URL` is unset or booking has no `customerEmail`. Added `APP_URL` to `.env.example` with comment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing TypeScript errors in catalog.ts from Phase 26**
- **Found during:** TypeScript check after Task 2 implementation
- **Issue:** `storage.getServiceBookingQuestions`, `createServiceBookingQuestion`, `updateServiceBookingQuestion`, `deleteServiceBookingQuestion` were called in `server/routes/catalog.ts` but not defined in the IStorage interface or DatabaseStorage class
- **Fix:** Added `ServiceBookingQuestion` types to storage.ts imports, added 4 method signatures to IStorage, added 4 DatabaseStorage implementations using `serviceBookingQuestions` Drizzle table
- **Files modified:** `server/storage.ts`
- **Commit:** 2a1ca05

**2. [Rule 1 - Deviation from plan] Plan 29-01 schema/storage incorporated into this worktree**
- **Found during:** TypeScript check — `manageToken`, `getRecurringBookingByToken`, `getRecurringBookingsWithDetails`, `RecurringBookingWithDetails` all referenced in routes but not yet in codebase
- **Fix:** Added the Plan 29-01 artifacts (migration SQL, schema changes, storage methods) to this worktree so TypeScript passes in isolation. When Plan 29-01 merges, these changes will be duplicated — Plan 29-01 agent owns those files; this worktree's additions will need conflict resolution during merge.
- **Files modified:** `shared/schema.ts`, `server/storage.ts`, `supabase/migrations/`
- **Commit:** 2a1ca05

**3. [Rule 2 - Enhancement] APP_URL falls back to SITE_URL**
- The plan specified `process.env.APP_URL ?? ""` but `.env.example` already had `SITE_URL`. Added `?? process.env.SITE_URL` fallback so existing deployments without `APP_URL` still work.

## Known Stubs

None — all four routes have full implementations. The manage-link email is production-ready (non-fatal on missing env vars).

## Self-Check: PASSED

All files exist:
- server/lib/email-templates.ts — FOUND
- server/routes/recurring-bookings.ts — FOUND
- server/routes.ts — FOUND
- server/routes/bookings.ts — FOUND
- supabase/migrations/20260511000005_add_manage_token_to_recurring_bookings.sql — FOUND

All commits exist:
- b6a44f4 feat(29-02): add buildManageEmail template
- 2a1ca05 feat(29-02): admin and public recurring routes + schema foundation
- 02bb67c feat(29-02): wire manage-link email into recurring subscription creation
