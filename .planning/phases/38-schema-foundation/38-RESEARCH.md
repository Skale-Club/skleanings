# Phase 38: Schema Foundation - Research

**Researched:** 2026-05-11
**Domain:** PostgreSQL multi-tenant schema via Supabase CLI migrations
**Confidence:** HIGH

---

## Summary

Phase 38 adds the three global registry tables (`tenants`, `domains`, `user_tenants`) and stamps every one of the 38 existing business tables with `tenant_id INTEGER NOT NULL DEFAULT 1`. The entire scope is pure SQL migration — no application code changes. The skaleclub-websites project has already executed an identical migration (Phase 13 there), providing a battle-tested reference for every SQL pattern needed.

The canonical approach, confirmed against the skaleclub-websites reference, is a two-file migration strategy: one file creates the registry tables and adds nullable `tenant_id` via `ADD COLUMN IF NOT EXISTS` inside a `DO $$ FOREACH` loop; a second file seeds Skleanings as tenant 1 and backfills existing rows. The Drizzle schema (`shared/schema.ts`) must be updated in parallel so TypeScript types stay in sync with the live DB.

**Primary recommendation:** Follow the skaleclub-websites two-step migration pattern (Step A: additive DDL; Step B: seed + backfill) using `ADD COLUMN IF NOT EXISTS` and `ON CONFLICT DO NOTHING` for full idempotency. Then update `shared/schema.ts` to declare the three new tables and add `tenantId` columns to all 38 business tables.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MT-01 | `tenants` table: id serial PK, name text, slug text unique, status text default 'active', createdAt timestamp | Reference migration `20260501120000_phase13_multi_tenant_foundation.sql` shows exact DDL pattern; simplified to text enum (no pgEnum) for skleanings |
| MT-02 | `domains` table: id serial PK, tenantId FK → tenants.id, hostname text unique, isPrimary boolean default false | Direct analog in skaleclub-websites reference; keep minimal (no cloudflare columns needed in Phase 38) |
| MT-03 | `userTenants` table: userId FK → users.id, tenantId FK → tenants.id, role text, composite PK | In skleanings, `users.id` is `text` (UUID string) — matches skaleclub-websites reference which uses `text NOT NULL REFERENCES users(id)` |
| MT-04 | `tenant_id INTEGER NOT NULL DEFAULT 1` on all 38 business tables via idempotent Supabase migration | `DO $$ FOREACH` loop with `ADD COLUMN IF NOT EXISTS` + `DEFAULT 1` makes this NOT NULL from day one — no separate backfill needed because DEFAULT 1 fills existing rows atomically |
| MT-05 | Skleanings seeded as tenant id=1, localhost in domains, all existing data has tenantId=1 | `INSERT INTO tenants ... ON CONFLICT (id) DO NOTHING` + `INSERT INTO domains ... ON CONFLICT (hostname) DO NOTHING`; sequence advance via `setval` |

</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Migrations:** Supabase CLI only — never `drizzle-kit push` or `drizzle-kit migrate`
- **Schema source of truth:** `shared/schema.ts` Drizzle tables generate both TypeScript types and Zod validators
- **Storage layer:** All DB ops go through `server/storage.ts` implementing `IStorage` — no raw SQL in routes
- **State management:** React Query + Context API (no Redux)
- **Tech stack:** Express, Drizzle ORM, PostgreSQL, TypeScript

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase CLI | current | Run migrations against Supabase PostgreSQL | Project constraint — only allowed migration tool |
| Drizzle ORM | current | Schema declaration + TypeScript type generation | Existing project standard |
| drizzle-zod | current | Auto-generates Zod insert schemas from Drizzle tables | Existing project standard |

### Migration File Naming
The latest existing migration is `20260514000000_add_locale_settings.sql`. The next migration must use a timestamp >= `20260515000000`. Convention used in this project: `YYYYMMDDHHMMSS_<descriptive_name>.sql`.

---

## Architecture Patterns

### Migration File Structure

This phase requires exactly **two migration files** following the skaleclub-websites two-step pattern:

```
supabase/migrations/
├── 20260515000000_phase38_multi_tenant_foundation.sql   # Step A: DDL only
└── 20260515000001_phase38_seed_skleanings_tenant.sql    # Step B: seed + domains
```

**Why two files:** Step A is pure additive DDL (safe to re-run, no data dependency). Step B inserts data that depends on the tables existing from Step A. Separating them makes rollback analysis clearer and matches the proven pattern.

