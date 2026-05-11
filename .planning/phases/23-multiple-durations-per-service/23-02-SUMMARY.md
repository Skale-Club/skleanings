---
phase: 23-multiple-durations-per-service
plan: "02"
subsystem: backend
tags: [storage, rest-api, express, drizzle]
dependency_graph:
  requires: [23-01]
  provides: [serviceDurations-CRUD, enriched-GET-services-id]
  affects: [client/src, booking-flow]
tech_stack:
  added: []
  patterns: [IStorage-interface, requireAdmin-middleware, insertServiceDurationSchema.partial]
key_files:
  created: []
  modified:
    - server/storage.ts
    - server/routes/catalog.ts
decisions:
  - "GET /api/services/:id enriched with durations array so Plan 03 needs no extra request"
  - "Admin routes use requireAdmin middleware (consistent with existing pattern)"
  - "GET /api/services/:id/durations returns [] on error (graceful degradation, matching options/frequencies pattern)"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-11"
  tasks_completed: 2
  files_changed: 2
---

# Phase 23 Plan 02: Service Durations Backend Summary

**One-liner:** 4 storage methods and 5 REST endpoints for `serviceDurations` CRUD, plus enriched `GET /api/services/:id` that includes a `durations` array.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add serviceDurations storage methods to server/storage.ts | 706795a | server/storage.ts |
| 2 | Add 5 duration endpoints and enrich GET /api/services/:id | f2edf1f | server/routes/catalog.ts |

## What Was Built

### Storage layer (Task 1)

Added to `server/storage.ts`:
- Import `serviceDurations` table, `ServiceDuration`, `InsertServiceDuration`, `insertServiceDurationSchema` from `@shared/schema`
- IStorage interface methods: `getServiceDurations`, `createServiceDuration`, `updateServiceDuration`, `deleteServiceDuration`
- DatabaseStorage implementations for all 4 methods (ordered by `order ASC, id ASC`)

### REST endpoints (Task 2)

Added to `server/routes/catalog.ts`:
- Imported `insertServiceDurationSchema` from `@shared/schema`
- Enriched `GET /api/services/:id`: response now `{ ...service, durations: ServiceDuration[] }`
- `GET /api/services/:id/durations` — public, returns `[]` on error
- `POST /api/services/:id/durations` — admin only, validates with `insertServiceDurationSchema`
- `PATCH /api/services/:id/durations/:durationId` — admin only, validates with `.partial()`
- `DELETE /api/services/:id/durations/:durationId` — admin only

## Verification

```
npm run check: exit 0 (no TypeScript errors)
grep -c "getServiceDurations|createServiceDuration|updateServiceDuration|deleteServiceDuration" server/storage.ts: 8 (4 interface + 4 impl)
grep -c "/api/services/:id/durations" server/routes/catalog.ts: 4
GET /api/services/:id response shape: { ...service, durations: ServiceDuration[] }
```

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All endpoints are fully wired to storage methods.

## Self-Check: PASSED

- [x] `server/storage.ts` has `getServiceDurations`, `createServiceDuration`, `updateServiceDuration`, `deleteServiceDuration` (8 occurrences: 4 interface + 4 impl)
- [x] `GET /api/services/:id` returns `{ ...service, durations }` (line 253-254)
- [x] 4 new routes in catalog.ts (GET, POST, PATCH, DELETE on `/api/services/:id/durations`)
- [x] Admin routes use `requireAdmin` middleware
- [x] `npm run check` passes with zero errors
- [x] Commits exist: 706795a (storage), f2edf1f (catalog)
