# Phase 36: Locale Settings - Research

**Researched:** 2026-05-11
**Domain:** Locale settings persistence, date-fns localization, react-big-calendar week start, booking flow date display
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOC-01 | Admin configures `language` (en / pt-BR) in General tab of Company Settings | Three new `<Select>` fields in CompanySettingsSection General tab; field added to `CompanySettingsData` type |
| LOC-02 | Admin configures `startOfWeek` (sunday / monday); admin calendar reflects it | `dateFnsLocalizer` `startOfWeek` callback and `startOfWeek`/`endOfWeek` calls in AppointmentsCalendarSection must read the setting |
| LOC-03 | Admin configures `dateFormat` (MM/DD/YYYY / DD/MM/YYYY / YYYY-MM-DD) | New select in General tab; utility function converts token to date-fns format string |
| LOC-04 | Three locale columns persisted in `companySettings` via Supabase migration | ALTER TABLE migration following established migration-number pattern |
| LOC-05 | Booking flow uses `language` and `dateFormat` for date display | StepTimeSlot calendar header and the hardcoded timezone label are the two touch points |
</phase_requirements>

---

## Summary

Phase 36 adds three locale columns (`language`, `startOfWeek`, `dateFormat`) to the singleton `companySettings` table, surfaces them as three `<Select>` fields inside the existing General tab of `CompanySettingsSection`, wires the admin appointments calendar to honor `startOfWeek`, and makes the booking-flow calendar render dates in the tenant-configured `dateFormat`.

The project already has `date-fns` v3.6 and `react-big-calendar` v1.19.4 installed. `date-fns/locale/pt-BR` is present on disk (confirmed). The `CompanySettingsContext` already fetches and broadcasts `companySettings` app-wide; consumers just need to read the three new fields. No new packages are required.

The scope is intentionally narrow: **locale is formatting only, not string translation**. SEED-012 (full i18n of booking strings) is cancelled per REQUIREMENTS.md. `language` in this phase controls only date-fns locale selection (month name display). `dateFormat` controls date token formatting. `startOfWeek` controls calendar column order.

**Primary recommendation:** Add three `text` columns with defaults to the DB via a single Supabase migration, extend the Drizzle schema in `shared/schema.ts` following the `timeFormat`/`timeZone` pattern, add three `<Select>` fields to the General tab, and thread the values from `CompanySettingsContext` into the two consumer sites (AppointmentsCalendarSection, StepTimeSlot).

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `date-fns` | ^3.6.0 | Date formatting, locale objects | Already used throughout the project |
| `date-fns/locale/enUS` | (bundled) | English locale for date-fns | Already imported in AppointmentsCalendarSection |
| `date-fns/locale/ptBR` | (bundled) | Portuguese (Brazil) locale | Confirmed present in node_modules |
| `react-big-calendar` | ^1.19.4 | Admin appointments calendar | Already in use; `dateFnsLocalizer` supports locale/weekStart |

**Installation:** No new packages required.

**Version verification (confirmed from package.json):**
- `date-fns`: `^3.6.0`
- `react-big-calendar`: `^1.19.4`

---

## Architecture Patterns

### Recommended Project Structure

No new files or directories needed. Changes touch existing files:

```
shared/
└── schema.ts              — add 3 columns to companySettings table + update InsertCompanySettings

supabase/migrations/
└── 20260514000000_add_locale_settings.sql  — ALTER TABLE migration

client/src/
├── components/admin/
│   ├── CompanySettingsSection.tsx   — add 3 selects to General tab
│   └── AppointmentsCalendarSection.tsx  — consume startOfWeek, language
├── context/
│   └── CompanySettingsContext.tsx   — no change needed (already broadcasts CompanySettings)
└── pages/booking/
    └── StepTimeSlot.tsx             — consume dateFormat + language for calendar header
```

### Pattern 1: Adding columns to companySettings (established pattern)

The `companySettings` table uses the **singleton upsert** pattern: `getCompanySettings()` either returns the single row or inserts a default row. Adding columns with DB-level defaults ensures the existing row is not broken.

In `shared/schema.ts`, follow the exact pattern of `timeFormat` / `timeZone`:

```typescript
// In companySettings pgTable definition — add after timeZone:
language: text("language").default('en'),           // 'en' | 'pt-BR'
startOfWeek: text("start_of_week").default('sunday'), // 'sunday' | 'monday'
dateFormat: text("date_format").default('MM/DD/YYYY'), // 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
```

`CompanySettingsData` in `client/src/components/admin/shared/types.ts` must also be extended:

```typescript
language: string | null;
startOfWeek: string | null;
dateFormat: string | null;
```

And add default values to the initial `settings` state in `CompanySettingsSection.tsx`:

```typescript
language: 'en',
startOfWeek: 'sunday',
dateFormat: 'MM/DD/YYYY',
```

