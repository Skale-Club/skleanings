---
phase: 24-manual-confirmation-flow-per-service
plan: "02"
subsystem: backend
tags: [backend, notifications, booking-status, approve-reject, confirmation-flow]
dependency_graph:
  requires: [24-01 (services.requiresConfirmation column)]
  provides:
    - POST /api/bookings sets awaiting_approval when requiresConfirmation=true
    - PUT /api/bookings/:id/approve endpoint
    - PUT /api/bookings/:id/reject endpoint
    - booking_awaiting_approval notification trigger (Twilio + Telegram)
  affects:
    - server/routes/bookings.ts
    - server/lib/notification-templates.ts
    - server/integrations/twilio.ts
    - server/integrations/telegram.ts
tech_stack:
  added: []
  patterns: [notification-builder-pattern, non-blocking-try-catch, requireAdmin-guard]
key_files:
  created: []
  modified:
    - server/lib/notification-templates.ts
    - server/integrations/twilio.ts
    - server/integrations/telegram.ts
    - server/routes/bookings.ts
decisions:
  - status passed explicitly to createBooking as type assertion (as any) — insertBookingSchema omits status by design; override at creation time is correct
  - rejection reason logged server-side only (bookings table has no notes column); Plan 03 UI will pass reason in request body
  - primaryRequiresConfirmation lookup is non-fatal (wrapped in try/catch); failure falls back to pending status preserving existing behavior
metrics:
  duration: 288s
  completed: "2026-05-10"
  tasks_completed: 3
  files_changed: 4
---

# Phase 24 Plan 02: Backend — booking status routing + approve/reject + notifications Summary

**One-liner:** Wired requiresConfirmation into booking creation (sets awaiting_approval status), added approve/reject admin endpoints, and added booking_awaiting_approval notification trigger to both Twilio and Telegram integrations.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add buildAwaitingApprovalNotification to notification-templates.ts | e0b0095 | server/lib/notification-templates.ts |
| 2 | Add sendAwaitingApprovalNotification to Twilio and Telegram integrations | 57b1f61 | server/integrations/twilio.ts, server/integrations/telegram.ts |
| 3 | Wire requiresConfirmation into POST /api/bookings and add approve/reject endpoints | 4714cf7 | server/routes/bookings.ts |

## What Was Built

### Notification Template (Task 1)
- `buildAwaitingApprovalNotification` exported from `server/lib/notification-templates.ts`
- Mirrors `buildBookingNotification` shape with title "Booking awaiting approval", hourglass emoji
- Adds "Action required" section: "Visit the admin panel to approve or reject this booking."
- Uses the same private helpers: `formatBookingDate`, `formatBookingTime`, `formatMoney`, `normalizeCompanyName`

### Integration Senders (Task 2)
- `sendAwaitingApprovalNotification` exported from `server/integrations/twilio.ts`
  - Uses `trigger: "booking_awaiting_approval"` in all `logNotification` calls
  - Structurally identical to `sendBookingNotification`
- `sendAwaitingApprovalNotification` exported from `server/integrations/telegram.ts`
  - Uses `trigger: "booking_awaiting_approval"` via `sendMessageToAll` logContext
  - Structurally identical to `sendBookingNotification`

### Booking Route (Task 3)
- **Import additions**: `sendAwaitingApprovalNotification` from both integrations
- **primaryRequiresConfirmation lookup**: fetches primary service before `createBooking`; wrapped in non-fatal try/catch (fallback to pending)
- **`storage.createBooking` call**: now passes `status: primaryRequiresConfirmation ? 'awaiting_approval' : 'pending'` explicitly (using `as any` to bypass Zod omit)
- **Notification routing**: if `primaryRequiresConfirmation` is true, fires `booking_awaiting_approval` trigger; otherwise fires `new_booking` (existing behavior unchanged — no regression)
- **`PUT /api/bookings/:id/approve`** (requireAdmin): calls `storage.updateBookingStatus(id, 'confirmed')`
- **`PUT /api/bookings/:id/reject`** (requireAdmin): calls `storage.updateBookingStatus(id, 'cancelled')`, logs optional `reason` from request body

## Decisions Made

- `status` passed to `createBooking` with `as any` type assertion — `insertBookingSchema` intentionally omits `status` (it's set by DB default), but an explicit value overrides the DB default. This is the correct approach without changing the storage interface signature.
- Rejection reason is logged server-side only for now. The `bookings` table has no `notes` column. Plan 03 UI will surface this to the admin; a future plan could add a `rejectionReason` column if persistence is needed.
- `primaryRequiresConfirmation` lookup failure is non-fatal by design — a service lookup failure should not block booking creation.
- Existing `new_booking` notification path is completely unchanged (else branch) — no regression for services without requiresConfirmation.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: server/lib/notification-templates.ts
- FOUND: server/integrations/twilio.ts
- FOUND: server/integrations/telegram.ts
- FOUND: server/routes/bookings.ts
- FOUND: commit e0b0095 (Task 1)
- FOUND: commit 57b1f61 (Task 2)
- FOUND: commit 4714cf7 (Task 3)
