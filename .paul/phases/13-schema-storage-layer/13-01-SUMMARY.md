---
phase: 13-schema-storage-layer
plan: 01
subsystem: database
tags: [drizzle, postgres, schema, storage, notification-logs]

requires: []
provides:
  - notificationLogs table (notification_logs) in shared/schema.ts
  - insertNotificationLogSchema + NotificationLog + InsertNotificationLog types
  - IStorage: createNotificationLog, getNotificationLogsByConversation, getNotificationLogsByBooking, getNotificationLogs
  - DatabaseStorage: 4 implementations with filter support

affects:
  - phase 14-backend-instrumentation-api (imports these types + storage methods)
  - phase 15-admin-ui-notification-log (API builds on these storage methods)

tech-stack:
  added: []
  patterns:
    - "Notification log table uses text columns for enum-like fields (matches existing codebase pattern — no pgEnum)"
    - "Nullable FK with onDelete: set null for conversationId + bookingId (log survives parent deletion)"
    - "getNotificationLogs uses dynamic conditions array + and(...conditions) for optional filters"

key-files:
  created: []
  modified:
    - shared/schema.ts
    - server/storage.ts

key-decisions:
  - "text columns for channel/trigger/status — matches all other enum-like fields in codebase"
  - "conversationId and bookingId both nullable — calendar disconnect alerts have neither"
  - "One row per recipient per send — enables per-number filtering"
  - "sentAt omitted from insertSchema — always auto-set by DB"

patterns-established:
  - "IStorage Notification Logs section added after Staff section"
  - "like() from drizzle-orm used for recipient substring search"

duration: ~15min
started: 2026-04-15T00:00:00Z
completed: 2026-04-15T00:00:00Z
---

# Phase 13 Plan 01: Schema + Storage Layer Summary

**`notification_logs` Drizzle table + 4 typed IStorage methods giving Phase 14 a clean, additive foundation to log every Twilio/Telegram/GHL send.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Started | 2026-04-15 |
| Completed | 2026-04-15 |
| Tasks | 2 of 2 |
| Files modified | 2 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Table Defined and Migratable | Pass | Table defined; `npm run db:push` ready to run with live DB |
| AC-2: Insert Schema and Types Exported | Pass | `notificationLogs`, `insertNotificationLogSchema`, `NotificationLog`, `InsertNotificationLog` all exported |
| AC-3: Storage Methods Available | Pass | `createNotificationLog` inserts and returns the full row via `.returning()` |
| AC-4: Global Query with Filters | Pass | `getNotificationLogs` builds dynamic `and(...conditions)` with all 6 filter params |

## Accomplishments

- New `notification_logs` table with 10 columns: serial PK, nullable FKs to conversations + bookings, channel/trigger/recipient/preview/status/errorMessage/providerMessageId/sentAt
- `insertNotificationLogSchema` omits `id` and `sentAt` (auto-generated); schema enforces `notNull` on channel, trigger, recipient, preview, status
- All 4 storage methods added to `IStorage` interface and implemented in `DatabaseStorage`; `like` added to the drizzle-orm import

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `shared/schema.ts` | Modified | Added `notificationLogs` table, insert schema, and TS types |
| `server/storage.ts` | Modified | Added `like` import, notificationLogs/types imports, IStorage signatures, and 4 DatabaseStorage methods |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `text` for channel/trigger/status (not `pgEnum`) | Matches every other enum-like field in the codebase | Phase 14 passes string literals; no migration needed for new trigger types |
| `onDelete: "set null"` on FK columns | Log row survives deletion of parent conversation or booking | Historical audit trail is preserved even after data cleanup |
| `sentAt` excluded from insert schema | Always DB-generated; prevents caller clock drift | Consistent timestamps across all log entries |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 0 | — |

Plan executed exactly as specified.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `npm run check` unavailable (node_modules not installed in shell environment) | Verified via code inspection: all imports resolve to named exports, column types use existing primitives, Drizzle operators all imported. TypeScript check deferred to `npm run check` on dev machine or CI. |

## Next Phase Readiness

**Ready:**
- `storage.createNotificationLog(entry)` available for Phase 14 to call after each send
- `storage.getNotificationLogsByConversation(id)` and `getNotificationLogsByBooking(id)` ready for Phase 15 API endpoints
- `storage.getNotificationLogs(filters)` ready for global admin view

**Concerns:**
- `npm run db:push` must run before Phase 14 code is deployed — table doesn't exist in DB yet

**Blockers:**
- None — Phase 14 can be planned immediately; `db:push` can run any time before deploy

---
*Phase: 13-schema-storage-layer, Plan: 01*
*Completed: 2026-04-15*
