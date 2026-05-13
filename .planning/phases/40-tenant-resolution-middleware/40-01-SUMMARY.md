---
phase: 40-tenant-resolution-middleware
plan: "01"
subsystem: server-middleware
tags: [multi-tenant, lru-cache, middleware, tenant-resolution]
dependency_graph:
  requires: [38-01, 39-01]
  provides: [tenant-resolution, express-locals-augmentation]
  affects: [server/routes.ts, all business route handlers]
tech_stack:
  added: [lru-cache@^11.3.6]
  patterns: [Express middleware, LRU caching, module augmentation]
key_files:
  created:
    - server/middleware/tenant.ts
    - server/types/locals.d.ts
  modified:
    - server/routes.ts
    - package.json
    - package-lock.json
decisions:
  - "Use req.hostname (not req.headers.host) to avoid port contamination in LRU cache keys"
  - "Super-admin routes mounted before resolveTenantMiddleware so they bypass tenant lookup entirely"
  - "LRU cache max=500, ttl=5min — balances memory footprint against DB hit rate"
metrics:
  duration: ~10 minutes
  completed: "2026-05-13"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
requirements:
  - MT-09
  - MT-10
  - MT-11
  - MT-13
---

# Phase 40 Plan 01: Tenant Resolution Middleware Summary

**One-liner:** LRU-cached Express middleware resolves hostname to tenant row, gates all business routes, and exposes typed `res.locals.tenant` and `res.locals.storage` via TypeScript module augmentation — super-admin routes bypassed.

## What Was Built

Tenant resolution middleware that sits at the HTTP boundary and gates every business request. On each request, the middleware checks an in-process LRU cache (max 500 entries, 5-minute TTL) keyed by `req.hostname`. On a cache miss it queries `domains JOIN tenants`, caches the result, then populates `res.locals.tenant` and `res.locals.storage = DatabaseStorage.forTenant(tenant.id)`. Unknown hostnames receive a 404 before reaching any business route handler.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install lru-cache and create TypeScript locals augmentation | 0ccb3cc | package.json, package-lock.json, server/types/locals.d.ts |
| 2 | Implement resolveTenantMiddleware with LRU cache | c4f6395 | server/middleware/tenant.ts |
| 3 | Wire middleware into routes.ts with super-admin bypass ordering | 696bdf2 | server/routes.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npm run check` passes with no TypeScript errors after each task
- Route ordering confirmed: super-admin at line 32, resolveTenantMiddleware at line 35, first business router at line 39
- `lru-cache` present in package.json dependencies
- `server/types/locals.d.ts` augments `Express.Locals` with typed `tenant?` and `storage?` fields
- `server/middleware/tenant.ts` exports `resolveTenantMiddleware` with LRU cache max=500, ttl=300_000ms

## Known Stubs

None. The middleware is fully wired. Note: `res.locals.storage` is populated but downstream route handlers still use the module-level `storage` singleton from `server/storage.ts` — switching route handlers to consume `res.locals.storage` is the scope of a future plan (40-02 or later).

## Self-Check: PASSED

- server/middleware/tenant.ts: FOUND
- server/types/locals.d.ts: FOUND
- Commit 0ccb3cc: FOUND
- Commit c4f6395: FOUND
- Commit 696bdf2: FOUND