### Pattern 2: Supabase migration (established project constraint)

Migration file must be created under `supabase/migrations/`. The last migration is `20260513000000`. The next must use a timestamp greater than that. A safe value is `20260514000000`.

```sql
-- supabase/migrations/20260514000000_add_locale_settings.sql
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS language        text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS start_of_week   text NOT NULL DEFAULT 'sunday',
  ADD COLUMN IF NOT EXISTS date_format     text NOT NULL DEFAULT 'MM/DD/YYYY';
```

`ADD COLUMN IF NOT EXISTS` is safe for idempotent re-runs. `NOT NULL DEFAULT` matches the pattern of `time_format` column (added in the initial remote schema).

Apply with: `supabase db push` (per project memory — never `drizzle-kit push`).

### Pattern 3: react-big-calendar weekStartsOn (LOC-02)

`AppointmentsCalendarSection` creates the `dateFnsLocalizer` at module level (outside the component), which means it cannot be dynamic. The solution is to move the localizer creation inside the component (or into a `useMemo`) so it can read `startOfWeek` from context.

**Current (hardcoded):**
```typescript
// Module-level — cannot read runtime settings
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
});
```

**Required pattern:**
```typescript
// Inside the component, after reading companySettings:
const { settings: companySettings } = useCompanySettings();
const weekStartsOn = companySettings?.startOfWeek === 'monday' ? 1 : 0;
const locale = companySettings?.language === 'pt-BR' ? ptBR : enUS;

const localizer = useMemo(() => dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn }),
  getDay,
  locales: {
    'en-US': enUS,
    'pt-BR': ptBR,
  },
}), [weekStartsOn]);
```

The `culture` prop on `<DnDCalendar>` selects which locale from `locales` the calendar uses for month/day names:

```tsx
<DnDCalendar
  culture={companySettings?.language === 'pt-BR' ? 'pt-BR' : 'en-US'}
  ...
/>
```

Additionally, the two hardcoded `weekStartsOn: 0` calls in the `useMemo` that computes `{ from, to }` range must also use `weekStartsOn`:

```typescript
start = startOfWeek(currentDate, { weekStartsOn });
end = endOfWeek(currentDate, { weekStartsOn });
```

### Pattern 4: dateFormat utility for LOC-03 and LOC-05

The setting stores human-readable format tokens (`MM/DD/YYYY`). date-fns v3 uses its own token syntax (`MM/dd/yyyy`). A small mapping utility is needed:

```typescript
// Suggested location: client/src/lib/locale.ts (new utility file)
export function toDateFnsFormat(adminFormat: string | null | undefined): string {
  switch (adminFormat) {
    case 'DD/MM/YYYY': return 'dd/MM/yyyy';
    case 'YYYY-MM-DD': return 'yyyy-MM-dd';
    case 'MM/DD/YYYY':
    default:           return 'MM/dd/yyyy';
  }
}
```

Usage in `StepTimeSlot.tsx` — the calendar header currently renders:
```typescript
format(viewDate, "MMMM yyyy")  // month name + year — locale-aware via date-fns locale
```

This needs to accept a `locale` object and the month-day cells use:
```typescript
format(currentDay, "d")  // day number — no change needed
```

The selected-date display (if any) and the day-name headers (`["Sun", "Mon", ...]`) are currently **hardcoded strings**. For LOC-05 scope, replacing the hardcoded day names with locale-aware output is optional — the requirement only specifies `language` and `dateFormat` for "date display." The month name (`format(viewDate, "MMMM yyyy", { locale })`) is the clearest win.

### Anti-Patterns to Avoid

- **Module-level localizer with hardcoded `weekStartsOn`:** The current `AppointmentsCalendarSection` creates the localizer at module level. It must become a `useMemo` inside the component or it will never reflect settings changes.
- **Using `drizzle-kit push` for migrations:** Per project memory feedback, always use `supabase db push`.
- **Translating UI strings:** LOC-05 scope is date formatting only. Do not attempt to translate button labels, step titles, or any other static strings — that is SEED-012 (cancelled).
- **Forgetting `CompanySettingsData` type extension:** The local `settings` state in `CompanySettingsSection` is typed to `CompanySettingsData`. If the three new fields are not added there, TypeScript will reject `updateField('language', ...)` calls.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Portuguese month names | Custom month name arrays | `date-fns/locale/ptBR` with `format(..., { locale })` | date-fns has full locale data including months, weekdays |
| Week start calculation | Custom date math | `startOfWeek(date, { weekStartsOn: 0 \| 1 })` | date-fns handles DST, month boundaries correctly |
| Format string mapping | Regex replacement | A simple switch/map utility | The token sets are finite (3 options); switch is safest |

---

## Common Pitfalls

