---
phase: 17-favicon-legal-company-type-admin-ui
plan: "01"
subsystem: database, ui, api
tags: [drizzle, supabase, typescript, react, favicon, company-settings]

# Dependency graph
requires:
  - phase: 15-schema-foundation-detokenization
    provides: serviceDeliveryModel, privacyPolicyContent, termsOfServiceContent columns in companySettings

provides:
  - favicon_url DB column migration (supabase/migrations/20260430000000_add_favicon_url.sql)
  - faviconUrl Drizzle field in companySettings table
  - CompanySettingsData interface extended with faviconUrl, serviceDeliveryModel, privacyPolicyContent, termsOfServiceContent
  - publicCompanySettingsFallback updated with all 4 new fields
  - CompanySettingsSection useState seeded with all 4 new fields
  - use-seo.ts favicon block reading faviconUrl (not logoIcon), no hardcoded MIME type

affects:
  - 17-02-PLAN (SEO injector reads faviconUrl)
  - 17-03-PLAN (admin UI uses faviconUrl, serviceDeliveryModel, privacyPolicyContent, termsOfServiceContent)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - New company_settings columns added via supabase migration file (not drizzle-kit push) — consistent with Phase 10/15 pattern
    - faviconUrl field placed after Phase 15 fields at end of companySettings pgTable definition

key-files:
  created:
    - supabase/migrations/20260430000000_add_favicon_url.sql
  modified:
    - shared/schema.ts
    - client/src/components/admin/shared/types.ts
    - server/routes/company.ts
    - client/src/components/admin/CompanySettingsSection.tsx
    - client/src/hooks/use-seo.ts

key-decisions:
  - "faviconUrl placed after termsOfServiceContent in companySettings Drizzle table (appended at end, consistent with Phase 15 pattern)"
  - "favicon.type = 'image/png' removed from use-seo.ts — browser detects MIME from Supabase Content-Type header (D-07 compliant)"
  - "logoIcon field retained in SeoSettings interface — it is still used for logo display, only the favicon assignment block changed"

patterns-established:
  - "All new company_settings columns: add to (1) migration SQL, (2) Drizzle schema, (3) CompanySettingsData interface, (4) publicCompanySettingsFallback, (5) useState initializer — in that order"

requirements-completed: [FAV-01, FAV-02, FAV-03, WLTYPE-02, LEGAL-02, LEGAL-03, LEGAL-04]

# Metrics
duration: 6min
completed: 2026-04-30
---

# Phase 17 Plan 01: Favicon-Legal-CompanyType Admin UI — Schema Foundation Summary

**faviconUrl column migration + Drizzle field + TypeScript type gaps closed + favicon hook switched from logoIcon to dedicated faviconUrl field**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-30T12:13:15Z
- **Completed:** 2026-04-30T12:18:49Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `supabase/migrations/20260430000000_add_favicon_url.sql` with `ADD COLUMN IF NOT EXISTS favicon_url TEXT DEFAULT ''`
- Added `faviconUrl: text("favicon_url").default('')` to the companySettings Drizzle table (after termsOfServiceContent)
- Extended `CompanySettingsData` interface with all 4 new fields: faviconUrl, serviceDeliveryModel, privacyPolicyContent, termsOfServiceContent
- Updated `publicCompanySettingsFallback` in `server/routes/company.ts` with all 4 new fields (faviconUrl: "", serviceDeliveryModel: "at-customer", privacyPolicyContent: "", termsOfServiceContent: "")
- Seeded all 4 new fields in `CompanySettingsSection` useState initializer
- Switched `use-seo.ts` favicon block to read `settings.faviconUrl` (not `settings.logoIcon`), removed hardcoded `favicon.type = 'image/png'`
- `npm run check` passes with zero TypeScript errors after all changes

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration + Drizzle schema + type/fallback gaps** - `9186875` (feat)
2. **Task 2: use-seo.ts — switch favicon source from logoIcon to faviconUrl** - `00e46f6` (feat)

## Files Created/Modified

- `supabase/migrations/20260430000000_add_favicon_url.sql` - New migration adding favicon_url column to company_settings table
- `shared/schema.ts` - Added faviconUrl Drizzle field to companySettings pgTable
- `client/src/components/admin/shared/types.ts` - Extended CompanySettingsData with 4 new fields
- `server/routes/company.ts` - Added 4 new fields to publicCompanySettingsFallback
- `client/src/components/admin/CompanySettingsSection.tsx` - Seeded 4 new fields in useState initializer
- `client/src/hooks/use-seo.ts` - Added faviconUrl to SeoSettings interface, replaced favicon block to use faviconUrl

## Decisions Made

- `faviconUrl` appended after `termsOfServiceContent` in the Drizzle table definition (consistent with Phase 15 append pattern)
- `favicon.type = 'image/png'` removed — browser detects MIME type from Supabase Content-Type response header; hardcoding was incorrect for SVG/ico favicons
- `logoIcon` remains in SeoSettings interface — it is still used for other logo purposes, only the favicon href assignment was redirected

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Migration pending.** The migration file `supabase/migrations/20260430000000_add_favicon_url.sql` is written and ready. Apply it before Phase 17 Plan 02 and 03 execution:

```bash
supabase db push
```

Requires `POSTGRES_URL_NON_POOLING` (direct connection, port 5432) in `.env`. Get from Supabase Dashboard > Settings > Database > Direct connection.

## Next Phase Readiness

- Plans 17-02 (SEO injector) and 17-03 (admin UI + legal pages) are now type-safe — all four new fields exist in CompanySettingsData and publicCompanySettingsFallback
- Migration must be applied (`supabase db push`) before 17-02 and 17-03 can be tested end-to-end
- No blockers for plan file creation; DB push required for runtime testing only

---
*Phase: 17-favicon-legal-company-type-admin-ui*
*Completed: 2026-04-30*
