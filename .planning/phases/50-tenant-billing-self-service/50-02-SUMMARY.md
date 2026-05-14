---
phase: 50-tenant-billing-self-service
plan: 02
subsystem: billing
tags: [billing, frontend, admin, stripe, self-service, wouter, shadcn]

# Dependency graph
requires:
  - phase: 50-01
    provides: GET /api/billing/status, POST /api/billing/portal backend routes

provides:
  - client/src/pages/admin/BillingPage.tsx (standalone /admin/billing page)
  - /admin/billing route in App.tsx inside AdminTenantAuthProvider Switch
  - 'billing' in AdminSection union (shared/types.ts)
  - Billing menu item with CreditCard icon in Admin.tsx sidebar

affects:
  - admin sidebar navigation (new Billing item)
  - admin route tree (new /admin/billing route)
  - AdminSection TypeScript union type

# Tech tracking
tech-stack:
  added: []
  patterns:
    - standalone-admin-page: BillingPage is a standalone route (not embedded section in Admin.tsx shell) — auth guard via useAdminTenantAuth hook
    - badge-color-pattern: reused from SuperAdmin.tsx (green/yellow/red/gray for active/past_due/canceled/other)
    - portal-redirect: POST /api/billing/portal then window.location.href = url for Stripe portal navigation

key-files:
  created:
    - client/src/pages/admin/BillingPage.tsx
  modified:
    - client/src/App.tsx
    - client/src/components/admin/shared/types.ts
    - client/src/pages/Admin.tsx

key-decisions:
  - "BillingPage is a standalone route at /admin/billing, not an embedded section in Admin.tsx shell — clicking Billing in sidebar navigates via handleSectionSelect which calls setLocation('/admin/billing')"
  - "Badge colors reused verbatim from SuperAdmin.tsx pattern (green/yellow/red/gray)"
  - "Manage Billing button disabled when stripeCustomerId is null — no billing account edge case handled gracefully"

requirements-completed: [SB-07, SB-08]

# Metrics
duration: 2min
completed: 2026-05-14
---

# Phase 50 Plan 02: Tenant Billing Self-Service Frontend Summary

**BillingPage.tsx created at /admin/billing with subscription status card (badge + planId + renewal date) and Manage Billing button that POSTs to /api/billing/portal and redirects to Stripe Customer Portal — wired into App.tsx route tree, AdminSection types, and Admin.tsx sidebar nav with CreditCard icon**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-14T15:06:09Z
- **Completed:** 2026-05-14T15:08:23Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Created `client/src/pages/admin/BillingPage.tsx` as a standalone page (not embedded in Admin.tsx shell)
- Auth guard via `useAdminTenantAuth` — unauthenticated users redirected to `/admin/login`
- Fetches `GET /api/billing/status` on mount with `credentials: 'include'`
- Displays subscription status badge (green/yellow/red/gray matching SuperAdmin.tsx pattern), planId in mono font, and renewal date formatted via `toLocaleDateString()`
- `Manage Billing` button POSTs to `/api/billing/portal` and sets `window.location.href` to returned URL
- Button disabled when `stripeCustomerId` is null; shows support message
- Error handling for both fetch and portal POST with inline error display
- Added `BillingPage` lazy import to `client/src/App.tsx`
- Added `<Route path="/admin/billing" component={BillingPage} />` inside `AdminTenantAuthProvider` Switch block (before generic `/admin` route)
- Added `'billing'` to `AdminSection` union in `client/src/components/admin/shared/types.ts`
- Added `CreditCard` to lucide-react imports in `Admin.tsx`
- Added `{ id: 'billing', title: 'Billing', icon: CreditCard }` to `menuItems` array after integrations
- Added `billing` case to Admin.tsx section renderer (shows link to standalone `/admin/billing` page)
- `npm run check` passes with 0 TypeScript errors after both tasks

## Task Commits

1. **Task 1: Create BillingPage.tsx** - `aca2c1c` (feat)
2. **Task 2: Wire BillingPage into App.tsx, types.ts, and Admin.tsx sidebar nav** - `ecbfaa5` (feat)

## Files Modified

- `client/src/pages/admin/BillingPage.tsx` — new standalone billing page (152 lines)
- `client/src/App.tsx` — BillingPage lazy import + /admin/billing Route (2 lines added)
- `client/src/components/admin/shared/types.ts` — 'billing' added to AdminSection union (1 line)
- `client/src/pages/Admin.tsx` — CreditCard import, billing menuItem, billing section renderer (6 lines added)

## Decisions Made

- `BillingPage` is a standalone route at `/admin/billing`, not an embedded section inside the Admin.tsx shell — clicking Billing in the sidebar navigates via `handleSectionSelect` which calls `setLocation('/admin/billing')`, matching the new Route added to App.tsx
- Badge colors reused verbatim from the SuperAdmin.tsx pattern (`bg-green-100 text-green-800` / `bg-yellow-100 text-yellow-800` / `bg-red-100 text-red-800` / `bg-gray-100 text-gray-600`)
- `Manage Billing` button is disabled when `stripeCustomerId` is null to gracefully handle tenants without a billing account

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. BillingPage fetches live data from `/api/billing/status` (implemented in Plan 50-01) and redirects to a real Stripe Customer Portal URL via `/api/billing/portal`.

## Self-Check: PASSED

- client/src/pages/admin/BillingPage.tsx: FOUND (fetch /api/billing/status, fetch /api/billing/portal, window.location.href, useAdminTenantAuth, setLocation /admin/login — all present)
- client/src/App.tsx: FOUND (BillingPage import at line 96, Route /admin/billing at line 198 — 2 matches)
- client/src/components/admin/shared/types.ts: FOUND ('billing' in AdminSection union)
- client/src/pages/Admin.tsx: FOUND (CreditCard import, billing menuItem, billing section renderer)
- Commit aca2c1c (Task 1): FOUND
- Commit ecbfaa5 (Task 2): FOUND
- npm run check: 0 errors

---
*Phase: 50-tenant-billing-self-service*
*Completed: 2026-05-14*
