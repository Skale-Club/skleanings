---
phase: 26-custom-booking-questions
verified: 2026-05-11T11:16:51Z
status: human_needed
score: 11/11 automated must-haves verified
re_verification: false
human_verification:
  - test: "Admin opens service edit form, opens Booking Questions collapsible, adds a question with type Select and options, marks Required, saves — question appears in list with badge count"
    expected: "Question saved via POST /api/services/:id/questions, returned in list, badge shows 1"
    why_human: "Browser interaction required; fetch + state update only verifiable in running browser"
  - test: "Admin edits an existing question (change label, click Save) — PATCH /api/services/:id/questions/:qId called, updated label persists on reload"
    expected: "PATCH returns 200 with updated question; page reload shows new label"
    why_human: "Network call + persistence only verifiable in browser"
  - test: "Admin deletes a question — question disappears immediately from list"
    expected: "DELETE /api/services/:id/questions/:qId returns 200; setBookingQuestions filter removes row"
    why_human: "DOM mutation requires browser"
  - test: "Customer adds a service with questions to cart, proceeds to step 4 — question fields appear below phone field with asterisk on required fields"
    expected: "serviceDetailsQueries returns questions from GET /api/services/:id; step 4 renders fields grouped by service"
    why_human: "React Query + step rendering requires browser"
  - test: "Customer leaves a required question blank and clicks Continue to Address — inline error appears, page does NOT advance to step 5"
    expected: "setQuestionErrors populates errors map; Object.keys(errors).length > 0 triggers early return"
    why_human: "Button click + error rendering requires browser"
  - test: "Customer fills answers and completes booking — in Admin > Bookings, expand the new booking item and see question label:answer pairs"
    expected: "bookingItems.question_answers JSONB populated; SharedBookingCard renders qa.label + qa.answer"
    why_human: "Full e2e flow including DB write and admin UI requires browser + running server + applied migrations"
---

# Phase 26: Custom Booking Questions Verification Report

**Phase Goal:** Admins can attach service-specific intake questions that customers answer during checkout, with answers stored on the booking record.
**Verified:** 2026-05-11T11:16:51Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | service_booking_questions table exists in DB schema with id, service_id, label, type, options (JSONB), required, order columns | VERIFIED | Migration 20260511000001 has CREATE TABLE with all 7 columns; IF NOT EXISTS guard present |
| 2  | booking_items table has question_answers JSONB column | VERIFIED | Migration 20260511000002 has ALTER TABLE ADD COLUMN IF NOT EXISTS question_answers JSONB |
| 3  | serviceBookingQuestions Drizzle table, ServiceBookingQuestion type, InsertServiceBookingQuestion type, insertServiceBookingQuestionSchema exported from shared/schema.ts | VERIFIED | schema.ts lines 120-132 export all four |
| 4  | cartItemSchema includes questionAnswers field so Zod does not strip answers | VERIFIED | schema.ts lines 492-497; cartItemSchema embedded in insertBookingSchemaBase at line 512 |
| 5  | QuestionAnswer interface exported from shared/schema.ts with questionId, label, type, answer fields | VERIFIED | schema.ts lines 431-436 |
| 6  | GET /api/services/:id returns questions array alongside durations | VERIFIED | catalog.ts line 254-258: Promise.all with getServiceBookingQuestions; returns { ...service, durations, questions } |
| 7  | GET/POST/PATCH/DELETE /api/services/:id/questions routes exist in catalog.ts | VERIFIED | catalog.ts lines 431, 441, 457, 470 — all four routes registered |
| 8  | IStorage has 4 serviceBookingQuestions methods declared and implemented | VERIFIED | storage.ts lines 170-173 (interface), 694-720 (implementation) |
| 9  | questionAnswers threaded from cartItem through bookings.ts into bookingItemsData and storage createBooking insert | VERIFIED | bookings.ts line 91; storage.ts line 766 |
| 10 | Admin ServiceForm has Booking Questions collapsible with full CRUD | VERIFIED | ServiceForm.tsx: showBookingQuestions state (line 114), useEffect fetch (line 143), section behind service?.id guard (line 532), add/save/delete wired to API |
| 11 | BookingPage step 4 has dynamic question fields, required validation, and answer payload assembly; SharedBookingCard displays answers | VERIFIED | BookingPage.tsx: questionAnswers state (line 61), allRequiredAnswered (line 147), required blocking (line 769), payload assembly (lines 271-287); SharedBookingCard.tsx lines 434-443 |

