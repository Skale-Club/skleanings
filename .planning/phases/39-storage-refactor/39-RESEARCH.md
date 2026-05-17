# Phase 39: Storage Refactor - Research

**Researched:** 2026-05-13
**Domain:** TypeScript class refactor / Drizzle ORM tenant scoping / multi-tenant data isolation
**Confidence:** HIGH

---

## Summary

Phase 39 refactors `server/storage.ts` so that every query in `DatabaseStorage` is automatically
filtered by a `tenantId` class field. The entry point is a static factory method
`DatabaseStorage.forTenant(tenantId: number)` that constructs an instance with `this.tenantId`
set. Every `SELECT`, `INSERT`, `UPDATE`, and `DELETE` in that instance then appends the tenant
filter automatically — no route code changes required.

The scope is large but mechanically uniform. The file is 2,246 lines with approximately 115
public business methods and ~67 private/infra helpers. All 40+ business tables in `shared/schema.ts`
already have a `tenantId integer NOT NULL DEFAULT 1` column added in Phase 38. The three infra
tables that use raw SQL (`calendar_sync_queue`, `notification_logs`, `time_slot_locks`) also have
`tenantId` in the schema and need filtering too. The singleton `export const storage` at the
bottom of the file becomes `DatabaseStorage.forTenant(1)`.

**Primary recommendation:** Introduce a `private readonly tenantId: number` class field and a
`static forTenant(id: number): DatabaseStorage` factory. Apply `eq(table.tenantId, this.tenantId)`
to every query. For INSERT operations, spread `{ tenantId: this.tenantId }` into the values
object. This is a mechanical find-and-update across the file — no interface changes, no route
changes.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MT-06 | `DatabaseStorage.forTenant(tenantId: number)` static factory — returns instance with all queries filtered by `WHERE tenant_id = tenantId` | Static factory pattern; `private readonly tenantId` field injected at construction |
| MT-07 | Every business query method that reads or writes data includes the tenantId filter automatically — no business query is unfiltered | Audit of all ~115 public methods; `and(eq(table.tenantId, this.tenantId), ...)` pattern |
| MT-08 | Existing `export const storage` singleton preserved as `DatabaseStorage.forTenant(1)` — all existing routes continue to work without modification | Change last line from `new DatabaseStorage()` to `DatabaseStorage.forTenant(1)` |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- TypeScript throughout — all code must type-check (`npm run check`)
- Drizzle ORM for all DB access — no raw SQL for business queries (raw SQL exists only in calendar health/retry helpers)
- Storage layer is the single source of DB access — routes call storage methods, not raw DB
- No Redux, no global state changes — only server/storage.ts and export line change
- Database migrations: Supabase CLI only — Phase 38 already applied the tenant_id columns; no new migration needed for this phase
- `npm run check` must pass after the refactor

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | existing | Query builder | Already used; `and()` + `eq()` are imported |
| TypeScript | existing | Class field + static method typing | Strict mode already enabled |

No new packages needed. This phase is a pure TypeScript/Drizzle refactor.

---

## Architecture Patterns

### Pattern 1: Static Factory + Private tenantId Field

**What:** `DatabaseStorage` gains a `private constructor(tenantId: number)` and a
`static forTenant(id: number)` factory. A `private readonly tenantId: number` field holds the
scoped value for all methods.

**Why private constructor:** Forces all instantiation through `forTenant()`, preventing accidental
unscoped instances.

```typescript
// server/storage.ts
export class DatabaseStorage implements IStorage {
  private readonly tenantId: number;

  private constructor(tenantId: number) {
    this.tenantId = tenantId;
  }

  static forTenant(tenantId: number): DatabaseStorage {
    return new DatabaseStorage(tenantId);
  }

  // ... all existing methods, now using this.tenantId
}

// Bottom of file — backward-compatible singleton
export const storage = DatabaseStorage.forTenant(1);
```

**Confidence:** HIGH — standard TypeScript factory pattern, verified against project conventions.

### Pattern 2: SELECT Filtering with `and()`

**What:** Every `db.select().from(table)` that currently has no `.where()` adds one with
`eq(table.tenantId, this.tenantId)`. Methods that already have a `.where()` wrap their
existing condition inside `and(eq(table.tenantId, this.tenantId), existingCondition)`.

