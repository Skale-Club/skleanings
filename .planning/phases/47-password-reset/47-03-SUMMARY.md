---
phase: 47-password-reset
plan: 03
subsystem: auth-ui
tags: [password-reset, frontend, react, pages, routing]

# Dependency graph
requires:
  - phase: 47-02
    provides: POST /api/auth/forgot-password and POST /api/auth/reset-password endpoints
provides:
  - ForgotPassword page component at client/src/pages/ForgotPassword.tsx
  - ResetPassword page component at client/src/pages/ResetPassword.tsx
  - /admin/forgot-password route (inside AdminTenantAuthProvider block)
  - /reset-password route (public Switch block)
  - "Forgot password?" link on AdminLogin page
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "No-enumeration UX: ForgotPassword always shows success regardless of fetch outcome"
    - "Token extraction via URLSearchParams(window.location.search) — works with Wouter routing"
    - "Disabled form inputs when token is missing — prevents misleading submit on /reset-password with no token"
    - "Lazy import pattern consistent with all other pages in App.tsx"

key-files:
  created:
    - client/src/pages/ForgotPassword.tsx
    - client/src/pages/ResetPassword.tsx
  modified:
    - client/src/App.tsx
    - client/src/pages/AdminLogin.tsx

key-decisions:
  - "ForgotPassword always shows success state — mirrors backend no-enumeration policy at UX layer"
  - "/admin/forgot-password placed inside AdminTenantAuthProvider so it inherits company settings context"
  - "/reset-password is in the public Switch (not admin block) — token links arrive via email with no session"
  - "ResetPassword disables inputs when token is absent and shows inline error immediately via useEffect"

# Metrics
duration: 8min
completed: 2026-05-14
---

# Phase 47 Plan 03: Password Reset UI Pages Summary

**ForgotPassword and ResetPassword pages created, routes wired in App.tsx, "Forgot password?" link added to AdminLogin — completing the end-to-end password reset user experience**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-14T13:47:43Z
- **Completed:** 2026-05-14T13:55:00Z
- **Tasks:** 2 auto + 1 checkpoint (auto-approved)
- **Files modified:** 4

## Accomplishments
- Created `client/src/pages/ForgotPassword.tsx` — email form POSTing to `/api/auth/forgot-password`, always shows success state (no-enumeration UX), brand yellow CTA, card styling matching AdminLogin
- Created `client/src/pages/ResetPassword.tsx` — reads `?token` from URL via `URLSearchParams`, new password + confirm form, inline error display for invalid/expired tokens, success state with link back to login
- Added lazy imports for both pages in `client/src/App.tsx` using the existing `PageWrapper` pattern
- Added `/admin/forgot-password` route inside `AdminTenantAuthProvider` block (inherits company settings)
- Added `/reset-password` route in the public Switch block (email token links arrive without session)
- Added "Forgot password?" link below the login form in `client/src/pages/AdminLogin.tsx`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ForgotPassword.tsx and ResetPassword.tsx** - `57b3078` (feat)
2. **Task 2: Wire routes in App.tsx and add forgot-password link to AdminLogin.tsx** - `4781a8d` (feat)
3. **Task 3: human-verify checkpoint** - auto-approved (bypass mode)

## Files Created/Modified
- `client/src/pages/ForgotPassword.tsx` — new page: email form → forgot-password API → success state
- `client/src/pages/ResetPassword.tsx` — new page: token form → reset-password API → error/success states
- `client/src/App.tsx` — two lazy imports added; `/admin/forgot-password` and `/reset-password` routes added
- `client/src/pages/AdminLogin.tsx` — "Forgot password?" link added below the login form

## Decisions Made
- `ForgotPassword` always shows success state after fetch — mirrors backend no-enumeration; even network errors only show a toast, not a "email not found" message
- `/admin/forgot-password` placed inside `AdminTenantAuthProvider` so `useCompanySettings()` resolves correctly via the provider hierarchy
- `/reset-password` is in the public Switch — password reset links arrive via email and must be accessible without a session
- `ResetPassword` disables form inputs and shows an inline error immediately when no `token` query param is present (via `useEffect`)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — both pages are fully wired to the API endpoints from 47-02. No hardcoded or placeholder data flows to UI rendering.

## Self-Check: PASSED

- `client/src/pages/ForgotPassword.tsx` — FOUND, 95 lines, contains `fetch.*forgot-password`
- `client/src/pages/ResetPassword.tsx` — FOUND, 119 lines, contains `fetch.*reset-password`
- `client/src/pages/AdminLogin.tsx` — FOUND, contains `forgot-password` link
- `client/src/App.tsx` — FOUND, contains `ForgotPassword`, `ResetPassword`, `/admin/forgot-password`, `/reset-password`
- Commit `57b3078` — FOUND
- Commit `4781a8d` — FOUND
- `npm run check` — exits 0, no TypeScript errors

---
*Phase: 47-password-reset*
*Completed: 2026-05-14*
