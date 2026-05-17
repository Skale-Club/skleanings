---
phase: 58-staff-invitation-frontend
plan: 01
subsystem: ui
tags: [react, wouter, lazy-loading, invite-flow, tenant-onboarding]

# Dependency graph
requires:
  - phase: 57-staff-invitation-backend
    provides: GET /api/auth/validate-invite + POST /api/auth/accept-invite endpoints
provides:
  - Public /accept-invite page for SF-06
  - Three-state UI machine (loading | invalid | ready | submitting) for invite acceptance
  - Cross-subdomain redirect to {adminUrl} after successful accept
affects: [58-02 (staff admin invite UI), onboarding flow, staff role provisioning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy-loaded public route via Wouter Switch + PageWrapper"
    - "URLSearchParams token read on mount (no router hook indirection)"
    - "Three-state status machine (loading|invalid|ready|submitting) for token-driven forms"

key-files:
  created:
    - client/src/pages/AcceptInvite.tsx
  modified:
    - client/src/App.tsx

key-decisions:
  - "Used a single status field 'loading | invalid | ready | submitting' instead of separate booleans — single source of truth, easier branch rendering"
  - "Read token via window.location.search URLSearchParams (mirrors VerifyEmail.tsx) — avoids pulling in a router hook for a one-shot, single-render concern"
  - "Route mounted in the public Switch outside AdminTenantAuthProvider — accept-invite establishes its own session server-side, no /api/auth/admin-me call needed"

patterns-established:
  - "Token-validated public forms: fetch validate endpoint on mount, set state to 'invalid' on 410/non-ok, render error card with no form"
  - "Cross-subdomain post-action redirect: server returns { adminUrl }, client does window.location.href = adminUrl (matches Signup.tsx)"

requirements-completed: [SF-06]

# Metrics
duration: 3min
completed: 2026-05-15
---

# Phase 58 Plan 01: Accept Invite Public Page Summary

**Public /accept-invite page that validates Phase 57 tokens, renders the setup form for valid tokens, shows an expired-state card for 410s, and redirects to the tenant adminUrl on successful acceptance.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-15T11:15:55Z
- **Completed:** 2026-05-15T11:18:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- New `client/src/pages/AcceptInvite.tsx` (219 lines) implementing loading/invalid/ready/submitting state machine, validate-invite fetch on mount, accept-invite POST submit with cross-subdomain redirect
- `/accept-invite` registered as a lazy-loaded public route in `App.tsx`, reachable on any tenant hostname
- SF-06 closed: the email link from Phase 57 (`/accept-invite?token=...`) now leads to a working acceptance flow instead of 404

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AcceptInvite.tsx public page** - `4c7a96e` (feat)
2. **Task 2: Register /accept-invite route in App.tsx** - `8d75d29` (feat)

**Plan metadata:** _to be added with final docs commit_

## Files Created/Modified
- `client/src/pages/AcceptInvite.tsx` - Public accept-invite page: validates token, renders setup form (email read-only + name + password + confirm), redirects to adminUrl on 201, shows expired card on 410
- `client/src/App.tsx` - Lazy import for AcceptInvite + `<Route path="/accept-invite" component={AcceptInvite} />` inside the public Switch (after `/verify-email`, before NotFound)

## Decisions Made
- **State shape:** Chose a single `status: 'loading' | 'invalid' | 'ready' | 'submitting'` union instead of separate `loading`/`error` booleans. Renders as three exhaustive branches; submitting reuses the ready form to avoid double-mounting Inputs (preserves focus, less flicker).
- **Token read strategy:** Used `new URLSearchParams(window.location.search).get('token')` inside the on-mount `useEffect` rather than a Wouter hook. Matches the existing VerifyEmail.tsx pattern, keeps the page free of router dependencies, and aligns with the "no router needed for a one-shot landing page" convention.
- **No auth provider wrap:** Route lives directly in the public Switch (not wrapped in `AdminTenantAuthProvider` like `/signup`). Accept-invite intentionally bypasses any client-side admin session check — the server establishes the session inside the accept-invite transaction, and the resulting redirect goes to a different subdomain anyway.
- **Disable submit only:** During submitting state we keep the form mounted and only disable the CTA, so revert-on-error (network failure / non-410 non-201) leaves the user's name/password intact.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npm run check` (tsc) passed cleanly after each task. Both grep-based acceptance criteria for both tasks matched on the first attempt.

## User Setup Required

None - no external service configuration required. The page consumes Phase 57 endpoints that are already wired into `server/routes/auth.ts`.

## Next Phase Readiness
- Phase 58-02 (staff admin invite UI — Invite button + pending invitations section) can proceed independently; it does not depend on this page beyond the shared invite URL contract.
- Manual smoke check still to perform end-to-end with a live Phase 57 token before declaring SF-06 user-verified.

## Self-Check: PASSED

- FOUND: client/src/pages/AcceptInvite.tsx
- FOUND commit: 4c7a96e (Task 1)
- FOUND commit: 8d75d29 (Task 2)
- npm run check: exit 0

---
*Phase: 58-staff-invitation-frontend*
*Completed: 2026-05-15*
