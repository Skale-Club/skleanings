---
phase: 31-branded-transactional-email-via-resend
plan: "02"
subsystem: email
tags: [email, resend, transactional, booking-lifecycle, templates]
dependency_graph:
  requires: [31-01]
  provides: [booking-confirmation-email, booking-cancellation-email, 24h-reminder-template]
  affects: [server/routes/bookings.ts, server/lib/email-templates.ts]
tech_stack:
  added: []
  patterns: [fire-and-forget-void-send, durationLabel-fallback, dynamic-import]
key_files:
  created: []
  modified:
    - server/lib/email-templates.ts
    - server/routes/bookings.ts
decisions:
  - "primaryItem cast to `any` to access Phase 30 durationLabel/durationMinutes fields not yet in BookingItem type"
  - "Plan 01 commits cherry-picked into worktree since parallel execution had no shared base"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-11"
  tasks_completed: 2
  files_modified: 2
---

# Phase 31 Plan 02: Booking Lifecycle Email Templates and Triggers Summary

Three booking lifecycle email templates built and wired into booking routes using Resend fire-and-forget pattern with companySettings branding.

## What Was Built

### Task 1 - Three email template functions in server/lib/email-templates.ts

- `formatDuration(minutes)` private helper: converts integer minutes to "1 hour 30 minutes" / "2 hours" etc.
- `buildBookingConfirmationEmail()` - green badge, #1C53A3 heading, logo, all booking details with durationLabel/formatDuration fallback
- `build24hReminderEmail()` - amber badge, #1C53A3 heading, logo, all booking details with duration fallback (used by Plan 03 cron)
- `buildCancellationEmail()` - red badge, #1C53A3 heading, logo, service + date + time
- All templates use `logoUrl ? <img> : ''` conditional rendering, responsive max-width 520px card layout

### Task 2 - Fire-and-forget email triggers in server/routes/bookings.ts

Three trigger points added:

1. **POST /api/bookings** (EMAIL-02): After Twilio/Telegram notification block, before final res.json. Reads emailSettings, fetches bookingItems for service name, fires confirmation email. Guard: emailSettings.enabled && booking.customerEmail.

2. **PUT /:id/status** (EMAIL-04 Path 1): After res.json(booking). Guard: status === 'cancelled' && booking.customerEmail. Fetches bookingItems for service name, fires cancellation email.

3. **PUT /:id/reject** (EMAIL-04 Path 2): After res.json(booking). Guard: booking.customerEmail (reject always = cancelled). Same cancellation email block.

All three use `void sendResendEmail(...).catch(err => console.error(...))` pattern -- response never delayed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cherry-picked Plan 01 commits into worktree**
- **Found during:** Pre-execution setup
- **Issue:** This worktree (agent-a25a87bd2e57ac512) was created before Plan 01 completed, so email-resend.ts and emailSettings storage methods were missing
- **Fix:** Cherry-picked 3 Plan 01 commits (schema, storage methods, email-resend module) into this worktree
- **Files modified:** server/lib/email-resend.ts, server/storage.ts, shared/schema.ts, supabase/migrations/...
- **Commits:** 26a9908, 6314321, 2c5b114

**2. [Rule 1 - Bug] Phase 30 durationLabel/durationMinutes not in BookingItem type**
- **Found during:** Task 2 TypeScript check
- **Issue:** `primaryItem.durationLabel` and `primaryItem.durationMinutes` caused TS2339 errors -- Phase 30 columns not in this worktree's schema
- **Fix:** Cast `primaryItem` to `any` with explanatory comment
- **Files modified:** server/routes/bookings.ts

## Known Stubs

None - all email triggers are fully wired with real data from DB.

## Self-Check: PASSED

- `server/lib/email-templates.ts` - exists, contains all 3 function exports
- `server/routes/bookings.ts` - exists, contains 3 void sendResendEmail calls
- Commit 5dfbdfa (Task 1): verified in git log
- Commit 328408f (Task 2): verified in git log
