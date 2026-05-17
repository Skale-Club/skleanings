---
phase: 56-setup-checklist
plan: "01"
subsystem: backend
tags: [setup-checklist, admin, schema, migration]
dependency_graph:
  requires: []
  provides: [adminSetupRouter, setupDismissedAt-schema, setup_dismissed_at-migration]
  affects: [server/routes.ts, shared/schema.ts, company_settings-table]
tech_stack:
  added: []
  patterns: [res.locals.storage tenant-scoped pattern, requireAdmin guard, Express Router]
key_files:
  created:
    - server/routes/admin-setup.ts
    - supabase/migrations/20260519000000_phase56_setup_dismissed_at.sql
  modified:
    - shared/schema.ts
    - server/routes.ts
decisions:
  - setupDismissedAt has no default — null means not dismissed, consistent with passwordResetTokens pattern
  - includeHidden=true used in getServices so admin sees all services (not just published ones) for checklist count
  - Sequential staff availability check (break on first hit) avoids unnecessary DB queries
metrics:
  duration_minutes: 10
  completed_date: "2026-05-14T23:27:30Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 56 Plan 01: Setup Checklist Backend Summary

**One-liner:** Setup checklist backend with `setup_dismissed_at` Supabase migration, Drizzle schema column, and `adminSetupRouter` exposing GET /api/admin/setup-status and POST /api/admin/setup-dismiss using tenant-scoped storage.

## What Was Built

Two admin endpoints for the setup checklist card:

- `GET /api/admin/setup-status` — queries live DB for services count, staff count, and staff availability, then returns `{ hasService, hasStaff, hasAvailability, dismissed }`. Uses `Promise.all` for the first three queries; availability check short-circuits on first positive result.
- `POST /api/admin/setup-dismiss` — sets `companySettings.setupDismissedAt = new Date()` to permanently dismiss the checklist card.

Both endpoints require a valid admin session via `requireAdmin` and use `res.locals.storage` (tenant-scoped) — no global storage singleton is imported.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Supabase migration + Drizzle schema | 810c96f | shared/schema.ts, supabase/migrations/20260519000000_phase56_setup_dismissed_at.sql |
| 2 | adminSetupRouter — GET /setup-status + POST /setup-dismiss | 7855ab3 | server/routes/admin-setup.ts, server/routes.ts |

## Verification

- `npm run check` passes with zero TypeScript errors (confirmed both after Task 1 and Task 2)
- `server/routes/admin-setup.ts` exports `adminSetupRouter` with both endpoints
- `shared/schema.ts` has `setupDismissedAt` on the `companySettings` pgTable
- `server/routes.ts` mounts `adminSetupRouter` at `/api/admin` after `resolveTenantMiddleware`
- No import of global `storage` singleton in `admin-setup.ts`
- Supabase migration SQL file exists at `supabase/migrations/20260519000000_phase56_setup_dismissed_at.sql`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all endpoints return live DB data.

## Pending Items

- `supabase db push` must be run to apply the `setup_dismissed_at` column to the live database (tracked in STATE.md Pending Items, per project convention).

## Self-Check: PASSED

- `server/routes/admin-setup.ts` — FOUND
- `supabase/migrations/20260519000000_phase56_setup_dismissed_at.sql` — FOUND
- Commit 810c96f — FOUND
- Commit 7855ab3 — FOUND
