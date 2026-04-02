---
phase: 01-schema-storage
plan: 01
subsystem: database
tags: [drizzle, postgres, schema, staff, types]

requires: []
provides:
  - staffMembers table (Drizzle + TypeScript types)
  - staffServiceAbilities junction table
  - staffAvailability table (per-staff working hours by day-of-week)
  - staffGoogleCalendar table (optional OAuth tokens per staff)
  - 4 insert schemas + 8 TypeScript types exported from shared/schema.ts
affects:
  - 01-02 (bookings migration — same file, adds staffMemberId column)
  - 01-03 (storage layer — imports all new types)
  - 02-xx (API endpoints — import types for request/response)
  - 04-xx (availability engine — imports StaffAvailability, StaffMember)

tech-stack:
  added: []
  patterns:
    - "pgTable + createInsertSchema + $inferSelect + z.infer — existing Drizzle pattern followed"
    - "onDelete: cascade on all staff junction/child tables"

key-files:
  created: []
  modified:
    - shared/schema.ts

key-decisions:
  - "staffGoogleCalendar included in Phase 1 schema (not Phase 3) to avoid a separate migration later"
  - "staffId NOT added to bookings in this plan — deferred to 01-02 for single combined migration"
  - "serial PK used (not uuid) — consistent with all other tables in codebase"

patterns-established:
  - "Staff child tables (abilities, availability, google_calendar) all use onDelete: cascade from staffMemberId FK"
  - "dayOfWeek uses JS convention: 0=Sunday ... 6=Saturday"

duration: ~5min
started: 2026-04-02T00:00:00Z
completed: 2026-04-02T00:00:00Z
---

# Phase 1 Plan 01: Staff Schema Tables Summary

**4 Drizzle tables + 4 insert schemas + 8 TypeScript types added to shared/schema.ts for the Staff Members feature foundation.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~5 min |
| Tasks | 2 completed |
| Files modified | 1 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Tables defined with correct fields and FK relationships | Pass | 4 tables, all FKs use `onDelete: "cascade"` |
| AC-2: Zod schemas and TypeScript types exported | Pass | 4 insert schemas, 8 types (Select + Insert variants) |
| AC-3: TypeScript compilation passes with no errors | Pass | `npm run check` → zero errors |

## Accomplishments

- Added `staffMembers` table with all fields (name, contact, photo, bio, isActive, order)
- Added `staffServiceAbilities` junction table linking staff to services (many-to-many)
- Added `staffAvailability` table for per-staff working hours by day-of-week
- Added `staffGoogleCalendar` table for optional OAuth token storage per staff member
- All schemas and types follow existing codebase conventions exactly

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `shared/schema.ts` | Modified (+75 lines) | 4 table definitions, 4 insert schemas, 8 TypeScript types |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `staffGoogleCalendar` defined now | Avoids separate DB migration in Phase 3 | Table exists early; used only in Phase 3 |
| `staffMemberId` on bookings deferred to Plan 01-02 | Single combined `db:push` covers all staff changes | No migration fragmentation |

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

**Ready:**
- All types importable from `@shared/schema`
- `StaffMember`, `StaffAvailability`, `StaffServiceAbility`, `StaffGoogleCalendar` types available
- Foundation for storage layer (Plan 01-03) and API endpoints (Phase 2) is in place

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 01-schema-storage, Plan: 01*
*Completed: 2026-04-02*
