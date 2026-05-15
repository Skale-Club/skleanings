---
phase: 66-payments-dashboard-ui
plan: 01
subsystem: payments
tags: [stripe-connect, express, drizzle, postgres, multi-tenant, admin-api]

requires:
  - phase: 63-stripe-connect
    provides: tenant_stripe_accounts, requireAdmin/resolveTenantMiddleware gates, adminStripeConnectRouter mount pattern
  - phase: 65-connect-payment-routing
    provides: bookings.platform_fee_amount + bookings.tenant_net_amount populated on checkout.session.completed
provides:
  - IStorage.getRecentPaidBookings(limit) tenant-scoped, paid + confirmed/completed only, newest-first
  - GET /api/admin/payments/recent endpoint returning shaped payment rows ({ payments: [...] })
  - adminPaymentsRouter mounted at /api/admin behind requireAdmin
affects: [66-02-dashboard-ui, future Connect financial reporting / payouts UI]

tech-stack:
  added: []
  patterns:
    - "Topic-focused admin router files (admin-payments.ts) mirroring admin-stripe-connect.ts structure"
    - "Per-row first-bookingItem.serviceName via deterministic correlated subquery (ORDER BY id ASC LIMIT 1)"
    - "Integer-cents normalisation: numeric(10,2) totalPrice → Math.round(parseFloat * 100) for uniform client-side division"

key-files:
  created:
    - server/routes/admin-payments.ts
  modified:
    - server/storage.ts
    - server/routes.ts

key-decisions:
  - "Use bookings.createdAt as paidAt proxy (no dedicated paid_at column exists today) and document inline"
  - "Use correlated subquery for first bookingItems.serviceName rather than GROUP BY / DISTINCT ON for clarity"
  - "Clamp limit to [1, 100] in BOTH the storage layer and the route handler (defence in depth — storage stays safe if called from a non-HTTP caller)"
  - "New router file rather than extending admin-stripe-connect.ts so routers stay topic-focused"

patterns-established:
  - "Per-request tenant scoping: routes call res.locals.storage.<method>, storage method asserts this.tenantId in WHERE — no manual tenant param at the route boundary"
  - "503 guards at top of admin route handlers when res.locals.tenant or res.locals.storage missing (matches admin-stripe-connect.ts)"

requirements-completed: [PF-07]

duration: 3min
completed: 2026-05-15
---

# Phase 66 Plan 01: Recent Payments Backend Summary

**Tenant-scoped GET /api/admin/payments/recent endpoint with getRecentPaidBookings storage method, exposing paid bookings + platform fee / tenant net split behind requireAdmin.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-15T17:32:44Z
- **Completed:** 2026-05-15T17:35:48Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Added `IStorage.getRecentPaidBookings(limit)` with full DatabaseStorage implementation, tenant-scoped via `this.tenantId`, filtering `paymentStatus='paid' AND status IN ('confirmed','completed')`, ordered by `createdAt DESC` with a [1, 100] clamp (default 20).
- Created `server/routes/admin-payments.ts` exporting `adminPaymentsRouter` with `GET /payments/recent`, mirroring the admin-stripe-connect.ts structure (requireAdmin gate, 503 guards on missing tenant/storage, 500 fallback on errors).
- Wired the router into `server/routes.ts` at `/api/admin` immediately after `adminStripeConnectRouter`, ensuring it sits after `resolveTenantMiddleware`.
- Response shape: `{ payments: Array<{ id, customerName, serviceName, amountTotal (cents int), platformFeeAmount, tenantNetAmount, paidAt }> }` — `amountTotal` normalised to integer cents so the client divides by 100 uniformly with the already-cents Connect fee fields.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getRecentPaidBookings to IStorage + DatabaseStorage** — `4a69ca0` (feat)
2. **Task 2: Create adminPaymentsRouter + mount in server/routes.ts** — `8ac697b` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `server/routes/admin-payments.ts` — New admin router exposing GET /payments/recent, gated by requireAdmin, with 503/500 guards
- `server/storage.ts` — Added `getRecentPaidBookings` to IStorage interface (~line 211) and DatabaseStorage implementation (~line 1020); uses a correlated subquery for first bookingItem.serviceName per booking
- `server/routes.ts` — Imported `adminPaymentsRouter` and mounted at `/api/admin` after `adminStripeConnectRouter` (line 124)

## Decisions Made
- **paidAt = bookings.createdAt:** No `paid_at` column exists on bookings today. createdAt is the closest proxy and is what the `paidAt` field in the response shape represents. Documented inline in storage method.
- **Correlated subquery for serviceName:** Used `(SELECT serviceName FROM booking_items WHERE booking_id = bookings.id ORDER BY id ASC LIMIT 1)` rather than GROUP BY / aggregate functions. Clearer intent for "first item" and ensures deterministic selection via id ASC tiebreaker.
- **Defence-in-depth clamping:** Limit is clamped to [1, 100] both in the route handler (parseInt query param) and in the storage method (in case future non-HTTP callers misuse it).
- **New router file:** Created `admin-payments.ts` rather than extending `admin-stripe-connect.ts` so routers stay topic-focused (per plan guidance).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. The endpoint is internal HTTP and uses existing session/JWT admin auth.

## Verification Results

- `npm run check` — **PASSED** (no TypeScript errors after Task 1, again after Task 2)
- `npm run build` — **PASSED** (server bundle includes `getRecentPaidBookings` and the new route; only pre-existing `import.meta` warnings in `server/static.ts` and `server/routes/chat/utils.ts`, unrelated to this plan)
- Code review: `getRecentPaidBookings` body contains `this.tenantId` in the WHERE clause — tenant scope guard confirmed
- Code review: `adminPaymentsRouter` uses `requireAdmin` and 503 guards on missing `res.locals.tenant` / `res.locals.storage` — matches admin-stripe-connect.ts pattern exactly
- Code review: Mount order — `adminPaymentsRouter` mounted at line 124 of `server/routes.ts`, after `resolveTenantMiddleware` (same position class as `adminStripeConnectRouter` at line 120)

## Next Phase Readiness
- Backend endpoint is live and tenant-scoped — Plan 66-02 can build the admin UI page (`/admin/payments`) consuming `GET /api/admin/payments/recent` via React Query.
- No blockers. The endpoint returns an empty array gracefully when a tenant has no paid bookings yet, so the UI does not need special "first run" handling at the API layer.

## Self-Check: PASSED

- FOUND: `server/routes/admin-payments.ts`
- FOUND: `.planning/phases/66-payments-dashboard-ui/66-01-SUMMARY.md`
- FOUND: commit `4a69ca0` (Task 1)
- FOUND: commit `8ac697b` (Task 2)

---
*Phase: 66-payments-dashboard-ui*
*Completed: 2026-05-15*
