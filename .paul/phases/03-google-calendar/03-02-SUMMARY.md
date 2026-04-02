---
phase: 03-google-calendar
plan: 02
subsystem: api + lib + admin-ui
tags: [google-calendar, oauth2, integrations, admin-credentials]

provides:
  - GET /api/integrations/google-calendar — read OAuth credentials
  - PUT /api/integrations/google-calendar — save OAuth credentials
  - Admin UI card in IntegrationsSection with Client ID, Client Secret, Redirect URI fields
  - google-calendar.ts reads creds from DB instead of env vars

key-decisions:
  - "Credentials stored in integrationSettings table (provider: google-calendar), not env vars"
  - "apiKey = Client ID, locationId = Client Secret, calendarId = Redirect URI — reuses existing shape"
  - "Both secrets masked as *** on GET, preserved on PUT if *** sent"
  - "createOAuth2Client() is now async — must be awaited by all callers"

duration: ~10min
started: 2026-04-02T00:00:00Z
completed: 2026-04-02T00:00:00Z
---

# Phase 3 Plan 02: Google Calendar Admin Credentials — Complete

**Google OAuth app credentials moved from env vars to admin DB (integrationSettings table), enabling setup via Admin → Integrations UI.**

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| AC-1: Credentials readable/writable via API | Pass |
| AC-2: Secrets masked on GET | Pass |
| AC-3: google-calendar.ts reads from DB | Pass |
| AC-4: Admin UI card for setup | Pass |
| AC-5: TypeScript zero errors | Pass |

## Files Changed

| File | Change |
|------|--------|
| `server/routes/integrations.ts` | +GET/PUT /google-calendar routes (GHL pattern) |
| `server/lib/google-calendar.ts` | createOAuth2Client() async, reads from storage |
| `server/routes/staff.ts` | 501 guard checks DB creds, getAuthUrl awaited |
| `client/src/components/admin/IntegrationsSection.tsx` | +GoogleCalendarSection component |

---
*Phase: 03-google-calendar — Completed: 2026-04-02*