```typescript
// Before
async getCategories(): Promise<Category[]> {
  return await db.select().from(categories).orderBy(categories.order);
}

// After
async getCategories(): Promise<Category[]> {
  return await db.select()
    .from(categories)
    .where(eq(categories.tenantId, this.tenantId))
    .orderBy(categories.order);
}
```

```typescript
// Before (with existing where)
async getServices(...): Promise<Service[]> {
  const baseConditions = [eq(services.isArchived, false)];
  // ...
  return await db.select().from(services).where(and(...baseConditions))...;
}

// After
async getServices(...): Promise<Service[]> {
  const baseConditions = [
    eq(services.tenantId, this.tenantId),  // prepend tenant filter
    eq(services.isArchived, false),
  ];
  // rest unchanged
}
```

**Confidence:** HIGH — consistent with existing Drizzle usage in the file.

### Pattern 3: INSERT Tenancy

**What:** Every `db.insert(table).values(data)` call spreads `tenantId: this.tenantId` into the
values, unless the table is a registry table (tenants/domains/userTenants — not accessed through
this storage class).

```typescript
// Before
async createCategory(category: InsertCategory): Promise<Category> {
  const [newCat] = await db.insert(categories).values(category).returning();
  return newCat;
}

// After
async createCategory(category: InsertCategory): Promise<Category> {
  const [newCat] = await db.insert(categories)
    .values({ ...category, tenantId: this.tenantId })
    .returning();
  return newCat;
}
```

For `createBooking` (which uses a transaction with multiple inserts), both the `bookings` insert
and every `bookingItems` insert get `tenantId: this.tenantId` injected.

**Confidence:** HIGH.

### Pattern 4: UPDATE/DELETE Scoping

**What:** UPDATE and DELETE operations that use only `eq(table.id, id)` gain an additional
`and(eq(table.tenantId, this.tenantId), eq(table.id, id))`. This prevents cross-tenant writes
even if a route somehow passes a foreign tenant's row ID.

```typescript
// Before
async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category> {
  const [updated] = await db.update(categories)
    .set(category)
    .where(eq(categories.id, id))
    .returning();
  return updated;
}

// After
async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category> {
  const [updated] = await db.update(categories)
    .set(category)
    .where(and(eq(categories.tenantId, this.tenantId), eq(categories.id, id)))
    .returning();
  return updated;
}
```

**Confidence:** HIGH.

### Pattern 5: Singleton Pattern Methods (`getCompanySettings`, `getChatSettings`, etc.)

**What:** Several methods implement a "get-or-create" singleton pattern — they SELECT with no
ID filter and INSERT a default row if none exists. These must scope both the SELECT and the INSERT.

```typescript
// After
async getCompanySettings(): Promise<CompanySettings> {
  const [settings] = await db.select().from(companySettings)
    .where(eq(companySettings.tenantId, this.tenantId));
  if (settings) return settings;

  const [newSettings] = await db.insert(companySettings)
    .values({ tenantId: this.tenantId })
    .returning();
  return newSettings;
}
```

Affected singleton methods: `getCompanySettings`, `getChatSettings`, `getBlogSettings`.

**Confidence:** HIGH.

### Pattern 6: JOIN Methods

**What:** Methods that JOIN across tables (e.g., `getRecurringBookingsWithDetails`,
`getServiceAddons`, `getStaffMembersByService`) need the tenant filter on the driving table.
Child/joined tables implicitly return matching rows because their rows are FK-linked to the
tenant-scoped parent. However, adding `eq(drivingTable.tenantId, this.tenantId)` to the WHERE
is the safe approach.

```typescript
// getRecurringBookingsWithDetails — filter on the driving table
async getRecurringBookingsWithDetails(): Promise<RecurringBookingWithDetails[]> {
  const rows = await db.select({...})
    .from(recurringBookings)
    .leftJoin(contacts, eq(recurringBookings.contactId, contacts.id))
    .leftJoin(services, eq(recurringBookings.serviceId, services.id))
    .where(eq(recurringBookings.tenantId, this.tenantId))  // add this
    .orderBy(desc(recurringBookings.createdAt));
  // ...
}
```

**Confidence:** HIGH.

### Pattern 7: Raw SQL Methods (calendar_sync_queue health/retry)

