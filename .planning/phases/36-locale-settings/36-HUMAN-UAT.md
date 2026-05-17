---
status: partial
phase: 36-locale-settings
source: [36-VERIFICATION.md]
started: 2026-05-13T00:00:00.000Z
updated: 2026-05-13T00:00:00.000Z
---

## Current Test

[awaiting human testing — requires supabase db push first]

## Tests

### 1. Apply migration
expected: supabase db push applies 20260514000000_add_locale_settings.sql — language, start_of_week, date_format columns added
result: [pending]

### 2. Admin Locale UI renders
expected: Three Select dropdowns (Language, Start of Week, Date Format) visible in General tab of Company Settings
result: [pending]

### 3. Locale settings persist after refresh
expected: Change a setting, refresh browser, setting is still saved
result: [pending]

### 4. Calendar week start reactivity
expected: Set Monday, admin calendar shows Monday as first column
result: [pending]

### 5. Booking flow Portuguese month
expected: Set pt-BR, booking flow shows "maio 2026" (not "May 2026")
result: [pending]

### 6. Booking Summary date format
expected: Set DD/MM/YYYY, booking summary shows "13/05/2026" (not "05/13/2026")
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
