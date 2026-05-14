---
phase: 47-password-reset
plan: 02
subsystem: auth-api
tags: [password-reset, email, resend, auth, api]

# Dependency graph
requires:
  - phase: 47-01
    provides: createPasswordResetToken / findPasswordResetToken / markPasswordResetTokenUsed / updateUserPassword storage methods
  - phase: 31-branded-transactional-email-via-resend
    provides: sendResendEmail() function in server/lib/email-resend.ts
provides:
  - buildPasswordResetEmail() pure builder function in server/lib/email-resend.ts
  - POST /api/auth/forgot-password route (no-enumeration flow)
  - POST /api/auth/reset-password route (token validation + password update)
  - POST /api/auth/change-password route (session-guarded self-serve)
affects: [47-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "No-enumeration: forgot-password always returns 200 regardless of email existence"
    - "Raw token in email link; SHA-256 hash only stored in DB — same pattern as 47-01"
    - "change-password requires req.session.adminUser — consistent with Phase 45 session auth"
    - "buildPasswordResetEmail is a pure function — no DB calls, no side effects"

key-files:
  created: []
  modified:
    - server/lib/email-resend.ts
    - server/routes/auth.ts

key-decisions:
  - "buildPasswordResetEmail is pure (no IStorage param) — caller fetches companyName and passes it in"
  - "forgot-password swallows all errors in try/catch to prevent timing-based enumeration"
  - "reset-password checks usedAt before expiresAt — used token is rejected even if within time window"
  - "change-password uses storage.getUser(userId) (not getUserByEmail) — session already holds the user ID"

# Metrics
duration: 5min
completed: 2026-05-14
---

# Phase 47 Plan 02: Password Reset API Routes Summary

**Three new auth routes (forgot-password, reset-password, change-password) plus buildPasswordResetEmail() email template added to complete the backend half of the password reset feature**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-14T13:42:00Z
- **Completed:** 2026-05-14T13:47:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `buildPasswordResetEmail()` pure builder function to `server/lib/email-resend.ts` — returns `{ subject, html, text }` with brand-color HTML template (blue header, yellow CTA button) and plain-text fallback
- Added `POST /api/auth/forgot-password`: generates `crypto.randomBytes(32)` raw token, stores SHA-256 hash via `storage.createPasswordResetToken()`, sends email via Resend, always returns 200 to prevent email enumeration
- Added `POST /api/auth/reset-password`: validates token hash via `storage.findPasswordResetToken()`, rejects expired or used tokens (400), updates password with bcrypt hash (cost 12), marks token used
- Added `POST /api/auth/change-password`: guards with `req.session.adminUser` check, verifies current password via `bcrypt.compare`, updates password via `storage.updateUserPassword()`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add buildPasswordResetEmail() to email-resend.ts** - `fcb9224` (feat)
2. **Task 2: Add forgot-password, reset-password, change-password routes** - `10d79e9` (feat)

## Files Created/Modified
- `server/lib/email-resend.ts` — appended `buildPasswordResetEmail()` pure function with branded HTML email and plain-text fallback
- `server/routes/auth.ts` — added `crypto` and `buildPasswordResetEmail`/`sendResendEmail` imports; added three route handlers

## Decisions Made
- `buildPasswordResetEmail` takes no `IStorage` parameter — caller (the route handler) fetches `companySettings` and passes `companyName` in; keeps function pure and trivially testable
- `forgot-password` wraps the entire user lookup + token creation + email send in one `try/catch` that swallows errors silently — same 200 response regardless; prevents timing correlation
- `reset-password` rejects `record.usedAt !== null` before checking `expiresAt` — a consumed token is invalid even if technically within the time window
- `change-password` retrieves user via `storage.getUser(userId)` using the session's stored ID rather than re-querying by email — simpler and matches existing session auth pattern

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all three routes are fully wired to storage methods from 47-01. No hardcoded or placeholder data.

## Self-Check: PASSED

- `server/lib/email-resend.ts` — FOUND, contains `buildPasswordResetEmail` export
- `server/routes/auth.ts` — FOUND, contains `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`
- Commit `fcb9224` — FOUND
- Commit `10d79e9` — FOUND
- `npm run check` — exits 0, no TypeScript errors

---
*Phase: 47-password-reset*
*Completed: 2026-05-14*
