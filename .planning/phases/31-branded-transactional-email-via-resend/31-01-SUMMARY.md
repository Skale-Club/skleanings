---
phase: 31-branded-transactional-email-via-resend
plan: "01"
subsystem: email
tags: [resend, email, schema, storage, transactional-email]
dependency_graph:
  requires: []
  provides: [emailSettings-table, getEmailSettings, saveEmailSettings, sendResendEmail]
  affects: [server/storage.ts, shared/schema.ts, server/lib/email-resend.ts]
tech_stack:
  added: [resend@^6.12.3]
  patterns: [singleton-upsert, fire-and-forget-notification-log, db-sourced-api-key-with-env-fallback]
key_files:
  created:
    - supabase/migrations/20260511000006_add_email_settings.sql
    - server/lib/email-resend.ts
  modified:
    - shared/schema.ts
    - server/storage.ts
decisions:
  - "Migration numbered 000006 not 000007 — 000006 was the correct next slot (000005 was the prior last migration)"
  - "emailSettings table mirrors twilioSettings pattern — serial PK, enabled boolean, text columns, createdAt/updatedAt"
  - "sendResendEmail reads DB settings on every call for live config changes without restart"
  - "Non-throwing design: all errors logged to notificationLogs, never propagated to callers"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-12"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
---

# Phase 31 Plan 01: Resend Foundation — Schema, Storage, and Email Module Summary

**One-liner:** Resend SDK integration with DB-sourced API key, emailSettings singleton table, and fire-and-forget sendResendEmail() that logs every outcome to notificationLogs.

## What Was Built

Plan 31-01 laid the complete data and delivery foundation for Phase 31 transactional email:

1. **emailSettings table** — Singleton DB table (id, enabled, resend_api_key, from_address, timestamps) added to shared/schema.ts with full Drizzle/Zod types and migration SQL.

2. **Storage CRUD** — `getEmailSettings()` and `saveEmailSettings()` added to IStorage interface and implemented in DatabaseStorage using the established singleton UPSERT pattern (mirrors twilioSettings/telegramSettings).

3. **email-resend.ts module** — `sendResendEmail(to, subject, html, text, bookingId?, trigger?)` exported. Reads API key from DB with RESEND_API_KEY env var fallback. Respects the `enabled` flag. Logs skipped/sent/failed to notificationLogs with channel='email'. Never throws. nodemailer/email.ts left completely untouched.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add emailSettings to schema + migration | e2d9ddf | shared/schema.ts, supabase/migrations/20260511000006_add_email_settings.sql |
| 2 | Add storage methods to IStorage and DatabaseStorage | 2517e0d | server/storage.ts |
| 3 | Install resend and create email-resend.ts | 89b3778 | server/lib/email-resend.ts, package.json |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration file numbered 000006 not 000007**
- **Found during:** Task 1
- **Issue:** Plan specified migration filename `20260511000007_add_email_settings.sql` based on an assumed 000006 existing. Actual last migration in directory was 000005.
- **Fix:** Created file as `20260511000006_add_email_settings.sql` — the correct sequential next slot.
- **Files modified:** supabase/migrations/20260511000006_add_email_settings.sql
- **Commit:** e2d9ddf

## Verification Results

- `npm run check` exits 0 (no TypeScript errors)
- `npm run build` exits 0 (esbuild bundles email-resend.ts with Resend import successfully)
- `grep -rn "emailSettings" shared/schema.ts server/storage.ts server/lib/email-resend.ts` returns 9 matches across all three files
- `server/lib/email.ts` still contains "nodemailer" — not modified

## Known Stubs

None — this plan creates infrastructure only. No customer-facing UI or email triggers implemented yet (those are Plans 02 and 03).

## Self-Check: PASSED
