---
phase: 13-visitor-journey-ghl-sync
plan: 03
subsystem: ui
tags: [react, shadcn, typescript, analytics, marketing-dashboard]

# Dependency graph
requires:
  - phase: 13-01
    provides: GET /api/analytics/conversions endpoint and GET /api/analytics/session/:visitorId endpoint
  - phase: 12-marketing-dashboard-ui
    provides: MarketingSection tabs pattern, DateRange type, getAccessToken prop pattern

provides:
  - MarketingConversionsTab component with source filter and paginated table
  - VisitorJourneyPanel Sheet slide-over with first/last touch journey blocks
  - MarketingSection extended with 4th Conversions tab

affects: [13-04-ghl-sync, marketing-dashboard, admin-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useEffect accumulation pattern for load-more pagination (React Query v5 removed onSuccess)"
    - "Sheet side=right for drill-down panels off table rows"
    - "Deriving filter options from loaded data (sourceOptions from allRows)"

key-files:
  created:
    - client/src/components/admin/marketing/MarketingConversionsTab.tsx
    - client/src/components/admin/marketing/VisitorJourneyPanel.tsx
  modified:
    - client/src/components/admin/MarketingSection.tsx

key-decisions:
  - "useEffect used for load-more row accumulation — React Query v5 removed onSuccess from useQuery"
  - "Source filter derives options from allRows (loaded data) not a separate API call — avoids extra round-trip"
  - "VisitorJourneyPanel null visitorId shows message immediately without API call (enabled: open && !!visitorId)"
  - "Influence indicator uses same-source + same-campaign comparison for single vs multi-touch label"

patterns-established:
  - "Drill-down panel pattern: table row click → Sheet side=right with detail content"
  - "Load-more pagination via offset state + useEffect accumulation into allRows"
  - "Empty-state-first principle: loading skeleton → error → no data → data render path"

requirements-completed: [CONV-01, CONV-02, CONV-03, JOUR-01, JOUR-02, FILTER-02]

# Metrics
duration: 67min
completed: 2026-04-25
---

# Phase 13 Plan 03: Conversions Tab and Visitor Journey Panel Summary

**Conversions tab UI with paginated last-touch event table, source filter, and Sheet slide-over visitor journey panel wired to /api/analytics/conversions and /api/analytics/session/:visitorId**

## Performance

- **Duration:** 67 min
- **Started:** 2026-04-25T14:18:59Z
- **Completed:** 2026-04-25T15:26:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- MarketingConversionsTab: paginated table (50 rows/page) with Event, Source, Campaign, Landing Page, Value, Time, Attribution columns; source dropdown filter deriving options from loaded data; load-more button; row click handler opening journey panel
- VisitorJourneyPanel: shadcn Sheet slide-over (side=right) with first-touch block, last-touch block, session stats, D-07 influence indicator (single vs multi-touch), D-08 null visitorId message, and conversion event section always visible at bottom
- MarketingSection extended from 3 to 4 tabs — Conversions is the 4th tab after Campaigns

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MarketingConversionsTab.tsx and VisitorJourneyPanel.tsx** - `5231f86` (feat)
2. **Task 2: Extend MarketingSection.tsx with Conversions tab** - `14b1c07` (feat)

## Files Created/Modified

- `client/src/components/admin/marketing/MarketingConversionsTab.tsx` - Conversions list with source filter, 50-row pagination, load-more, row click handler
- `client/src/components/admin/marketing/VisitorJourneyPanel.tsx` - Sheet slide-over with visitor session journey (first/last touch blocks, session stats, conversion event)
- `client/src/components/admin/MarketingSection.tsx` - Added import, union type extended, 4th TabsTrigger and TabsContent added

## Decisions Made

- Used `useEffect` for load-more accumulation into `allRows` because React Query v5 removed `onSuccess` from `useQuery` — accumulation must happen in a side-effect
- Source filter options are derived from `allRows` (the already-loaded data) rather than a separate API call, to avoid an extra round-trip
- `VisitorJourneyPanel` skips the API call entirely when `visitorId` is null (`enabled: open && !!visitorId`) and shows the D-08 message immediately
- Influence indicator uses two conditions (same traffic source + same campaign) to label single-touch vs multi-touch journeys

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TypeScript check passed clean on both tasks. Build completed successfully with only pre-existing warnings in server/routes/chat/utils.ts (unrelated to this plan).

## Known Stubs

None — both components fetch real data from existing Plan 01 endpoints. The empty state renders correctly when the API returns an empty array.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Conversions tab and Visitor Journey panel are complete frontend deliverables for Phase 13
- Phase 13 Plan 03 is the final frontend plan — GoHighLevel UTM sync (if a Plan 04 exists) can proceed independently on the backend
- Admin > Marketing now shows 4 tabs: Overview, Sources, Campaigns, Conversions

---
*Phase: 13-visitor-journey-ghl-sync*
*Completed: 2026-04-25*
