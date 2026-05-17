---
phase: 36-locale-settings
verified: 2026-05-11T13:00:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Booking flow uses dateFormat from tenant settings for date display — toDateFnsFormat() is now imported and called in BookingSummary.tsx; dateFormat prop is passed from BookingPage.tsx"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Apply supabase db push to run migration 20260514000000_add_locale_settings.sql against live database"
    expected: "company_settings table gains three new columns: language (default 'en'), start_of_week (default 'sunday'), date_format (default 'MM/DD/YYYY')"
    why_human: "supabase db push is a TTY-interactive CLI command that cannot be executed in automated verification; requires human with Supabase project credentials"
  - test: "Open Admin > Company Settings > General tab. Verify a 'Locale' section is visible with three Select dropdowns: Language (English / Portuguese Brazil), Start of Week (Sunday / Monday), Date Format (MM/DD/YYYY / DD/MM/YYYY / YYYY-MM-DD)"
    expected: "Three selects render, each selection auto-saves within ~800ms, values persist after browser refresh"
    why_human: "Visual rendering and auto-save timing require a running browser session"
  - test: "Set Start of Week to Monday in Admin settings, then open Admin > Appointments calendar"
    expected: "Calendar first column shows Monday (not Sunday) without a page reload"
    why_human: "Calendar column order requires visual inspection of a running app with DB migration applied"
  - test: "Set Language to pt-BR in Admin settings, then navigate to /booking"
    expected: "Month header in booking calendar shows Portuguese month name (e.g. 'maio 2026' instead of 'May 2026')"
    why_human: "Locale rendering requires a running app with the DB migration applied and pt-BR setting saved"
  - test: "Set Date Format to DD/MM/YYYY, then open /booking and select a date"
    expected: "Booking Summary panel shows the selected date in DD/MM/YYYY format (e.g. '15/05/2026' not '05/15/2026')"
    why_human: "Requires live app with DB migration applied and setting persisted; visual inspection needed"
---

# Phase 36: Locale Settings Verification Report

**Phase Goal:** Admins can configure tenant locale (language, week start, date format) and the booking flow and calendar consume those settings automatically
**Verified:** 2026-05-11T13:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (LOC-05 dateFormat fix)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Three new locale columns exist in migration and Drizzle schema with safe defaults | VERIFIED | `supabase/migrations/20260514000000_add_locale_settings.sql` has all three `ADD COLUMN IF NOT EXISTS` statements; `shared/schema.ts` lines 768-770 have `language`, `startOfWeek`, `dateFormat` |
| 2 | Admin can configure Language, Start of Week, and Date Format via General tab with auto-save | VERIFIED | `CompanySettingsSection.tsx` lines 291-345 render a "Locale" section with three `<Select>` fields; each calls `updateField('language'/'startOfWeek'/'dateFormat', val)` which feeds the existing 800ms debounced `saveSettings` PUT |
| 3 | Admin calendar first column and month/day names react to startOfWeek and language settings | VERIFIED | `AppointmentsCalendarSection.tsx` line 334: `dateFnsLocalizer` is inside `useMemo([weekStartsOn])`; dynamic `weekStartsOn` at lines 338, 353, 354; `culture` prop references `companySettings.language`; zero instances of hardcoded `weekStartsOn: 0` remain |
| 4 | Booking flow month header renders locale-aware month name based on language setting | VERIFIED | `StepTimeSlot.tsx` line 119: `format(viewDate, "MMMM yyyy", { locale: dateFnsLocale })` where `dateFnsLocale = language === 'pt-BR' ? ptBR : enUS`; `language` prop flows from `BookingPage.tsx` query result |
| 5 | Booking flow uses dateFormat from tenant settings for date display | VERIFIED | `BookingSummary.tsx` line 3 imports `toDateFnsFormat` from `@/lib/locale`; line 146: `format(new Date(selectedDate), toDateFnsFormat(dateFormat ?? 'MM/DD/YYYY'))`; `dateFormat` prop passed at `BookingPage.tsx` line 409; hardcoded `"MMM do, yyyy"` string is gone |

**Score: 5/5 truths verified**

---

## Required Artifacts

### Plan 36-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260514000000_add_locale_settings.sql` | Idempotent ALTER TABLE for 3 locale columns | VERIFIED | Contains `ADD COLUMN IF NOT EXISTS language`, `start_of_week`, `date_format` with correct NOT NULL defaults |
| `shared/schema.ts` | Drizzle column definitions for language, startOfWeek, dateFormat | VERIFIED | Lines 768-770 follow `timeFormat`/`timeZone` pattern exactly |
| `client/src/components/admin/shared/types.ts` | CompanySettingsData with 3 locale fields | VERIFIED | `language: string | null`, `startOfWeek: string | null`, `dateFormat: string | null` |

