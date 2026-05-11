---
phase: 26-custom-booking-questions
plan: 01
subsystem: database
tags: [postgres, drizzle, zod, supabase-migrations, schema]

# Dependency graph
requires:
  - phase: 23-multiple-durations-per-service
    provides: serviceDurations table pattern (child table per service with FK + CASCADE)
provides:
  - service_booking_questions table with id, service_id, label, type, options, required, order columns
  - question_answers JSONB column on booking_items table
  - serviceBookingQuestions Drizzle table export from shared/schema.ts
  - QuestionAnswer interface export from shared/schema.ts
  - insertServiceBookingQuestionSchema, ServiceBookingQuestion, InsertServiceBookingQuestion type exports
  - cartItemSchema extended with questionAnswers field (prevents Zod silent stripping)
affects: [26-02-admin-ui, 26-03-booking-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Child table per service with ON DELETE CASCADE (mirrors serviceDurations pattern)"
    - "QuestionAnswer snapshot pattern: denormalize label+type at booking time for audit trail survivability"
    - "JSONB for flexible string[] options on select-type questions"
    - "cartItemSchema must include all client payload fields or Zod silently strips them"

key-files:
  created:
    - supabase/migrations/20260511000001_add_service_booking_questions.sql
    - supabase/migrations/20260511000002_add_booking_item_question_answers.sql
  modified:
    - shared/schema.ts

key-decisions:
  - "QuestionAnswer stores label and type snapshots at booking time so answers remain readable if the source question is later deleted or edited"
  - "options column is JSONB string[] (nullable) — only populated for type=select, null for text/textarea"
  - "cartItemSchema extended inline (not via .extend()) to match existing schema.ts pattern for the z.object definition"
  - "Migration timestamps 20260511000001 and 20260511000002 continue the sequence after 20260510000003"

patterns-established:
  - "Question snapshot pattern: always copy label+type into QuestionAnswer at write time, never join back to serviceBookingQuestions for display"

requirements-completed: [QUEST-01, QUEST-02, QUEST-04]

# Metrics
duration: 8min
completed: 2026-05-11
---

# Phase 26 Plan 01: Custom Booking Questions — Data Layer Summary

**service_booking_questions table and question_answers JSONB column established as Drizzle schema + two Supabase SQL migrations with IF NOT EXISTS guards**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-11T00:00:00Z
- **Completed:** 2026-05-11T00:08:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Two SQL migration files created with IF NOT EXISTS guards, ready for `supabase db push`
- serviceBookingQuestions Drizzle table added to shared/schema.ts mirroring the serviceDurations child-table pattern
- QuestionAnswer interface added as booking-time snapshot (label + type survive question deletion)
- questionAnswers JSONB column added to bookingItems table (Drizzle + SQL migration aligned)
- cartItemSchema extended with questionAnswers array field — critical to prevent Zod from silently stripping answers before they reach the server

## Task Commits

Each task was committed atomically:

1. **Task 1: Write SQL migration files** - `b66d241` (chore)
2. **Task 2: Extend shared/schema.ts** - `5a38603` (feat)

**Plan metadata:** _(committed with docs commit below)_

## Files Created/Modified

- `supabase/migrations/20260511000001_add_service_booking_questions.sql` - CREATE TABLE service_booking_questions with FK + index
- `supabase/migrations/20260511000002_add_booking_item_question_answers.sql` - ALTER TABLE booking_items ADD COLUMN question_answers JSONB
- `shared/schema.ts` - QuestionAnswer interface, serviceBookingQuestions table, bookingItems column, cartItemSchema extension

## Decisions Made

- QuestionAnswer stores label and type snapshots at booking time so answers remain readable if the source question is later deleted or edited
- options column is JSONB string[] (nullable) — only populated for type=select, null for text/textarea questions
- Migration timestamps 20260511000001 and 20260511000002 follow the existing sequence after 20260510000003
- cartItemSchema extended inline to match existing z.object pattern (not via .extend())

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript check confirms only pre-existing `express-rate-limit` type declaration errors (4 errors, all pre-existing in server/index.ts, not introduced by this plan).

## User Setup Required

**Migrations must be applied manually.** Run the following after plan execution:
```bash
supabase db push
```
This applies both migration files:
- `20260511000001_add_service_booking_questions.sql`
- `20260511000002_add_booking_item_question_answers.sql`

## Known Stubs

None — this plan is pure schema/migration. No UI or data wiring.

## Next Phase Readiness

- Plan 26-02 (admin UI) can now compile against ServiceBookingQuestion, InsertServiceBookingQuestion, and insertServiceBookingQuestionSchema
- Plan 26-03 (booking flow) can now access questionAnswers on bookingItems and cartItemSchema
- Migrations must be applied to Supabase before Plans 02/03 can run against a real database

---
*Phase: 26-custom-booking-questions*
*Completed: 2026-05-11*
