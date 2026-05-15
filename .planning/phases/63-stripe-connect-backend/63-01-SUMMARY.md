---
phase: 63-stripe-connect-backend
plan: 01
subsystem: payments
tags: [stripe, stripe-connect, drizzle, postgres, supabase, multi-tenant]

# Dependency graph
requires:
  - phase: 48-billing-stripe
    provides: tenantSubscriptions global registry pattern (tenant_id FK + UNIQUE, db direct in storage)
provides:
  - tenant_stripe_accounts table (Supabase migration) — stores Stripe Express Account ID + capability flags per tenant
  - tenantStripeAccounts Drizzle schema + TenantStripeAccount/InsertTenantStripeAccount types
  - 5 IStorage methods (create, getByTenantId, getByAccountId, update, delete) + DatabaseStorage implementations
affects: [63-02-connect-routes, 63-03-connect-webhooks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global registry table pattern (mirrors Phase 48): tenant_id FK + UNIQUE, no per-row scope column, db used directly in storage methods (NOT this.tenantId)"
    - "Getter return type `| null` (not `| undefined`) for unambiguous absence semantics in downstream routes/webhooks"
    - "Inline `Partial<{...}>` narrow shape for update data param (avoids exposing tenantId/stripeAccountId/timestamps to callers)"

key-files:
  created:
    - supabase/migrations/20260523000000_phase63_tenant_stripe_accounts.sql
  modified:
    - shared/schema.ts
    - server/storage.ts

key-decisions:
  - "Getters return `| null` (not `| undefined`) — webhook handlers in 63-03 will branch on absence semantics, null is unambiguous"
  - "updateTenantStripeAccount uses inline `Partial<{ chargesEnabled; payoutsEnabled; detailsSubmitted }>` rather than `Partial<InsertTenantStripeAccount>` — narrows the API so callers cannot mutate identity columns or timestamps"
  - "update/delete return `Promise<void>` — callers (webhook handlers) only need to confirm completion, not retrieve updated row"
  - "Global registry pattern: storage methods use `db` directly, NOT `this.tenantId`. Mirrors Phase 48 tenantSubscriptions exactly."

patterns-established:
  - "Phase 63 Stripe Connect persistence contract: 1 table, 5 methods, used by downstream Connect routes (63-02) and webhooks (63-03)"

requirements-completed: [SC-01]

# Metrics
duration: ~8min
completed: 2026-05-15
---

# Phase 63 Plan 01: Stripe Connect Persistence Foundation Summary

**tenant_stripe_accounts table + Drizzle schema + 5 IStorage methods establishing the persistence contract for Stripe Connect (Express accounts and capability flags), ready for routes (63-02) and webhooks (63-03).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-15T15:31:00Z
- **Completed:** 2026-05-15T15:39:37Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Supabase migration created for `tenant_stripe_accounts` (8 columns, UNIQUE on tenant_id and stripe_account_id, ON DELETE CASCADE, lookup index on stripe_account_id)
- Drizzle schema `tenantStripeAccounts` exported with snake_case SQL column names mapped to camelCase TS keys; `TenantStripeAccount`/`InsertTenantStripeAccount` types exported
- IStorage interface declares 5 new methods (Phase 63 section); DatabaseStorage class implements all 5 using `db` directly (global registry pattern)
- `npm run check` passes with zero TypeScript errors after each schema/storage change

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Supabase migration for tenant_stripe_accounts** — `a31ea10` (feat)
2. **Task 2: Add tenantStripeAccounts Drizzle schema + types** — `3bd82a6` (feat)
3. **Task 3: Add 5 IStorage methods + implementations** — `f885813` (feat)

## Files Created/Modified

- `supabase/migrations/20260523000000_phase63_tenant_stripe_accounts.sql` — New table (8 columns: id, tenant_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, created_at, updated_at) + UNIQUE constraints + ON DELETE CASCADE FK + lookup index on stripe_account_id.
- `shared/schema.ts` — Added `tenantStripeAccounts` pgTable definition between `tenantSubscriptions` types and `categories` table; added `TenantStripeAccount` and `InsertTenantStripeAccount` type exports. No new imports required (`pgTable`, `serial`, `integer`, `text`, `boolean`, `timestamp` already imported).
- `server/storage.ts` — Added `tenantStripeAccounts` + `TenantStripeAccount` to the @shared/schema import block; added 5 IStorage method signatures (Phase 63 section, immediately after Phase 48 block); added 5 DatabaseStorage async method implementations (immediately after `upsertTenantSubscription`). All use `db` directly; `eq` already imported.

## Exact Column Names (migration → Drizzle)

| SQL column                | Drizzle key         | Type                            |
| ------------------------- | ------------------- | ------------------------------- |
| `id`                      | `id`                | `serial PRIMARY KEY`            |
| `tenant_id`               | `tenantId`          | `integer NOT NULL UNIQUE FK`    |
| `stripe_account_id`       | `stripeAccountId`   | `text NOT NULL UNIQUE`          |
| `charges_enabled`         | `chargesEnabled`    | `boolean NOT NULL DEFAULT false`|
| `payouts_enabled`         | `payoutsEnabled`    | `boolean NOT NULL DEFAULT false`|
| `details_submitted`       | `detailsSubmitted`  | `boolean NOT NULL DEFAULT false`|
| `created_at`              | `createdAt`         | `timestamptz DEFAULT now()`     |
| `updated_at`              | `updatedAt`         | `timestamptz DEFAULT now()`     |

## Decisions Made

1. **Getter return type `| null` (not `| undefined`)** — Downstream Connect webhook handlers (63-03) will branch on absence to decide whether to create-or-update; `null` is the canonical "row not present" signal and avoids the `undefined` ambiguity that mixes "missing field" vs "row absent".
2. **Inline `Partial<{ chargesEnabled; payoutsEnabled; detailsSubmitted }>` for `updateTenantStripeAccount`** — Narrower than `Partial<InsertTenantStripeAccount>`. Prevents callers from accidentally updating identity columns (`tenantId`, `stripeAccountId`) or stomping timestamps. The implementation sets `updatedAt: new Date()` automatically.
3. **`update`/`delete` return `Promise<void>`** — Webhook handlers in 63-03 only need success/failure semantics, not the updated row. Returning void keeps the contract minimal.
4. **Global registry pattern** — Mirrors Phase 48 `tenantSubscriptions` exactly: storage methods use `db` directly, NOT `this.tenantId`. The table itself enforces tenant scoping via the `tenant_id UNIQUE FK` constraint.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Pending manual step (already tracked in STATE.md):** Run `supabase db push` against the linked Supabase project to apply migration `20260523000000_phase63_tenant_stripe_accounts.sql`. Per project MEMORY, migrations are always applied via Supabase CLI, never via `drizzle-kit push`.

Verification once pushed:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'tenant_stripe_accounts' ORDER BY ordinal_position;
```
Should return 8 rows matching the table above.

## Next Phase Readiness

- **Ready for 63-02 (Connect routes):** Storage methods are wired and type-checked. Routes can import `tenantStripeAccounts` + `TenantStripeAccount` and call the 5 storage methods.
- **Ready for 63-03 (Connect webhooks):** Webhook handlers can use `getTenantStripeAccountByAccountId` (Stripe webhooks deliver `account.id`, not `tenant_id`) and `updateTenantStripeAccount` to update capability flags.
- **Blocker:** `supabase db push` must run before any 63-02 route is hit at runtime (otherwise inserts will fail). Type checking and unit tests will pass before push.

## Self-Check

Verifying claims:

- File `supabase/migrations/20260523000000_phase63_tenant_stripe_accounts.sql`: FOUND
- File `shared/schema.ts` contains `tenantStripeAccounts`: FOUND (verified via Edit)
- File `server/storage.ts` contains `createTenantStripeAccount` x2 (interface + impl): FOUND (grep returned interface at line 467, impl at line 2646)
- Commit `a31ea10` (Task 1): FOUND
- Commit `3bd82a6` (Task 2): FOUND
- Commit `f885813` (Task 3): FOUND
- `npm run check`: PASSED (zero errors, run twice — after Task 2 and after Task 3)

## Self-Check: PASSED

---
*Phase: 63-stripe-connect-backend*
*Completed: 2026-05-15*
