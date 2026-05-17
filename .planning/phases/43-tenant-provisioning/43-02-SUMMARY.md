---
phase: 43-tenant-provisioning
plan: 02
subsystem: server-routes
tags: [lru-cache, bcrypt, multi-tenant, provisioning, super-admin]

# Dependency graph
requires:
  - phase: 43-01
    provides: provisionTenantAdmin/seedTenantCompanySettings on IStorage + DatabaseStorage
  - phase: 40-tenant-resolution-middleware
    provides: LRU hostnameCache in server/middleware/tenant.ts
provides:
  - exported invalidateTenantCache(hostname) function in server/middleware/tenant.ts
  - POST /api/super-admin/tenants/:id/provision endpoint with one-time password response
  - seedTenantCompanySettings called on POST /tenants (new tenant creation)
  - LRU cache invalidation on POST /tenants/:id/domains and DELETE /domains/:id
affects: [44-isolation-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "invalidateTenantCache wraps hostnameCache.delete — cache stays module-private, only function exported"
    - "randomBytes(10).toString('base64url').slice(0, 16) for cryptographically secure 16-char password"
    - "409 on Postgres error code 23505 for duplicate email in provision endpoint"
    - "Password returned once in response body — never stored in plaintext after the single response"

key-files:
  created: []
  modified:
    - server/middleware/tenant.ts
    - server/routes/super-admin.ts

key-decisions:
  - "hostnameCache not exported — only invalidateTenantCache wrapper exported, preserving encapsulation"
  - "invalidateTenantCache called AFTER removeDomain succeeds in DELETE — hostname captured from pre-fetched domain row before deletion"
  - "seedTenantCompanySettings called between addDomain and res.status(201) in POST /tenants — settings seeded atomically with tenant creation"
  - "randomBytes from Node built-in crypto (not third-party) — no new dependency"

# Metrics
duration: 10min
completed: 2026-05-14
---

# Phase 43 Plan 02: Provision Endpoint + Cache Invalidation + Settings Seed Summary

**Exported invalidateTenantCache function + POST /provision endpoint wired to storage.provisionTenantAdmin + LRU cache invalidation on domain mutations + companySettings seed on tenant creation**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-05-14
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added exported `invalidateTenantCache(hostname: string): void` to `server/middleware/tenant.ts` — wraps `hostnameCache.delete(hostname)` without exposing the cache itself
- Added `randomBytes` import from `crypto` and `invalidateTenantCache` import from `../middleware/tenant` to `server/routes/super-admin.ts`
- Wired `await storage.seedTenantCompanySettings(tenant.id, name.trim())` in POST /tenants after `addDomain` and before the 201 response
- Wired `invalidateTenantCache(hostname)` in POST /tenants/:id/domains after `addDomain` succeeds
- Wired `invalidateTenantCache(domain.hostname)` in DELETE /domains/:id after `removeDomain` succeeds (hostname captured from pre-fetched row)
- Added POST /tenants/:id/provision endpoint: generates cryptographically secure 16-char password via `randomBytes`, bcrypt hashes it, calls `storage.provisionTenantAdmin`, returns `{ userId, email, password }` once, returns 409 on duplicate email (Postgres error code 23505)
- TypeScript check passes with zero errors

## Task Commits

1. **Task 1: Export invalidateTenantCache from tenant.ts** - `43d47fd` (feat)
2. **Task 2: Add provision endpoint + seed call + cache invalidation to super-admin.ts** - `fe8f891` (feat)

## Files Created/Modified

- `server/middleware/tenant.ts` - Added exported `invalidateTenantCache` function (4 lines)
- `server/routes/super-admin.ts` - Added 2 imports, 1 seed call, 2 cache invalidation calls, provision endpoint (40 lines)

## Decisions Made

- hostnameCache stays module-private — only the function is exported to maintain encapsulation
- invalidateTenantCache called after removeDomain succeeds, not before — hostname captured from pre-fetched row before deletion ensures correct key even after DB row is gone
- seedTenantCompanySettings placed between addDomain and response in POST /tenants — new tenant always gets default company settings atomically with domain creation
- randomBytes from Node built-in crypto — no new dependency introduced

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `server/middleware/tenant.ts` — exists and contains `export function invalidateTenantCache`
- `server/routes/super-admin.ts` — exists and contains `provision`, `invalidateTenantCache` (3 occurrences: 1 import + 2 call sites), `seedTenantCompanySettings`, `randomBytes`, `provisionTenantAdmin`
- Commits `43d47fd` and `fe8f891` verified in git log
- `npm run check` exits 0

---
*Phase: 43-tenant-provisioning*
*Completed: 2026-05-14*
