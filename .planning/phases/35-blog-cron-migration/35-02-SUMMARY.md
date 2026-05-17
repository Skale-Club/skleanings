---
phase: 35-blog-cron-migration
plan: "02"
subsystem: schema-cleanup
tags: [schema, supabase, migration, cleanup, dead-code]
dependency_graph:
  requires: []
  provides: [system-heartbeats-removed]
  affects: [shared/schema.ts, supabase/migrations]
tech_stack:
  added: []
  patterns: [Supabase CLI migration, schema cleanup]
key_files:
  created:
    - supabase/migrations/20260513000000_remove_system_heartbeats.sql
  modified:
    - shared/schema.ts
decisions:
  - "Migration uses DROP TABLE IF EXISTS to handle the case where system_heartbeats was never applied via Supabase CLI to the live DB"
  - "Legacy Drizzle file migrations/0013_system_heartbeats.sql left untouched as historical artifact"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 2
---

# Phase 35 Plan 02: Blog Cron Migration — Remove systemHeartbeats Schema Summary

**One-liner:** Removed dead systemHeartbeats pgTable definition and SystemHeartbeat type from shared/schema.ts, and created Supabase migration to drop the table from the live database.

## What Was Changed

### shared/schema.ts — Lines removed

BLOCK 1 removed (was lines 402-408, 7 lines including comment):
```typescript
// Heartbeat log table for keep-alive cron runs
export const systemHeartbeats = pgTable("system_heartbeats", {
  id: serial("id").primaryKey(),
  source: text("source").notNull().default("vercel-cron"),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});
```

BLOCK 2 removed (was line 645, 1 line):
```typescript
export type SystemHeartbeat = typeof systemHeartbeats.$inferSelect;
```

After deletion, the line immediately following the removed block 1 is `export const conversations = pgTable(...)` as required.

No other files reference systemHeartbeats — confirmed: no import in server/storage.ts, no route in server/routes/*.ts.

### Migration file created

`supabase/migrations/20260513000000_remove_system_heartbeats.sql`:
```sql
-- Remove system_heartbeats table (legacy Vercel Cron keep-alive artifact)
-- Table was defined in Drizzle schema but never migrated via Supabase CLI.
-- Using IF EXISTS to handle the case where it does not exist in the live DB.
DROP TABLE IF EXISTS public.system_heartbeats;
```

This is the next sequential migration after `20260512000000_add_calendar_sync_queue.sql`.

The legacy Drizzle file `migrations/0013_system_heartbeats.sql` was NOT touched — kept as historical artifact.

## Pending Human Action — supabase db push

Task 3 (Apply migration via Supabase CLI) requires a live database connection and was not executed automatically.

**Action required:**
```bash
supabase db push
```

Expected outcome: migration applied (or "already applied" if table never existed in live DB — both are acceptable due to `IF EXISTS`).

If you see an error about missing `POSTGRES_URL_NON_POOLING`, get it from:
Supabase Dashboard > Settings > Database > Connection string (direct connection, port 5432).

## TypeScript and Build Status

- `npm run check` — passes (tsc exits 0, no SystemHeartbeat errors)
- `grep -n "systemHeartbeats\|SystemHeartbeat" shared/schema.ts` — no results

## Deviations from Plan

None — Tasks 1 and 2 executed exactly as written. Task 3 (supabase db push) was intentionally skipped as it requires a live database connection (human action gate per plan design).

## Self-Check: PASSED

- shared/schema.ts — modified, committed at e5b6284
- supabase/migrations/20260513000000_remove_system_heartbeats.sql — created, committed at 830cce1
- `grep -n "systemHeartbeats\|SystemHeartbeat" shared/schema.ts` — no results
- npm run check — passes