**What:** `getCalendarSyncHealth`, `retryCalendarSyncJob`, and `listRecentSyncFailures` use
`db.execute(sql`...`)` with raw SQL strings. These methods query `calendar_sync_queue` which
has `tenant_id`. The raw SQL must be extended to include `AND tenant_id = ${this.tenantId}`.

```typescript
// Before
const pendingResult = await db.execute(sql`
  SELECT COUNT(*)::int AS count
  FROM calendar_sync_queue
  WHERE target = ${target} AND status = 'pending'
`);

// After
const pendingResult = await db.execute(sql`
  SELECT COUNT(*)::int AS count
  FROM calendar_sync_queue
  WHERE target = ${target} AND status = 'pending'
    AND tenant_id = ${this.tenantId}
`);
```

**Confidence:** HIGH — the `tenant_id` column exists on `calendar_sync_queue` per Phase 38.

### Pattern 8: upsertContact — Email Uniqueness Scope Issue

**What:** `upsertContact` currently checks for an existing contact by `eq(contacts.email, data.email)`.
After tenanting, this check must also scope by tenant: a contact with the same email in tenant 2
should NOT match tenant 1's contact.

```typescript
// After
const [existing] = await db.select().from(contacts)
  .where(and(
    eq(contacts.tenantId, this.tenantId),
    eq(contacts.email, data.email)
  ));
```

Note: The database currently has a `UNIQUE` constraint on `contacts.email` globally. This may
cause issues when two tenants have the same customer email. This is a schema concern for a future
phase — for now, Phase 39's job is storage scoping; the unique constraint issue is tracked as an
open question.

**Confidence:** HIGH for the storage fix; MEDIUM for the downstream schema concern.

### Recommended Execution Order

The refactor is mechanical but large. A safe execution order:

1. Add `private readonly tenantId: number` field and `private constructor(tenantId)` + `static forTenant()` factory
2. Update the bottom export: `export const storage = DatabaseStorage.forTenant(1)`
3. Run `npm run check` — expect no errors yet (tenantId field not yet used in queries)
4. Go method-group by method-group (Users, Categories, Services, Bookings, etc.)
5. For each method: add `eq(table.tenantId, this.tenantId)` to SELECTs, add `tenantId: this.tenantId` to INSERTs, add to UPDATE/DELETE WHEREs
6. Run `npm run check` after each group to catch TypeScript errors early
7. Handle the three raw-SQL methods (`getCalendarSyncHealth`, `retryCalendarSyncJob`, `listRecentSyncFailures`) last

### Recommended Project Structure

No new files. The change is entirely within `server/storage.ts`. The plan should be a single
plan document covering the full file refactor, or split into logical method groups.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tenant scoping | A wrapper/proxy layer around IStorage | Class field + factory method in the class itself | Proxy adds an extra abstraction layer with no benefit; the class-field approach is zero-overhead and type-safe |
| Per-method tenantId param | Add `tenantId?: number` to every IStorage method signature | `private readonly tenantId` class field | Changing method signatures would require updating every route file — defeats the backward-compat requirement |
| Middleware-level query interception | Drizzle middleware or query hooks | Direct `.where(eq(table.tenantId, this.tenantId))` | Drizzle doesn't have a stable query middleware API; the explicit approach is transparent and debuggable |

**Key insight:** The class-field approach is the only one that satisfies MT-08 (no route changes)
while remaining explicit and type-safe.

---

## Common Pitfalls

### Pitfall 1: Missing tenantId on INSERT — TypeScript Won't Catch It
**What goes wrong:** Drizzle's `$inferInsert` type for `InsertCategory` already includes `tenantId`
as optional (due to `DEFAULT 1`). If you forget to spread `tenantId: this.tenantId` in an INSERT,
TypeScript won't error — but the inserted row will get `DEFAULT 1` regardless of the actual tenant.
**Why it happens:** The column has a database-level default, so the TypeScript insert type marks it optional.
**How to avoid:** Systematically grep for every `db.insert(` in the file and verify each has
`tenantId: this.tenantId` in the values.
**Warning signs:** A test creating a booking as tenant 2 finds it also visible to tenant 1.

