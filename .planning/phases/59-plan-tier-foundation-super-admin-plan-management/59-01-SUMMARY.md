---
phase: 59-plan-tier-foundation-super-admin-plan-management
plan: 01
subsystem: billing/plan-tiers
tags: [stripe, billing, schema, migration, plan-tiers]
one_liner: "Foundation for 3-tier plans — plan_tier column on tenant_subscriptions + stripe-plans helper module + 3 tier-specific env vars"
requirements:
  - PT-01
  - PT-02
dependency_graph:
  requires:
    - "tenant_subscriptions table (Phase 48)"
    - "shared/schema.ts Drizzle setup"
    - "server/storage.ts IStorage upsertTenantSubscription contract"
  provides:
    - "tenant_subscriptions.plan_tier column (DB)"
    - "tenantSubscriptions.planTier (Drizzle/TypeScript)"
    - "PlanTier type union 'basic' | 'pro' | 'enterprise'"
    - "PLAN_TIERS readonly tuple"
    - "isPlanTier(value) runtime guard"
    - "getPriceIdForTier(tier) forward lookup helper"
    - "getTierForPriceId(priceId) reverse lookup helper"
  affects:
    - "Phase 59-02 (feature catalog will consume PlanTier type)"
    - "Phase 59-03 (webhook reverse lookup + PATCH endpoint)"
    - "Phase 60 (Billing UI tier badge + super-admin Select dropdown)"
tech_stack:
  added: []
  patterns:
    - "DB CHECK constraint enforces enum values; Drizzle column kept as plain text() for forward compat (matches Phase 48 'status' column pattern)"
    - "Helpers read process.env at call-time, not module load, for test friendliness"
    - "Partial<Omit<InsertX>> contract auto-widens when Drizzle table gains a column — no IStorage signature edit needed"
key_files:
  created:
    - "supabase/migrations/20260521000000_phase59_plan_tier.sql"
    - "server/lib/stripe-plans.ts"
  modified:
    - "shared/schema.ts (tenantSubscriptions gains planTier column)"
    - ".env.example (3 new Stripe Price ID env vars)"
decisions:
  - "DB column type is TEXT + CHECK constraint, not a pgEnum — matches Phase 48 'status' column and allows forward compat"
  - "Helpers read process.env at call-time so tests mutating env between calls work without module re-import"
  - "Empty-string priceId short-circuits getTierForPriceId to avoid false matches against unset env vars"
  - "Did NOT edit IStorage.upsertTenantSubscription signature — Partial<Omit<InsertTenantSubscription>> auto-includes planTier? once schema regenerates"
  - "Legacy STRIPE_SAAS_PRICE_ID preserved unchanged so Phase 48 subscribe endpoint keeps working; comments instruct operator to alias it to STRIPE_SAAS_PRICE_ID_BASIC"
metrics:
  duration_seconds: 140
  tasks_completed: 3
  files_changed: 4
  completed_date: 2026-05-15
---

# Phase 59 Plan 01: Plan Tier Foundation Summary

Foundation for the v17.0 plan tier system. Added the `plan_tier` column to `tenant_subscriptions` (DB + Drizzle), created `server/lib/stripe-plans.ts` with forward + reverse tier↔priceId lookups driven by three new env vars, documented those env vars in `.env.example`, and verified that `IStorage.upsertTenantSubscription` transparently accepts `planTier` via its existing generic `Partial` contract.

## What Shipped

### Database
- New Supabase migration `20260521000000_phase59_plan_tier.sql`:
  - `ALTER TABLE tenant_subscriptions ADD COLUMN plan_tier TEXT NOT NULL DEFAULT 'basic'`
  - `CHECK (plan_tier IN ('basic', 'pro', 'enterprise'))` constraint (idempotent guard)
  - `CREATE INDEX idx_tenant_subscriptions_plan_tier` for super-admin tier queries

### Drizzle / TypeScript
- `shared/schema.ts` `tenantSubscriptions` table gains `planTier: text("plan_tier").notNull().default("basic")` as the final column
- `TenantSubscription` / `InsertTenantSubscription` types auto-regenerate to include `planTier`