### Pattern 1: Idempotent Registry Table Creation

```sql
-- Source: skaleclub-websites/supabase/migrations/20260501120000_phase13_multi_tenant_foundation.sql
BEGIN;

CREATE TABLE IF NOT EXISTS tenants (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS domains (
  id          serial PRIMARY KEY,
  tenant_id   integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hostname    text NOT NULL UNIQUE,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS domains_tenant_id_idx ON domains (tenant_id);

CREATE TABLE IF NOT EXISTS user_tenants (
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'viewer',
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS user_tenants_tenant_id_idx ON user_tenants (tenant_id);

COMMIT;
```

**Key detail for skleanings:** `users.id` is declared as `text` (UUID string via `gen_random_uuid()`) in both `shared/schema.ts` and `shared/models/auth.ts`. The FK in `user_tenants` must be `text NOT NULL REFERENCES users(id)` — not `integer` or `uuid`.

### Pattern 2: Bulk Column Addition via DO $$ FOREACH Loop

```sql
-- Source: skaleclub-websites/supabase/migrations/20260501120000_phase13_multi_tenant_foundation.sql (adapted)
DO $$
DECLARE
  t text;
  scoped_tables text[] := ARRAY[
    'users',
    'categories',
    'subcategories',
    'services',
    -- ... all 38 tables ...
  ];
BEGIN
  FOREACH t IN ARRAY scoped_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id integer NOT NULL DEFAULT 1 REFERENCES tenants(id)',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)',
        t || '_tenant_id_idx', t
      );
    END IF;
  END LOOP;
END $$;
```

**Critical difference from skaleclub-websites reference:** The reference used nullable `tenant_id` first, then applied NOT NULL in a later migration. For skleanings Phase 38, we apply `NOT NULL DEFAULT 1` directly in Step A because:
1. All existing rows immediately get `tenant_id = 1` via the DEFAULT clause — PostgreSQL applies DEFAULT to existing rows when adding a column with a default
2. No separate backfill UPDATE is needed
3. This is simpler and Phase 39 (storage refactor) expects the column to be NOT NULL

### Pattern 3: Seed with Idempotency

```sql
-- Source: skaleclub-websites/supabase/migrations/20260501130000_phase13_backfill_mvp_tenant.sql (adapted)
BEGIN;

INSERT INTO tenants (id, slug, name, status, created_at)
VALUES (1, 'skleanings', 'Skleanings', 'active', now())
ON CONFLICT (id) DO NOTHING;

-- Advance sequence so next INSERT gets id=2, not a collision with id=1
SELECT setval(
  pg_get_serial_sequence('tenants', 'id'),
  GREATEST((SELECT MAX(id) FROM tenants), 1),
  true
);

INSERT INTO domains (tenant_id, hostname, is_primary)
VALUES (1, 'localhost', true)
ON CONFLICT (hostname) DO NOTHING;

COMMIT;
```

### Pattern 4: Drizzle Schema Declaration for New Tables

New tables must be added to `shared/schema.ts` so TypeScript types are generated. For skleanings, the simplified version (no pgEnum, matching the simpler MT-01/MT-02/MT-03 spec):

```typescript
// In shared/schema.ts

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("active"), // 'active' | 'suspended' | 'deleted'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const domains = pgTable("domains", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  hostname: text("hostname").notNull().unique(),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userTenants = pgTable("user_tenants", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("viewer"), // 'owner' | 'admin' | 'viewer'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: { name: "user_tenants_pkey", columns: [table.userId, table.tenantId] },
}));
```

**Note:** Drizzle composite PKs via the table builder require using `primaryKey()` from `drizzle-orm/pg-core`. The SQL migration enforces this at the DB level with `PRIMARY KEY (user_id, tenant_id)`. The Drizzle table declaration should use `primaryKey({ columns: [table.userId, table.tenantId] })` in the table options callback.

### Pattern 5: Adding tenantId to Existing Drizzle Tables

For each of the 38 business tables in `shared/schema.ts`, add the column referencing the new `tenants` table:

```typescript
// Example: in the categories pgTable definition
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1).references(() => tenants.id),
  name: text("name").notNull(),
  // ... existing columns unchanged
});
```

### Recommended Project Structure (no changes to folder structure)

