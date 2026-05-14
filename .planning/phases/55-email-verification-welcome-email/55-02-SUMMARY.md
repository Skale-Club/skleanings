---
phase: 55
plan: 02
subsystem: auth / email
tags: [email-verification, welcome-email, signup, resend, transactional-email]
dependency_graph:
  requires: [55-01 schema and storage methods (implemented inline as Rule 3 deviation)]
  provides: [email verification flow, welcome email on signup, verify-email route, resend-verification route]
  affects: [server/routes/signup.ts, server/routes/auth.ts, server/lib/email-resend.ts, shared/schema.ts, server/storage.ts]
tech_stack:
  added: [Supabase migration for email_verification_tokens table]
  patterns: [fire-and-forget void IIFE, SHA-256 token hashing, pure email builder functions]
key_files:
  created:
    - supabase/migrations/20260518000000_phase55_email_verification_tokens.sql
  modified:
    - server/lib/email-resend.ts
    - server/routes/signup.ts
    - server/routes/auth.ts
    - shared/schema.ts
    - server/storage.ts
decisions:
  - "[55-02] buildVerificationEmail and buildWelcomeEmail are pure functions — no DB calls, no side effects, caller provides all data"
  - "[55-02] fire-and-forget uses storage singleton in signup.ts (pre-tenant-middleware context, no res.locals.storage)"
  - "[55-02] resend-verification always returns 200 to prevent email enumeration"
  - "[55-02] verify-email uses SHA-256 hash of raw query param token, same pattern as password-reset"
  - "[55-02] setEmailVerified uses db directly without tenant scope — email_verified_at is global user state"
metrics:
  duration_seconds: 660
  completed_date: "2026-05-14"
  tasks_completed: 2
  files_modified: 5
---

# Phase 55 Plan 02: Email Routes + Builder Functions Summary

**One-liner:** Verification token flow wired end-to-end — buildVerificationEmail/buildWelcomeEmail pure functions, fire-and-forget on signup, GET /verify-email token validation with SHA-256 hash, POST /resend-verification session-guarded.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | buildVerificationEmail + buildWelcomeEmail in email-resend.ts | a44f98d | server/lib/email-resend.ts |
| 2 | Schema foundation + routes wired (signup fire-and-forget, verify-email, resend-verification) | 4a11550 | shared/schema.ts, server/storage.ts, server/routes/signup.ts, server/routes/auth.ts, supabase/migrations/ |

## What Was Built

### server/lib/email-resend.ts
Two new pure exported functions appended after `buildPasswordResetEmail`:

- **`buildVerificationEmail(verifyUrl, companyName)`** — Returns `{ subject, html, text }` for the email verification email. CTA: "Verify Email" button in brand yellow (#FFFF01), heading in #1C53A3. Link expires in 24 hours.
- **`buildWelcomeEmail(adminUrl, companyName)`** — Returns `{ subject, html, text }` for the post-signup welcome email. Includes 3 onboarding steps as `<ol>`, CTA: "Go to Admin Panel".

### server/routes/signup.ts
After `req.session.adminUser` is set, a fire-and-forget IIFE runs:
1. Calls `storage.createEmailVerificationToken(userId)` to get a raw token
2. Calls `buildVerificationEmail` + `sendResendEmail` with trigger `'email_verification'`
3. Calls `buildWelcomeEmail` + `sendResendEmail` with trigger `'welcome'`
4. Any email error is caught and logged — tenant already provisioned, error is non-fatal

### server/routes/auth.ts
- **GET `/api/auth/verify-email`** — Public route. Hashes `?token=` with SHA-256, calls `storage.findEmailVerificationToken`. On success: marks used, sets `emailVerifiedAt`, redirects to `/admin`. On failure/missing: redirects to `/verify-email?error=invalid`.
- **POST `/api/auth/resend-verification`** — Session-guarded (401 if no session). Creates new token, fetches company name from settings, sends verification email. Errors swallowed. Always returns `{ ok: true }`.

### shared/schema.ts + server/storage.ts + migration (55-01 scope, implemented as deviation)
- `emailVerificationTokens` pgTable added (mirrors `passwordResetTokens` pattern)
- `emailVerifiedAt` column added to `users` pgTable
- 4 new IStorage methods + DatabaseStorage implementations using `db` directly (global, no tenant scope)
- Supabase migration `20260518000000_phase55_email_verification_tokens.sql` created

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Implemented 55-01 schema/storage foundation inline**
- **Found during:** Task 2 — `npm run check` reported `Property 'createEmailVerificationToken' does not exist on type 'DatabaseStorage'`
- **Issue:** Plan 55-01 (schema + storage methods) had not been executed in this worktree. Plan 55-02 depended on those methods being available.
- **Fix:** Implemented the full 55-01 scope inline: `emailVerificationTokens` pgTable in `shared/schema.ts`, `emailVerifiedAt` on `users`, 4 IStorage methods in interface, 4 DatabaseStorage implementations, Supabase migration file, `crypto` import in `storage.ts`.
- **Files modified:** `shared/schema.ts`, `server/storage.ts`, `supabase/migrations/20260518000000_phase55_email_verification_tokens.sql`
- **Commit:** 4a11550 (included in Task 2 commit)

## Known Stubs

None — all email builder functions are fully implemented with real HTML/text content and real URLs. No placeholder data flows to rendering.

## Self-Check: PASSED

- `server/lib/email-resend.ts` — buildVerificationEmail at line 171, buildWelcomeEmail at line 216: FOUND
- `server/routes/signup.ts` — fire-and-forget block with createEmailVerificationToken: FOUND
- `server/routes/auth.ts` — GET /auth/verify-email at line 203, POST /auth/resend-verification at line 233: FOUND
- `shared/schema.ts` — emailVerificationTokens table + emailVerifiedAt on users: FOUND
- `server/storage.ts` — 4 IStorage methods + 4 DatabaseStorage implementations: FOUND
- `supabase/migrations/20260518000000_phase55_email_verification_tokens.sql`: FOUND
- Commit a44f98d: FOUND
- Commit 4a11550: FOUND
- `npm run check`: PASSES (0 errors)