### Pitfall 2: UPDATE without Tenant Scope Allows Cross-Tenant Writes
**What goes wrong:** `db.update(bookings).where(eq(bookings.id, id))` will update any booking
with that ID, regardless of tenant. A malicious or buggy route could update another tenant's booking.
**Why it happens:** ID filters are not tenant-aware by default.
**How to avoid:** Every UPDATE and DELETE WHERE clause must be `and(eq(table.tenantId, this.tenantId), eq(table.id, id))`.
**Warning signs:** Update returns a row but the calling route's tenant didn't own it.

### Pitfall 3: Singleton Methods Create Rows for Wrong Tenant
**What goes wrong:** `getCompanySettings()` INSERT path creates a new row without scoping tenantId.
Tenant 2's first request creates a row with DEFAULT 1, which then looks like tenant 1's settings.
**Why it happens:** The INSERT `values({})` uses the column default.
**How to avoid:** Always inject `{ tenantId: this.tenantId }` into the INSERT values of singleton
methods.

### Pitfall 4: JOIN Methods Only Filter on Joined Table, Not Driving Table
**What goes wrong:** In `getServiceAddons`, the code first selects from `serviceAddons` by
`serviceId`, then selects services by those IDs. If `serviceAddons` is not filtered by tenantId,
tenant 2 could see cross-linked addons of tenant 1.
**Why it happens:** The developer adds `eq(services.tenantId, this.tenantId)` on the second query
but forgets it on the first.
**How to avoid:** Filter the driving table (the one queried first or joined FROM) by tenantId.

### Pitfall 5: Raw SQL Queries Miss tenantId
**What goes wrong:** `getCalendarSyncHealth` uses `db.execute(sql`...`)` — no Drizzle WHERE builder.
The tenant filter must be manually written into the SQL string.
**Why it happens:** Raw SQL bypasses Drizzle's condition builder.
**How to avoid:** Treat every `db.execute(sql``)` call as requiring manual audit for `tenant_id`.
There are exactly 3 such methods in this file.

### Pitfall 6: `private constructor` Breaks Tests or Scripts
**What goes wrong:** Any test or script that calls `new DatabaseStorage()` directly will fail to compile.
**Why it happens:** Making the constructor private closes the public instantiation path.
**How to avoid:** The only known instantiation point is `export const storage = new DatabaseStorage()`
at line 2246, which must change to `DatabaseStorage.forTenant(1)`. Grep the whole codebase for
`new DatabaseStorage` before marking complete.

### Pitfall 7: `companySettings` Unique Constraint
**What goes wrong:** `companySettings` may have a database-level unique constraint on `id` (serial)
but no tenant-scoped unique index. Two tenants calling `getCompanySettings()` concurrently before
any row exists could both INSERT, causing a race. The second insert might fail on PK or succeed,
creating duplicate settings rows.
**Why it happens:** The original singleton assumes one global row. After tenanting, there should be
one row per tenant.
**How to avoid:** The INSERT path should use `ON CONFLICT DO NOTHING` or a try/catch similar to
`getChatSettings`. Alternatively, ensure tenant 1's settings row already exists (seeded in Phase 38).
For now, the existing try/catch in `getChatSettings` is the model to follow.

---

## Method Audit Summary

The following table groups all ~115 public methods by refactor complexity:

