---
phase: 40-tenant-resolution-middleware
plan: "02"
subsystem: server-lib
tags: [multi-tenant, storage-refactor, IStorage, parameter-threading, dependency-injection]
dependency_graph:
  requires: [40-01]
  provides: [lib-storage-parameter-threading]
  affects: [server/lib/*, server/integrations/*, server/services/*, server/static.ts, server/vite.ts]
tech_stack:
  added: []
  patterns: [Explicit dependency injection via IStorage parameter, Express res.locals.storage access pattern in middlewares]
key_files:
  created: []
  modified:
    - server/lib/auth.ts
    - server/lib/availability.ts
    - server/lib/staff-availability.ts
    - server/lib/booking-client-sync.ts
    - server/lib/booking-ghl-sync.ts
    - server/lib/time-slot-lock.ts
    - server/lib/email-resend.ts
    - server/lib/google-calendar.ts
    - server/lib/notification-logger.ts
    - server/lib/seo-injector.ts
    - server/lib/stripe.ts
    - server/integrations/telegram.ts
    - server/integrations/twilio.ts
    - server/services/booking-email-reminders.ts
    - server/services/calendar-sync-worker.ts
    - server/static.ts
    - server/vite.ts
decisions:
  - "Express middleware functions (requireAuth, requireAdmin, etc.) cannot accept storage as a function-level parameter — they read res.locals.storage! in the function body"
  - "getStaffBusyTimes keeps storage as optional parameter (with early null guard) to preserve call signature compatibility from external callers not yet updated"
  - "server/integrations/telegram.ts and twilio.ts required storage threading — they call logNotification which now requires IStorage; these are not lib/ but must be fixed to avoid intra-server TypeScript errors"
  - "server/static.ts and server/vite.ts catch-all handlers use res.locals.storage! since they run after resolveTenantMiddleware in server/routes.ts"
  - "server/services/ cron workers (booking-email-reminders, calendar-sync-worker) pass the global storage singleton — they run outside request context so res.locals is unavailable"
metrics:
  duration: ~14 minutes
  completed: "2026-05-13"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 17
requirements:
  - MT-12
---

# Phase 40 Plan 02: Lib Storage Parameter Threading Summary

**One-liner:** All 11 server/lib/ files have global storage singleton import removed — every exported function that calls storage now accepts an explicit `storage: IStorage` parameter, enabling per-request tenant-scoped storage from res.locals.

## What Was Built

Refactored all `server/lib/` files to use dependency injection for storage instead of importing the global singleton. This is the prerequisite for Plan 03, where route files will pass `res.locals.storage` (set by the tenant middleware) through to lib calls — completing per-request tenant isolation.

The pattern applied throughout:
```typescript
// BEFORE
import { storage } from "../storage";
export async function doThing(): Promise<void> {
  const data = await storage.getCompanySettings();
}

// AFTER
import type { IStorage } from "../storage";
export async function doThing(storage: IStorage): Promise<void> {
  const data = await storage.getCompanySettings();
}
```

Express middleware functions (fixed signatures) read storage from `res.locals`:
```typescript
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const storage = res.locals.storage!;
  const user = await getAuthenticatedUser(req, storage);
  // ...
}
```

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Refactor auth.ts — thread storage through getAuthenticatedUser | 8cd76c8 | server/lib/auth.ts |
| 2 | Refactor availability, staff-availability, and booking libs | 45b6fd0 | server/lib/availability.ts, staff-availability.ts, booking-client-sync.ts, booking-ghl-sync.ts, time-slot-lock.ts |
| 3 | Refactor email-resend, google-calendar, notification-logger, seo-injector, stripe libs | 453cad2 | server/lib/email-resend.ts, google-calendar.ts, notification-logger.ts, seo-injector.ts, stripe.ts + 9 cascade files |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Thread storage through server/integrations/ and server/services/ callers**
- **Found during:** Task 3
- **Issue:** `notification-logger.ts` (a lib file) had its signature updated to require `storage: IStorage`. This cascaded to `server/integrations/telegram.ts` and `server/integrations/twilio.ts` which call `logNotification`. Similarly `sendResendEmail` cascaded to `server/services/booking-email-reminders.ts`, and `syncBookingToGhl` cascaded to `server/services/calendar-sync-worker.ts`.
- **Fix:** Added `storage: IStorage` parameter to all exported functions in `telegram.ts` (sendMessageToAll, sendNewChatNotification, sendBookingNotification, sendAwaitingApprovalNotification, sendTelegramTestMessage) and `twilio.ts` (sendNewChatNotification, sendCalendarDisconnectNotification, sendBookingNotification, sendAwaitingApprovalNotification). Updated cron service call sites to pass the global storage singleton (appropriate for background workers that have no request context).
- **Files modified:** server/integrations/telegram.ts, server/integrations/twilio.ts, server/services/booking-email-reminders.ts, server/services/calendar-sync-worker.ts
- **Commit:** 453cad2

**2. [Rule 1 - Bug] Fix server/static.ts and server/vite.ts getCachedSettings calls**
- **Found during:** Task 3
- **Issue:** `getCachedSettings()` in both files gained a required `storage` parameter. These files contain catch-all request handlers that run after `resolveTenantMiddleware`, so `res.locals.storage` is available.
- **Fix:** Pass `res.locals.storage!` to `getCachedSettings` in both catch-all handlers.
- **Files modified:** server/static.ts, server/vite.ts
- **Commit:** 453cad2

**3. [Rule 1 - Bug] google-calendar.ts sendCalendarDisconnectNotification call site**
- **Found during:** Task 3
- **Issue:** `sendCalendarDisconnectNotification` in `twilio.ts` gained a storage parameter. It's called from `getValidAccessToken` in `google-calendar.ts` which already has `storage: IStorage`.
- **Fix:** Pass storage to `sendCalendarDisconnectNotification` at the call site in `google-calendar.ts`.
- **Files modified:** server/lib/google-calendar.ts (updated call), server/integrations/twilio.ts (reordered storage param first)
- **Commit:** 453cad2

## Verification

- `grep -rn "import { storage }" server/lib/` returns only seeds.ts (excluded per plan)
- `grep -rn "IStorage" server/lib/` matches in all 11 refactored lib files
- `npm run check 2>&1 | grep -v "server/routes/" | grep "error TS"` returns empty
- Remaining TypeScript errors are exclusively in `server/routes/` — to be fixed in Plan 03

## Known Stubs

None. All storage calls in lib/ now accept explicit IStorage parameters. Route files still call old signatures — this is intentional; Plan 03 fixes all route callers.

## Self-Check: PASSED