**Score:** 11/11 automated truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260511000001_add_service_booking_questions.sql` | CREATE TABLE with FK, index, IF NOT EXISTS | VERIFIED | All columns correct; IF NOT EXISTS on both TABLE and INDEX |
| `supabase/migrations/20260511000002_add_booking_item_question_answers.sql` | ALTER TABLE ADD COLUMN JSONB | VERIFIED | Correct SQL with IF NOT EXISTS guard |
| `shared/schema.ts` | serviceBookingQuestions table, QuestionAnswer interface, questionAnswers on bookingItems, cartItemSchema extended | VERIFIED | All four additions present at lines 120-132, 431-436, 453, 492-497 |
| `server/storage.ts` | 4 IStorage methods + implementations + createBooking persistence | VERIFIED | Interface at lines 170-173; implementations at 694-720; questionAnswers insert at line 766 |
| `server/routes/catalog.ts` | GET/POST/PATCH/DELETE /api/services/:id/questions + GET includes questions | VERIFIED | 4 sub-routes at lines 431-474; GET /:id extended at lines 254-258 |
| `server/routes/bookings.ts` | questionAnswers forwarded from cartItem into bookingItemsData | VERIFIED | Line 91: `questionAnswers: cartItem.questionAnswers` |
| `client/src/components/admin/services/ServiceForm.tsx` | Booking Questions collapsible with CRUD | VERIFIED | showBookingQuestions state, fetch useEffect, full section with add/save/delete |
| `client/src/pages/BookingPage.tsx` | Dynamic question fields in step 4, required validation, payload assembly | VERIFIED | questionAnswers/questionErrors state, allRequiredAnswered, blocking validation, answers merged at submit |
| `client/src/components/admin/shared/SharedBookingCard.tsx` | question answers display in expanded booking items | VERIFIED | Lines 434-443: conditional render of qa.label + qa.answer pairs |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| shared/schema.ts cartItemSchema | insertBookingSchemaBase cartItems array | cartItemSchema embedded at schema.ts line 512 | WIRED | questionAnswers field in cartItemSchema reaches server without being stripped |
| shared/schema.ts bookingItems | migration 20260511000002 | Drizzle column definition mirrors SQL migration | WIRED | Both define question_answers JSONB |
| catalog.ts GET /api/services/:id | storage.getServiceBookingQuestions | Promise.all at line 254-258 | WIRED | questions returned in response body |
| bookings.ts cartItem loop | bookingItemsData.questionAnswers | cartItem.questionAnswers at line 91 | WIRED | Forwarded into push object |
| storage.ts createBooking | bookingItems insert | item.questionAnswers at line 766 | WIRED | Included in tx.insert values |
| BookingPage.tsx questionAnswers state | cartItems payload | getCartItemsForBooking().map at lines 271-287 | WIRED | answers merged per serviceId at onSubmit |
| ServiceForm.tsx | POST /api/services/:id/questions | fetch at line 696 | WIRED | POST call with JSON body on Save Question click |
| SharedBookingCard.tsx | item.questionAnswers | conditional render at line 434 | WIRED | Maps qa.questionId + qa.label + qa.answer |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| ServiceForm.tsx | bookingQuestions | fetch /api/services/:id/questions → storage.getServiceBookingQuestions → DB query | DB SELECT with WHERE service_id = ? ORDER BY order ASC | FLOWING |
| BookingPage.tsx | serviceDetailsQueries[].data.questions | React Query GET /api/services/:id → catalog.ts Promise.all | Real DB queries via getServiceBookingQuestions | FLOWING |
| SharedBookingCard.tsx | item.questionAnswers | bookingItems row from DB (JSONB column populated at booking creation) | Stored via storage.ts createBooking tx.insert | FLOWING — pending migrations applied to DB |

### Behavioral Spot-Checks

Step 7b: SKIPPED — server requires running DB with applied migrations; cannot smoke-test API endpoints without live database. All code paths verified statically above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QUEST-01 | 26-01, 26-02, 26-03 | Admin can attach service-specific intake questions | SATISFIED | Migration + schema + 4 CRUD routes + ServiceForm collapsible all present |
| QUEST-02 | 26-01, 26-02, 26-03 | Admin can manage (add/edit/delete) questions per service | SATISFIED | POST/PATCH/DELETE routes + ServiceForm CRUD UI wired |
| QUEST-03 | 26-02, 26-03 | Customer sees questions during checkout and answers them | SATISFIED | GET /api/services/:id includes questions; BookingPage step 4 renders fields with required validation |
| QUEST-04 | 26-01, 26-02, 26-03 | Answers stored on booking record | SATISFIED | question_answers JSONB column in migration; threadd through bookings.ts → storage.ts → tx.insert |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| server/index.ts | 3, 49, 57 | Pre-existing TS errors (express-rate-limit missing types; implicit any params) | Info | Pre-dates Phase 26 (introduced in security rate-limiting commit `245e051`); not introduced by this phase |

No anti-patterns introduced by Phase 26. TypeScript errors in server/index.ts are pre-existing and out of scope per SUMMARY.md deviations note.

### Human Verification Required

All 6 browser UAT scenarios from Plan 26-03 Task 3 require a running dev server with migrations applied to the database. Task 3 was explicitly deferred as a blocking checkpoint.

#### 1. Admin adds a question (QUEST-01)

**Test:** Go to Admin > Services > edit a service > open "Booking Questions" > click "+ Add Question" > fill label "Do you have pets?", type "Multiple Choice", options "Cat, Dog, None", Required checked > click "Save Question"
**Expected:** Question appears in list; badge count updates to 1; POST /api/services/:id/questions returns 201
**Why human:** Browser interaction + network call + DOM state update

#### 2. Admin updates a question (QUEST-01)

**Test:** Edit the label of the saved question, click "Save" on that row
**Expected:** PATCH /api/services/:id/questions/:qId returns 200; page reload shows updated label
**Why human:** Browser interaction + persistence verification

#### 3. Admin deletes a question (QUEST-02)

**Test:** Click "Delete" on a question row
**Expected:** Question disappears from list immediately (optimistic update)
**Why human:** DOM mutation requires browser

#### 4. Customer sees questions in step 4 (QUEST-03)

**Test:** Add a service with questions to cart > proceed through booking to step 4
**Expected:** Question fields appear below phone field; required fields show asterisk; grouped by service name if multiple services
**Why human:** React Query + multi-step flow requires browser

#### 5. Required validation blocks continuation (QUEST-03)

**Test:** Leave a required question blank > click "Continue to Address"
**Expected:** Inline error message appears under the blank field; page stays on step 4
**Why human:** Button click event + error state rendering requires browser

#### 6. Admin sees answers in booking detail (QUEST-04)

**Test:** Complete a full booking with answers > Admin > Bookings > expand the new booking > expand the service item
**Expected:** Question label and customer answer pairs displayed (e.g., "Do you have pets?: Cat")
**Why human:** Full e2e flow requires applied DB migrations, live server, and browser

### Gaps Summary

No code gaps found. All 11 automated truths are verified — the implementation is complete and fully wired. The only outstanding item is browser UAT (Task 3 checkpoint, explicitly deferred by design in Plan 26-03). The feature cannot be marked fully complete until the 6 UAT scenarios above pass in a browser session with migrations applied.

---

_Verified: 2026-05-11T11:16:51Z_
_Verifier: Claude (gsd-verifier)_
