---
phase: 13-visitor-journey-ghl-sync
plan: "01"
subsystem: analytics-backend
tags: [analytics, backend, storage, routes, conversions, visitor-journey]
dependency_graph:
  requires: []
  provides: [GET /api/analytics/conversions, GET /api/analytics/session/:visitorId, ConversionEventRow, getConversionsData, getVisitorSession]
  affects: [server/storage/analytics.ts, server/routes/analytics.ts]
tech_stack:
  added: []
  patterns: [42P01-guard, requireAdmin, last-touch-filter, drizzle-select]
key_files:
  created: []
  modified:
    - server/storage/analytics.ts
    - server/routes/analytics.ts
decisions:
  - "D-02 last_touch filter enforced in getConversionsData — first_touch rows excluded by query condition, not post-filter"
  - "D-04 source+date filter only in getConversionsData — campaign/type filters deferred per plan spec"
  - "Limit capped at 200 server-side to prevent runaway queries on large datasets"
  - "getVisitorSession reuses existing VisitorSession type from shared/schema.ts — no new types needed"
metrics:
  duration_seconds: 289
  completed_date: "2026-04-26"
  tasks_completed: 2
  files_modified: 2
---

# Phase 13 Plan 01: Conversions + Visitor Journey Backend Endpoints Summary

**One-liner:** Two analytics GET endpoints (conversions list with last-touch filter + visitor session lookup) backed by typed Drizzle storage functions with 42P01 guards.

## What Was Built

### Task 1 — Storage functions in `server/storage/analytics.ts`

- **`ConversionEventRow` interface**: typed shape for conversion event rows returned to the client (id, eventType, attributedSource, attributedCampaign, attributedLandingPage, bookingValue as string, occurredAt as ISO string, bookingId, visitorId, attributionModel).
- **`getConversionsData(fromDate, toDate, source?, limit, offset)`**: queries `conversionEvents` filtered to `attributionModel = 'last_touch'`, date range, optional source equality filter. Returns `ConversionEventRow[]` ordered by `occurredAt DESC`. 42P01 guard returns `[]` if table doesn't exist.
- **`getVisitorSession(visitorId)`**: selects the full `visitorSessions` row by primary key. Returns `VisitorSession | null`. 42P01 guard returns `null` if table doesn't exist.

### Task 2 — Route endpoints in `server/routes/analytics.ts`

- **`GET /api/analytics/conversions`**: parses `from`, `to`, `source`, `limit` (capped at 200), `offset` query params. Validates dates, calls `getConversionsData`, returns JSON array. Protected by `requireAdmin`.
- **`GET /api/analytics/session/:visitorId`**: extracts `visitorId` from path, calls `getVisitorSession`, returns 404 if not found, otherwise returns full session JSON. Protected by `requireAdmin`.

Both routes use the `log()` utility from `../lib/logger` for error logging and return 500 on unexpected errors.

## Verification

- `npm run check` — exits 0 (no TypeScript errors)
- `npm run build` — completes successfully (2.0mb bundle; 3 pre-existing import.meta warnings unrelated to this plan)
- Analytics router confirmed mounted at `/api/analytics` in `server/index.ts` line 71
- `requireAdmin` on all 5 GET routes (3 existing + 2 new)
- 5 occurrences of 42P01 guard across storage functions

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — storage functions perform real Drizzle queries; routes wire directly to storage.

## Self-Check: PASSED
