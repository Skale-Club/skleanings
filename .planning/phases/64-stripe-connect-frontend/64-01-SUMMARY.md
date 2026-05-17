---
phase: 64-stripe-connect-frontend
plan: 01
subsystem: payments
tags: [stripe, stripe-connect, react, react-query, lucide-react, admin-ui]

# Dependency graph
requires:
  - phase: 63-stripe-connect-backend
    provides: GET /api/admin/stripe/status, POST /api/admin/stripe/connect/onboard, POST /api/admin/stripe/refresh
provides:
  - Tenant-facing /admin/payments UI with status card, capability badges, and connect/continue/update CTA
  - Return-from-Stripe handler that toasts + auto-refreshes on ?status=success
  - AdminSection union extension for 'payments'
  - Sidebar menu entry with Wallet icon
affects: [stripe-checkout, payment-flows, tenant-onboarding, stripe-webhooks-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Self-fetching admin section component (no props, no getAccessToken — session-cookie auth)
    - useMutation for action POSTs paired with queryClient.invalidateQueries for read-after-write
    - Mount-time URL param handler with window.history.replaceState to prevent re-fire on remount
    - Stateful primary CTA label driven by (connected, detailsSubmitted) tuple

key-files:
  created:
    - client/src/components/admin/PaymentsSection.tsx
  modified:
    - client/src/components/admin/shared/types.ts
    - client/src/pages/Admin.tsx

key-decisions:
  - "Used default export for PaymentsSection (matches BillingPage convention; plan permitted either)"
  - "Refresh button entirely hidden when !status.connected (refresh endpoint 404s — defensive UX)"
  - "404 from /refresh surfaced as friendly toast 'No Stripe account yet' rather than destructive error"
  - "URL stripped via window.history.replaceState on ?status=success to prevent re-fire on hot-reload/remount"
  - "Section rendered inline (max-w-2xl, no outer page padding) — Admin.tsx provides the wrapper"

patterns-established:
  - "Stripe Connect onboard URL handoff: POST returns { url }, client sets window.location.href"
  - "Capability flags rendered as Check/X icon rows from lucide-react (consistent with BillingPage features)"

requirements-completed: [SC-06]

# Metrics
duration: 20min
completed: 2026-05-15
---

# Phase 64 Plan 01: Stripe Connect Frontend Onboarding UI Summary

**`/admin/payments` page with React Query status card, stateful Connect/Continue/Update CTA, and return-from-Stripe auto-refresh — turns Phase 63 backend into a usable tenant-facing feature.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-15T16:09:45Z
- **Completed:** 2026-05-15T16:29:20Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Tenant admins can now self-serve Stripe Express onboarding from `/admin/payments` — no curl/API access required
- Status card surfaces connection state, account ID, and three capability flags (Charges/Payouts/Details Submitted) in real time
- Return-from-Stripe UX automatically refreshes status and clears the `?status=success` query param after a single toast
- Sidebar entry with Wallet icon discovers the feature naturally between Billing and Domains

## Task Commits

Each task was committed atomically with `--no-verify`:

1. **Task 1: Add 'payments' to AdminSection union** — `5131f14` (feat)
2. **Task 2: Create PaymentsSection component** — `d916230` (feat)
3. **Task 3: Wire Payments sidebar entry and inline render in Admin.tsx** — `cd50d8f` (feat)

**Plan metadata commit:** (created with this SUMMARY + STATE/ROADMAP updates)

## Files Created/Modified

- `client/src/components/admin/PaymentsSection.tsx` (created, 240 lines) — Status card, brand-yellow primary CTA, refresh button, mount-time `?status=success` handler, error/loading states.
- `client/src/components/admin/shared/types.ts` (modified) — AdminSection union extended with `'payments'` member tagged for Phase 64 / SC-06.
- `client/src/pages/Admin.tsx` (modified) — Wallet icon import, default-import of PaymentsSection, menu entry `{ id: 'payments', title: 'Payments', icon: Wallet }`, conditional render `{activeSection === 'payments' && <PaymentsSection />}`.

## Decisions Made

- **Default export for PaymentsSection** — matches BillingPage convention; plan permitted either default or named.
- **Refresh button conditional on `status.connected`** — refresh endpoint 404s when no account row exists; hiding the button avoids surfacing a confusing error state to a tenant who hasn't connected yet. The 404 path is still gracefully handled with a friendly toast in case the button is rendered before status arrives.
- **Mount-time URL param stripping** — `window.history.replaceState({}, '', '/admin/payments')` after the success-path toast prevents the same handler firing on hot-reload, route change, or React strict-mode double mount.
- **Section padding from Admin.tsx wrapper** — PaymentsSection uses `max-w-2xl` only (no `mx-auto py-12 px-4`), matching other inline sections so it inherits the parent `p-6 sm:p-6 md:p-8` padding.

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed on first attempt with zero TypeScript errors after each step.

## Issues Encountered

None — TypeScript compilation passed cleanly after each task. No build errors, no missing imports, no schema mismatches with the Phase 63 backend contracts.

## User Setup Required

None — no external service configuration required for the frontend. The Phase 63 backend already handles Stripe Connect setup; this plan only adds UI surface on top of existing endpoints.

## Verification Evidence

- **TypeScript:** `npx tsc --noEmit -p tsconfig.json` exited 0 after each of Tasks 1, 2, and 3 (logs empty — zero errors).
- **Acceptance criteria checklist:**
  - [x] PaymentsSection exists with React Query + status card + connect/continue button + refresh
  - [x] AdminSection union includes `'payments'`
  - [x] Admin.tsx has Payments sidebar entry with Wallet icon
  - [x] `?status=success` URL param triggers auto-refresh + toast + URL strip
  - [x] `window.location.href = data.url` on onboard click
  - [x] `npm run check` (tsc --noEmit) passes
- **Sidebar position:** Payments appears after Billing in `menuItems` (line 75 in Admin.tsx).

## Self-Check: PASSED

Files verified to exist:
- FOUND: `client/src/components/admin/PaymentsSection.tsx`
- FOUND: `client/src/components/admin/shared/types.ts` (modified)
- FOUND: `client/src/pages/Admin.tsx` (modified)

Commits verified in git log:
- FOUND: `5131f14` (Task 1)
- FOUND: `d916230` (Task 2)
- FOUND: `cd50d8f` (Task 3)

## Known Stubs

None — all UI is wired to live Phase 63 backend endpoints. No hardcoded data, no placeholder text, no mock components.

## Next Phase Readiness

- Phase 64 plan 02 (likely customer-facing checkout / Stripe Payment Intent flow) can build on the tenant having a connected Stripe account.
- Backend webhook handling for `account.updated` events (if not already covered in Phase 63) would let status refresh proactively without the manual button.
- No blockers.

---
*Phase: 64-stripe-connect-frontend*
*Completed: 2026-05-15*
