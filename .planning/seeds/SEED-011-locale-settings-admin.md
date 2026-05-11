---
id: SEED-011
status: dormant
planted: 2026-05-10
last_revised: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when onboarding the first non-English tenant (confirmed Xkedule will have non-English tenants, at lower intensity)
scope: Small
priority: medium
---

# SEED-011: Locale settings in admin (language, start of week, date format)

## Why This Matters

`companySettings` already has `timeFormat` (12h/24h) and `timeZone`, but no `language` or `startOfWeek`. For a white-label product serving different markets, these settings are basic:
- Brazilian company wants Monday-starting week, pt-BR dates, 24h format
- American company wants Sunday-starting week, en-US dates, 12h format

Currently `timeFormat` exists in the table but there's no `language` or `startOfWeek`. The admin calendar uses hardcoded `Sunday` as start of week.

**Why:** Every new tenant in a different market will ask for this in the first month of use. It's the kind of detail that seems small but blocks adoption.

## When to Surface

**Trigger:** when starting any internationalization milestone, or when adding the first non-US tenant.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Locale / internationalization milestone
- International tenant onboarding milestone
- White-label self-serve milestone

## Scope Estimate

**Small** — A short phase. Schema: add `language` (text, default 'en') and `startOfWeek` (text, default 'sunday') to `companySettings`. UI: add selects in the General section of Company Settings — Language, Start of week. Consumption: admin calendar respects `startOfWeek`, frontend uses `language` for Intl.DateTimeFormat.

## Breadcrumbs

- `shared/schema.ts` — `companySettings` table, already has `timeFormat` and `timeZone` (pattern for new fields)
- `client/src/components/admin/CompanySettingsSection.tsx` — where new selects would be added
- `client/src/components/admin/AppointmentsCalendarSection.tsx` — consumes calendar settings; `startOfWeek` would affect RBC `culture` prop
- `client/src/hooks/useCompanySettings.ts` — hook that exposes settings to the frontend
- `react-big-calendar` — supports `culture` prop for calendar localization

## Notes

The Language selector in admin controls the default locale of the public site (booking flow). Each tenant sits in one locale. It's not full i18n (doesn't translate strings) — it's locale for date, number, and currency formatting.

**Strategic decision (2026-05-10):** SEED-012 (full i18n) was cancelled. This seed (locale settings) covers the lower-intensity case: a non-English tenant gets UI in English but with date/number/currency formatting in their locale. Full booking flow translation is for a much later moment.
