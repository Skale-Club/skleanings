---
phase: 42-tenant-management-ui
plan: 02
subsystem: api
tags: [express, super-admin, tenant-management, drizzle, rest-api]

# Dependency graph
requires:
  - phase: 42-01
    provides: IStorage global-registry methods (createTenant, addDomain, updateTenantStatus, getTenantDomains, removeDomain)
  - phase: 38-schema-foundation
    provides: tenants and domains tables in shared/schema.ts
provides:
  - Six Express routes for tenant/domain CRUD under /api/super-admin/*
  - GET /tenants with LEFT JOIN primaryDomain (no N+1)
  - POST /tenants with hostname normalization and 23505 duplicate detection
  - PATCH /tenants/:id/status for active/inactive toggle
  - GET /tenants/:id/domains domain listing
  - POST /tenants/:id/domains non-primary domain addition
  - DELETE /domains/:id with primary-domain guard
affects:
  - 42-03 (frontend hooks consuming these routes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - drizzle leftJoin with and() compound condition for GET /tenants (one query, no N+1)
    - hostname normalization via regex (strip protocol + trailing slash) before persistence
    - PostgreSQL error code 23505 caught for 409 on duplicate slug or hostname
    - Primary-domain guard via pre-fetch before DELETE (400 if isPrimary=true)

key-files:
  created: []
  modified:
    - server/routes/super-admin.ts

key-decisions:
  - "GET /tenants uses direct db LEFT JOIN rather than storage.getTenants() to return primaryDomain in-row without N+1 — one query for the full list"
  - "hostname normalization (strip protocol/trailing slash) applied in both POST /tenants and POST /tenants/:id/domains — consistent input handling"
  - "DELETE /domains/:id pre-fetches the domain row before calling storage.removeDomain() — allows explicit 400 guard on isPrimary without storage-layer changes"

# Metrics
duration: 3min
completed: 2026-05-14
---

# Phase 42 Plan 02: Tenant Management UI — API Routes Summary

**Six Express routes added to server/routes/super-admin.ts for tenant and domain CRUD, all guarded by requireSuperAdmin, using LEFT JOIN for N+1-free list, 23505 duplicate detection, and primary-domain guard on DELETE**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-14T00:43:28Z
- **Completed:** 2026-05-14T00:46:11Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Extended drizzle-orm import with `and`, `asc` and schema import with `tenants`, `domains`
- Added GET /tenants with `db.leftJoin(domains, and(...))` — single query returns primaryDomain inline
- Added POST /tenants — validates required fields, normalizes hostname (strips protocol/trailing slash), creates tenant then domain, catches PostgreSQL 23505 with context-aware 409 messages (slug vs hostname)
- Added PATCH /tenants/:id/status — validates id and status enum, delegates to storage.updateTenantStatus
- Added GET /tenants/:id/domains — delegates to storage.getTenantDomains
- Added POST /tenants/:id/domains — normalizes hostname, adds non-primary domain, catches 23505
- Added DELETE /domains/:id — pre-fetches domain for 404/400 guards, calls storage.removeDomain on success (204)
- All six routes guarded by `requireSuperAdmin`
- `npm run check` passes with zero TypeScript errors

## Task Commits

1. **Task 1: GET /tenants, POST /tenants, PATCH /tenants/:id/status** — `7a23125`
2. **Task 2: GET/POST /tenants/:id/domains, DELETE /domains/:id** — `964c6d5`

## Files Created/Modified

- `server/routes/super-admin.ts` — Added `and`, `asc`, `tenants`, `domains` imports; six new route handlers (182 lines added)

## Decisions Made

- GET /tenants uses direct db LEFT JOIN rather than storage.getTenants() to return primaryDomain in-row without N+1.
- hostname normalization regex applied at route layer (not storage) — strips `https?://` prefix and trailing `/`.
- DELETE /domains/:id pre-fetches the domain row before removal to enforce the isPrimary guard with a proper 400 response.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Known Stubs

None — all routes are fully implemented with real storage calls.

## Next Phase Readiness

- Plan 42-03 (frontend hooks + UI) can now be implemented — all six API routes are live
- No blockers

---
*Phase: 42-tenant-management-ui*
*Completed: 2026-05-14*
