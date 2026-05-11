---
phase: 23-multiple-durations-per-service
plan: "01"
subsystem: schema
tags: [schema, migration, drizzle, postgresql]
dependency_graph:
  requires: []
  provides: [serviceDurations-table, serviceDurations-types]
  affects: [server/storage.ts, server/routes/catalog.ts]
tech_stack:
  added: []
  patterns: [drizzle-pgTable, createInsertSchema, $inferSelect]
key_files:
  created:
    - supabase/migrations/20260510000002_add_service_durations.sql
  modified:
    - shared/schema.ts
decisions:
  - "serviceDurations is a standalone table (not folded into services) to allow N durations per service"
  - "ON DELETE CASCADE ensures orphan-free cleanup when parent service is removed"
  - "order column allows UI-controlled sort order independent of insertion order"
metrics:
  duration_minutes: 5
  completed_date: "2026-05-11"
  tasks_completed: 2
  files_changed: 2
---

# Phase 23 Plan 01: Service Durations Schema Summary

**One-liner:** SQL migration and Drizzle ORM table for `service_durations` with cascade FK to `services.id`, enabling multiple duration/price options per service.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Write Supabase migration for service_durations table | 7cd37ad | supabase/migrations/20260510000002_add_service_durations.sql |
| 2 | Add serviceDurations table to shared/schema.ts | 6abfbae | shared/schema.ts |

## What Was Built

### Migration (Task 1)
- `supabase/migrations/20260510000002_add_service_durations.sql`
- Creates `service_durations` table with 6 columns: `id`, `service_id`, `label`, `duration_minutes`, `price`, `order`
- FK to `services(id)` with `ON DELETE CASCADE`
- Index `service_durations_service_id_idx` on `service_id` for fast lookups
- Both `CREATE TABLE` and `CREATE INDEX` use `IF NOT EXISTS` (idempotent)

### Schema additions (Task 2)
- `serviceDurations` pgTable — mirrors migration exactly
- `insertServiceDurationSchema` — Zod insert schema (omits `id`)
- `ServiceDuration` TypeScript type — `typeof serviceDurations.$inferSelect`
- `InsertServiceDuration` TypeScript type — `z.infer<typeof insertServiceDurationSchema>`

## Verification

```
npm run check: exit 0 (no TypeScript errors)
grep -c "serviceDurations" shared/schema.ts: 5 matches
Migration file contains CREATE TABLE IF NOT EXISTS + ON DELETE CASCADE
```

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. This plan only adds DB schema; no UI or data rendering is involved.

## Self-Check: PASSED

- [x] `supabase/migrations/20260510000002_add_service_durations.sql` exists
- [x] `shared/schema.ts` exports `serviceDurations`, `ServiceDuration`, `InsertServiceDuration`, `insertServiceDurationSchema`
- [x] `npm run check` passes with zero errors
- [x] Commits exist: 7cd37ad (migration), 6abfbae (schema)