The migration files go in the existing location:
```
supabase/migrations/
├── 20260515000000_phase38_multi_tenant_foundation.sql
└── 20260515000001_phase38_seed_skleanings_tenant.sql

shared/
└── schema.ts   # Add tenants/domains/userTenants + tenantId on 38 tables
```

### Anti-Patterns to Avoid

- **Using drizzle-kit push or drizzle-kit migrate:** Project constraint prohibits this. Use `supabase db push` only.
- **Adding NOT NULL without DEFAULT on existing tables:** Will fail immediately because existing rows have no value. Always pair NOT NULL with DEFAULT 1 when adding to a table with existing data.
- **Skipping the sequence advance after INSERT with explicit id=1:** PostgreSQL serial sequences start at 1 and will collide on next auto-insert. Always call `setval` after forcing id=1.
- **Adding tenantId as a FK before the tenants table exists:** Migration Step A must create `tenants` before the `DO $$ FOREACH` loop that references it as a FK.
- **Using `ADD COLUMN IF NOT EXISTS ... NOT NULL DEFAULT 1` split across two ALTER TABLE statements:** Some Postgres versions require the DEFAULT in the same statement as NOT NULL when adding to a non-empty table. Keep them together.
- **Importing `primaryKey` from wrong path:** Must import from `drizzle-orm/pg-core`, not `drizzle-orm`.

---

## Complete Table Inventory: All 38 Business Tables

These are the tables that need `tenant_id` added, in the order they appear in `shared/schema.ts` (dependency order matters for FK references within the same migration):

| # | Drizzle Name | SQL Table Name | Notes |
|---|-------------|----------------|-------|
| 1 | `users` | `users` | Keep global? See decision below |
| 2 | `categories` | `categories` | |
| 3 | `subcategories` | `subcategories` | |
| 4 | `services` | `services` | |
| 5 | `serviceAddons` | `service_addons` | |
| 6 | `serviceOptions` | `service_options` | |
| 7 | `serviceFrequencies` | `service_frequencies` | |
| 8 | `serviceDurations` | `service_durations` | |
| 9 | `serviceBookingQuestions` | `service_booking_questions` | |
| 10 | `contacts` | `contacts` | |
| 11 | `visitorSessions` | `visitor_sessions` | |
| 12 | `recurringBookings` | `recurring_bookings` | |
| 13 | `bookings` | `bookings` | |
| 14 | `conversionEvents` | `conversion_events` | |
| 15 | `integrationSettings` | `integration_settings` | |
| 16 | `chatSettings` | `chat_settings` | singleton pattern |
| 17 | `chatIntegrations` | `chat_integrations` | |
| 18 | `twilioSettings` | `twilio_settings` | |
| 19 | `emailSettings` | `email_settings` | |
| 20 | `telegramSettings` | `telegram_settings` | |
| 21 | `conversations` | `conversations` | |
| 22 | `conversationMessages` | `conversation_messages` | |
| 23 | `bookingItems` | `booking_items` | |
| 24 | `companySettings` | `company_settings` | singleton pattern |
| 25 | `faqs` | `faqs` | |
| 26 | `serviceAreaGroups` | `service_area_groups` | |
| 27 | `serviceAreaCities` | `service_area_cities` | |
| 28 | `serviceAreas` | `service_areas` | legacy table |
| 29 | `blogPosts` | `blog_posts` | |
| 30 | `blogPostServices` | `blog_post_services` | |
| 31 | `blogSettings` | `blog_settings` | singleton pattern |
| 32 | `blogGenerationJobs` | `blog_generation_jobs` | |
| 33 | `timeSlotLocks` | `time_slot_locks` | |
| 34 | `staffMembers` | `staff_members` | |
| 35 | `staffServiceAbilities` | `staff_service_abilities` | |
| 36 | `staffAvailability` | `staff_availability` | |
| 37 | `staffGoogleCalendar` | `staff_google_calendar` | |
| 38 | `staffAvailabilityOverrides` | `staff_availability_overrides` | |
| 39 | `notificationLogs` | `notification_logs` | |
| 40 | `calendarSyncQueue` | `calendar_sync_queue` | |

**Actual count:** The additional context lists 38 tables but the schema has 40 distinct business tables (the list in the context omits `serviceOptions`, `serviceFrequencies`, and `serviceDurations` — or counts some differently). The planner should include all tables verified above. The `sessions` table is NOT included — it is infra, not tenant-scoped.

