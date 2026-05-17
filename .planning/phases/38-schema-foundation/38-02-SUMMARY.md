---
phase: 38-schema-foundation
plan: "02"
subsystem: database
tags: [drizzle-orm, postgresql, multi-tenant, schema, typescript]

requires:
  - phase: 38-01
    provides: SQL DDL migration adding tenant_id columns and tenants/domains/user_tenants tables

provides:
  - Drizzle table declarations for tenants, domains, userTenants (registry tables)
  - tenantId field on all 40 business table Drizzle declarations (integer, notNull, default 1)
  - TypeScript types for all new fields via $inferSelect/$inferInsert

affects:
  - 39-storage-refactor (uses tenantId in Drizzle queries)
  - 40-tenant-resolution-middleware (references tenants/domains tables)

tech-stack:
  added: []
  patterns:
    - "Multi-tenant scoping: all business tables carry tenantId integer(tenant_id).notNull().default(1).references(() => tenants.id)"
    - "Registry tables (tenants, domains, userTenants) carry NO tenantId — they are global"
    - "userTenants composite PK uses array-of-constraints form: (table) => [primaryKey({ columns: [...] })]"

key-files:
  created: []
  modified:
    - shared/schema.ts
    - server/storage.ts
    - server/storage/chat.ts
    - server/routes/integrations/telegram.ts
    - client/src/components/admin/StaffSection.tsx

key-decisions:
  - "tenants declaration placed between insertUserSchema and categories — Drizzle lazy references allow users.tenantId to reference tenants even though tenants is declared after users in file order"
  - "Forward reference works because Drizzle column references use arrow functions () => tenants.id, resolved at runtime not parse time"
  - "Custom select projections in storage (getConversations, getRecurringBookingsWithDetails) must explicitly include tenantId to satisfy Conversation/RecurringBooking TypeScript types"
  - "createStaff mutation in StaffSection omits tenantId from its type — tenantId is server-managed (default 1)"

patterns-established:
  - "All future business tables must include tenantId as second field after id"
  - "Registry tables (global infra) never carry tenantId"

requirements-completed:
  - MT-01
  - MT-02
  - MT-03
  - MT-04

duration: 25min
completed: 2026-05-11
---

# Phase 38 Plan 02: Schema Foundation — Drizzle Type Coverage Summary

**Drizzle ORM table declarations updated with tenants/domains/userTenants registry tables and tenantId field on all 40 business tables, enabling typed multi-tenant queries in Phase 39**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-11T00:00:00Z
- **Completed:** 2026-05-11T00:25:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `primaryKey` to drizzle-orm/pg-core import and declared 3 new registry tables: `tenants`, `domains`, `userTenants`
- Added `tenantId: integer("tenant_id").notNull().default(1).references(() => tenants.id)` to all 40 business table pgTable declarations
- Fixed 4 downstream TypeScript errors caused by the new required `tenantId` field on `$inferSelect` types

## Task Commits

1. **Task 1: Add primaryKey to import + declare tenants, domains, userTenants tables** - `a5b392f` (feat)
2. **Task 2: Add tenantId field to all 40 existing business table declarations** - `cae07ab` (feat)

## Files Created/Modified

- `shared/schema.ts` - Added 3 registry tables + tenantId on all 40 business tables
- `server/storage.ts` - Fixed getConversations() and getRecurringBookingsWithDetails() select projections to include tenantId
- `server/storage/chat.ts` - Fixed getConversations() select projection to include tenantId
- `server/routes/integrations/telegram.ts` - Fixed settingsToTest object to include tenantId field
- `client/src/components/admin/StaffSection.tsx` - Fixed createStaff mutation type to omit tenantId (server-managed)

## Decisions Made

- Drizzle forward references via arrow functions allow `users.tenantId` to reference `tenants` even though `tenants` is declared after `users` in the file — no reordering needed
- Custom select projections (not `db.select().from(table)` wildcard) must explicitly list `tenantId` to satisfy TypeScript `$inferSelect` types

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 4 TypeScript errors from downstream code relying on $inferSelect types**
- **Found during:** Task 2 (after adding tenantId to all 40 tables)
- **Issue:** Custom Drizzle select projections (getConversations, getRecurringBookingsWithDetails) and client mutation types did not include tenantId, causing TS2322/TS2345 errors
- **Fix:**
  - Added `tenantId: conversations.tenantId` to both getConversations() implementations (storage.ts + storage/chat.ts)
  - Added `tenantId: recurringBookings.tenantId` to getRecurringBookingsWithDetails() projection
  - Added `tenantId: existingSettings?.tenantId ?? 1` to settingsToTest in telegram.ts
  - Added `'tenantId'` to the Omit union in createStaff mutationFn type
- **Files modified:** server/storage.ts, server/storage/chat.ts, server/routes/integrations/telegram.ts, client/src/components/admin/StaffSection.tsx
- **Verification:** npm run check: 0 errors; npm run build: success
- **Committed in:** cae07ab (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — downstream type errors from schema change)
**Impact on plan:** Required fix for TypeScript compilation. All affected code still passes tenantId=1 (the default), maintaining backward compatibility.

## Issues Encountered

None beyond the expected downstream type updates.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 39 (Storage Refactor) can now write `WHERE tenant_id = $tenantId` in Drizzle ORM — all tables have the typed field
- Phase 40 (Tenant Resolution Middleware) can query `tenants` and `domains` tables via Drizzle
- All existing data in DB already has tenant_id=1 from the 38-01 migration; default(1) in Drizzle ensures new inserts also default to tenant 1

---
*Phase: 38-schema-foundation*
*Completed: 2026-05-11*
