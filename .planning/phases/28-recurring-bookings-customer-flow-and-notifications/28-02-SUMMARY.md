---
phase: 28-recurring-bookings-customer-flow-and-notifications
plan: 02
subsystem: infra
tags: [nodemailer, email, smtp, transactional-email, templates]

# Dependency graph
requires:
  - phase: 27-recurring-bookings-schema-and-cron
    provides: recurring booking schema and cron job that generates bookings needing reminders
provides:
  - sendEmail() utility with graceful SMTP-unconfigured skip
  - buildReminderEmail() returning { subject, text, html } for 48h recurring reminders
  - SMTP env var documentation in .env.example
affects:
  - 28-recurring-bookings-customer-flow-and-notifications plan 03 (imports sendEmail + buildReminderEmail)

# Tech tracking
tech-stack:
  added: [nodemailer, "@types/nodemailer"]
  patterns:
    - Graceful-skip SMTP pattern: sendEmail() logs warning and returns void when EMAIL_HOST absent — no throw
    - Template function returns { subject, text, html } — caller owns delivery

key-files:
  created:
    - server/lib/email.ts
    - server/lib/email-templates.ts
  modified:
    - .env.example
    - package.json
    - package-lock.json

key-decisions:
  - "EMAIL_PORT defaults to 587 when absent/non-numeric; port 465 triggers TLS, all others use STARTTLS"
  - "EMAIL_FROM falls back to EMAIL_USER when not set — one fewer required var"
  - "buildReminderEmail formats YYYY-MM-DD dates via UTC midnight to avoid timezone-off-by-one"
  - "HTML template inlines CSS (no external stylesheet) — email clients strip external CSS"

patterns-established:
  - "Transactional email utility: check env vars first, log warning + return if missing, never throw"
  - "Template functions: pure data-in, { subject, text, html } out — no side effects"

requirements-completed: [RECUR-03]

# Metrics
duration: 20min
completed: 2026-05-11
---

# Phase 28 Plan 02: Email Infrastructure Summary

**Nodemailer SMTP transporter with graceful no-op + typed reminder email template (subject/text/HTML) using brand colors and 12h time formatting**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-11T14:15:00Z
- **Completed:** 2026-05-11T14:35:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `server/lib/email.ts` with `sendEmail()`: logs warning and returns silently when SMTP unconfigured, uses nodemailer createTransport when EMAIL_HOST/USER/PASS are all set
- Created `server/lib/email-templates.ts` with `buildReminderEmail()`: returns { subject, text, html } with formatted booking date (Month Day, Year), 12h time, service/company/frequency names
- HTML template uses brand blue (#1C53A3) for heading, Outfit for headings, Inter for body — inline CSS for email-client compatibility
- Documented all 5 SMTP env vars (EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM) in .env.example with explanatory comments
- Installed nodemailer + @types/nodemailer

## Task Commits

Each task was committed atomically:

1. **Task 1: nodemailer transporter + sendEmail()** — `d8a8f42` (feat) — committed in worktree-agent-a3bf62b9a1f8f097f
2. **Task 2: email-templates.ts + .env.example + email.ts on main** — `3091634` (feat)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified

- `server/lib/email.ts` — Nodemailer transporter factory + sendEmail() with graceful skip when SMTP unconfigured
- `server/lib/email-templates.ts` — buildReminderEmail() returning { subject, text, html }; ReminderEmailData interface; formatDate/formatTime12h helpers
- `.env.example` — EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM documented with purpose comments
- `package.json` — nodemailer ^8.0.7 added to dependencies
- `package-lock.json` — lockfile updated

## Decisions Made

- EMAIL_PORT defaults to 587 (STARTTLS) when absent or non-numeric; port 465 enables TLS (secure: true). Matches industry standard.
- EMAIL_FROM falls back to EMAIL_USER to reduce required env var count for minimal setup.
- Date formatted via `new Date(dateStr + "T00:00:00Z")` with `timeZone: "UTC"` to avoid timezone-driven off-by-one errors on YYYY-MM-DD strings.
- HTML template uses inline CSS — email clients (Gmail, Outlook) strip `<link>` and `<style>` tags in `<head>`; inlining is the only reliable approach.

## Deviations from Plan

Task 1 (email.ts) was completed in a worktree branch (worktree-agent-a3bf62b9a1f8f097f, commit d8a8f42). Since that branch had not yet been merged to main when this agent ran, email.ts was re-created on main as part of Task 2's commit (3091634). The file content is identical to the plan specification. The worktree branch will be merged by the orchestrator.

No functional deviations — plan executed exactly as specified.

## Issues Encountered

- nodemailer was not yet in package.json (anticipated in plan's build.mjs comment but not pre-installed). Installed via `npm install nodemailer @types/nodemailer` as part of Task 2.

## User Setup Required

To enable 48h reminder emails, add to your `.env` file:

```
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=no-reply@example.com
EMAIL_PASS=your-smtp-password
EMAIL_FROM="Your Company <no-reply@example.com>"
```

Without these vars, `sendEmail()` silently skips — no crash, no reminder emails sent.

## Next Phase Readiness

- Plan 03 can import `sendEmail` from `server/lib/email.ts` and `buildReminderEmail` from `server/lib/email-templates.ts`
- All interfaces match Plan 03's expected contracts (verified against plan frontmatter `<interfaces>` block)
- No blockers for Plan 03 execution

---
*Phase: 28-recurring-bookings-customer-flow-and-notifications*
*Completed: 2026-05-11*
