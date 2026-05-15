---
phase: 64-stripe-connect-frontend
plan: 02
subsystem: ui
tags: [stripe-connect, super-admin, react, drizzle, react-query]

requires:
  - phase: 63-stripe-connect-backend
    provides: tenant_stripe_accounts table, webhook-maintained connect state
provides:
  - GET /api/super-admin/tenants response augmented with stripeConnect nested object per tenant
  - TenantListItem TypeScript type extended with stripeConnect field
  - SuperAdmin Tenants table Connect column (badge + capability indicators)
affects: [65-payment-routing, super-admin-ui, future-connect-ops-tooling]

tech-stack:
  added: []
  patterns:
    - "LEFT JOIN aggregate select with row destructuring to drop join-key alias columns from response"
    - "Read-only audit column pattern (badge + subtext) for super-admin lean tooling"

key-files:
  created:
    - .planning/phases/64-stripe-connect-frontend/64-02-SUMMARY.md
  modified:
    - server/routes/super-admin.ts
    - client/src/hooks/useSuperAdmin.ts
    - client/src/pages/SuperAdmin.tsx

key-decisions:
  - "LEFT JOIN tenant_stripe_accounts so deauthorized tenants (row deleted on account.application.deauthorized webhook) and never-onboarded tenants both surface as connected:false — single source of truth, no separate disconnected state"
  - "Read-only Connect column (no action buttons) per CLAUDE.md lean-admin guidance; operational actions (force-disconnect) deferred"
  - "Strip raw stripeConnected/stripeChargesEnabled/stripePayoutsEnabled aliases from response via destructured map — keep API surface clean and only expose the nested stripeConnect object"

patterns-established:
  - "Aggregate super-admin endpoints LEFT JOIN auxiliary tables and reshape into nested objects in the result mapper, hiding column-alias plumbing from clients"
  - "Capability indicator subtext uses check/x glyphs (✓/✗) for compact dual-flag display under a primary state badge"

requirements-completed: [SC-07]

duration: 24min
completed: 2026-05-15
---

# Phase 64 Plan 02: Super-Admin Connect Status Column Summary

**Per-tenant Stripe Connect status (connected + charges/payouts capabilities) surfaced via LEFT JOIN aggregate and rendered as a Connected/Not Connected badge with capability subtext in the SuperAdmin Tenants table.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-05-15T16:09:25Z
- **Completed:** 2026-05-15T16:33:31Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- GET /api/super-admin/tenants now LEFT JOINs `tenant_stripe_accounts` and returns `stripeConnect: { connected, chargesEnabled, payoutsEnabled }` on every tenant row (never omitted — disconnected tenants get `connected: false`).
- `TenantListItem` type in `useSuperAdmin.ts` extended to mirror the server contract; React Query data flows through without hook changes.
- SuperAdmin Tenants table gained a new "Connect" column between Billing and Created, rendering a green/gray badge plus capability indicators (Charges/Payouts ✓ or ✗) when connected.
- Implements requirement SC-07 — platform operators can now audit Connect adoption from the super-admin panel without DB inspection.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend GET /api/super-admin/tenants with stripeConnect LEFT JOIN** — `996a61d` (feat)
2. **Task 2: Extend TenantListItem type with stripeConnect field** — `e4d21f9` (feat)
3. **Task 3: Add Connect column to SuperAdmin Tenants table** — `2711cc5` (feat)

## Files Created/Modified

- `server/routes/super-admin.ts` — Imports `tenantStripeAccounts`; adds three select columns + a LEFT JOIN in `GET /tenants`; reshapes result map to drop alias columns and build the nested `stripeConnect` object.
- `client/src/hooks/useSuperAdmin.ts` — `TenantListItem` interface gains `stripeConnect: { connected, chargesEnabled, payoutsEnabled }` matching the server response.
- `client/src/pages/SuperAdmin.tsx` — `TenantsSection` table adds a "Connect" `<TableHead>` and matching `<TableCell>` with badge + conditional capability subtext.

## Decisions Made

- **Absence-of-row = disconnected.** Phase 63's webhook deletes the `tenant_stripe_accounts` row on `account.application.deauthorized`. The LEFT JOIN therefore correctly produces `connected: false` for both never-onboarded and deauthorized tenants — no separate "disconnected" state to track.
- **Read-only column.** No dropdown, no force-disconnect button. Per CLAUDE.md "lean admin tools": audit-only surface. Operational actions remain a future plan.
- **Hide column-alias plumbing from the response.** The select uses `stripeConnected` (mapped from `tenantStripeAccounts.tenantId`), `stripeChargesEnabled`, `stripePayoutsEnabled` aliases; the result mapper destructures those out and emits only the nested `stripeConnect` object. Keeps the API contract clean.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Initial edits were accidentally applied to the non-worktree checkout (`C:\Users\Vanildo\Dev\skleanings\server\routes\super-admin.ts`) instead of the worktree (`C:\Users\Vanildo\Dev\skleanings\.claude\worktrees\agent-a27919066aaf3c54e\server\routes\super-admin.ts`). Reverted the main checkout and re-applied to the worktree. No code impact — caught before any commit.

## User Setup Required

None — no external service configuration required. Webhook-driven `tenant_stripe_accounts` rows from Phase 63 are sufficient to populate the new column.

## Verification

- `npx tsc --noEmit -p tsconfig.json` — exit 0 after each task (no new errors).
- Manual API smoke (per plan): `curl -b cookie.txt http://localhost:5000/api/super-admin/tenants | jq '.[0].stripeConnect'` returns `{ connected, chargesEnabled, payoutsEnabled }` (super-admin login + running server required — deferred to user smoke test).
- Manual UI smoke (per plan): visit `/superadmin` → Tenants table shows Connect column between Billing and Created (deferred to user smoke test).

## Next Phase Readiness

- SC-07 satisfied. Phase 64 plan 03 (or next plan) can build on this audit surface.
- The aggregate LEFT JOIN pattern in `GET /tenants` is now five-table-wide (tenants, domains, tenant_subscriptions, tenant_stripe_accounts + bookings/services/staff via grouped counts). If further tables get added, consider extracting to a storage method to keep the route handler readable.
- v20.0 payment routing work can rely on the `tenant_stripe_accounts` join shape and the surfaced `chargesEnabled` flag as a gating signal in super-admin tooling.

## Self-Check: PASSED

Files verified on disk:
- FOUND: server/routes/super-admin.ts
- FOUND: client/src/hooks/useSuperAdmin.ts
- FOUND: client/src/pages/SuperAdmin.tsx
- FOUND: .planning/phases/64-stripe-connect-frontend/64-02-SUMMARY.md

Commits verified in git log:
- FOUND: 996a61d (Task 1)
- FOUND: e4d21f9 (Task 2)
- FOUND: 2711cc5 (Task 3)

---
*Phase: 64-stripe-connect-frontend*
*Completed: 2026-05-15*
