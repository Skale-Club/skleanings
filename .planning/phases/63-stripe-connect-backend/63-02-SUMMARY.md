---
phase: 63-stripe-connect-backend
plan: 02
subsystem: payments
tags: [stripe, stripe-connect, express, multi-tenant, admin-api]

# Dependency graph
requires:
  - phase: 63-stripe-connect-backend
    plan: 01
    provides: 5 IStorage methods + tenantStripeAccounts schema/types
  - phase: 40-tenant-resolution-middleware
    provides: res.locals.tenant + res.locals.storage propagation
  - phase: 45-tenant-admin-auth-backend
    provides: requireAdmin middleware (session fast-path then Supabase JWT)
  - phase: 48-billing-stripe
    provides: Stripe SDK init pattern + SITE_URL fallback pattern (mirrored)
provides:
  - server/routes/admin-stripe-connect.ts (adminStripeConnectRouter with 3 routes)
  - POST /api/admin/stripe/connect/onboard (Express account creation + AccountLink)
  - GET /api/admin/stripe/status (read-only Connect state)
  - POST /api/admin/stripe/refresh (sync capability flags from Stripe)
affects: [63-03-connect-webhooks, future tenant-admin Payments UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Persist-before-AccountLink ordering: stripe.accounts.create -> storage.createTenantStripeAccount -> stripe.accountLinks.create. Prevents orphaned Stripe accounts when AccountLink request fails after the account is already created upstream."
    - "Idempotent onboard: existing stripeAccountId is reused; only a fresh single-use AccountLink is minted on subsequent calls."
    - "Status (200/connected:false) vs Refresh (404) semantic split: status is a UI-friendly state read that always succeeds; refresh is an explicit 'rehydrate from Stripe' op that requires an existing row."
    - "All handlers use res.locals.tenant + res.locals.storage exclusively (no direct db/schema imports in route file) — keeps Storage interface as the only persistence contract."

key-files:
  created:
    - server/routes/admin-stripe-connect.ts
  modified:
    - server/routes.ts

key-decisions:
  - "Persist accountId BEFORE generating AccountLink — if AccountLink creation throws, we still own the account record in DB, avoiding a Stripe account orphaned from our DB"
  - "SITE_URL fallback to req.hostname — mirrors Phase 48 billingRouter portal pattern; works in dev (custom domains) and prod"
  - "adminEmail sourced from req.session?.adminUser?.email — same access path as Phase 48; tolerates JWT-only auth (Stripe accepts undefined email)"
  - "/refresh returns 404 when no row vs /status returns 200/connected:false — explicit 'nothing to refresh' vs UI-friendly state probe"
  - "Inner try/catch around every Stripe SDK call — Stripe errors become 500 with logging, never crash the response"

patterns-established:
  - "Phase 63 admin routes contract: 3 routes (onboard/status/refresh) gated by requireAdmin, all using res.locals.{tenant,storage}, all logging+500 on Stripe errors"

requirements-completed: [SC-02, SC-03, SC-04]

# Metrics
duration: ~8min
completed: 2026-05-15
---

# Phase 63 Plan 02: Admin Stripe Connect REST endpoints Summary

**Three admin-facing Stripe Connect endpoints (onboard, status, refresh) implemented in a single router file, mounted at /api/admin after tenant resolution, all gated by requireAdmin and routed through the IStorage contract established in 63-01.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-15T15:44:09Z
- **Completed:** 2026-05-15T15:52:38Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created `server/routes/admin-stripe-connect.ts` (150 lines) exporting `adminStripeConnectRouter` with 3 handlers
- `POST /stripe/connect/onboard`: idempotent — creates Express account on first call, reuses existing `stripeAccountId` thereafter; persists DB row BEFORE generating AccountLink to prevent orphan accounts
- `GET /stripe/status`: always returns 200; `connected:false` shape when no row exists, full capability flag state when row exists
- `POST /stripe/refresh`: 404 when no row, otherwise calls `stripe.accounts.retrieve` and updates DB flags via `updateTenantStripeAccount`
- Router mounted in `server/routes.ts` at `/api/admin` AFTER `resolveTenantMiddleware`, next to `adminDomainsRouter` for grouping coherence
- All handlers use `res.locals.tenant` + `res.locals.storage` exclusively (no direct `db` or schema imports)
- `npm run check` exits 0 after both tasks

## Task Commits

Each task was committed atomically:

1. **Task 1: Create server/routes/admin-stripe-connect.ts** — `ee6b814` (feat)
2. **Task 2: Mount adminStripeConnectRouter at /api/admin in server/routes.ts** — `ae037f0` (feat)

## Files Created/Modified

- `server/routes/admin-stripe-connect.ts` — New router with 3 handlers (POST onboard, GET status, POST refresh). Imports `requireAdmin` from `../lib/auth`, instantiates `Stripe` with `STRIPE_SECRET_KEY`. No direct DB/schema imports — accesses persistence through `res.locals.storage` (the 63-01 IStorage methods).
- `server/routes.ts` — Added `import { adminStripeConnectRouter } from "./routes/admin-stripe-connect";` next to `adminDomainsRouter` import. Added `app.use("/api/admin", adminStripeConnectRouter)` mount at the end of `registerRoutes`, immediately after `adminDomainsRouter` mount. Placement is AFTER `app.use(resolveTenantMiddleware)` so the router receives the populated `res.locals.tenant` and `res.locals.storage`.

## Endpoints Registered

| Method | Path                                  | Guard         | Returns                                                                            |
| ------ | ------------------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| POST   | `/api/admin/stripe/connect/onboard`   | requireAdmin  | `{ url }` (Stripe-hosted AccountLink onboarding URL)                               |
| GET    | `/api/admin/stripe/status`            | requireAdmin  | `{ connected, stripeAccountId, chargesEnabled, payoutsEnabled, detailsSubmitted }` |
| POST   | `/api/admin/stripe/refresh`           | requireAdmin  | `{ chargesEnabled, payoutsEnabled, detailsSubmitted }` or 404 when no row          |

## Decisions Made

1. **Persist accountId BEFORE generating AccountLink.** The sequence `stripe.accounts.create -> storage.createTenantStripeAccount -> stripe.accountLinks.create` ensures that if the AccountLink request fails (network glitch, Stripe outage, validation issue), we still have the Stripe account ID persisted in our DB. The alternative (AccountLink first, then persist) would leave a created Stripe account orphaned from our system — unrecoverable without manual Dashboard cleanup.

2. **Status returns 200/connected:false vs Refresh returns 404 when no row.** Status is a UI-friendly state probe — the UI always wants a usable response shape (no try/catch needed for "not connected" branch). Refresh is an explicit "go fetch the latest from Stripe" action — there is nothing to fetch when no row exists, so 404 is the correct semantic.

3. **AccountLinks are single-use, short-lived.** Calling onboard repeatedly mints fresh AccountLinks on the same `stripeAccountId`. This matches Stripe's recommended UX (admin clicks "continue onboarding" -> fresh URL) without proliferating Stripe accounts.

4. **`adminEmail` via `req.session?.adminUser?.email`.** Same access pattern as Phase 48 billingRouter. When auth is JWT-only (no session), the email is `undefined`, which Stripe accepts gracefully (admin will fill it in during onboarding).

5. **`SITE_URL` env var with `req.hostname` fallback.** Mirrors Phase 48 portal endpoint. In production with a fixed deployment URL, `SITE_URL` is set; in dev or multi-domain setups, the hostname fallback handles per-request resolution.

6. **No direct `db` or schema imports in route file.** All persistence flows through `res.locals.storage.{getTenantStripeAccount,createTenantStripeAccount,updateTenantStripeAccount}` — the IStorage contract from 63-01. This keeps the Storage layer as the single source of truth for DB operations and makes the route file trivially mockable.

## Deviations from Plan

None — plan executed exactly as written.

The initial worktree was behind local `main` and missing the 63-01 commits + plan files. Merged local `main` into the worktree before executing (no conflicts). This is not a plan deviation — it's a worktree sync step the orchestrator note already anticipated ("Pull main into your worktree if needed").

## Issues Encountered

None.

## User Setup Required

Tracked as pending in STATE.md (not introduced by this plan, but called out for Phase 63 readiness):

1. **Stripe Dashboard → Connect → Settings → Platform settings:** Enable Stripe Connect Express accounts on the platform account. Without this, `stripe.accounts.create({ type: "express", ... })` will return a `platform_settings` error.
2. **Stripe Dashboard → Connect → Settings → Branding:** Configure business name, logo, support URL for the onboarding screen tenant admins will see.
3. **`STRIPE_CONNECT_CLIENT_ID`** env var: needed for OAuth-style Connect flows. NOT required for Express direct-onboarding via AccountLinks (this plan's pattern), but worth keeping in env reference for future Standard/OAuth integrations.
4. **`SITE_URL`** env var: already set in earlier phases. Used here for `return_url`/`refresh_url`.

## Next Phase Readiness

- **Ready for 63-03 (Stripe Connect webhooks):** Webhook handlers can use `getTenantStripeAccountByAccountId` (already provided by 63-01) and `updateTenantStripeAccount` to update flags asynchronously. The sync `/refresh` endpoint in this plan provides a backup path for cases where the webhook arrives late or never (UI can manually trigger refresh).
- **Ready for tenant-admin Payments UI:** The 3 endpoints provide the complete client contract — "show current state" (GET status), "start/resume onboarding" (POST onboard), "rehydrate after returning" (POST refresh).

## Self-Check

Verifying claims:

- File `server/routes/admin-stripe-connect.ts`: FOUND
- File `server/routes.ts` contains `adminStripeConnectRouter` import + mount: FOUND (line 33 import, line 120 mount)
- Commit `ee6b814` (Task 1): FOUND
- Commit `ae037f0` (Task 2): FOUND
- `npm run check`: PASSED (exit 0, zero errors — run after Task 1 and after Task 2)
- All 3 endpoints gated by `requireAdmin`: VERIFIED (grep on file shows 3 `requireAdmin` references, one per route registration)
- Persist-before-AccountLink ordering: VERIFIED (`createTenantStripeAccount` call sits between `stripe.accounts.create` and `stripe.accountLinks.create`)
- No direct `db` or schema import in route file: VERIFIED (only imports are express, Stripe, and requireAdmin)

## Self-Check: PASSED

---
*Phase: 63-stripe-connect-backend*
*Completed: 2026-05-15*