### Plan 36-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/components/admin/CompanySettingsSection.tsx` | Three locale Select fields in General tab | VERIFIED | Lines 291-345: "Locale" section with three selects wired to `updateField('language'/'startOfWeek'/'dateFormat')` |

### Plan 36-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/lib/locale.ts` | `toDateFnsFormat()` utility | VERIFIED | Exported and now imported by `BookingSummary.tsx` |
| `client/src/components/admin/AppointmentsCalendarSection.tsx` | dateFnsLocalizer in useMemo; weekStartsOn dynamic | VERIFIED | useMemo at line 334; dynamic weekStartsOn at lines 338, 353, 354; culture prop at line 780 |
| `client/src/pages/booking/StepTimeSlot.tsx` | Month header locale-aware via language prop | VERIFIED | Line 119 passes `{ locale: dateFnsLocale }` |
| `client/src/pages/booking/BookingSummary.tsx` | dateFormat applied via toDateFnsFormat() | VERIFIED | Line 3 imports `toDateFnsFormat`; line 146 applies it to `format()` call; `dateFormat` prop declared at line 41 and consumed at line 146 |
| `client/src/pages/BookingPage.tsx` | dateFormat + language extracted and passed to BookingSummary | VERIFIED | `dateFormat` extracted at line 175; passed to `BookingSummary` at line 409; `language` passed to `StepTimeSlot` at line 347 |

---

## Key Link Verification

### Plan 36-01 Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `shared/schema.ts` | migration SQL | column name alignment | VERIFIED | Drizzle `start_of_week` / `date_format` match migration snake_case |
| `client/src/components/admin/shared/types.ts` | `CompanySettingsSection.tsx` | `keyof CompanySettingsData` | VERIFIED | `updateField('language')` etc. type-check because `CompanySettingsData` has the three fields |

### Plan 36-02 Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CompanySettingsSection.tsx` | `/api/company-settings` | `updateField` → debounced `saveSettings` → PUT | VERIFIED | `updateField('language', val)` triggers debounced PUT; Drizzle `.set(settings)` persists all locale fields |

