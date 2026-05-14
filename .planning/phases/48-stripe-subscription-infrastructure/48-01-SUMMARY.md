---
phase: 48-stripe-subscription-infrastructure
plan: 01
subsystem: database
tags: [stripe, postgres, drizzle, supabase, subscription, saas]

# Dependency graph
requires:
  - phase: 47-password-reset
    provides: global registry pattern (passwordResetTokens, db-direct methods)
  - phase: 38-schema-foundation
    provides: tenants table FK target for tenant_subscriptions
provides:
  - tenant_subscriptions Supabase migration DDL
  - tenantSubscriptions Drizzle table + TenantSubscription / InsertTenantSubscription types
  - IStorage interface: createTenantSubscription, getTenantSubscription, upsertTenantSubscription
  - DatabaseStorage implementations using db directly (global registry pattern)
affects:
  - 48-02 (subscribe endpoint needs createTenantSubscription)
  - 48-03 (webhook handler needs upsertTenantSubscription)
  - 49-subscription-enforcement (needs getTenantSubscription for 402 guard)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Global registry pattern: tenant_subscriptions uses db directly (never this.tenantId), one row per tenant

key-files:
  created:
    - supabase/migrations/20260517000000_phase48_tenant_subscriptions.sql
  modified:
    - shared/schema.ts
    - server/storage.ts

key-decisions:
  - "tenant_subscriptions is a global registry table — getTenantSubscription/upsertTenantSubscription use db directly, not this.tenantId (same pattern as tenants/domains/passwordResetTokens)"
  - "stripe_subscription_id is nullable — absent until tenant subscribes after customer is created"
  - "status DEFAULT 'none' — new tenants start with no subscription status before Stripe checkout"

patterns-established:
  - "Global registry DB methods: use db.insert/select/update directly without this.tenantId guard"
  - "upsertTenantSubscription: accepts Partial<Omit<Insert, 'tenantId'|'stripeCustomerId'>> — caller only passes fields to change"

requirements-completed: [SB-01, SB-03]

# Metrics
duration: 15min
completed: 2026-05-13
---

# Phase 48 Plan 01: Stripe Subscription Infrastructure — Storage Foundation Summary

**tenant_subscriptions table via Supabase migration, Drizzle schema export, and three IStorage methods (create/get/upsert) implemented on DatabaseStorage using the global registry db-direct pattern**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-13T00:00:00Z
- **Completed:** 2026-05-13T00:15:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created `supabase/migrations/20260517000000_phase48_tenant_subscriptions.sql` with correct DDL (9 columns, 2 indexes, proper nullable/NOT NULL constraints)
- Added `tenantSubscriptions` pgTable to `shared/schema.ts` with `TenantSubscription` and `InsertTenantSubscription` type exports
- Added `createTenantSubscription`, `getTenantSubscription`, `upsertTenantSubscription` to IStorage interface
- Implemented all three methods in DatabaseStorage using `db` directly (global registry, no `this.tenantId`)
- `npm run check` passes with 0 TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Supabase migration — create tenant_subscriptions table** - `4131c7e` (chore)
2. **Task 2: Drizzle schema + IStorage interface + DatabaseStorage implementation** - `0716a70` (feat)

## Files Created/Modified
- `supabase/migrations/20260517000000_phase48_tenant_subscriptions.sql` - DDL for tenant_subscriptions with 9 columns and 2 indexes
- `shared/schema.ts` - tenantSubscriptions pgTable, TenantSubscription, InsertTenantSubscription types
- `server/storage.ts` - imports, IStorage interface 3 methods, DatabaseStorage 3 implementations

## Decisions Made
- `tenant_subscriptions` is a global registry table — all three storage methods use `db` directly, never `this.tenantId`, consistent with the global registry pattern established in Phase 42/47
- `stripe_subscription_id` is nullable: a Stripe customer can be created before a subscription exists
- `status` defaults to `'none'` — clearly indicates no subscription state before checkout

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `supabase db push` requires credentials (`SUPABASE_DB_PASSWORD`) not available in automated context. Migration file is correctly authored and committed — manual `supabase db push` is required (already noted as pending item in STATE.md).

## User Setup Required

**Migration pending:** Run `supabase db push` in the project root to apply the `tenant_subscriptions` table to the live database. This is required before Phase 48-02 (subscribe endpoint) can function end-to-end.

## Next Phase Readiness

- Phase 48-02 (subscribe endpoint): `createTenantSubscription` and `getTenantSubscription` ready to call
- Phase 48-03 (webhook handler): `upsertTenantSubscription` ready to call
- Phase 49 (enforcement): `getTenantSubscription` available for 402 guard in resolveTenantMiddleware

---
*Phase: 48-stripe-subscription-infrastructure*
*Completed: 2026-05-13*