| Group | Methods | Complexity | tenantId Tables |
|-------|---------|------------|-----------------|
| Users | getUsers, getUser, getUserByEmail, createUser, updateUser, deleteUser | LOW | users |
| Categories | getCategories, getCategoryBySlug, createCategory, updateCategory, deleteCategory | LOW | categories |
| Subcategories | getSubcategories, createSubcategory, updateSubcategory, deleteSubcategory | LOW | subcategories |
| Services | getService, getServices, createService, updateService, deleteService, reorderServices | LOW-MEDIUM | services |
| Service Addons | getServiceAddons, setServiceAddons, getAddonRelationships | MEDIUM | serviceAddons, services (JOIN) |
| Service Options | getServiceOptions, createServiceOption, updateServiceOption, deleteServiceOption, setServiceOptions | LOW | serviceOptions |
| Service Frequencies | getServiceFrequencies, getServiceFrequency, createServiceFrequency, updateServiceFrequency, deleteServiceFrequency, setServiceFrequencies | LOW | serviceFrequencies |
| Service Durations | getServiceDurations, getServiceDuration, createServiceDuration, updateServiceDuration, deleteServiceDuration | LOW | serviceDurations |
| Service Booking Questions | getServiceBookingQuestions, createServiceBookingQuestion, updateServiceBookingQuestion, deleteServiceBookingQuestion | LOW | serviceBookingQuestions |
| Bookings | createBooking, getBookings, getBookingsByDate, getBookingsByDateAndStaff, getBooking, getBookingByStripeSessionId, getBookingsByUserId, getClientBookings, updateBookingStripeFields, updateBooking, deleteBooking, updateBookingStatus, getBookingItems, getBookingsByDateRange, getContactBookings | HIGH | bookings, bookingItems (transaction) |
| Company Settings | getCompanySettings, updateCompanySettings, getBusinessHours | MEDIUM | companySettings (singleton) |
| FAQs | getFaqs, createFaq, updateFaq, deleteFaq | LOW | faqs |
| Service Areas | getServiceAreas, createServiceArea, updateServiceArea, deleteServiceArea, reorderServiceAreas | LOW | serviceAreas |
| Service Area Groups | getServiceAreaGroups, createServiceAreaGroup, updateServiceAreaGroup, deleteServiceAreaGroup, reorderServiceAreaGroups | LOW | serviceAreaGroups |
| Service Area Cities | getServiceAreaCities, createServiceAreaCity, updateServiceAreaCity, deleteServiceAreaCity, reorderServiceAreaCities | LOW | serviceAreaCities |
| Integration Settings | getIntegrationSettings, upsertIntegrationSettings | MEDIUM | integrationSettings |
| GHL Sync | updateBookingGHLSync, updateBookingSyncStatus, getBookingsPendingSync, updateBookingGHLSync | LOW | bookings |
| Chat | getChatSettings, updateChatSettings, getChatIntegration, upsertChatIntegration | MEDIUM | chatSettings (singleton), chatIntegrations |
| Twilio/Telegram/Email | getTwilioSettings, saveTwilioSettings, getTelegramSettings, saveTelegramSettings, getEmailSettings, saveEmailSettings | LOW | twilioSettings, telegramSettings, emailSettings |
| Conversations | getConversations, getConversation, updateConversation, deleteConversation, createConversation, addConversationMessage, getConversationMessages, findOpenConversationByContact | MEDIUM | conversations, conversationMessages |
| Blog Posts | getBlogPosts, getBlogPost, getBlogPostBySlug, getPublishedBlogPosts, getRelatedBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost, getBlogPostServices, setBlogPostServices, countPublishedBlogPosts | MEDIUM | blogPosts, blogPostServices |
| Blog Settings | getBlogSettings, upsertBlogSettings | MEDIUM | blogSettings (singleton) |
| Blog Generation Jobs | getBlogGenerationJobs, getBlogGenerationJob, createBlogGenerationJob, updateBlogGenerationJob, acquireBlogGenerationLock, releaseBlogGenerationLock | MEDIUM | blogGenerationJobs |
| Time Slot Locks | acquireTimeSlotLock, releaseTimeSlotLock, cleanExpiredTimeSlotLocks | MEDIUM | timeSlotLocks |
| Staff Members | getStaffMembers, getStaffMember, getStaffMemberByUserId, linkStaffMemberToUser, getStaffCount, createStaffMember, updateStaffMember, deleteStaffMember, reorderStaffMembers | LOW | staffMembers |
| Staff Service Abilities | getStaffMembersByService, getServicesByStaffMember, getStaffMembersByServiceId, setStaffServiceAbilities | MEDIUM | staffServiceAbilities, staffMembers, services (JOINs) |
| Staff Availability | getStaffAvailability, setStaffAvailability | LOW | staffAvailability |
| Staff Availability Overrides | getStaffAvailabilityOverrides, getStaffAvailabilityOverridesByDate, createStaffAvailabilityOverride, deleteStaffAvailabilityOverride | LOW | staffAvailabilityOverrides |
| Staff Google Calendar | getStaffGoogleCalendar, upsertStaffGoogleCalendar, deleteStaffGoogleCalendar, markCalendarNeedsReconnect, clearCalendarNeedsReconnect, getAllCalendarStatuses | LOW-MEDIUM | staffGoogleCalendar |
| Contacts | getContact, listContactsWithStats, upsertContact, updateContact, updateBookingContactId, getContactBookings | MEDIUM | contacts (upsert scope issue) |
| Notification Logs | createNotificationLog, getNotificationLogsByConversation, getNotificationLogsByBooking, getNotificationLogs | LOW | notificationLogs |
| Recurring Bookings | createRecurringBooking, getRecurringBooking, getRecurringBookings, getActiveRecurringBookingsDueForGeneration, updateRecurringBooking, getRecurringBookingByToken, getRecurringBookingsWithDetails | HIGH | recurringBookings, contacts, services (JOIN) |
| Calendar Sync Queue | enqueueCalendarSync, getCalendarSyncHealth, retryCalendarSyncJob, listRecentSyncFailures | HIGH | calendarSyncQueue (raw SQL) |
| Private/Infra | initializeRuntimeState, ensureChatSchema, ensureCompanySchema, ensureConversationSchema | SKIP | DDL helpers — not tenant data |

