---
phase: 26-custom-booking-questions
plan: 02
subsystem: api
tags: [express, drizzle, postgres, jsonb, rest-api]

requires:
  - phase: 26-01
    provides: "serviceBookingQuestions table + questionAnswers column on bookingItems (migrations + Drizzle schema types)"

provides:
  - "4 IStorage interface methods + DatabaseStorage implementations for serviceBookingQuestions CRUD"
  - "GET /api/services/:id now returns questions array alongside durations"
  - "GET/POST/PATCH/DELETE /api/services/:id/questions REST endpoints"
  - "bookings.ts cartItem loop threads questionAnswers through to bookingItemsData"
  - "storage.createBooking persists questionAnswers to booking_items.question_answers"

affects:
  - 26-03-frontend-admin-ui-customer-flow

tech-stack:
  added: []
  patterns:
    - "serviceDurations CRUD blueprint applied to serviceBookingQuestions (parallel structure)"
    - "Promise.all parallel fetch for durations+questions on GET /api/services/:id"
    - "Graceful GET route returns [] on DB error (before migration applied)"

key-files:
  created: []
  modified:
    - shared/schema.ts
    - server/storage.ts
    - server/routes/catalog.ts
    - server/routes/bookings.ts

key-decisions:
  - "Schema types added to shared/schema.ts in this worktree since Plan 01 runs in parallel; both plans converge on merge"
  - "Questions GET route returns [] on DB error (mirrors durations pattern) so catalog works before migration is applied"
  - "questionAnswers threaded via cartItem.questionAnswers directly — no intermediate transformation needed"

patterns-established:
  - "Child-table sub-route pattern: GET/POST/PATCH/DELETE under /api/services/:id/<child>"
  - "Parallel Promise.all in service detail endpoint for O(1) latency regardless of child table count"

requirements-completed: [QUEST-01, QUEST-02, QUEST-03, QUEST-04]

duration: 12min
completed: 2026-05-11
---

# Phase 26 Plan 02: Custom Booking Questions — Backend API Summary

**Four IStorage CRUD methods, four REST sub-routes under `/api/services/:id/questions`, extended service detail endpoint, and booking write path all wired for per-service intake questions.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-11T10:51:00Z
- **Completed:** 2026-05-11T11:03:28Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

### Task 1: IStorage methods + schema + createBooking extension

- Added `serviceBookingQuestions` table definition, `insertServiceBookingQuestionSchema`, `ServiceBookingQuestion`, `InsertServiceBookingQuestion` types to `shared/schema.ts`
- Added `QuestionAnswer` interface and `questionAnswers` JSONB column to `bookingItems` table in `shared/schema.ts`
- Extended `cartItemSchema` with optional `questionAnswers` array (prevents Zod silent-strip before answers reach server)
- Added `serviceBookingQuestions` table import to `server/storage.ts`
- Added `ServiceBookingQuestion`, `InsertServiceBookingQuestion`, `insertServiceBookingQuestionSchema` imports
- Declared 4 methods in `IStorage` interface after `deleteServiceDuration`
- Implemented all 4 methods in `DatabaseStorage` following serviceDurations pattern exactly
- Extended `createBooking` bookingItems insert to include `questionAnswers: item.questionAnswers`

### Task 2: REST routes + booking write path

- Extended `GET /api/services/:id` from single-fetch to `Promise.all([getServiceDurations, getServiceBookingQuestions])` returning `{ ...service, durations, questions }`
- Added `GET /api/services/:id/questions` — public, returns `[]` on DB error (safe before migration applied)
- Added `POST /api/services/:id/questions` — admin-only, Zod-validated via `insertServiceBookingQuestionSchema`
- Added `PATCH /api/services/:id/questions/:questionId` — admin-only, partial schema validation
- Added `DELETE /api/services/:id/questions/:questionId` — admin-only
- Threaded `cartItem.questionAnswers` into `bookingItemsData.push()` in bookings.ts cartItem loop

## Commits

| Hash | Description |
|------|-------------|
| `4d9aa38` | feat(26-02): add IStorage methods for serviceBookingQuestions; extend schema + createBooking |
| `710a4ae` | feat(26-02): add questions sub-routes to catalog.ts; thread questionAnswers in bookings.ts |

## Deviations from Plan

### Auto-added: Schema types (Rule 3 — blocking issue)

- **Found during:** Task 1 setup
- **Issue:** Plan 01 runs in parallel in a separate worktree; `shared/schema.ts` in this worktree lacked `serviceBookingQuestions`, `QuestionAnswer`, `insertServiceBookingQuestionSchema`, and `questionAnswers` on `bookingItems`/`cartItemSchema`. TypeScript compilation would fail without them.
- **Fix:** Added all schema types from the Plan 01 parallel agent's worktree (`agent-ad615326b1eea2c2f`), matching exactly what Plan 01 produces. These will be identical on merge.
- **Files modified:** `shared/schema.ts`
- **Commit:** `4d9aa38`

## Known Stubs

None. All data paths are fully wired. The `questions` array in `GET /api/services/:id` returns `[]` before the migration is applied (graceful degradation, not a stub).

## Self-Check: PASSED

- `server/storage.ts` — `getServiceBookingQuestions` found at lines 170, 694
- `server/routes/catalog.ts` — questions routes at lines 431, 441, 457, 470
- `server/routes/bookings.ts` — `questionAnswers: cartItem.questionAnswers` at line 91
- Commits `4d9aa38` and `710a4ae` verified in `git log`
- `npm run check` — only pre-existing errors in `server/index.ts` (express-rate-limit types + implicit any params); no new errors introduced
