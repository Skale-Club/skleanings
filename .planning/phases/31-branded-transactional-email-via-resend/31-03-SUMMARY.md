---
phase: 31-branded-transactional-email-via-resend
plan: "03"
subsystem: email-notifications
tags:
  - resend
  - email
  - cron
  - admin-ui
  - github-actions
dependency_graph:
  requires:
    - 31-01  # emailSettings table, storage methods, email-resend.ts
  provides:
    - run24hEmailReminders()  # queries tomorrow's bookings and sends reminders
    - GET/PUT /api/integrations/resend  # admin settings CRUD with masked key
    - POST /api/integrations/resend/test  # test-send endpoint
    - POST /api/integrations/email/cron/send-reminders  # CRON_SECRET-protected trigger
    - EmailTab admin UI  # enabled toggle, API key, from-address, save, test-send
  affects:
    - server/services/cron.ts  # added 08:00 UTC cron entry
    - server/lib/email-templates.ts  # added build24hReminderEmail()
tech_stack:
  added:
    - resend SDK (already in package.json, installed node_modules)
    - .github/workflows/booking-email-reminders-cron.yml (daily 08:00 UTC)
  patterns:
    - Masked API key pattern (GET returns "********", PUT preserves if "********" submitted)
    - Fire-and-forget cron with dynamic import()
    - CRON_SECRET header auth on production trigger endpoint
key_files:
  created:
    - server/services/booking-email-reminders.ts
    - server/routes/integrations/resend.ts
    - .github/workflows/booking-email-reminders-cron.yml
    - client/src/components/admin/integrations/EmailTab.tsx
  modified:
    - server/lib/email-templates.ts
    - server/services/cron.ts
    - server/routes/integrations.ts
    - client/src/components/admin/IntegrationsSection.tsx
decisions:
  - build24hReminderEmail() added to email-templates.ts in Plan 03 (Plan 02 was parallel Wave 2 and had not yet run)
  - db.execute(sql`...`) result cast via unknown[] (RowList from postgres-js is array-like, no .rows property)
  - resend SDK installed during execution (was in package.json but not in node_modules in this worktree)
metrics:
  duration: "~35 minutes"
  completed: "2026-05-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 4
---

# Phase 31 Plan 03: 24h Reminder Service, Resend API Routes, and Admin Email Tab Summary

**One-liner:** 24h appointment reminder cron via Resend SDK, CRON_SECRET-protected trigger endpoint, masked-key admin UI with save + test-send, and daily 08:00 UTC GitHub Actions workflow.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | 24h reminder service, resend routes, cron entry, GH Actions workflow | e5d70ba | booking-email-reminders.ts, email-templates.ts, resend.ts, integrations.ts, cron.ts, booking-email-reminders-cron.yml |
| 2 | EmailTab admin UI + IntegrationsSection integration | d314311 | EmailTab.tsx, IntegrationsSection.tsx |

## What Was Built

### server/services/booking-email-reminders.ts
`run24hEmailReminders()` — queries bookings WHERE booking_date = tomorrow AND status IN ('confirmed', 'pending') AND customer_email is not empty. Loads company settings, builds branded email via `build24hReminderEmail()`, sends via `sendResendEmail()` with trigger `appointment_reminder_24h`. Returns `{ sent, skipped, failed, total }`.

### server/routes/integrations/resend.ts
- `GET /api/integrations/resend` — returns settings with `resendApiKey` masked as `"********"`
- `PUT /api/integrations/resend` — upserts settings; preserves existing key when `"********"` submitted (Twilio pattern)
- `POST /api/integrations/resend/test` — sends live test email via Resend SDK; returns `{ success, message }`

### server/routes/integrations.ts
- Mounts `resendRouter`
- Adds `POST /api/integrations/email/cron/send-reminders` protected by `Authorization: Bearer CRON_SECRET`

### server/services/cron.ts
Added daily `"0 8 * * *"` entry that dynamically imports and calls `run24hEmailReminders()`.

### .github/workflows/booking-email-reminders-cron.yml
Daily 08:00 UTC GitHub Actions workflow. Uses `CRON_SECRET` secret + `APP_URL` variable. Retries once on 5xx responses. Supports `workflow_dispatch` for manual trigger.

### server/lib/email-templates.ts
Added `build24hReminderEmail()` with `Reminder24hEmailData` interface — handles duration display (uses `durationLabel` when available, falls back to minutes-to-human-readable), includes company logo via `logoUrl`, service address row.

### client/src/components/admin/integrations/EmailTab.tsx
Admin UI following GHLTab pattern: `useQuery` for settings, `enabled` Switch (saves on toggle), `resendApiKey` password input, `fromAddress` text input, Save Settings button, Send Test Email button. Shows active status banner when enabled.

### client/src/components/admin/IntegrationsSection.tsx
Added `'email'` to `INTEGRATION_TABS`, imported `Mail` from lucide-react, added `TabsTrigger` and `TabsContent` for email tab.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added build24hReminderEmail() to email-templates.ts**
- **Found during:** Task 1 implementation
- **Issue:** Plan 03 imports `build24hReminderEmail` from `server/lib/email-templates.ts`, but this function is defined in Plan 02 which runs in parallel (Wave 2). Plan 02 had not yet run.
- **Fix:** Added `build24hReminderEmail()` and `Reminder24hEmailData` interface directly in Plan 03. Handles duration formatting, logo inclusion, and service address display.
- **Files modified:** server/lib/email-templates.ts
- **Commit:** e5d70ba

**2. [Rule 1 - Bug] Fixed db.execute() return type access**
- **Found during:** Task 1 TypeScript check
- **Issue:** Plan code used `tomorrowRows.rows` — but `db.execute(sql\`...\`)` with postgres-js/drizzle returns a `RowList` (array-like), not `{ rows: [...] }`.
- **Fix:** Changed to cast `(await db.execute(...)) as unknown as Array<{...}>` — directly iterates the RowList.
- **Files modified:** server/services/booking-email-reminders.ts
- **Commit:** e5d70ba

**3. [Rule 3 - Blocking] Installed resend package**
- **Found during:** Task 1 TypeScript check (`Cannot find module 'resend'`)
- **Issue:** `resend` was in package.json but not installed in the worktree's node_modules.
- **Fix:** Ran `npm install` to install all dependencies including resend SDK.
- **Commit:** Not a code change — dependency install.

## Known Stubs

None — all functionality is fully wired.

## Self-Check: PASSED

### Files Exist
- FOUND: server/services/booking-email-reminders.ts
- FOUND: server/routes/integrations/resend.ts
- FOUND: .github/workflows/booking-email-reminders-cron.yml
- FOUND: client/src/components/admin/integrations/EmailTab.tsx

### Commits Exist
- FOUND: e5d70ba — feat(31-03): build 24h reminder service, resend routes, cron entry, and GH Actions workflow
- FOUND: d314311 — feat(31-03): add EmailTab admin UI and integrate into IntegrationsSection
