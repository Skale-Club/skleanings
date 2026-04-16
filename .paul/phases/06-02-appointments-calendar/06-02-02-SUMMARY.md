---
phase: 06-02-appointments-calendar
plan: 02
subsystem: ui
tags: [react-big-calendar, admin, calendar, staff, filters]

requires:
  - phase: 06-02-01
    provides: date-range API + react-big-calendar installed
provides:
  - AppointmentsCalendarSection component
  - 'calendar' AdminSection type + sidebar wiring
  - Month/Week/Day calendar views with staff color coding
  - Staff + status filters
affects:
  - 06-02-03 (adds GCal overlay + click interactions to this component)

key-files:
  created: [client/src/components/admin/AppointmentsCalendarSection.tsx]
  modified:
    - client/src/components/admin/shared/types.ts
    - client/src/pages/Admin.tsx

key-decisions:
  - "getAccessToken typed as Promise<string | null> to match Admin.tsx signature"
  - "GCal overlay and click interactions deferred to Plan 03 — keep this plan focused"

duration: ~10min
started: 2026-04-09T00:00:00Z
completed: 2026-04-09T00:00:00Z
---

# Phase 2 Plan 02: Calendar UI Component

**Full AppointmentsCalendarSection with Month/Week/Day views, per-staff color coding, staff + status filters, and admin sidebar wiring at /admin/calendar.**

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Calendar accessible from sidebar | Pass | 'calendar' in AdminSection, CalendarDays icon in menuItems |
| AC-2: Bookings as color-coded events | Pass | getStaffColor() deterministic from staffId |
| AC-3: Staff + status filters | Pass | hiddenStaff + hiddenStatuses Set state |
| AC-4: GCal overlay | Deferred | Plan 03 |
| AC-5: View switching | Pass | Views.MONTH/WEEK/DAY wired to onView |

## Deviations
- `getAccessToken` prop typed as `Promise<string | null>` (auto-fix from TS error — Admin.tsx returns nullable)

---
*Completed: 2026-04-09*
