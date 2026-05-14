---
phase: 52-self-serve-signup-frontend
plan: "02"
subsystem: ui
tags: [react, stripe, billing, trial, shadcn]

# Dependency graph
requires:
  - phase: 50-saas-billing-self-service
    provides: BillingPage.tsx with status display and handleManageBilling / POST /api/billing/portal
provides:
  - Blue Trial badge on BillingPage when status is 'trialing'
  - Days-remaining countdown from currentPeriodEnd (minimum 0)
  - Add Payment Method CTA (brand yellow button) for trialing and past_due states
affects: [52-self-serve-signup-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: [conditional badge rendering, Math.max(0) for non-negative countdown display]

key-files:
  created: []
  modified:
    - client/src/pages/admin/BillingPage.tsx

key-decisions:
  - "Reuse handleManageBilling for Add Payment Method — same POST /api/billing/portal endpoint handles both actions"
  - "Math.max(0, Math.ceil(...)) prevents negative day display when trial already expired"
  - "Add Payment Method button uses brand yellow (#FFFF01) per CLAUDE.md CTA guidelines"

patterns-established:
  - "Trial-aware conditional rendering: status === 'trialing' gate for badge, countdown row, and CTA"

requirements-completed: [SS-07, SS-08]

# Metrics
duration: 5min
completed: 2026-05-14
---

# Phase 52 Plan 02: Trial-Aware Billing UI Summary

**BillingPage extended with blue Trial badge, days-remaining countdown, and Add Payment Method CTA for trialing/past_due subscription states**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-14T18:28:00Z
- **Completed:** 2026-05-14T18:33:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Blue Trial badge rendered beside the status badge when `status === 'trialing'`
- Days-remaining countdown row shows `X day(s) remaining` calculated from `currentPeriodEnd` with `Math.max(0, ...)` guard
- Add Payment Method button (brand yellow, pill CTA) displayed for `trialing` and `past_due` states, reusing `handleManageBilling` / Stripe portal redirect
- Manage Billing button preserved in all states

## Task Commits

1. **Task 1: Add trial and past_due conditional UI to BillingPage.tsx** - `91aaa59` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `client/src/pages/admin/BillingPage.tsx` - Added daysRemaining computation, Trial badge, countdown row, Add Payment Method button

## Decisions Made

- Reused `handleManageBilling` for Add Payment Method — same Stripe portal URL handles both adding payment and general billing management, no new endpoint needed.
- `Math.max(0, Math.ceil(...))` ensures zero or expired trials show "0 days remaining" rather than a negative number.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Trial-aware billing UI complete (SS-07, SS-08)
- Remaining phase 52 plans can proceed: public /signup page and post-signup redirect flow

---
*Phase: 52-self-serve-signup-frontend*
*Completed: 2026-05-14*