**Also excluded (global/infra):**
- `sessions` — Express session store, not tenant data
- `tenants`, `domains`, `userTenants` — ARE the tenant registry

### Decision on `users` Table

**Recommendation: include `users` in the 38 tables and add `tenant_id`.** Rationale:
- The `userTenants` join table handles the many-to-many relationship
- But `users.tenant_id` serves as the "home tenant" concept for a user created via a specific tenant's admin panel
- The skaleclub-websites reference adds tenantId to users
- However, if users are truly global (a user can belong to multiple tenants via userTenants), keeping users without tenantId is also valid
- **For Phase 38 specifically:** The requirement (MT-04) says "all 38 business tables" — the additional context explicitly lists `users` in the 38. Follow the requirement as stated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Idempotent column addition | Custom existence check per table | `ADD COLUMN IF NOT EXISTS` — PostgreSQL built-in |
| Bulk DDL across N tables | N separate ALTER TABLE statements | `DO $$ FOREACH` loop with `EXECUTE format()` |
| Sequence collision after forced id=1 | Manual sequence inspection | `setval(pg_get_serial_sequence(...), ...)` — standard pattern |
| Table existence check before ALTER | Try/catch in application code | `information_schema.tables` check inside DO block |

---

## Common Pitfalls

### Pitfall 1: NOT NULL Without DEFAULT Fails on Non-Empty Tables
**What goes wrong:** `ALTER TABLE bookings ADD COLUMN tenant_id INTEGER NOT NULL` fails immediately because existing rows have no value.
**Why it happens:** PostgreSQL enforces NOT NULL during the ALTER, not lazily.
**How to avoid:** Always `ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id)`.
**Warning signs:** Migration error: `column "tenant_id" of relation "X" contains null values` or `ERROR: column "tenant_id" contains null values`.

### Pitfall 2: FK to tenants Before tenants Exists
**What goes wrong:** The `DO $$ FOREACH` loop tries to add `REFERENCES tenants(id)` but `tenants` was not created earlier in the same migration file.
**Why it happens:** SQL statement order matters. FKs cannot reference tables that don't exist yet.
**How to avoid:** CREATE TABLE tenants first, then run the FOREACH loop. Both must be in the same migration file (Step A).

### Pitfall 3: Serial Sequence Collision After Forced id=1 Seed
**What goes wrong:** After `INSERT INTO tenants (id, ...) VALUES (1, ...)`, the serial sequence is still at 1. The next `INSERT INTO tenants ...` (without explicit id) will try id=1 and fail with unique constraint violation.
**Why it happens:** PostgreSQL serial sequences are not reset by explicit id inserts.
**How to avoid:** Call `SELECT setval(pg_get_serial_sequence('tenants', 'id'), GREATEST((SELECT MAX(id) FROM tenants), 1), true)` after the seed insert.

### Pitfall 4: `IF NOT EXISTS` Missing on Index Creation
**What goes wrong:** Running the migration twice (e.g., after a reset) fails on `CREATE INDEX` because the index already exists.
**Why it happens:** `CREATE INDEX` does not have an implicit idempotency guarantee without `IF NOT EXISTS`.
**How to avoid:** Always use `CREATE INDEX IF NOT EXISTS` on all index creation statements.

### Pitfall 5: Drizzle Schema Out of Sync with Migration
**What goes wrong:** The DB has `tenant_id` columns but `shared/schema.ts` does not declare them. TypeScript types become wrong (no `tenantId` property on inferred types). Phase 39 (storage refactor) cannot compile.
**Why it happens:** Forgetting to update `shared/schema.ts` after writing the SQL migration.
**How to avoid:** The plan must include a task to update `shared/schema.ts` immediately after (or in the same wave as) the migration task.

### Pitfall 6: Slug Conflicts Within tenants Table
**What goes wrong:** If later tenants are added with slug = 'skleanings', the UNIQUE constraint on `tenants.slug` will reject them.
**Why it happens:** Global UNIQUE on slug is correct — the slug is the tenant identifier.
**How to avoid:** Use a meaningful, collision-resistant slug like `'skleanings'` (not `'mvp'` or `'tenant1'`).

