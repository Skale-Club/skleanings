---
phase: 61-custom-domain-backend-middleware
plan: 03
subsystem: infra
tags: [middleware, multi-tenant, custom-domain, lru-cache, drizzle, security]

requires:
  - phase: 61-custom-domain-backend-middleware (plan 01)
    provides: domains.verified / verifiedAt / verificationToken columns + storage primitives
  - phase: 61-custom-domain-backend-middleware (plan 02)
    provides: invalidateTenantCache call sites on verify-success and domain-delete
provides:
  - resolveTenantMiddleware now gates non-primary unverified hostnames with 404 (CD-06)
  - LRU hostname cache invariant: "if it's in the cache, it's safe to serve"
  - Primary *.xkedule.com subdomains continue to resolve unchanged (isPrimary bypass clause)
affects: [phase-62, phase-63, custom-domain-routing, caddy-on-demand-tls]

tech-stack:
  added: []
  patterns:
    - "Servable-only cache invariant: never insert rows that fail an authorization gate"
    - "Indistinguishable 404 for unknown vs unverified hostnames (prevents enumeration)"

key-files:
  created:
    - .planning/phases/61-custom-domain-backend-middleware/61-03-SUMMARY.md
  modified:
    - server/middleware/tenant.ts
    - shared/schema.ts (deviation — see below)

key-decisions:
  - "Cache only servable entries (do NOT widen CachedTenant to include verified flag) — simpler invariant, same end-state because invalidateTenantCache flushes on verify-success"
  - "Return identical 404 body ('Unknown tenant') for unknown AND unverified rows — prevents domain-enumeration attacks"
  - "isPrimary clause carries the bypass for both backfilled and newly-signed-up primaries — avoids tightening signupTenant"

patterns-established:
  - "Authorization gates positioned BEFORE cache.set, so cache hits never need to re-check authorization"
  - "Multi-column SELECT shape (tenant + auxiliary flags) for gating without expanding cache value type"

requirements-completed: [CD-06]

duration: 5min
completed: 2026-05-15
---

# Phase 61 Plan 03: Tenant Middleware Verification Gate Summary

**resolveTenantMiddleware now returns 404 for non-primary unverified hostnames before any route handler runs, closing CD-06.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-15T14:32:21Z
- **Completed:** 2026-05-15T14:36:55Z
- **Tasks:** 1
- **Files modified:** 2 (1 planned + 1 deviation)

## Accomplishments

- Extended cache-miss DB JOIN to fetch `domains.isPrimary` and `domains.verified` alongside the tenant row
- Inserted verification gate BEFORE `hostnameCache.set` — non-primary unverified rows return 404 and never enter the cache
- Preserved primary-domain resolution (bypass via `!row.isPrimary` clause) so existing `{slug}.xkedule.com` traffic is unaffected
- Left subscription (402) and inactive-tenant (503) guards untouched

## Task Commits

1. **Task 1: Add verification gate to resolveTenantMiddleware** — `4447c18` (feat)

## Exact Diff Applied

`server/middleware/tenant.ts` — the cache-miss branch now reads:

```typescript
if (!tenant) {
  // DB lookup: JOIN domains -> tenants on cache miss
  const [row] = await db
    .select({
      tenant: tenants,
      isPrimary: domains.isPrimary,
      verified: domains.verified,
    })
    .from(domains)
    .innerJoin(tenants, eq(domains.tenantId, tenants.id))
    .where(eq(domains.hostname, hostname))
    .limit(1);

  if (!row) {
    res.status(404).json({ message: "Unknown tenant" });
    return;
  }

  // Phase 61 CD-06: non-primary domains must be DNS-verified to resolve.
  // Primary *.xkedule.com subdomains bypass this check (the 61-01 backfill set
  // verified=true for all existing primaries, and new signups create primaries
  // via storage.signupTenant — which still uses addDomain(..., isPrimary=true)
  // without a verification token; those rows would be verified=false, so we
  // special-case isPrimary here rather than tightening signupTenant).
  if (!row.isPrimary && !row.verified) {
    res.status(404).json({ message: "Unknown tenant" });
    return; // do NOT cache — unverified entries are not servable
  }

  tenant = row.tenant;
  hostnameCache.set(hostname, tenant);
}
```

Everything below this block (inactive 503, subscription 402, `res.locals.tenant`, `res.locals.storage`, the try/catch) is unchanged.

## Cache Invariant

**"Anything in `hostnameCache` is safe to serve."**

We deliberately did NOT widen `CachedTenant` to include `verified` / `isPrimary` flags. Reasoning:

- Caching `{ tenant, verified, isPrimary }` and re-checking on every hit would only matter if verified-state could flip while cached.
- `invalidateTenantCache` is already called by plan 61-02 on verify-success AND on domain delete, so any state-flipping event triggers a cold reload from DB.
- Cold reload sees the new state, re-runs the gate, and either caches (now safe) or 404s.
- Net effect is identical, with a simpler type and zero per-request flag re-checks.