### Helper Module
- `server/lib/stripe-plans.ts` exports:
  - `PlanTier` type union (`'basic' | 'pro' | 'enterprise'`)
  - `PLAN_TIERS` readonly tuple for iteration in validators + UI
  - `isPlanTier(value): value is PlanTier` runtime guard for narrowing request bodies
  - `getPriceIdForTier(tier)` reading `STRIPE_SAAS_PRICE_ID_{BASIC,PRO,ENTERPRISE}` at call-time
  - `getTierForPriceId(priceId)` reverse lookup used by Phase 59-03 webhook

### Env Vars
- `.env.example` documents 3 new vars:
  - `STRIPE_SAAS_PRICE_ID_BASIC`
  - `STRIPE_SAAS_PRICE_ID_PRO`
  - `STRIPE_SAAS_PRICE_ID_ENTERPRISE`
- Legacy `STRIPE_SAAS_PRICE_ID` preserved with migration guidance ("set this = `STRIPE_SAAS_PRICE_ID_BASIC` for backward compat")

## Tasks Executed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Supabase migration + Drizzle schema column | `b60526c` | `supabase/migrations/20260521000000_phase59_plan_tier.sql`, `shared/schema.ts` |
| 2 | server/lib/stripe-plans.ts helper + IStorage compile check | `98deeda` | `server/lib/stripe-plans.ts` |
| 3 | Document env vars in .env.example | `deb653e` | `.env.example` |

## Verification Evidence

- `ls supabase/migrations/20260521000000_phase59_plan_tier.sql` — file present
- `grep -n "planTier" shared/schema.ts` — 1 line (`120: planTier: text("plan_tier").notNull().default("basic"),`)
- `grep -c "^export" server/lib/stripe-plans.ts` — 5 exports
- `grep -c "^STRIPE_SAAS_PRICE_ID" .env.example` — 4 entries (legacy + 3 new)
- `npm run check` — exits 0, no TypeScript errors

## Deviations from Plan

None — plan executed exactly as written. The "verify upsertTenantSubscription accepts planTier transparently" assumption held: `npm run check` passed without any edit to `server/storage.ts`.

## Decisions Made

1. **TEXT + CHECK constraint over pgEnum** — matches Phase 48 `status` column pattern and keeps schema migrations cheap if tiers grow.
2. **Call-time env reads** — `getPriceIdForTier` / `getTierForPriceId` read `process.env` inside the function, not at module load, so tests mutating env between calls work without re-importing.
3. **Empty-string priceId guard** — `getTierForPriceId("")` returns null immediately, preventing false matches against unset env vars that some test environments default to empty string.
4. **No IStorage signature edit** — `Partial<Omit<InsertTenantSubscription, 'tenantId' | 'stripeCustomerId'>>` auto-widens to include `planTier?: string` once the Drizzle table gains the column. Verified by `npm run check` exit 0.
5. **Legacy STRIPE_SAAS_PRICE_ID preserved** — Phase 48 subscribe endpoint still depends on it; `.env.example` instructs operators to set it equal to `STRIPE_SAAS_PRICE_ID_BASIC`.

## Pending Operator Actions

- Run `supabase db push` to apply `20260521000000_phase59_plan_tier.sql` against the live database
- Create 3 recurring monthly Prices in Stripe Dashboard (Basic / Pro / Enterprise)
- Set `STRIPE_SAAS_PRICE_ID_BASIC`, `STRIPE_SAAS_PRICE_ID_PRO`, `STRIPE_SAAS_PRICE_ID_ENTERPRISE` in `.env` with the new Price IDs
- Optionally set `STRIPE_SAAS_PRICE_ID = STRIPE_SAAS_PRICE_ID_BASIC` so existing Phase 48 subscribe flow defaults to the Basic tier

## Known Stubs

None — this plan delivers infrastructure (DB column, helper module, env documentation). No UI or runtime call-sites are introduced in 59-01 — those land in 59-02 (feature catalog), 59-03 (webhook + PATCH), and Phase 60 (UI).

## Self-Check: PASSED

- FOUND: supabase/migrations/20260521000000_phase59_plan_tier.sql
- FOUND: server/lib/stripe-plans.ts
- FOUND: shared/schema.ts planTier column at line 120
- FOUND: .env.example 3 new tier env vars
- FOUND commit b60526c (Task 1)
- FOUND commit 98deeda (Task 2)
- FOUND commit deb653e (Task 3)
- npm run check: exit 0
