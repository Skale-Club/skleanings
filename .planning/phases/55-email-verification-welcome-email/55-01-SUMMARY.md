---
phase: 55
plan: "01"
subsystem: auth
tags: [email-verification, schema, storage, migration]
dependency_graph:
  requires: []
  provides: [emailVerificationTokens-table, users.emailVerifiedAt, IStorage-email-verification-methods]
  affects: [server/storage.ts, shared/schema.ts]
tech_stack:
  added: []
  patterns: [global-registry-pattern, password-reset-token-mirror]
key_files:
  created:
    - supabase/migrations/20260518000000_phase55_email_verification_tokens.sql
  modified:
    - shared/schema.ts
    - server/storage.ts
decisions:
  - "emailVerificationTokens mirrors passwordResetTokens pattern exactly — no tenant_id, uses db directly"
  - "createEmailVerificationToken returns raw token (not hash) — caller uses it in email link, only hash stored in DB"
  - "findEmailVerificationToken filters by usedAt IS NULL and expiresAt >= now() — pre-validated at query time"
  - "setEmailVerified updates users globally (no tenantId filter) — email_verified_at is user-level not tenant-level"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-14T22:22:05Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 55 Plan 01: Email Verification Foundation Summary

SHA-256-hashed email verification token table + 4 IStorage methods wired to Drizzle schema, mirroring the Phase 47 password-reset-token pattern exactly.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Supabase migration — email_verification_tokens table + users.email_verified_at | 6f338a7 | supabase/migrations/20260518000000_phase55_email_verification_tokens.sql |
| 2 | Drizzle schema + IStorage interface + DatabaseStorage implementation | 1550692 | shared/schema.ts, server/storage.ts |

## What Was Built

**Migration file** (`20260518000000_phase55_email_verification_tokens.sql`):
- `CREATE TABLE IF NOT EXISTS email_verification_tokens` with `id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`
- Two indexes: `idx_evtoken_token_hash` and `idx_evtoken_user_id`
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`

**shared/schema.ts additions**:
- `emailVerifiedAt` field added to `users` pgTable (withTimezone: true, nullable = unverified)
- `emailVerificationTokens` pgTable declaration with full column set
- `EmailVerificationToken` and `InsertEmailVerificationToken` type exports

**server/storage.ts additions**:
- `import crypto from "crypto"` at top
- Import of `emailVerificationTokens`, `EmailVerificationToken`, `InsertEmailVerificationToken` from schema
- 4 IStorage interface methods declared
- 4 DatabaseStorage implementations using `db` directly (no `this.tenantId` scope)

## Decisions Made

- emailVerificationTokens mirrors passwordResetTokens pattern exactly — no tenant_id, uses db directly
- createEmailVerificationToken returns raw token (not hash) — caller uses it in email link, only hash stored in DB
- findEmailVerificationToken filters by usedAt IS NULL and expiresAt >= now() — pre-validated at query time
- setEmailVerified updates users globally (no tenantId filter) — email_verified_at is user-level not tenant-level

## Verification

- `npm run check` exits 0 — no TypeScript errors
- Migration file exists with correct DDL (CREATE TABLE, 2 CREATE INDEX, ALTER TABLE)
- `grep -c "createEmailVerificationToken|findEmailVerificationToken|markEmailVerificationTokenUsed|setEmailVerified" server/storage.ts` returns 9 (4 interface + 4 impl + 1 comment)
- `emailVerifiedAt` present in users pgTable at line 25 of shared/schema.ts

## Deviations from Plan

**1. [Rule 2 - Missing Critical Functionality] Added `import crypto from "crypto"` to server/storage.ts**
- **Found during:** Task 2
- **Issue:** Plan specified `crypto` was already imported but grep confirmed it was not
- **Fix:** Added `import crypto from "crypto"` at top of storage.ts (Node built-in, no package install needed)
- **Files modified:** server/storage.ts
- **Commit:** 1550692

## Known Stubs

None — this plan creates DB infrastructure only (migration, schema, storage methods). No UI components or route handlers in scope.

## Self-Check: PASSED

- [x] supabase/migrations/20260518000000_phase55_email_verification_tokens.sql — EXISTS
- [x] shared/schema.ts emailVerifiedAt field — EXISTS (line 25)
- [x] shared/schema.ts emailVerificationTokens table — EXISTS (line 78)
- [x] server/storage.ts 4 IStorage methods — EXISTS (lines 445-448)
- [x] server/storage.ts 4 DatabaseStorage implementations — EXISTS (lines 530-558)
- [x] Commits 6f338a7 and 1550692 — VERIFIED
- [x] npm run check — PASSED (exit 0)