### Plan 36-03 Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AppointmentsCalendarSection.tsx` | `CompanySettingsContext` | `useCompanySettings()` → `settings.startOfWeek` + `settings.language` | VERIFIED | Line 331: `useCompanySettings()` called at component top; drives `weekStartsOn` and `culture` |
| `BookingPage.tsx` | `BookingSummary.tsx` | `dateFormat` prop | VERIFIED | `dateFormat={dateFormat}` at line 409; received as prop at `BookingSummary.tsx` line 63; applied at line 146 |
| `BookingPage.tsx` | `StepTimeSlot.tsx` | `language` prop | VERIFIED | `language={language}` at line 347; consumed to select `dateFnsLocale` |
| `client/src/lib/locale.ts` | `BookingSummary.tsx` | `toDateFnsFormat()` import | WIRED | `import { toDateFnsFormat } from '@/lib/locale'` at line 3; called at line 146 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AppointmentsCalendarSection.tsx` | `companySettings.startOfWeek` | `useCompanySettings()` → React Query → `GET /api/company-settings` → Drizzle SELECT | Yes — reads from DB column | FLOWING |
| `AppointmentsCalendarSection.tsx` | `companySettings.language` | Same chain | Yes | FLOWING |
| `StepTimeSlot.tsx` | `language` prop | `BookingPage.tsx` → `companySettings?.language` → same API chain | Yes | FLOWING |
| `BookingSummary.tsx` | `dateFormat` prop | `BookingPage.tsx` → `companySettings?.dateFormat` → same API chain → `toDateFnsFormat()` → `format()` | Yes — reaches `format()` call | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles with zero errors | `npm run check` | Exit 0, no output | PASS |
| `toDateFnsFormat` imported in BookingSummary | grep codebase | `BookingSummary.tsx:3: import { toDateFnsFormat } from '@/lib/locale'` | PASS |
| `toDateFnsFormat` called in BookingSummary date display | grep codebase | `BookingSummary.tsx:146: format(new Date(selectedDate), toDateFnsFormat(dateFormat ?? 'MM/DD/YYYY'))` | PASS |
| Hardcoded `"MMM do, yyyy"` string removed | grep BookingSummary.tsx | No matches | PASS |
| `dateFormat={dateFormat}` passed to BookingSummary | grep BookingPage.tsx | Line 409 confirmed | PASS |
| Migration file has all 3 ADD COLUMN statements | file content check | All three present | PASS |
| Zero hardcoded `weekStartsOn: 0` in AppointmentsCalendarSection | grep | No matches | PASS |
| `locale: dateFnsLocale` in StepTimeSlot month header | grep | Line 119 confirmed | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| LOC-01 | 36-01, 36-02 | Admin can configure `language` (en / pt-BR) | SATISFIED | Three-select Locale section in General tab; `updateField('language')` wired to auto-save PUT |
| LOC-02 | 36-01, 36-03 | Admin can configure `startOfWeek`; admin calendar reflects it | SATISFIED | `weekStartsOn` derived from `companySettings.startOfWeek`; drives `dateFnsLocalizer` useMemo and range useMemo; zero hardcoded `weekStartsOn: 0` |
| LOC-03 | 36-01, 36-02 | Admin can configure `dateFormat` | SATISFIED | Select field in General tab with three options; auto-saves via `updateField('dateFormat')` |
| LOC-04 | 36-01 | Locale settings persisted via Supabase migration | HUMAN NEEDED | Migration file exists and is correct; `supabase db push` is a pending human action |
| LOC-05 | 36-03 | Booking flow uses `language` AND `dateFormat` for date display | SATISFIED | `language` drives month header locale via `dateFnsLocale`; `dateFormat` flows through `BookingPage → BookingSummary → toDateFnsFormat() → format()`; no hardcoded format strings remain |

---

## Anti-Patterns Found

None blocking. Previous blockers resolved:

- `client/src/lib/locale.ts` — `toDateFnsFormat` is now imported and called (no longer orphaned)
- `client/src/pages/booking/BookingSummary.tsx` — hardcoded `"MMM do, yyyy"` replaced with `toDateFnsFormat(dateFormat ?? 'MM/DD/YYYY')`
- `client/src/pages/booking/StepTimeSlot.tsx` — `dateFormat` prop was a dead prop; consumers now wired through `BookingSummary.tsx` instead

---

## Human Verification Required

All automated checks pass. The following items require a running browser session with the Supabase migration applied.

### 1. Database Migration Apply

**Test:** Run `supabase db push` from the project root to apply migration `20260514000000_add_locale_settings.sql`
**Expected:** Three new columns appear in the live `company_settings` table: `language` (default 'en'), `start_of_week` (default 'sunday'), `date_format` (default 'MM/DD/YYYY')
**Why human:** `supabase db push` requires TTY interaction and Supabase project credentials; cannot be run in automated verification

### 2. Admin Locale UI Renders

**Test:** Open Admin > Company Settings > General tab in a browser with the migration applied
**Expected:** A "Locale" section appears below the existing General tab content, containing three labeled Select dropdowns — Language (English / Portuguese Brazil), Start of Week (Sunday / Monday), Date Format (MM/DD/YYYY / DD/MM/YYYY / YYYY-MM-DD)
**Why human:** Visual rendering requires a running browser session

### 3. Auto-Save and Persistence

**Test:** Change Language to "Portuguese (Brazil)", wait 1 second, then hard-refresh the page
**Expected:** Language select still shows "Portuguese (Brazil)" after refresh
**Why human:** Requires live DB write and read cycle in a browser

### 4. Calendar Week Start Reactivity

**Test:** With migration applied, set Start of Week to Monday in Admin settings. Navigate to Admin > Appointments calendar
**Expected:** Calendar first column shows Monday (not Sunday)
**Why human:** Requires a running app with the React state propagating from CompanySettingsContext to the calendar

### 5. Booking Flow Language

**Test:** With Language set to pt-BR, navigate to /booking
**Expected:** Month header in the booking calendar shows Portuguese month name (e.g. "maio 2026" instead of "May 2026")
**Why human:** Requires live app with DB migration applied and setting persisted

### 6. Booking Flow Date Format

**Test:** Set Date Format to DD/MM/YYYY in Admin settings, then navigate to /booking and select a date
**Expected:** Booking Summary panel shows the selected date in DD/MM/YYYY format (e.g. "15/05/2026" rather than "05/15/2026")
**Why human:** Requires live app with DB migration applied and setting persisted; visual confirmation of formatted output

---

## Gaps Summary

No gaps remain. The single gap from the initial verification (LOC-05 dateFormat never applied) is closed:

- `BookingSummary.tsx` now imports `toDateFnsFormat` from `@/lib/locale` (line 3)
- Line 146 applies it: `format(new Date(selectedDate), toDateFnsFormat(dateFormat ?? 'MM/DD/YYYY'))`
- `BookingPage.tsx` passes `dateFormat={dateFormat}` to `BookingSummary` (line 409)
- TypeScript compiles with zero errors confirming all types align
- The hardcoded `"MMM do, yyyy"` string no longer exists in the file

All five observable truths are now verified at the code level. Remaining human verification items are prerequisite to runtime confirmation (DB migration + browser session), not code gaps.

---

_Verified: 2026-05-11T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