### Tables That Do NOT Need Tenant Filtering (infra/registry only)

- `tenants` — registry table; not accessed through IStorage
- `domains` — registry table; not accessed through IStorage
- `userTenants` — registry table; not accessed through IStorage
- `sessions` — Express session store; intentionally excluded per Phase 38 decision

### Explicitly Confirmed: ALL Business Tables Have tenantId (Phase 38)

Every table accessed by the storage methods listed above has `tenantId integer NOT NULL DEFAULT 1`
as confirmed by reading `shared/schema.ts`. This includes: users, categories, subcategories,
services, serviceAddons, serviceOptions, serviceFrequencies, serviceDurations,
serviceBookingQuestions, contacts, visitorSessions, recurringBookings, bookings, conversionEvents,
integrationSettings, chatSettings, chatIntegrations, twilioSettings, emailSettings,
telegramSettings, conversations, conversationMessages, bookingItems, companySettings, faqs,
serviceAreaGroups, serviceAreaCities, serviceAreas, blogPosts, blogPostServices, blogSettings,
blogGenerationJobs, timeSlotLocks, staffMembers, staffServiceAbilities, staffAvailability,
staffGoogleCalendar, staffAvailabilityOverrides, notificationLogs, calendarSyncQueue.

---

## Code Examples

### Full Factory + Field Pattern

```typescript
// server/storage.ts — top of class
export class DatabaseStorage implements IStorage {
  private readonly tenantId: number;

  private constructor(tenantId: number) {
    this.tenantId = tenantId;
  }

  static forTenant(tenantId: number): DatabaseStorage {
    return new DatabaseStorage(tenantId);
  }

  // ... existing private schema fields below
  private chatSchemaEnsured = false;
  private companySchemaEnsured = false;
  private conversationSchemaEnsured = false;
```

```typescript
// server/storage.ts — last line
export const storage = DatabaseStorage.forTenant(1);
```

### setServiceAddons (multi-insert pattern)

```typescript
async setServiceAddons(serviceId: number, addonServiceIds: number[]): Promise<void> {
  await db.delete(serviceAddons).where(
    and(eq(serviceAddons.tenantId, this.tenantId), eq(serviceAddons.serviceId, serviceId))
  );
  if (addonServiceIds.length > 0) {
    const values = addonServiceIds.map(addonId => ({
      tenantId: this.tenantId,
      serviceId,
      addonServiceId: addonId,
    }));
    await db.insert(serviceAddons).values(values);
  }
}
```

### deleteService (transaction with cascading deletes)

```typescript
async deleteService(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(serviceAddons).where(
      and(eq(serviceAddons.tenantId, this.tenantId), eq(serviceAddons.serviceId, id))
    );
    await tx.delete(serviceOptions).where(
      and(eq(serviceOptions.tenantId, this.tenantId), eq(serviceOptions.serviceId, id))
    );
    // ... all other cascades
    await tx.delete(services).where(
      and(eq(services.tenantId, this.tenantId), eq(services.id, id))
    );
  });
}
```

### getActiveRecurringBookingsDueForGeneration (complex WHERE)

