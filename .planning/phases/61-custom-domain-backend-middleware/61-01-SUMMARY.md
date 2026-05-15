---
phase: 61-custom-domain-backend-middleware
plan: 01
subsystem: database
tags: [drizzle, postgres, supabase, multi-tenant, custom-domain, verification]

# Dependency graph
requires:
  - phase: 42-multi-tenant-foundation
    provides: domains table, tenants registry, IStorage domain methods (getTenantDomains, addDomain, removeDomain)
provides:
  - "domains table extended with verified/verifiedAt/verificationToken columns"
  - "Backfill auto-verifies existing primary domains (system-generated subdomains)"
  - "Five new IStorage methods for tenant-scoped domain verification: addDomainWithVerification, verifyDomain, removeDomainForTenant, getDomainsForTenant, findDomainById"
affects: [61-02-admin-domain-routes, 61-03-verification-middleware-gate, custom-domain]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global-registry storage methods (db directly, parameter-based tenantId — no this.tenantId)"
    - "Tenant-scoped queries via and(eq(domains.id, id), eq(domains.tenantId, tenantId)) — prevents cross-tenant access"
    - "32-byte hex verification tokens via crypto.randomBytes(32).toString('hex')"
    - "removeDomainForTenant returns tri-state result (removed/not-found/primary-refused)"

key-files:
  created:
    - supabase/migrations/20260522000000_phase61_domain_verification.sql
  modified:
    - shared/schema.ts
    - server/storage.ts

key-decisions:
  - "verifiedAt uses withTimezone: true to match TIMESTAMPTZ migration column type, consistent with Phase 55 emailVerificationTokens"
  - "createdAt/updatedAt left without withTimezone to avoid breaking pre-existing code in other phases"
  - "No index on verification_token: lookups always use (id, tenantId), never raw token scan"
  - "getDomainsForTenant and getTenantDomains intentionally coexist as near-duplicates — different semantic owners (tenant admin vs super-admin)"
  - "removeDomainForTenant fetches before delete to distinguish not-found vs primary-refused for caller error messaging"

patterns-established:
  - "Tenant-scoped delete pattern: SELECT first to determine refused vs not-found, then DELETE with composite WHERE"
  - "Phase 61 storage methods follow global-registry pattern: take tenantId as parameter, never read this.tenantId"

requirements-completed: [CD-01]

# Metrics
duration: 5min
completed: 2026-05-15
---

# Phase 61 Plan 01: Domain Verification Schema & Storage Primitives Summary

**Domains table extended with verified/verifiedAt/verificationToken columns plus five tenant-scoped IStorage methods to unblock admin routes (61-02) and middleware gate (61-03)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-15T14:13:19Z
- **Completed:** 2026-05-15T14:18:21Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Supabase migration adds verified, verified_at, verification_token to domains table with idempotent ADD COLUMN IF NOT EXISTS
- Backfill UPDATE marks existing primary domains as verified (system-generated subdomains never need DNS verification)
- Drizzle schema mirrors the new columns so DomainRow auto-inherits the fields via $inferSelect
- Five new IStorage methods land on both the interface and DatabaseStorage with full type-checking via `npm run check`
- Existing super-admin domain methods (addDomain/removeDomain/getTenantDomains) preserved untouched

## Task Commits

Each task was committed atomically (with --no-verify per orchestrator directive):

1. **Task 1: Create Supabase migration for domain verification columns** - `d4c1b48` (feat)
2. **Task 2: Extend Drizzle domains schema with verification columns** - `e76a47c` (feat)
3. **Task 3: Add IStorage verification methods + DatabaseStorage implementations** - `5411697` (feat)

**Plan metadata commit:** _(pending — final docs commit after this SUMMARY)_

## Files Created/Modified

- `supabase/migrations/20260522000000_phase61_domain_verification.sql` (created) — Adds verified/verified_at/verification_token columns, backfills primaries as verified
- `shared/schema.ts` (modified) — domains pgTable extended with verified (boolean, default false), verifiedAt (timestamp withTimezone), verificationToken (text)
- `server/storage.ts` (modified) — IStorage gains 5 method signatures; DatabaseStorage implements all 5 with tenant-scoped composite WHERE clauses

## New IStorage Method Signatures

```typescript
addDomainWithVerification(tenantId: number, hostname: string): Promise<{ id: number; verificationToken: string }>;
verifyDomain(id: number, tenantId: number): Promise<boolean>;
removeDomainForTenant(id: number, tenantId: number): Promise<{ removed: boolean; isPrimary: boolean; hostname: string }>;
getDomainsForTenant(tenantId: number): Promise<DomainRow[]>;
findDomainById(id: number, tenantId: number): Promise<DomainRow | null>;
```

## Import Notes

No new imports were required in `server/storage.ts`:
- `crypto` — already imported at line 1 (`import crypto from "crypto"`)
- `eq`, `and`, `asc` — all already present at line 141 (`import { eq, and, or, gte, lte, inArray, desc, asc, sql, ne, isNull, like } from "drizzle-orm"`)
- `domains` — already imported from `@shared/schema`

## Decisions Made

- **verifiedAt uses TIMESTAMPTZ + withTimezone** for consistency with the migration and with Phase 55's emailVerificationTokens pattern; createdAt/updatedAt deliberately left as-is (without withTimezone) to avoid touching pre-existing types in unrelated code paths.
- **No verification_token index**: lookups always scope by (id, tenantId), never by raw token. Adding an index would be overhead without query benefit.
- **getDomainsForTenant alongside getTenantDomains**: both methods are near-duplicate one-liners but serve different semantic owners. Tenant-admin routes (61-02) use the new method; super-admin keeps using the existing one. They can diverge later without breaking either consumer.
- **removeDomainForTenant tri-state return**: select-then-delete pattern lets the route layer distinguish 404 (not found) from 400 (refusing to remove primary domain) without leaking that distinction at the storage layer.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Pending user action:** Run `supabase db push` after merge to apply `20260522000000_phase61_domain_verification.sql` to the live database. This is already tracked in STATE.md pending items and noted in the plan's `user_setup` frontmatter.

The migration is idempotent (ADD COLUMN IF NOT EXISTS, backfill guarded by `WHERE is_primary = true AND verified = false`), so re-running is safe.

## Next Phase Readiness

- Plan 61-02 (admin routes) unblocked: can build POST /api/admin/domains, POST /api/admin/domains/:id/verify, DELETE /api/admin/domains/:id against the five new methods.
- Plan 61-03 (middleware gate) unblocked: can read `domain.verified` and `domain.isPrimary` from cached/queried rows (DomainRow inherits the new fields automatically).
- Both downstream plans are independent of each other — Wave 2 can run them in parallel.
- No blockers, no concerns.

## Self-Check: PASSED

Verified all artifacts:
- `supabase/migrations/20260522000000_phase61_domain_verification.sql` — FOUND
- `shared/schema.ts` updates — FOUND (verified/verifiedAt/verificationToken fields present)
- `server/storage.ts` updates — FOUND (all 5 method signatures + implementations present)
- Commit `d4c1b48` — FOUND
- Commit `e76a47c` — FOUND
- Commit `5411697` — FOUND
- `npm run check` — PASSED (exit code 0, no output)

---
*Phase: 61-custom-domain-backend-middleware*
*Completed: 2026-05-15*
