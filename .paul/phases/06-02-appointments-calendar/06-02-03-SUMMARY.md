---
phase: 06-02-appointments-calendar
plan: 03
subsystem: ui
tags: [calendar, gcal, overlay, click, dialog]

requires:
  - phase: 06-02-02
    provides: AppointmentsCalendarSection base component
provides:
  - GET /api/staff/:id/calendar/busy?date= endpoint (cached via google-calendar.ts)
  - GCal busy-time overlay (async, non-blocking gray blocks per staff per day)
  - Event click → booking detail dialog with "Open in Bookings" navigation
  - Slot click → new booking dialog pre-filled with date/time/staff

key-files:
  modified:
    - server/routes/staff.ts
    - client/src/components/admin/AppointmentsCalendarSection.tsx

key-decisions:
  - "BookingEditDialog not exported from BookingsSection — built inline detail modal instead"
  - "New booking: dialog links to /admin/bookings rather than inline form (full form is complex)"
  - "/api/staff/:id/calendar/busy fails gracefully — returns empty array on any error"

duration: ~15min
started: 2026-04-09T00:00:00Z
completed: 2026-04-09T00:00:00Z
---

# Phase 2 Plan 03: GCal Overlay + Click Interactions

**GCal busy-time overlay as async gray blocks + event click opens booking detail + slot click opens new booking dialog — calendar is now fully interactive.**

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: GCal busy overlay async | Pass | useEffect + Promise.all per staff/date, cancelled on unmount |
| AC-2: Event click → booking detail | Pass | Dialog with customer info + "Open in Bookings" |
| AC-3: Slot click → new booking dialog | Pass | Pre-filled date/time/staff, links to /admin/bookings |

## Deviations
- Built inline booking detail modal instead of reusing `BookingEditDialog` (not exported)
- New booking dialog links out rather than inline form (scope limit maintained)

---
*Phase: 06-02-appointments-calendar, Plan: 03 — Completed: 2026-04-09*
