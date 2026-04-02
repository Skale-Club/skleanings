---
phase: 01-schema-storage
plan: 02
subsystem: database
tags: [drizzle, postgres, supabase, migration, bookings, staff]

requires:
  - phase: 01-schema-storage/01-01
    provides: staffMembers table definition (needed for FK reference in bookings)
provides:
  - bookings.staffMemberId nullable FK column (onDelete: SET NULL)
  - All staff tables live in database (applied via Supabase migration)
  - supabase/migrations/20260402000000_add_staff_tables.sql
affects:
  - 01-03 (storage layer — DB is ready, methods can be implemented)
  - 02-xx (API endpoints — bookings now carry staffMemberId)

tech-stack:
  added: []
  patterns:
    - "DB migrations: write SQL to supabase/migrations/, execute via Node pg script — NOT drizzle-kit push"
    - "Migration verification: query information_schema.tables/columns after apply"

key-files:
  created:
    - supabase/migrations/20260402000000_add_staff_tables.sql
  modified:
    - shared/schema.ts (bookings table)

key-decisions:
  - "onDelete: SET NULL on bookings.staffMemberId — preserves booking history when staff deleted"
  - "Supabase CLI migration pattern adopted — drizzle-kit push has unresolvable TTY prompt issue"
  - "Migration SQL written to supabase/migrations/ for version control + reproducibility"

patterns-established:
  - "DB migrations go to supabase/migrations/<timestamp>_<name>.sql, applied via Node pg script"

duration: ~10min
started: 2026-04-02T00:00:00Z
completed: 2026-04-02T00:00:00Z
---

# Phase 1 Plan 02: Bookings Migration + DB Push Summary

**staffMemberId nullable FK added to bookings; all 5 staff tables applied to database via Supabase SQL migration.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10 min |
| Tasks | 2 completed |
| Files modified | 2 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: staffMemberId in bookings table (nullable, onDelete SET NULL) | Pass | Line 120, shared/schema.ts |
| AC-2: TypeScript compilation passes | Pass | `npm run check` → zero errors |
| AC-3: All schema changes in database | Pass | 4 staff tables + bookings column verified via information_schema |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `shared/schema.ts` | Modified (+3 lines) | staffMemberId nullable FK on bookings table |
| `supabase/migrations/20260402000000_add_staff_tables.sql` | Created | SQL migration for all 5 staff tables + bookings column |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `onDelete: SET NULL` on bookings.staffMemberId | Preserve booking history when staff member deleted | Bookings survive staff deletion |
| Supabase migration file + Node pg execution | drizzle-kit push has unresolvable TTY prompt (blog_generation_jobs rename detection); Node pg script is reliable and non-interactive | All future DB migrations use this pattern |

## Deviations from Plan

**1 deviation — approach change (non-breaking):**
- Plan specified `npm run db:push`
- Switched to Supabase migration file + Node pg execution
- Reason: drizzle-kit push has a pre-existing TTY interactive prompt that cannot be bypassed non-interactively
- Impact: None — same SQL applied, same result; migration file adds version control benefit

## Next Phase Readiness

**Ready:**
- Database fully provisioned: all 4 staff tables + bookings.staff_member_id live
- Schema types and Drizzle definitions complete
- Plan 01-03 (storage layer methods) can begin immediately

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 01-schema-storage, Plan: 02*
*Completed: 2026-04-02*