```typescript
async getActiveRecurringBookingsDueForGeneration(asOfDate: string): Promise<RecurringBooking[]> {
  return db.select().from(recurringBookings).where(
    and(
      eq(recurringBookings.tenantId, this.tenantId),  // add this
      eq(recurringBookings.status, 'active'),
      lte(recurringBookings.nextBookingDate, asOfDate),
    )
  );
}
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (`npm run check`) |
| Config file | tsconfig.json |
| Quick run command | `npm run check` |
| Full suite command | `npm run check` |

No automated integration tests exist for storage methods. The validation strategy for this phase is:

1. TypeScript compile success (`npm run check`) — catches missing imports, wrong method signatures
2. Manual smoke test: start `npm run dev`, verify admin dashboard loads, verify booking flow works
3. Key manual checks: categories load, bookings visible in admin, company settings not 404

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Note |
|--------|----------|-----------|-------------------|------|
| MT-06 | `DatabaseStorage.forTenant(2)` returns scoped instance | manual | `npm run check` (type check only) | No integration test exists |
| MT-07 | All business queries include tenantId filter | code audit | `npm run check` | Grep audit validates coverage |
| MT-08 | `storage` singleton equals `forTenant(1)` | manual | `npm run dev` + admin smoke test | Backward compat verified by app startup |

### Sampling Rate

- **Per task commit:** `npm run check`
- **Per wave merge:** `npm run check` + manual smoke test of admin + booking flow
- **Phase gate:** `npm run check` green + manual smoke test confirms tenant 1 data still loads correctly

### Wave 0 Gaps

None — no test infrastructure needed beyond what exists. The refactor is compile-time verifiable
via TypeScript and runtime-verifiable via manual smoke test.

---

## Open Questions

1. **`contacts.email` UNIQUE constraint is global, not per-tenant**
   - What we know: `contacts` has `email text unique` at DB level (not per-tenant)
   - What's unclear: When tenant 2 tries to create a contact with the same email as tenant 1, the INSERT will fail with a unique constraint violation
   - Recommendation: Note this as a deferred schema concern — Phase 39 fixes the storage layer scoping; the unique constraint needs a separate migration to drop the global unique index and add a per-tenant composite unique index `(tenant_id, email)`. Flag as a blocker for Phase 40 if Phase 40 will bring real tenant 2 traffic

2. **`visitorSessions` — scoped or cross-tenant?**
   - What we know: `visitorSessions` has `tenantId` per Phase 38. Storage has no `getVisitorSession` method in IStorage — it's queried from routes directly or via external attribution logic
   - What's unclear: Whether Phase 39 should include `visitorSessions` in the IStorage methods
   - Recommendation: Scope is only `server/storage.ts` methods listed in IStorage. `visitorSessions` is not in IStorage, so no action needed in Phase 39

3. **`ensureChatSchema`, `ensureCompanySchema`, `ensureConversationSchema` — DDL in private methods**
   - What we know: These run `ALTER TABLE` DDL. They are not tenant-scoped (they modify global schema structure)
   - What's unclear: Nothing — these should NOT get tenantId filtering; they're schema migration helpers, not data queries
   - Recommendation: Leave all three `ensureXSchema` private methods unchanged

---

## Environment Availability

Step 2.6: SKIPPED — Phase 39 is a pure code refactor of `server/storage.ts`. No external tools, services, databases, or CLI utilities beyond what already exist in the project are required. The only commands needed are `npm run check` (TypeScript) and `npm run dev` (smoke test).

---

## Sources

### Primary (HIGH confidence)

- Direct code reading of `server/storage.ts` (2,246 lines, ~115 public methods) — full method list, query patterns, raw SQL locations
- Direct code reading of `shared/schema.ts` — confirmed `tenantId integer NOT NULL DEFAULT 1` on all 40+ business tables
- Phase 38 STATE.md decisions — confirmed `sessions` table intentionally excluded from tenant scoping
- Phase 38 decision: "Drizzle forward references allow users.tenantId to reference tenants before its declaration"
- REQUIREMENTS.md MT-06/MT-07/MT-08 — exact requirement wording

### Secondary (MEDIUM confidence)

- TypeScript class factory pattern knowledge (training data, HIGH confidence for language fundamentals)
- Drizzle ORM `and()` / `eq()` filter composition (already used throughout storage.ts — HIGH confidence)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; pure TypeScript/Drizzle refactor
- Architecture (factory pattern): HIGH — standard TypeScript idiom, zero external dependencies
- Method audit: HIGH — direct code reading of entire storage.ts
- Pitfalls: HIGH — derived from direct reading of actual code patterns in the file
- Open questions: MEDIUM — schema concern (contacts uniqueness) is real but out of scope for Phase 39

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable — no external dependencies, schema already applied in Phase 38)