### Pitfall 7: contacts.email Has a Global UNIQUE Constraint
**What goes wrong:** After adding `tenant_id`, two different tenants cannot have customers with the same email — the global `UNIQUE(email)` on `contacts` prevents it.
**Why it happens:** The original schema defined `email: text("email").unique()` globally.
**How to avoid:** Phase 38 does NOT need to resolve this. The constraint stays as-is. This is a Phase 39/40 concern when multi-tenant filtering is active. Document as a known forward-looking issue.

**Same issue exists for:** `categories.slug`, `subcategories.slug`, `services` (no slug but other uniques), `staffMembers.email`, `staffGoogleCalendar` (staffMemberId unique), `users.email`.

---

## Runtime State Inventory

> This is an additive migration phase (new tables + new columns), not a rename/refactor. No runtime state is affected.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No existing data needs renaming or migrating — DEFAULT 1 fills existing rows | None |
| Live service config | No service config references tenant IDs | None |
| OS-registered state | None | None |
| Secrets/env vars | No new env vars required for Phase 38 | None |
| Build artifacts | None affected by schema additions | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Running migration | Assumed available (used in previous phases) | — | None — required |
| PostgreSQL (via Supabase) | Migration target | Yes (production DB active) | — | — |
| Node.js + npm | TypeScript compilation check | Yes | — | — |

**Note:** The migration is applied via `supabase db push` against the remote Supabase instance. No local PostgreSQL required.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test framework configured in this project |
| Config file | None |
| Quick run command | `npm run check` (TypeScript type-check) |
| Full suite command | `npm run check && npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MT-01 | tenants table created | smoke (DB query) | manual — query `SELECT * FROM tenants` after migration | N/A |
| MT-02 | domains table created with FK | smoke (DB query) | manual — query `SELECT * FROM domains` after migration | N/A |
| MT-03 | user_tenants composite PK | smoke (DB query) | manual — attempt duplicate insert, expect error | N/A |
| MT-04 | tenant_id on all 38 tables | smoke (DB query) | manual — `SELECT column_name FROM information_schema.columns WHERE column_name = 'tenant_id'` | N/A |
| MT-05 | Skleanings seeded as id=1 | smoke (DB query) | manual — `SELECT * FROM tenants WHERE id = 1` | N/A |

### TypeScript Validation (automated)
After updating `shared/schema.ts`:
- **Per task:** `npm run check` — verifies no TypeScript errors from new columns
- **Phase gate:** `npm run build` — full client + server build must succeed

### Wave 0 Gaps
None — this phase has no automated tests. Validation is `npm run check` + manual DB inspection after `supabase db push`.

---

## Code Examples

### Full Step A Migration Structure

```sql
-- supabase/migrations/20260515000000_phase38_multi_tenant_foundation.sql

BEGIN;

