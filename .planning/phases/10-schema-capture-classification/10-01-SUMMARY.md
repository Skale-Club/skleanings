---
phase: 10-schema-capture-classification
plan: 01
subsystem: database
tags: [drizzle, postgres, supabase, schema, utm, attribution, migration]

# Dependency graph
requires:
  - phase: 09-db-stability
    provides: Reliable postgres.js connection (SCRAM/pgBouncer fix); database is stable

provides:
  - visitorSessions Drizzle table definition with 23 columns (first_* + last_* attribution, counters, indexes)
  - conversionEvents Drizzle table definition with denormalized attribution snapshot and ATTR-03 unique index
  - bookings.utmSessionId nullable UUID FK to visitorSessions
  - TypeScript types VisitorSession, ConversionEvent, InsertVisitorSession, InsertConversionEvent
  - Supabase SQL migration 20260425000000_add_utm_tracking.sql ready to apply

affects:
  - 10-02 (server storage + endpoint — imports visitorSessions, conversionEvents from shared/schema.ts)
  - 10-03 (client hook — depends on endpoint from 10-02 which depends on schema from this plan)
  - 11 (booking attribution writes — needs utmSessionId FK and conversionEvents table)
  - 12 (marketing dashboard — queries visitor_sessions and conversion_events)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "drizzle index() / uniqueIndex() callback pattern for table-level indexes"
    - "Collocated type/schema exports (next to table definition, not in bottom === TYPES === block)"
    - "Supabase CLI migration (hand-written SQL, never drizzle-kit push)"
    - "ATTR-03 partial unique index enforced via SQL migration only (Drizzle placeholder for type safety)"

key-files:
  created:
    - supabase/migrations/20260425000000_add_utm_tracking.sql
  modified:
    - shared/schema.ts

key-decisions:
  - "visitorSessions defined BEFORE bookings in schema.ts (required for FK forward-reference)"
  - "conversionEvents defined AFTER bookings in schema.ts (references both visitorSessions and bookings)"
  - "ATTR-03 partial unique index (WHERE booking_id IS NOT NULL) enforced via SQL migration only — Drizzle 0.39.3 cannot express partial unique indexes; Drizzle uniqueIndex() is a type-safety placeholder only"
  - "Types/schemas collocated with table definitions (contacts pattern), not moved to bottom === TYPES === block"

patterns-established:
  - "Phase 10 attribution tables: first_* columns immutable after INSERT; last_* updated on meaningful re-engagement only"
  - "Migration naming: YYYYMMDDHHMMSS_description.sql — 20260425000000 sorts after last applied 20260409100000"

requirements-completed:
  - CAPTURE-01
  - CAPTURE-02
  - CAPTURE-03
  - CAPTURE-04
  - CAPTURE-05
  - CAPTURE-06
  - ATTR-03

# Metrics
duration: 3min
completed: 2026-04-25
---

# Phase 10 Plan 01: Schema — UTM Tracking Tables Summary

**Two-table UTM attribution schema (visitor_sessions + conversion_events) with FK on bookings, plus Supabase SQL migration; TypeScript compiles cleanly and migration file is ready for `supabase db push`**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-25T14:53:33Z
- **Completed:** 2026-04-25T14:55:30Z
- **Tasks completed:** 2 of 3 (Task 3 is awaiting human action: `supabase db push`)
- **Files modified:** 2

## Accomplishments

- Added `visitorSessions` Drizzle table with 23 columns: `id` (UUID PK), 9 `first_*` attribution columns + `first_seen_at`, 9 `last_*` attribution columns + `last_seen_at`, plus `visitCount`, `totalBookings`, `convertedAt`; 5 BTREE indexes
- Added `conversionEvents` Drizzle table with denormalized attribution snapshot (12 columns); 6 BTREE indexes plus ATTR-03 unique index placeholder
- Added `utmSessionId` nullable UUID FK on `bookings` referencing `visitorSessions.id` with `onDelete: "set null"`
- Created hand-written SQL migration `20260425000000_add_utm_tracking.sql` with all DDL, complete ordering (visitor_sessions → ALTER bookings → conversion_events), and ATTR-03 partial unique index `WHERE booking_id IS NOT NULL`
- `npm run check` exits 0 — TypeScript compiles with zero errors

## Task Commits

1. **Task 1: Add visitorSessions, conversionEvents Drizzle tables and bookings.utmSessionId FK** - `5941538` (feat)
2. **Task 2: Create Supabase SQL migration file 20260425000000_add_utm_tracking.sql** - `875c0ca` (chore)
3. **Task 3: USER applies the Supabase migration** - awaiting `supabase db push` (checkpoint:human-action)

## Files Created/Modified

- `shared/schema.ts` — Extended import (added `index`, `uniqueIndex`); added `visitorSessions` at line 125, `utmSessionId` FK inside `bookings` at line 192, `conversionEvents` at line 197; VisitorSession/ConversionEvent types and insert schemas collocated with their table definitions
- `supabase/migrations/20260425000000_add_utm_tracking.sql` — Complete DDL for both new tables, bookings ALTER, all indexes, and ATTR-03 partial unique index

