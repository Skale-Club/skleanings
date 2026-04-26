---
phase: 13-visitor-journey-ghl-sync
plan: "02"
subsystem: server-ghl-integration
tags: [ghl, utm, attribution, crm, fire-and-forget]
dependency_graph:
  requires: [13-01]
  provides: [GHL-UTM-sync]
  affects: [server/integrations/ghl.ts, server/lib/booking-ghl-sync.ts]
tech_stack:
  added: []
  patterns: [fire-and-forget async IIFE, optional parameter extension]
key_files:
  created: []
  modified:
    - server/integrations/ghl.ts
    - server/lib/booking-ghl-sync.ts
decisions:
  - "updateGHLContact extended with optional customFields array — backward compatible, zero callers broken"
  - "UTM write is fire-and-forget via void IIFE — errors caught and logged, outer sync never affected"
  - "Skip write entirely when booking.utmSessionId is null — no unnecessary API calls for anonymous visitors"
metrics:
  duration: "67 minutes"
  completed: "2026-04-26"
  tasks_completed: 2
  files_modified: 2
requirements_satisfied: [GHL-01, GHL-02]
---

# Phase 13 Plan 02: GHL UTM Custom Field Sync Summary

**One-liner:** Extended GHL contact sync to write 4 UTM attribution custom fields (first/last source+campaign) as fire-and-forget after booking contact is confirmed.

## What Was Built

After a booking creates or finds a GHL contact, the system now reads the visitor's UTM session data and writes four custom field values to the GHL contact:
- `utm_first_source` — the source that first brought the visitor
- `utm_first_campaign` — the campaign from first touch
- `utm_last_source` — the source from the most recent visit before booking
- `utm_last_campaign` — the campaign from last touch

The write is fire-and-forget: it never delays or blocks the booking confirmation or the main GHL appointment sync. If the UTM write fails, the error is caught and logged but never propagated.

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Extend updateGHLContact with customFields param | 17ca647 | server/integrations/ghl.ts |
| 2 | Add UTM custom field write to syncBookingToGhl | 81a67ee | server/lib/booking-ghl-sync.ts |

## Success Criteria Verification

- GHL UTM write path: `booking.utmSessionId` → `getVisitorSession` → `updateGHLContact` with 4 custom fields — VERIFIED
- Null path: `booking.utmSessionId` null → debug log, no API call — VERIFIED
- Error path: `updateGHLContact` throws → caught and logged, `syncBookingToGhl` still returns `{ synced: true }` — VERIFIED (fire-and-forget pattern)
- TypeScript check passes clean — VERIFIED (exit code 0)
- Build passes clean — VERIFIED (exit code 0)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The implementation is fully wired: `booking.utmSessionId` → `getVisitorSession` → `updateGHLContact`. No hardcoded data or placeholders.

## Key Links

- `server/lib/booking-ghl-sync.ts` imports `updateGHLContact` from `server/integrations/ghl.ts`
- `server/lib/booking-ghl-sync.ts` imports `getVisitorSession` from `server/storage/analytics.ts`
- UTM field write fires between contact confirm (line 62) and companySettings fetch

## Self-Check: PASSED

Files exist:
- server/integrations/ghl.ts — FOUND
- server/lib/booking-ghl-sync.ts — FOUND

Commits exist:
- 17ca647 (Task 1) — FOUND
- 81a67ee (Task 2) — FOUND
