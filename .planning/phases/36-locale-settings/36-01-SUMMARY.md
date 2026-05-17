---
phase: 36-locale-settings
plan: "01"
subsystem: database-schema
tags: [locale, migration, schema, types]
dependency_graph:
  requires: []
  provides: [locale-columns-migration, drizzle-locale-schema, company-settings-locale-types]
  affects: [shared/schema.ts, client/src/components/admin/shared/types.ts]
tech_stack:
  added: []
  patterns: [ADD COLUMN IF NOT EXISTS, Drizzle text column with default]
key_files:
  created:
    - supabase/migrations/20260514000000_add_locale_settings.sql
  modified:
    - shared/schema.ts
    - client/src/components/admin/shared/types.ts
    - client/src/components/admin/CompanySettingsSection.tsx
decisions:
  - Locale columns added immediately after timeZone following the existing timeFormat/timeZone pattern
  - CompanySettingsSection default state updated with locale field defaults to satisfy TypeScript strict checking
metrics:
  duration: 5m
  completed: "2026-05-13T18:15:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 36 Plan 01: Locale Settings Foundation Summary

**One-liner:** Added three locale columns (language, start_of_week, date_format) to company_settings via idempotent Supabase migration, with matching Drizzle schema fields and CompanySettingsData interface extension.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Supabase migration for locale columns | d87b609 | supabase/migrations/20260514000000_add_locale_settings.sql |
| 2 | Extend Drizzle schema and CompanySettingsData type | 4c9c772 | shared/schema.ts, client/src/components/admin/shared/types.ts, CompanySettingsSection.tsx |

## Verification

1. Migration file exists with all three `ADD COLUMN IF NOT EXISTS` statements (language, start_of_week, date_format)
2. `shared/schema.ts` companySettings table has `language`, `startOfWeek`, `dateFormat` using `text("snake_case").default(...)` pattern after `timeZone`
3. `client/src/components/admin/shared/types.ts` `CompanySettingsData` has all three `string | null` fields
4. `npm run check` passes with zero errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing locale fields in CompanySettingsSection default state**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** `CompanySettingsSection.tsx` initializes a `useState` with a hardcoded object matching `CompanySettingsData`. Adding three new required fields to the interface caused a TypeScript error on the default state object.
- **Fix:** Added `language: 'en'`, `startOfWeek: 'sunday'`, `dateFormat: 'MM/DD/YYYY'` to the default state in CompanySettingsSection.tsx
- **Files modified:** `client/src/components/admin/CompanySettingsSection.tsx`
- **Commit:** 4c9c772

## Known Stubs

None — this plan only adds schema and type foundation. No UI rendering of locale values yet (Wave 2 plans).

## Next Steps

Wave 2 plans can now reference `language`, `startOfWeek`, `dateFormat` from both the DB schema and TypeScript types without errors. The `supabase db push` migration apply step is a human action to be performed before Wave 2 UI plans go live.