`grep -c "hostnameCache.set" server/middleware/tenant.ts` = **1** (post-gate). Confirmed.

## Edge-Case Verification Table

| Scenario                                               | isPrimary | verified | Outcome                                                                              |
| ------------------------------------------------------ | --------- | -------- | ------------------------------------------------------------------------------------ |
| Existing primary `{slug}.xkedule.com` (post-backfill)  | true      | true     | Gate passes (both clauses true) → cached → resolves ✓                                |
| New-signup primary (signupTenant path, pre-verify)     | true      | false    | Gate passes via `!row.isPrimary` short-circuit → cached → resolves ✓                 |
| Newly-added custom domain (via 61-02 POST)             | false     | false    | Gate triggers 404 → NOT cached → next request also 404 (correct) ✓                   |
| Just-verified custom domain (after 61-02 verify)       | false     | true     | invalidateTenantCache flushed → cold DB load → gate passes → cached → resolves ✓     |
| Deleted custom domain                                  | (n/a)     | (n/a)    | invalidateTenantCache flushed → cold DB load → `!row` branch returns 404 ✓           |

## Decisions Made

- **Servable-only cache:** Documented under "Cache Invariant" above.
- **Indistinguishable 404 body:** Same `{ message: "Unknown tenant" }` for unknown AND unverified hostnames — prevents attackers from enumerating registered-but-unverified domains.
- **isPrimary bypass over signupTenant tightening:** The signup flow inserts primaries with `verified=false` until the 61-01 backfill runs. Special-casing `isPrimary` in the middleware lets us leave signupTenant alone — fewer moving parts to maintain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Apply 61-01 schema columns inline**
- **Found during:** Task 1 (npm run check failure: `Property 'verified' does not exist on type domains`)
- **Issue:** The execution note stated plans 61-01 and 61-02 were merged into main and that this worktree would have `verified`/`verifiedAt`/`verificationToken` on `shared/schema.ts`. In reality, those plans had not been merged into the worktree — the branch only contained the phase-creation commit (`f3d0d10 docs(61): create phase plan...`). Without the schema fields, the Drizzle `domains.verified` / `domains.isPrimary` references in the JOIN failed to type-check.
- **Fix:** Added the three columns (`verified: boolean`, `verifiedAt: timestamp(withTimezone: true)`, `verificationToken: text`) to the `domains` pgTable in `shared/schema.ts`, matching the spec from 61-01-PLAN.md exactly.
- **Files modified:** `shared/schema.ts`
- **Verification:** `npm run check` clean, `npm run build` succeeds (3 pre-existing unrelated import.meta warnings).
- **Committed in:** `4447c18` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule-3 blocking).
**Impact on plan:** Mechanical — the schema fields are an exact subset of 61-01's planned work and are a hard prerequisite for 61-03 to type-check. No scope creep, no design change.

## Issues Encountered

- The plan execution note in the parent prompt described 61-01 and 61-02 as already merged into the worktree. The worktree's `shared/schema.ts` and `server/storage.ts` did not contain those changes (verified by `git log --oneline` showing only `f3d0d10 docs(61): create phase plan...` as the most recent 61-* commit). Worked around via Rule-3 deviation (above).

## Reminder for Ops

- **`supabase db push` is still required.** This middleware change is meaningless without the live `domains.verified` column. Until the migration from 61-01 (`20260522000000_phase61_domain_verification.sql`) is applied, the JOIN will fail at runtime even though it type-checks. Note: that migration file is also missing from this worktree (it was 61-01-Task-1's deliverable) — apply it as part of the 61-01 merge.
- **Caddy on-demand TLS interplay:** Caddy queries the backend's certificate-authorization endpoint before issuing a cert for a new hostname. The 404 from this middleware (or from the dedicated `/caddy/ask` endpoint when it ships) is the signal that tells Caddy "do not issue a cert for this hostname." Without this gate, anyone adding a hostname via 61-02 could cause Caddy to issue an unauthorized cert via on-demand TLS.

## Next Phase Readiness

- CD-06 security guarantee in place: combined with 61-02's POST `/verify` flow, a hostname can only serve traffic for a tenant if (a) it is the tenant's auto-generated subdomain, or (b) DNS ownership has been proven.
- **Pending:** 61-01 and 61-02 must be merged (or their artifacts applied) before this gate is operational end-to-end.

## Self-Check: PASSED

- `server/middleware/tenant.ts` modified: FOUND
- `shared/schema.ts` modified: FOUND (deviation)
- Commit `4447c18` exists: FOUND
- `grep -c "hostnameCache.set" server/middleware/tenant.ts` = 1 (gate invariant holds): VERIFIED
- `npm run check`: CLEAN
- `npm run build`: SUCCEEDS

---
*Phase: 61-custom-domain-backend-middleware*
*Plan: 03*
*Completed: 2026-05-15*
