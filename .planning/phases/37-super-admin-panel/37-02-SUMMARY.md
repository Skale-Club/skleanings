---
phase: 37-super-admin-panel
plan: "02"
subsystem: server
tags: [super-admin, api, authentication, express, bcrypt, drizzle]
dependency_graph:
  requires:
    - server/types/session.d.ts (Plan 01 — superAdmin session typing)
    - server/lib/error-log.ts (Plan 01 — getRecentErrors)
    - server/lib/runtime-env.ts (collectRuntimeEnvDiagnostics)
  provides:
    - server/routes/super-admin.ts (all /api/super-admin/* handlers)
    - requireSuperAdmin middleware (exported for future use)
  affects:
    - server/routes.ts (superAdminRouter mounted at /api/super-admin)
tech_stack:
  added: []
  patterns:
    - Timing-safe credential check via Promise.all (bcrypt always runs)
    - requireSuperAdmin middleware exported alongside router
    - Parallel db.select count queries via Promise.all
    - Migration count via fs.readdirSync with .sql filter
key_files:
  created:
    - server/routes/super-admin.ts
  modified:
    - server/routes.ts
decisions:
  - Timing-safe login: Promise.all ensures bcrypt.compare runs even when email doesn't match
  - collectRuntimeEnvDiagnostics() reused for health check env var status (no duplication)
  - requireSuperAdmin exported from router file so Plan 03 can import it directly if needed
metrics:
  duration_minutes: 5
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  completed_date: "2026-05-11"
requirements:
  - SADM-01
  - SADM-02
  - SADM-03
  - SADM-04
  - SADM-05
  - SADM-06
---

# Phase 37 Plan 02: Super-Admin API Routes Summary

Complete /api/super-admin/* REST API with timing-safe bcrypt login, session-based auth middleware, platform stats, health diagnostics, company-settings CRUD, and error log retrieval.

## What Was Built

### Task 1: server/routes/super-admin.ts

Created the entire super-admin API router with 8 route registrations (9 handler registrations counting logout):

| Route | Method | Auth Required | Description |
|-------|--------|---------------|-------------|
| /login | POST | No | Timing-safe bcrypt login; sets session.superAdmin |
| /logout | POST | No | Destroys session |
| /me | GET | No | Session probe — returns 403 if not authenticated |
| /stats | GET | Yes | totalBookings, totalContacts, totalServices, totalStaff, serverUptimeSeconds |
| /health | GET | Yes | dbConnected, migrationCount, envErrors, envWarnings |
| /company-settings | GET | Yes | Returns current company settings |
| /company-settings | PATCH | Yes | Updates company settings via storage layer |
| /error-logs | GET | Yes | Returns getRecentErrors() (up to 50, most recent first) |

**Key implementation details:**

- `requireSuperAdmin` checks `req.session.superAdmin?.authenticated === true` — no `any` casts needed thanks to Plan 01's session type augmentation
- POST /login uses `Promise.all([Promise.resolve(emailMatch), bcrypt.compare(...)])` so bcrypt ALWAYS runs regardless of email match (prevents timing-based username enumeration)
- GET /stats runs 4 parallel `db.select({ count: count() })` queries via Promise.all
- GET /health reuses `collectRuntimeEnvDiagnostics()` from runtime-env.ts rather than duplicating env checks

### Task 2: server/routes.ts — mount point

Added two changes:
1. Import: `import { superAdminRouter } from "./routes/super-admin";`
2. Mount: `app.use("/api/super-admin", superAdminRouter);` after existing route mounts

## Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| Timing-safe login | Promise.all with bcrypt always running | Prevents username enumeration via timing differences |
| collectRuntimeEnvDiagnostics reuse | Import from runtime-env.ts | No duplication; single source of truth for env validation |
| requireSuperAdmin export | Named export alongside router | Plan 03 can import it directly if needed for middleware composition |
| Migration count | fs.readdirSync with .sql filter, catch = 0 | Graceful degradation if supabase/migrations dir doesn't exist |

## Verification

- `grep -n "superAdminRouter" server/routes.ts` — shows import (line 26) and mount (line 92)
- `grep -n "requireSuperAdmin" server/routes/super-admin.ts` — shows 6 uses (definition + 5 protected routes)
- `grep "Promise.all" server/routes/super-admin.ts` — shows timing-safe login check
- `npm run check` — exits 0 (no TypeScript errors)
- `npm run build` — exits 0 (dist/index.cjs 2.3mb)

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 8141108 | feat(37-02): create super-admin router with all /api/super-admin/* handlers |
| Task 2 | dcbc886 | feat(37-02): mount superAdminRouter at /api/super-admin in routes.ts |

## Self-Check: PASSED

- `server/routes/super-admin.ts` — FOUND (178 lines, all 8 routes confirmed)
- `server/routes.ts` — FOUND (modified, import line 26 + mount line 92 confirmed)
- Commit 8141108 — FOUND
- Commit dcbc886 — FOUND
