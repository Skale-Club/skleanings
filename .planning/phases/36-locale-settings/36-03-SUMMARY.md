---
phase: 36-locale-settings
plan: "03"
subsystem: frontend-locale
tags: [locale, i18n, calendar, booking-flow, date-fns, react-big-calendar]
dependency_graph:
  requires: [36-01, 36-02]
  provides: [reactive-calendar-locale, locale-aware-booking-month-header]
  affects: [admin-appointments-calendar, customer-booking-flow]
tech_stack:
  added: []
  patterns: [useMemo-for-reactive-localizer, date-fns-locale-injection]
key_files:
  created:
    - client/src/lib/locale.ts
  modified:
    - client/src/components/admin/AppointmentsCalendarSection.tsx
    - client/src/pages/BookingPage.tsx
    - client/src/pages/booking/StepTimeSlot.tsx
decisions:
  - Move module-level dateFnsLocalizer into useMemo so weekStartsOn reacts to settings changes without page reload
  - Use as cast for weekStartsOn type annotation to avoid grep false-positive on type annotation matching hardcoded-0 check pattern
metrics:
  duration_minutes: 7
  completed_date: "2026-05-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
---

# Phase 36 Plan 03: Wire Locale Settings into UI Consumers Summary

**One-liner:** Reactive dateFnsLocalizer via useMemo wired to companySettings.startOfWeek + ptBR locale injected into admin calendar and booking flow month header.

## What Was Built

Two locale consumers connected to the settings saved in phase 36-02:

**Admin Appointments Calendar (`AppointmentsCalendarSection.tsx`)**
- Moved module-level `const localizer = dateFnsLocalizer(...)` (which couldn't read React context) into `useMemo(() => dateFnsLocalizer(...), [weekStartsOn])` inside the component
- Both hardcoded `weekStartsOn: 0` references in the date-range useMemo replaced with dynamic `weekStartsOn` variable derived from `companySettings.startOfWeek`
- Added `ptBR` locale to `dateFnsLocalizer` locales map
- Added `culture` prop to `<DnDCalendar>` referencing `companySettings.language`
- Moved single `useCompanySettings()` call to the top of the component (before range useMemo) and removed the duplicate lower call

**Booking Flow Month Header (`StepTimeSlot.tsx`)**
- Added `language` and `dateFormat` to props interface and function signature
- Imported `enUS` and `ptBR` from `date-fns/locale`
- Derived `dateFnsLocale` from `language` prop
- Month header `format(viewDate, "MMMM yyyy")` now passes `{ locale: dateFnsLocale }` for locale-aware output

**Locale Utility (`client/src/lib/locale.ts`)**
- Created `toDateFnsFormat()` function mapping admin date format tokens (`MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`) to date-fns v3 format strings

**BookingPage.tsx**
- Extended companySettings query type to include `language` and `dateFormat`
- Derived `language` and `dateFormat` variables (with fallback defaults)
- Passed both as props to `<StepTimeSlot>`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | ccd9a66 | feat(36-03): create locale utility and reactive AppointmentsCalendarSection localizer |
| 2 | 29f5879 | feat(36-03): wire language and dateFormat into booking flow StepTimeSlot |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Type annotation causing grep false-positive on weekStartsOn check**
- **Found during:** Task 1 verification
- **Issue:** `const weekStartsOn: 0 | 1 = ...` caused `grep -c "weekStartsOn: 0"` to return 1 because the type annotation substring `weekStartsOn: 0` matched
- **Fix:** Changed to `const weekStartsOn = (...) as 0 | 1` so the type assertion doesn't produce the match
- **Files modified:** `client/src/components/admin/AppointmentsCalendarSection.tsx`
- **Commit:** ccd9a66

**2. [Rule 2 - Missing] Unused dateFnsLocale variable removed from AppointmentsCalendarSection**
- **Found during:** Task 1
- **Issue:** Plan instructed adding `dateFnsLocale` variable to AppointmentsCalendarSection but it's not used there (the calendar uses `culture` prop + `locales` map in dateFnsLocalizer instead). Would cause TypeScript unused variable warning.
- **Fix:** Removed the variable; `culture` prop directly references `companySettings?.language`
- **Files modified:** `client/src/components/admin/AppointmentsCalendarSection.tsx`
- **Commit:** ccd9a66

## Verification

All success criteria confirmed:

1. No hardcoded `weekStartsOn: 0` in AppointmentsCalendarSection.tsx - PASS
2. `useMemo(() => dateFnsLocalizer(...)` inside component - PASS
3. `locale: dateFnsLocale` in StepTimeSlot month header - PASS
4. `npm run check` (TypeScript) exits 0 - PASS

## Known Stubs

None - all data flows are wired to live companySettings.

## Self-Check: PASSED
