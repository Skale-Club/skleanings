---
phase: 51-self-serve-signup-backend
plan: 01
subsystem: backend
tags: [signup, multi-tenant, stripe, auth, storage]
dependency_graph:
  requires: []
  provides: [POST /api/auth/signup, storage.signupTenant()]
  affects: [server/storage.ts, server/routes/signup.ts, server/routes.ts]
tech_stack:
  added: []
  patterns: [global-registry-storage, db.transaction, non-fatal-stripe, bcrypt-12-rounds]
key_files:
  created:
    - server/routes/signup.ts
  modified:
    - server/storage.ts
    - server/routes.ts
decisions:
  - "[51-01] signupTenant() is a global registry method (uses db directly, not this.tenantId) matching provisionTenantAdmin pattern"
  - "[51-01] Pre-transaction uniqueness check throws SUBDOMAIN_TAKEN error code for clean 409 handling in route layer"
  - "[51-01] Stripe subscription creation is non-fatal — tenant exists regardless of Stripe API availability"
  - "[51-01] signupRouter mounted at /api before resolveTenantMiddleware so signup is accessible without a tenant context"
metrics:
  duration: ~5 minutes
  completed: 2026-05-14
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 51 Plan 01: Self-Serve Signup Backend Summary

**One-liner:** Atomic `signupTenant()` storage method + `POST /api/auth/signup` route with 14-day Stripe trial and session setup, mounted before `resolveTenantMiddleware`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add signupTenant() to IStorage interface + DatabaseStorage | b39119e | server/storage.ts |
| 2 | POST /api/auth/signup route + mount before resolveTenantMiddleware | 89c146e | server/routes/signup.ts, server/routes.ts |

## What Was Built

### Task 1: signupTenant() Storage Method

Added `signupTenant()` to both `IStorage` interface and `DatabaseStorage` class in `server/storage.ts`:

- Pre-transaction uniqueness check on `domains.hostname` — throws `err.code = "SUBDOMAIN_TAKEN"` for clean 409 at route layer
- `db.transaction()` atomically inserts into 5 tables: `tenants`, `domains`, `users`, `userTenants`, `companySettings`
- Returns `{ tenantId, userId, subdomain }` — subdomain is `${slug}.xkedule.com`
- Follows global registry pattern (uses `db` directly, not `this.tenantId`) matching `provisionTenantAdmin`

### Task 2: POST /api/auth/signup Route

Created `server/routes/signup.ts` with:

- `signupSchema` Zod validation: `companyName` (2–100), `slug` (`^[a-z0-9-]+$`, 2–50), `email` (valid), `password` (min 8)
- Calls `storage.signupTenant()` — maps `SUBDOMAIN_TAKEN` to 409 `{ field: 'slug' }`, Postgres `23505` email conflict to 409 `{ field: 'email' }`
- Non-fatal Stripe block: creates customer + 14-day trial subscription via `trial_period_days: 14`; errors logged but tenant provisioning succeeds regardless
- Sets `req.session.adminUser = { id, email, role: 'admin', tenantId }` for immediate `/admin` access
- Returns 201 `{ subdomain: 'slug.xkedule.com', adminUrl: 'https://slug.xkedule.com/admin' }`

Mounted in `server/routes.ts` at `/api` **before** `resolveTenantMiddleware` (lines 37 vs 40) so the endpoint is reachable without a tenant session.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all logic is wired. Stripe block is intentionally non-fatal (not a stub).

## Verification

All plan verification checks pass:

- `npm run check` — no TypeScript errors
- `grep -n "signupRouter\|resolveTenantMiddleware" server/routes.ts` — signupRouter at line 37, resolveTenantMiddleware at line 40 (correct order)
- `grep -n "signupTenant" server/storage.ts` — appears at line 446 (IStorage interface) and line 2509 (DatabaseStorage implementation)
- `server/routes/signup.ts` exists and exports default Router
- `signupSchema` present at line 18 of signup.ts

## Self-Check: PASSED

- server/routes/signup.ts: FOUND
- server/storage.ts signupTenant in IStorage: FOUND (line 446)
- server/storage.ts signupTenant in DatabaseStorage: FOUND (line 2509)
- server/routes.ts signupRouter before resolveTenantMiddleware: CONFIRMED (37 < 40)
- Commits b39119e and 89c146e: FOUND
