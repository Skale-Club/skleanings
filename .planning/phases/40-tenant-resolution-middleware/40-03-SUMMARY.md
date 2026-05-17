---
phase: 40-tenant-resolution-middleware
plan: "03"
subsystem: server-routes
tags: [multi-tenant, storage-refactor, IStorage, res.locals, dependency-injection, express]
dependency_graph:
  requires:
    - phase: 40-02
      provides: lib-storage-parameter-threading
  provides:
    - route-storage-migration
    - zero-global-storage-singleton-in-routes
  affects: [server/routes/*, server/routes/chat/*, server/routes/integrations/*]
tech-stack:
  added: []
  patterns:
    - "res.locals.storage! pattern at top of every route handler body"
    - "setChatDependencies({ storage }) called inside /chat/message handler for chat DI"
key-files:
  created: []
  modified:
    - server/routes/bookings.ts
    - server/routes/catalog.ts
    - server/routes/staff.ts
    - server/routes/availability.ts
    - server/routes/company.ts
    - server/routes/auth-routes.ts
    - server/routes/blog.ts
    - server/routes/calendar-sync.ts
    - server/routes/chat/index.ts
    - server/routes/chat/message-handler.ts
    - server/routes/chat/tools/create-booking.ts
    - server/routes/chat/tools/suggest-booking-dates.ts
    - server/routes/chat/tools/update-contact.ts
    - server/routes/client.ts
    - server/routes/contacts.ts
    - server/routes/faqs.ts
    - server/routes/integrations/ai.ts
    - server/routes/integrations/ghl.ts
    - server/routes/integrations/google-calendar.ts
    - server/routes/integrations/resend.ts
    - server/routes/integrations/stripe.ts
    - server/routes/integrations/telegram.ts
    - server/routes/integrations/twilio.ts
    - server/routes/notification-logs.ts
    - server/routes/payments.ts
    - server/routes/recurring-bookings.ts
    - server/routes/service-areas.ts
    - server/routes/user-routes.ts
key-decisions:
  - "chat/index.ts: setChatDependencies({ storage: res.locals.storage! }) called inside /chat/message wrapper handler so chat tools receive tenant-scoped storage via chatDeps.storage"
  - "chat tool call sites use chatDeps.storage as first arg to all lib functions (acquireTimeSlotLock, releaseTimeSlotLock, syncBookingToGhl, getAvailabilityForDate, getAvailabilityRange)"
  - "isAuthenticatedAdminRequest helper updated to accept res parameter and read res.locals.storage! for getAuthenticatedUser call"
  - "Implicit any type annotations fixed in auth-routes.ts, user-routes.ts, blog.ts, bookings.ts to achieve zero TypeScript errors"
  - "super-admin.ts and analytics.ts intentionally excluded per plan — super-admin uses global storage (MT-13 bypass), analytics uses modular storage/index.ts"
requirements-completed:
  - MT-12
duration: ~25min
completed: "2026-05-13"
---

# Phase 40 Plan 03: Route Storage Migration Summary

**All 24 business route files migrated from global storage singleton to res.locals.storage!, completing MT-12 tenant isolation — npm run check passes with zero TypeScript errors**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-13T21:30:00Z
- **Completed:** 2026-05-13T22:00:00Z
- **Tasks:** 2 (plus 1 human-verify auto-approved)
- **Files modified:** 28

## Accomplishments
- Removed `import { storage }` from all 24 business route files; only super-admin.ts and analytics.ts retain global storage (per plan exclusions)
- Added `const storage = res.locals.storage!;` as first line of every route handler body across all migrated files
- Fixed all cascading lib call sites in chat tools (create-booking, suggest-booking-dates, update-contact) to pass storage as first argument
- Fixed chat module DI pattern: setChatDependencies called inside the /chat/message handler wrapper so chatDeps.storage is tenant-scoped per request
- Achieved zero TypeScript errors (`npm run check` passes clean)

## Task Commits

1. **Task 1: Migrate high-traffic core routes (bookings, catalog, staff, availability, company)** - `29498b4` (feat)
2. **Task 2: Migrate remaining route files and integration routes** - `883ccd4` (feat)
3. **Task 3: Human verify checkpoint** - auto-approved (auto_advance=true)

## Files Created/Modified

**Core routes (Task 1):**
- `server/routes/bookings.ts` - No global storage import; res.locals.storage! in all handlers
- `server/routes/catalog.ts` - No global storage import; res.locals.storage! in all handlers
- `server/routes/staff.ts` - No global storage import; res.locals.storage! in all handlers
- `server/routes/availability.ts` - No global storage import; res.locals.storage! in all handlers
- `server/routes/company.ts` - No global storage import; res.locals.storage! in all handlers
- `server/routes/auth-routes.ts` - No global storage import; fixed implicit any
- `server/routes/blog.ts` - No global storage import; fixed implicit any in tag lambdas
- `server/routes/calendar-sync.ts` - Already migrated

**Remaining routes + integrations (Task 2):**
- `server/routes/chat/index.ts` - Global storage import removed; setChatDependencies in message handler
- `server/routes/chat/message-handler.ts` - twilio/telegram notification calls pass chatDeps.storage first
- `server/routes/chat/tools/create-booking.ts` - All lib calls pass chatDeps.storage first
- `server/routes/chat/tools/suggest-booking-dates.ts` - getAvailabilityRange passes chatDeps.storage
- `server/routes/chat/tools/update-contact.ts` - logNotification passes chatDeps.storage
- `server/routes/client.ts` - Global storage removed; checkAvailability and booking-client-sync pass storage
- `server/routes/contacts.ts` - Global storage removed; res.locals.storage! in all handlers
- `server/routes/faqs.ts` - Global storage removed; res.locals.storage! in all handlers
- `server/routes/integrations/ai.ts` - Global storage removed; res.locals.storage! in all handlers
- `server/routes/integrations/ghl.ts` - Global storage removed; res.locals.storage! in all handlers
- `server/routes/integrations/google-calendar.ts` - Global storage removed; res.locals.storage! in all handlers
- `server/routes/integrations/resend.ts` - Global storage removed; res.locals.storage! in all handlers
- `server/routes/integrations/stripe.ts` - Global storage removed; createCheckoutSession/verifyWebhookEvent/retrieveCheckoutSession pass storage
- `server/routes/integrations/telegram.ts` - Global storage removed; sendTelegramTestMessage passes storage
- `server/routes/integrations/twilio.ts` - Global storage removed; res.locals.storage! in all handlers
- `server/routes/notification-logs.ts` - Global storage removed; res.locals.storage! in all handlers
- `server/routes/payments.ts` - Global storage removed; Stripe lib calls pass storage
- `server/routes/recurring-bookings.ts` - Global storage removed; res.locals.storage! in all 4 routers
- `server/routes/service-areas.ts` - Global storage removed; res.locals.storage! in all handlers
- `server/routes/user-routes.ts` - Global storage removed; fixed implicit any in filter lambdas

## Decisions Made

- Chat module DI: `setChatDependencies({ storage: res.locals.storage! })` called in the `/chat/message` wrapper handler, making `chatDeps.storage` tenant-scoped for the entire tool execution chain.
- `isAuthenticatedAdminRequest` updated to accept `res: Response` parameter to read `res.locals.storage!` for the `getAuthenticatedUser(req, storage)` call (Plan 02 changed its signature).
- Implicit any type fixes applied inline rather than adding tsconfig overrides — these were pre-existing issues in modified files that blocked `npm run check`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fix chat tool lib call sites for storage parameter**
- **Found during:** Task 2 (after initial migration, running npm run check)
- **Issue:** `create-booking.ts`, `suggest-booking-dates.ts`, and `update-contact.ts` called lib functions (`acquireTimeSlotLock`, `releaseTimeSlotLock`, `getAvailabilityForDate`, `getAvailabilityRange`, `syncBookingToGhl`, `logNotification`) without storage as first argument — these signatures were updated in Plan 02.
- **Fix:** Updated all call sites to pass `chatDeps.storage` as first argument. `chatDeps.storage` is set per-request via `setChatDependencies` in the message handler.
- **Files modified:** server/routes/chat/tools/create-booking.ts, server/routes/chat/tools/suggest-booking-dates.ts, server/routes/chat/tools/update-contact.ts
- **Committed in:** 883ccd4

**2. [Rule 1 - Bug] Fix message-handler.ts twilio/telegram notification calls**
- **Found during:** Task 2 (npm run check)
- **Issue:** `chatDeps.twilio.sendNewChatNotification(twilioSettings, ...)` and `chatDeps.telegram.sendNewChatNotification(telegramSettings, ...)` no longer match updated signatures (storage first).
- **Fix:** Added `chatDeps.storage` as first argument to all sendNewChatNotification and sendBookingNotification calls in message-handler.ts and create-booking.ts.
- **Files modified:** server/routes/chat/message-handler.ts, server/routes/chat/tools/create-booking.ts
- **Committed in:** 883ccd4

**3. [Rule 1 - Bug] Fix stripe lib call sites in payments.ts**
- **Found during:** Task 2 (npm run check)
- **Issue:** `createCheckoutSession`, `retrieveCheckoutSession`, and `verifyWebhookEvent` from `../lib/stripe` now require storage as first argument (Plan 02 change).
- **Fix:** Pass `storage` (from `res.locals.storage!`) as first arg to all three Stripe lib function calls.
- **Files modified:** server/routes/payments.ts
- **Committed in:** 883ccd4

**4. [Rule 1 - Bug] Fix telegram test route sendTelegramTestMessage call**
- **Found during:** Task 2 (npm run check)
- **Issue:** `sendTelegramTestMessage(settingsToTest, companyNameForTest)` — signature now requires storage as first arg.
- **Fix:** Pass `storage` as first arg: `sendTelegramTestMessage(storage, settingsToTest, companyNameForTest)`.
- **Files modified:** server/routes/integrations/telegram.ts
- **Committed in:** 883ccd4

**5. [Rule 1 - Bug] Fix isAuthenticatedAdminRequest in chat/index.ts**
- **Found during:** Task 2 (npm run check)
- **Issue:** `getAuthenticatedUser(req)` — signature now requires storage as second arg (Plan 02 change). Helper function had no access to res.
- **Fix:** Updated `isAuthenticatedAdminRequest(req, res)` to accept res parameter and pass `res.locals.storage!` to `getAuthenticatedUser`.
- **Files modified:** server/routes/chat/index.ts
- **Committed in:** 883ccd4

**6. [Rule 1 - Bug] Fix implicit any type annotations in migrated files**
- **Found during:** Task 2 (npm run check - remaining errors after lib fixes)
- **Issue:** Pre-existing implicit any in filter/find lambda callbacks in auth-routes.ts, user-routes.ts, blog.ts, bookings.ts that were in files we modified.
- **Fix:** Added explicit type annotations to affected lambda parameters.
- **Files modified:** server/routes/auth-routes.ts, server/routes/user-routes.ts, server/routes/blog.ts, server/routes/bookings.ts
- **Committed in:** 29498b4, 883ccd4

---

**Total deviations:** 6 auto-fixed (all Rule 1 - Bug fixes)
**Impact on plan:** All fixes were necessary cascading corrections from Plan 02 signature changes. No scope creep.

## Known Stubs

None. All route handlers read storage from res.locals and pass it to lib functions. The chat module uses setChatDependencies per-request.

## Self-Check: PASSED

Files verified:
- `grep -rn "import { storage }" server/routes/` returns only super-admin.ts and analytics.ts
- `grep -c "res.locals.storage" server/routes/bookings.ts` > 0
- `grep -c "res.locals.storage" server/routes/chat/index.ts` > 0
- Commits 29498b4 and 883ccd4 exist
- `npm run check` passes with zero errors

## Next Phase Readiness

Phase 40 MT-12 is complete: global storage singleton import absent from all business route files. The complete tenant resolution middleware stack is in place:
- Plan 01: `resolveTenantMiddleware` with LRU cache (max 500, 5-min TTL)
- Plan 02: 11 lib files accept IStorage parameter
- Plan 03: 24+ route files read storage from res.locals

Ready for Phase 41: Infra Config (MT-14 through MT-17).

Remaining concern: Phase 35 still has `supabase db push` (drop system_heartbeats) + `BLOG_CRON_TOKEN` GitHub Secret pending.

---
*Phase: 40-tenant-resolution-middleware*
*Completed: 2026-05-13*