## visitor_sessions Column List (final as written)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NOT NULL | — (client-generated, passed as PK) |
| first_utm_source | TEXT | NULL | — |
| first_utm_medium | TEXT | NULL | — |
| first_utm_campaign | TEXT | NULL | — |
| first_utm_term | TEXT | NULL | — |
| first_utm_content | TEXT | NULL | — |
| first_utm_id | TEXT | NULL | — |
| first_landing_page | TEXT | NULL | — |
| first_referrer | TEXT | NULL | — |
| first_traffic_source | TEXT | NOT NULL | 'unknown' |
| first_seen_at | TIMESTAMP | NOT NULL | NOW() |
| last_utm_source | TEXT | NULL | — |
| last_utm_medium | TEXT | NULL | — |
| last_utm_campaign | TEXT | NULL | — |
| last_utm_term | TEXT | NULL | — |
| last_utm_content | TEXT | NULL | — |
| last_utm_id | TEXT | NULL | — |
| last_landing_page | TEXT | NULL | — |
| last_referrer | TEXT | NULL | — |
| last_traffic_source | TEXT | NOT NULL | 'unknown' |
| last_seen_at | TIMESTAMP | NOT NULL | NOW() |
| visit_count | INTEGER | NOT NULL | 1 |
| total_bookings | INTEGER | NOT NULL | 0 |
| converted_at | TIMESTAMP | NULL | — |

**Total: 24 columns** (id + 9 first_* + first_seen_at + 9 last_* + last_seen_at + 3 counters)

## conversion_events Column List (final as written)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | SERIAL | NOT NULL | auto-increment |
| visitor_id | UUID | NULL | FK → visitor_sessions(id) ON DELETE SET NULL |
| event_type | TEXT | NOT NULL | — |
| booking_id | INTEGER | NULL | FK → bookings(id) ON DELETE SET NULL |
| booking_value | NUMERIC(10,2) | NULL | — |
| attributed_source | TEXT | NULL | — |
| attributed_medium | TEXT | NULL | — |
| attributed_campaign | TEXT | NULL | — |
| attributed_landing_page | TEXT | NULL | — |
| attribution_model | TEXT | NOT NULL | 'last_touch' |
| occurred_at | TIMESTAMP | NOT NULL | NOW() |
| page_url | TEXT | NULL | — |
| metadata | JSONB | NULL | {} |

**Total: 13 columns**

## ATTR-03 Partial Unique Index Note

The unique index on `(booking_id, event_type, attribution_model)` is enforced as a **partial index** (`WHERE booking_id IS NOT NULL`) via the SQL migration only.

- **Why partial:** Non-booking events (e.g., `chat_initiated` with `booking_id = NULL`) must not conflict with each other on the unique index. Standard unique indexes treat NULL as distinct in PostgreSQL, but a partial index makes the intent explicit and guaranteed.
- **Drizzle limitation:** Drizzle 0.39.3 `uniqueIndex().where(...)` does not reliably generate partial index DDL. The `uniqueIndex()` call in `shared/schema.ts` is a **type-safety placeholder only**. The authoritative constraint lives in `supabase/migrations/20260425000000_add_utm_tracking.sql`.
- **SQL migration fragment:** `CREATE UNIQUE INDEX IF NOT EXISTS conversion_events_booking_event_model_unique_idx ON conversion_events (booking_id, event_type, attribution_model) WHERE booking_id IS NOT NULL;`

## Decisions Made

- **Collocated exports:** `VisitorSession`, `InsertVisitorSession`, `insertVisitorSessionSchema` placed immediately after the `visitorSessions` table (contacts pattern) — NOT moved to the bottom `=== TYPES ===` block. Same for conversion events.
- **Migration file timestamp:** `20260425000000` — chosen to sort after the most recent applied migration `20260409100000` (lexicographic order preserved).
- **No drizzle-kit push:** Per MEMORY.md, only Supabase CLI (`supabase db push`) is used for actual database changes.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Task 3 — DATABASE MIGRATION — requires manual `supabase db push`.**

The Drizzle schema definitions and SQL migration file are complete. The actual database schema has NOT yet changed. To apply:

1. From project root: `supabase db push`
2. Confirm migration `20260425000000_add_utm_tracking.sql` is listed and applied without error
3. Verify in Supabase Dashboard > Database > Tables:
   - `visitor_sessions` table exists with all columns listed above
   - `conversion_events` table exists with all columns listed above
   - `bookings` table has a new `utm_session_id` UUID nullable column
4. Verify in Supabase Dashboard > Database > Indexes:
   - `conversion_events_booking_event_model_unique_idx` exists as partial unique index with predicate `booking_id IS NOT NULL`
   - All 5 `visitor_sessions_*_idx` indexes exist
   - All 6 `conversion_events_*_idx` indexes exist

**Resume signal:** Type "migration applied" once `supabase db push` completes and tables/indexes are confirmed in the dashboard.

## Next Phase Readiness

- `shared/schema.ts` provides types for all downstream plans: `VisitorSession`, `ConversionEvent`, `InsertVisitorSession`, `InsertConversionEvent`
- Plan 10-02 (storage + endpoint) is unblocked as soon as the TypeScript types are available (already done)
- Plan 10-02 EXECUTION requires the database tables to exist (`supabase db push` must complete first)

---
*Phase: 10-schema-capture-classification*
*Completed: 2026-04-25*
