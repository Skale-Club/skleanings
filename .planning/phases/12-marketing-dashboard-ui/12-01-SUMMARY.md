---
plan: 12-01
phase: 12-marketing-dashboard-ui
status: complete
completed: 2026-04-25
key-files:
  created:
    - client/src/lib/analytics-display.ts
    - (extended) client/src/components/admin/shared/types.ts
    - (extended) server/storage/analytics.ts
    - (extended) server/routes/analytics.ts
---

## Summary

Wave 1 backend foundation complete. Three tasks shipped across three commits.

**Task 1:** Extended `AdminSection` union type with `| 'marketing'` in `types.ts` (Wave 0 type blocker — without this, all Phase 12 files fail `npm run check`). Created `client/src/lib/analytics-display.ts` with `getSourceDisplayName`, `formatConversionRate`, `formatRevenue`, `TRAFFIC_SOURCE_LABELS`, and `UTM_SOURCE_LABELS`.

**Task 2:** Appended three aggregate query functions to `server/storage/analytics.ts` — `getOverviewData`, `getSourcesData`, `getCampaignsData`. All booking counts filter `attributionModel = 'last_touch'` to prevent double-counting (recordConversionEvent writes 2 rows per booking). All functions catch PostgreSQL error 42P01 and return empty shapes for migration-pending safety. Existing functions (`upsertVisitorSession`, `linkBookingToAttribution`, `recordConversionEvent`) preserved intact.

**Task 3:** Added three GET endpoints to `server/routes/analytics.ts` — `GET /api/analytics/overview`, `GET /api/analytics/sources`, `GET /api/analytics/campaigns`. All protected by `requireAdmin` from `../lib/auth` (correct path — not `../middleware/auth`). Both existing POST endpoints preserved.

## Verification

- `npm run check` passes with zero TypeScript errors
- `| 'marketing'` present in AdminSection union type
- `requireAdmin` imported from `../lib/auth` (not middleware/auth)
- All booking count queries include `attributionModel = 'last_touch'`
- All three storage functions catch 42P01 → return empty shapes

## Self-Check: PASSED
