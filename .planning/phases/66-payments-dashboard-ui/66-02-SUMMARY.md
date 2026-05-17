---
phase: 66-payments-dashboard-ui
plan: 02
subsystem: ui

tags: [react, react-query, shadcn, stripe-connect, payments, admin]

# Dependency graph
requires:
  - phase: 66-payments-dashboard-ui (plan 01)
    provides: GET /api/admin/payments/recent endpoint returning last 20 paid bookings with platform_fee_amount and tenant_net_amount in cents
  - phase: 65-platform-fee-persistence
    provides: platform_fee_amount and tenant_net_amount columns populated by Stripe webhook
provides:
  - Recent Payments admin UI card rendered under existing /admin/payments route
  - Platform fee / net split visualization for tenant admins (no DB inspection needed)
  - Refresh Status button now also invalidates payments table query
affects: [future-phases-needing-payments-visualization, reporting-dashboards, payouts-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shadcn Table primitives for tabular admin data"
    - "React Query staleTime: 30000 for moderately-fresh admin data"
    - "Cents-to-display currency formatting via local formatCents helper (cents/100, toFixed(2), $-prefix, em-dash for null)"
    - "Co-invalidation of multiple query keys from a single mutation onSuccess"

key-files:
  created: []
  modified:
    - client/src/components/admin/PaymentsSection.tsx

key-decisions:
  - "Co-located RecentPayment / RecentPaymentsResponse types in PaymentsSection.tsx (single consumer, no shared/ export needed)"
  - "Local formatCents helper rather than a shared currency util — only used by this component; keeps diff minimal and avoids premature abstraction"
  - "staleTime: 30000 matches existing stripe/status query for consistent admin refresh cadence"
  - "Empty state hides the table header entirely (renders <p> instead of <Table>) per plan Success Criteria #3"

patterns-established:
  - "Pattern: cents-stored / display-formatted — DB stores integer cents, UI divides by 100 only at render time with toFixed(2)"
  - "Pattern: multi-key invalidation on shared mutations — Refresh Status invalidates BOTH stripe/status and payments/recent so one user action refreshes related views"

requirements-completed: [PF-08]

# Metrics
duration: 2m 20s
completed: 2026-05-15
---

# Phase 66 Plan 02: PaymentsSection Recent Payments UI Summary

**Recent Payments card with Date/Customer/Service/Total/Platform Fee/Net columns rendered below the Stripe Connect status card on /admin/payments, with co-invalidation of stripe/status and payments/recent on Refresh Status click.**

## Performance

- **Duration:** 2m 20s
- **Started:** 2026-05-15T17:32:32Z
- **Completed:** 2026-05-15T17:34:52Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `paymentsQuery` React Query hook fetching `/api/admin/payments/recent` with 30s staleTime
- Rendered new Recent Payments Card directly below the existing Stripe Connect status Card (`className="mt-4"`)
- Implemented 4-state UI: loading (3 Skeleton rows) / error (destructive text) / empty ("No payments yet.") / populated (shadcn Table with 6 columns)
- Currency formatting via `formatCents()` helper: integer cents divided by 100, `toFixed(2)` with `$` prefix; em-dash for null
- Platform Fee column tinted red with `-` prefix when present; Net column tinted green and bold
- Extended `refreshMutation.onSuccess` to invalidate both `['/api/admin/stripe/status']` AND `['/api/admin/payments/recent']` so the Refresh Status button now refreshes the payments table inline

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Recent Payments query + Card with Table to PaymentsSection** - `589fcf5` (feat)

_Plan metadata commit will be created after this SUMMARY is written._

## Files Created/Modified
- `client/src/components/admin/PaymentsSection.tsx` - Extended with RecentPayment types, fetchRecentPayments helper, formatCents helper, paymentsQuery useQuery, refreshMutation co-invalidation, and a new Card containing the recent payments Table

## Decisions Made
- **Co-located types** (RecentPayment, RecentPaymentsResponse) inside PaymentsSection.tsx rather than shared/. Rationale: single consumer; importing from shared/ would add coupling for no benefit. If a future page reuses these, hoist then.
- **Local formatCents helper** rather than a shared currency util. Rationale: minimal diff, no premature abstraction; the cents-storage / display-formatting boundary is well-understood here.
- **30s staleTime** matches the existing `stripe/status` query — same admin refresh cadence everywhere.
- **Hide table header entirely on empty state** (render `<p>` not `<Table>`). Matches plan Success Criteria #3 and follows the principle that empty tables waste visual space.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The plan provided full implementation snippets and they applied cleanly. `npm run check` (tsc) passed with zero errors. `npm run build` succeeded; the three `import.meta` warnings observed in the server bundle (seeds.ts, static.ts, chat/utils.ts) are pre-existing and unrelated to this plan (out of scope per executor scope-boundary rule).

## User Setup Required

None - no external service configuration required. The new card is purely a UI consumer of the endpoint added in plan 66-01 and Stripe-webhook-populated columns from phase 65.

## Verification Results

- `npm run check` (tsc): **PASS** (no new TypeScript errors)
- `npm run build`: **PASS** (client bundle built in 19.42s; server bundle built; serverless handler built)
- Grep sanity check on `PaymentsSection.tsx`:
  - "Recent Payments" — found (line 285, CardTitle)
  - "No payments yet" — found (line 304)
  - "/api/admin/payments/recent" — found 3 times (fetcher line 93, queryKey line 130, invalidation line 161)
  - `invalidateQueries` — found 2 times (line 160 stripe/status + line 161 payments/recent)
- shadcn primitives confirmed present: `client/src/components/ui/table.tsx`, `client/src/components/ui/skeleton.tsx`

## Self-Check: PASSED

- `client/src/components/admin/PaymentsSection.tsx` exists and contains all required artifacts
- Commit `589fcf5` exists on main
- All success criteria from the prompt satisfied:
  - [x] PaymentsSection.tsx has useQuery for /api/admin/payments/recent
  - [x] Recent Payments Card below Connect Status card with Table (6 columns)
  - [x] Empty state "No payments yet"
  - [x] Loading: 3 Skeleton rows
  - [x] Refresh Status button invalidates both query keys
  - [x] Platform Fee shown red (-$x.xx); Net shown green
  - [x] npm run check passes
  - [x] SUMMARY.md created

## Next Phase Readiness
- PF-08 visible UI shipped. Phase 66 dashboard work complete pending verifier.
- The shadcn Table primitives are now in use in admin/PaymentsSection — pattern available for future admin tabular UIs (bookings list, customers list, payouts).
- No blockers for downstream payouts/reporting phases.

---
*Phase: 66-payments-dashboard-ui*
*Completed: 2026-05-15*
