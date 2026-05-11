---
id: SEED-024
status: cancelled
cancelled_on: 2026-05-10
cancellation_reason: Cut — workaround: staff uses only one calendar for work
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when a staff member has personal commitments in Google Calendar that conflict with bookings
scope: Medium
---

# SEED-024: Conflict checking across multiple Google Calendars per staff

## Why This Matters

The current system connects only ONE Google Calendar per staff (`staffGoogleCalendar` table — one record per staff). But a real person has multiple calendars: work, personal, family. Cal.com shows: you can select which calendars to check for conflicts — "Skale Club | Vanildo Junior", "Family", "skleanings@gmail.com", "Vanildo Agenda" — each with an independent toggle.

If the worker has a personal commitment at 2pm in the "Family" calendar but the system only checks the work calendar, the 2pm booking is offered and creates a real conflict.

**Why:** False positives for availability are the most critical error in a booking system — the customer confirms, the worker can't show up. Checking multiple calendars is the only way to guarantee real availability.

## When to Surface

**Trigger:** when the first staff member connects Google Calendar and reports conflicts with personal commitments, or when implementing the complete redesign of the availability system (SEED-021/022/023).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Availability / conflict detection milestone
- Google Calendar integration improvements milestone
- Together with SEED-021/022/023 (availability system redesign)

## Scope Estimate

**Medium** — One phase. Schema: replace `staffGoogleCalendar` (one row per staff) with `staffCalendarConnections` (multiple rows — one per calendar in the Google Account, with `checkForConflicts` boolean and `addEventsTo` boolean). Backend: when checking availability, fetch busy slots from ALL calendars with `checkForConflicts = true`.

## Breadcrumbs

- `shared/schema.ts` — `staffGoogleCalendar` table: `id`, `staffMemberId`, `accessToken`, `refreshToken`, `calendarId`, `tokenExpiresAt`, `needsReconnect` — needs to evolve to support multiple calendars
- `server/lib/google-calendar/` — OAuth and busy slot fetching logic — needs to accept list of calendarIds
- `server/routes/staff.ts` — `GET /api/staff/:id/google-calendar` — returns list of calendars available in the staff's OAuth account
- Google Calendar API: `calendar.calendarList.list()` returns all calendars in the account — use to populate the toggle list
- `client/src/components/admin/StaffSection.tsx` — calendar UI → list of calendars with toggles

## Notes

The OAuth scope needs to include `https://www.googleapis.com/auth/calendar.readonly` to list available calendars in the account. The UI shows all of the staff's Google account calendars with two toggles: "Check for conflicts" and "Add events to" (only one can have "Add events to" active at a time).

Migration: the existing `calendarId` in `staffGoogleCalendar` becomes the first entry in `staffCalendarConnections` with both toggles active — behavior preserved.
