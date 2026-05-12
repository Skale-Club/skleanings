---
phase: 32-calendar-harmony-retry-queue
plan: "03"
subsystem: admin-integrations
tags: [calendar-sync, admin-ui, retry-queue, observability]
dependency_graph:
  requires: [32-01, 32-02]
  provides: [CalendarSyncTab, calendar-sync-tab-in-IntegrationsSection]
  affects: [client/src/components/admin/IntegrationsSection.tsx]
tech_stack:
  added: []
  patterns: [React Query refetchInterval auto-poll, authenticated fetch pattern, shadcn Table+Card+Badge+Alert]
key_files:
  created:
    - client/src/components/admin/integrations/CalendarSyncTab.tsx
  modified:
    - client/src/components/admin/IntegrationsSection.tsx
decisions:
  - "[Phase 32-03]: Tab value is 'calendar-sync' (hyphenated) to match INTEGRATION_TABS const pattern used across IntegrationsSection"
  - "[Phase 32-03]: Used RefreshCw icon from lucide-react for Calendar Sync tab trigger — already imported in IntegrationsSection's lucide bundle"
  - "[Phase 32-03]: err typed as unknown in handleRetry catch block (not any) to satisfy strict TS — message extracted with instanceof check"
metrics:
  duration_seconds: 417
  completed_date: "2026-05-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 32 Plan 03: CalendarSyncTab Admin UI Summary

CalendarSyncTab admin component with 30s auto-poll, per-target health cards, permanent-failure table, per-row retry button, and >= 10 failure warning banner — wired as "Calendar Sync" tab in IntegrationsSection.

## What Was Built

### Task 1: CalendarSyncTab.tsx (created)

File: `client/src/components/admin/integrations/CalendarSyncTab.tsx`

- **Health summary cards** — one `Card` per target (`ghl_contact`, `ghl_appointment`, `google_calendar`) showing pending count and failed-permanent count (24h). Counts styled with `Badge` variants: `destructive` at >= 10, `secondary` when > 0, `outline` when 0.
- **Auto-refresh** — `refetchInterval: 30_000` on the `useQuery` call polls `GET /api/integrations/calendar-sync/health` every 30 seconds without user action.
- **Consecutive-failure warning banner** — `Alert variant="destructive"` with `AlertTriangle` icon renders when any target has `failedPermanentCount >= 10`. Requirement SYNC-06.
- **Failure detail table** — Rendered per target only when `recentFailures.length > 0`. Columns: Job ID, Booking (link to `/admin/bookings/:id`), Attempts, Last Attempt (formatted via `toLocaleString()`), Error text (truncated), and Action.
- **Per-row Retry button** — `onClick` calls `POST /api/integrations/calendar-sync/:jobId/retry` with Bearer auth token, shows `Loader2` spinner while in-flight, invalidates health query key on success, shows destructive toast on error.
- **Manual Refresh button** — calls `refetch()` from useQuery for immediate refresh outside the 30s interval.
- **Healthy state** — "No permanent failures in the queue" message when all targets have zero recentFailures.

### Task 2: IntegrationsSection.tsx (modified)

- Added `import { CalendarSyncTab } from './integrations/CalendarSyncTab'`
- Added `'calendar-sync'` to the `INTEGRATION_TABS` const array (position: after `'calendar'`, before `'analytics'`)
- Added `<TabsTrigger value="calendar-sync">` with `RefreshCw` icon — label "Calendar Sync"
- Added `<TabsContent value="calendar-sync"><CalendarSyncTab getAccessToken={getAccessToken} /></TabsContent>`

**Tab value:** `calendar-sync` — used in URL slug routing via `useSlugTab`. Admin can navigate directly to `/admin/integrations?tab=calendar-sync`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 745f0ff | feat(32-03): create CalendarSyncTab with health panel, failure table, retry, and banner |
| 2 | 376e519 | feat(32-03): wire CalendarSyncTab into IntegrationsSection as calendar-sync tab |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced `err: any` with `err: unknown` in handleRetry catch block**
- **Found during:** Task 1
- **Issue:** Plan's code sample used `catch (err: any)` which is a TypeScript lint concern and can hide type errors
- **Fix:** Typed as `unknown`, extracted message with `err instanceof Error ? err.message : 'Unknown error'` — same behavior, type-safe
- **Files modified:** client/src/components/admin/integrations/CalendarSyncTab.tsx

## Notes for Verifier

1. **Migration required** — The `calendar_sync_queue` table must exist in PostgreSQL before the health panel returns live data. Apply via `supabase db push` (not drizzle-kit) as documented in Phase 32-01 SUMMARY.
2. **Tab navigation** — "Calendar Sync" tab is the 5th tab (after Calendar, before Analytics) in the Integrations panel.
3. **Testing the banner** — Insert 10 rows with `status = 'failed_permanent'` and `created_at > NOW() - INTERVAL '24 hours'` for the same target, then reload the tab.
4. **Testing retry** — Insert one `failed_permanent` row, click Retry — job should reset to `status = 'pending'`, counts update within 30s.

## Known Stubs

None — all data is fetched live from `/api/integrations/calendar-sync/health`. No hardcoded placeholders.
