---
phase: 36-locale-settings
plan: 02
subsystem: ui
tags: [react, admin, select, locale, company-settings]

# Dependency graph
requires:
  - phase: 36-01
    provides: language/startOfWeek/dateFormat columns in DB and CompanySettingsData type
provides:
  - Three locale Select fields (Language, Start of Week, Date Format) in Admin > Company Settings > General tab
affects: [36-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [updateField debounced auto-save applied to locale selects]

key-files:
  created: []
  modified:
    - client/src/components/admin/CompanySettingsSection.tsx

key-decisions:
  - "Locale selects grouped under a labeled 'Locale' section heading within the existing General tab card — no new tab required"

patterns-established:
  - "Locale selects follow identical pattern to existing timeFormat select: value={settings.field || default} onValueChange={(val) => updateField('field', val)}"

requirements-completed: [LOC-01, LOC-02, LOC-03]

# Metrics
duration: 5min
completed: 2026-05-11
---

# Phase 36 Plan 02: Locale Settings UI Summary

**Language, Start of Week, and Date Format selects added to General tab using existing debounced updateField auto-save pattern**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-11T00:00:00Z
- **Completed:** 2026-05-11T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Language select (English / Portuguese Brazil) wired to `updateField('language')`
- Start of Week select (Sunday / Monday) wired to `updateField('startOfWeek')`
- Date Format select (MM/DD/YYYY / DD/MM/YYYY / YYYY-MM-DD) wired to `updateField('dateFormat')`
- All three selects grouped under a "Locale" section heading inside the General tab card
- TypeScript check passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add locale state defaults and three Select fields to General tab** - `13bdb86` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `client/src/components/admin/CompanySettingsSection.tsx` - Added Locale section with three Select fields below the map embed URL field in General tab

## Decisions Made
- Locale selects grouped under a labeled 'Locale' section heading within the existing General tab card — no new tab required

## Deviations from Plan

None - plan executed exactly as written. State defaults (language/startOfWeek/dateFormat) were already added by plan 36-01, so only the UI Select elements needed to be added.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Locale fields are now persisted and surfaced in admin UI
- Plan 36-03 can consume `settings.language`, `settings.startOfWeek`, and `settings.dateFormat` for runtime formatting logic

---
*Phase: 36-locale-settings*
*Completed: 2026-05-11*