-- 1. Registry tables
CREATE TABLE IF NOT EXISTS tenants (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  status     text NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS domains (
  id          serial PRIMARY KEY,
  tenant_id   integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hostname    text NOT NULL UNIQUE,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS domains_tenant_id_idx ON domains (tenant_id);

CREATE TABLE IF NOT EXISTS user_tenants (
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'viewer',
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS user_tenants_tenant_id_idx ON user_tenants (tenant_id);
CREATE INDEX IF NOT EXISTS user_tenants_user_id_idx ON user_tenants (user_id);

-- 2. Add tenant_id to all business tables (idempotent via IF NOT EXISTS)
DO $$
DECLARE
  t text;
  scoped_tables text[] := ARRAY[
    'users',
    'categories',
    'subcategories',
    'services',
    'service_addons',
    'service_options',
    'service_frequencies',
    'service_durations',
    'service_booking_questions',
    'contacts',
    'visitor_sessions',
    'recurring_bookings',
    'bookings',
    'conversion_events',
    'integration_settings',
    'chat_settings',
    'chat_integrations',
    'twilio_settings',
    'email_settings',
    'telegram_settings',
    'conversations',
    'conversation_messages',
    'booking_items',
    'company_settings',
    'faqs',
    'service_area_groups',
    'service_area_cities',
    'service_areas',
    'blog_posts',
    'blog_post_services',
    'blog_settings',
    'blog_generation_jobs',
    'time_slot_locks',
    'staff_members',
    'staff_service_abilities',
    'staff_availability',
    'staff_google_calendar',
    'staff_availability_overrides',
    'notification_logs',
    'calendar_sync_queue'
  ];
BEGIN
  FOREACH t IN ARRAY scoped_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id integer NOT NULL DEFAULT 1 REFERENCES tenants(id)',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)',
        t || '_tenant_id_idx', t
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
```

### Full Step B Migration Structure

```sql
-- supabase/migrations/20260515000001_phase38_seed_skleanings_tenant.sql

BEGIN;

-- Insert Skleanings as the canonical tenant (id=1)
INSERT INTO tenants (id, slug, name, status, created_at, updated_at)
VALUES (1, 'skleanings', 'Skleanings', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Advance sequence past id=1 so next auto-insert gets id=2
SELECT setval(
  pg_get_serial_sequence('tenants', 'id'),
  GREATEST((SELECT MAX(id) FROM tenants), 1),
  true
);

-- Insert localhost as primary domain for Skleanings
INSERT INTO domains (tenant_id, hostname, is_primary, created_at, updated_at)
VALUES (1, 'localhost', true, now(), now())
ON CONFLICT (hostname) DO NOTHING;

COMMIT;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-tenant schema | tenant_id on every business table | Phase 38 (this phase) | All queries in Phase 39 will filter by tenantId |
| Global UNIQUE on slug/email | Will need composite UNIQUE per tenant (future) | Phase 39+ | Known forward issue, not in Phase 38 scope |
| `drizzle-kit push` | Supabase CLI only | Project memory (feedback_db_migrations.md) | Never use drizzle-kit for migrations |

---

## Open Questions

1. **`users` table: global vs tenant-scoped**
   - What we know: MT-04 and the additional context explicitly list `users` in the 38 tables
   - What's unclear: A global `users` table (where one user can serve multiple tenants via `user_tenants`) is architecturally cleaner for a SaaS platform
   - Recommendation: Follow the stated requirement — add `tenant_id DEFAULT 1` to `users`. The `user_tenants` junction table handles the multi-tenant membership relationship. The `users.tenant_id` serves as the "home tenant" concept.

2. **Global UNIQUE constraints that will break under multi-tenancy**
   - What we know: `contacts.email`, `categories.slug`, `subcategories.slug`, `staffMembers.email`, `users.email` have global UNIQUE constraints that will conflict across tenants
   - What's unclear: Should Phase 38 begin converting these to composite unique constraints?
   - Recommendation: Do NOT change existing UNIQUE constraints in Phase 38. This is purely additive. The constraints become a problem only when a second real tenant is onboarded. Flag for Phase 39 or a dedicated future phase.

3. **`ON DELETE` behavior for tenant_id FK**
   - What we know: The skaleclub-websites reference does not add `ON DELETE` to the scoped tables' tenant_id FK (leaves it as default RESTRICT)
   - Recommendation: Omit `ON DELETE` clause on scoped tables' tenant_id FK (default RESTRICT). Tenants should never be deleted casually — RESTRICT is safe.

---

## Sources

### Primary (HIGH confidence)
- `shared/schema.ts` — all 40 business tables enumerated directly from source
- `supabase/migrations/20260514000000_add_locale_settings.sql` — confirms latest migration timestamp is `20260514000000`; next must be `>=20260515000000`
- `supabase/migrations/20260409000000_add_contacts.sql` — confirms `ADD COLUMN IF NOT EXISTS` pattern and backfill pattern used in this project
- `supabase/migrations/20260512000000_add_calendar_sync_queue.sql` — confirms `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` patterns
- `skaleclub-websites/supabase/migrations/20260501120000_phase13_multi_tenant_foundation.sql` — authoritative reference for the exact two-step migration pattern, DO $$ FOREACH loop, FK definitions
- `skaleclub-websites/supabase/migrations/20260501130000_phase13_backfill_mvp_tenant.sql` — authoritative reference for seed + `setval` pattern
- `shared/models/auth.ts` — confirms `users.id` is `varchar/text`, not integer or uuid type column

### Secondary (MEDIUM confidence)
- Project memory `feedback_db_migrations.md` — "Always use Supabase CLI for DB migrations, never drizzle-kit push"
- `skaleclub-websites/shared/schema.ts` — confirms `users.id` is `uuid` text type in reference project; `user_tenants.userId` uses `text` FK

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all from project's own files and direct reference project
- Migration SQL patterns: HIGH — copied from working reference migrations in skaleclub-websites
- Table inventory: HIGH — enumerated directly from shared/schema.ts
- Drizzle schema patterns: HIGH — matches existing patterns in the codebase

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable — SQL migrations don't change)