### Pitfall 1: Module-level localizer cannot be reactive

**What goes wrong:** The `dateFnsLocalizer` is currently created once at module evaluation time. If `weekStartsOn` comes from a React context, the localizer will always use the value at the time the module was first loaded (i.e., the default `0`).

**Why it happens:** JavaScript modules are evaluated once; closures capture values at creation time.

**How to avoid:** Move the `dateFnsLocalizer` creation into a `useMemo` inside the component body, depending on `weekStartsOn`.

**Warning signs:** Calendar always shows Sunday first regardless of setting.

### Pitfall 2: Drizzle schema vs. DB column name casing

**What goes wrong:** Drizzle column names use camelCase in TypeScript but snake_case in the DB. The migration must use `start_of_week` and `date_format` (snake_case). The Drizzle table definition uses `startOfWeek: text("start_of_week")` to map them.

**How to avoid:** Follow the exact pattern of `timeFormat: text("time_format")` in `companySettings`.

### Pitfall 3: Forgetting the `{ from, to }` range calculation

**What goes wrong:** LOC-02 requires the admin calendar to reflect `startOfWeek`. There are two places in `AppointmentsCalendarSection` with hardcoded `weekStartsOn: 0`:
1. Inside the `localizer` (visible column headers)
2. Inside the `useMemo` that computes `start = startOfWeek(currentDate, { weekStartsOn: 0 })` for the API date range fetch

If only (1) is fixed, the columns show Monday-first but the API query still fetches Sunday-to-Saturday data, causing events at the boundary to disappear.

**How to avoid:** Update both `weekStartsOn` references in the same task.

### Pitfall 4: ptBR import path in date-fns v3

**What goes wrong:** In date-fns v3, the import path changed slightly from v2. In v3 it is:

```typescript
import { ptBR } from 'date-fns/locale';   // correct for v3 (barrel export)
// or
import { ptBR } from 'date-fns/locale/pt-BR';  // also valid
```

The existing `enUS` import is `import { enUS } from 'date-fns/locale'` (confirmed in the file). Use the same pattern for `ptBR`.

**How to avoid:** Match the import style used by the existing `enUS` import.

### Pitfall 5: `CompanySettingsData` type not updated

**What goes wrong:** `CompanySettingsSection.tsx` uses a local `CompanySettingsData` interface from `shared/types.ts`. If the three new fields are missing from it, the `updateField` helper will raise a TypeScript error since `K extends keyof CompanySettingsData` won't include them.

**How to avoid:** Add all three fields to `CompanySettingsData` before wiring up the selects.

---

## Code Examples

### Supabase migration

```sql
-- supabase/migrations/20260514000000_add_locale_settings.sql
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS language        text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS start_of_week   text NOT NULL DEFAULT 'sunday',
  ADD COLUMN IF NOT EXISTS date_format     text NOT NULL DEFAULT 'MM/DD/YYYY';
```

### Drizzle schema addition (shared/schema.ts)

```typescript
// Inside companySettings pgTable, after timeZone:
language: text("language").default('en'),
startOfWeek: text("start_of_week").default('sunday'),
dateFormat: text("date_format").default('MM/DD/YYYY'),
```

### dateFnsLocalizer as useMemo (AppointmentsCalendarSection.tsx)

```typescript
import { enUS, ptBR } from 'date-fns/locale';

// Inside component:
const { settings: companySettings } = useCompanySettings();
const weekStartsOn: 0 | 1 = companySettings?.startOfWeek === 'monday' ? 1 : 0;
const dateFnsLocale = companySettings?.language === 'pt-BR' ? ptBR : enUS;

const localizer = useMemo(
  () => dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn }),
    getDay,
    locales: { 'en-US': enUS, 'pt-BR': ptBR },
  }),
  [weekStartsOn],
);
```

### range useMemo fix (same file)

```typescript
const { from, to } = useMemo(() => {
  // ...
  if (currentView === Views.WEEK) {
    start = startOfWeek(currentDate, { weekStartsOn });  // was hardcoded 0
    end = endOfWeek(currentDate, { weekStartsOn });      // was hardcoded 0
  }
  // ...
}, [currentDate, currentView, weekStartsOn]);  // add weekStartsOn dependency
```

### StepTimeSlot — locale-aware month format

`StepTimeSlot.tsx` receives `timeFormat` as a prop from `BookingPage`. The same prop pattern can carry `dateFormat` and `language`:

```typescript
// BookingPage.tsx — read from companySettings (already fetched):
const dateFormat = companySettings?.dateFormat || 'MM/DD/YYYY';
const language   = companySettings?.language   || 'en';

// Pass as props to StepTimeSlot:
<StepTimeSlot
  ...
  dateFormat={dateFormat}
  language={language}
/>
```

Inside `StepTimeSlot`:

```typescript
import { enUS, ptBR } from 'date-fns/locale';
// ...
const dateFnsLocale = language === 'pt-BR' ? ptBR : enUS;

// Month header:
format(viewDate, "MMMM yyyy", { locale: dateFnsLocale })

// Selected date display (if added):
format(parseISO(selectedDate), toDateFnsFormat(dateFormat), { locale: dateFnsLocale })
```

### Format token utility (client/src/lib/locale.ts)

```typescript
export function toDateFnsFormat(adminFormat: string | null | undefined): string {
  switch (adminFormat) {
    case 'DD/MM/YYYY': return 'dd/MM/yyyy';
    case 'YYYY-MM-DD': return 'yyyy-MM-dd';
    case 'MM/DD/YYYY':
    default:           return 'MM/dd/yyyy';
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| date-fns v2 locale imports (`import ptBR from 'date-fns/locale/pt-BR'`) | date-fns v3 named export (`import { ptBR } from 'date-fns/locale'`) | date-fns v3.0 | Use named exports; default imports removed |
| `react-big-calendar` `culture` prop took an ISO string | Still `culture` string key — must match a key in `locales` map | No change in v1.x | Pass `'pt-BR'` and register it in `locales` |

---

## Open Questions

1. **Day-name headers in StepTimeSlot calendar (LOC-05 scope)**
   - What we know: They are hardcoded `["Sun", "Mon", ...]` strings in JSX.
   - What's unclear: LOC-05 says "date display" — does this include day-name column headers?
   - Recommendation: Scope it to month name and the selected-date display string only. The hardcoded day abbreviations are cosmetic and changing them requires generating locale-aware day names from date-fns. Keep it out of scope to avoid over-engineering.

2. **Hardcoded timezone label in StepTimeSlot**
   - What we know: Line 183 shows `"GMT-05:00 America/New_York (EST)"` hardcoded regardless of `companySettings.timeZone`.
   - What's unclear: Is fixing this part of this phase or a pre-existing known issue?
   - Recommendation: Out of scope for LOC-01–05. Note it as a separate cleanup item.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code and config changes. The Supabase CLI is already in use (confirmed by existing migrations). No new external tools are required.

---

## Validation Architecture

No automated test infrastructure detected in this project (no `jest.config.*`, `vitest.config.*`, `pytest.ini`, or `tests/` directory). Phase validation is manual:

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Command |
|--------|----------|-----------|---------|
| LOC-01 | Language select persists to DB and reloads on refresh | Manual browser | Open Admin > Company Settings > General; change Language to pt-BR; refresh page; confirm pt-BR is selected |
| LOC-02 | startOfWeek select changes calendar column order | Manual browser | Change to Monday; navigate to admin calendar; confirm Mon is first column |
| LOC-03 | dateFormat select persists | Manual browser | Change to DD/MM/YYYY; confirm value persists on reload |
| LOC-04 | Columns exist in DB | Manual / supabase dashboard | Check table columns or run `supabase db push` without error |
| LOC-05 | Booking flow month name uses pt-BR locale | Manual browser | Set language pt-BR; open /booking; confirm month header shows Portuguese month name |

### Wave 0 Gaps

None — no test framework to set up. Validation is browser-based per project convention.

---

## Sources

### Primary (HIGH confidence)

- Direct file inspection: `client/src/components/admin/AppointmentsCalendarSection.tsx` — confirmed `dateFnsLocalizer` at module level, hardcoded `weekStartsOn: 0` in two places
- Direct file inspection: `shared/schema.ts` — confirmed `companySettings` table columns `timeFormat`, `timeZone` as the exact pattern to follow
- Direct file inspection: `client/src/components/admin/shared/types.ts` — confirmed `CompanySettingsData` interface must be extended
- Direct file inspection: `client/src/pages/booking/StepTimeSlot.tsx` — confirmed hardcoded `["Sun", "Mon",...]` day names and `format(viewDate, "MMMM yyyy")` without locale arg
- Direct file inspection: `supabase/migrations/` directory listing — confirmed last migration timestamp `20260513000000`
- Direct `node_modules` inspection: `date-fns/locale/pt-BR` confirmed present on disk
- Direct file inspection: `package.json` — date-fns `^3.6.0`, react-big-calendar `^1.19.4`

### Secondary (MEDIUM confidence)

- react-big-calendar v1.19 documentation: `culture` prop selects locale from the `locales` map passed to the localizer; `dateFnsLocalizer` `startOfWeek` callback controls first day of week

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and confirmed from package.json
- Architecture: HIGH — all touch-points confirmed by direct source inspection; patterns are straightforward extensions of existing patterns
- Pitfalls: HIGH — confirmed by reading actual code (module-level localizer, hardcoded weekStartsOn in two places)

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable libraries, slow-changing codebase)
