---
phase: 21-per-service-booking-limits-buffer-time-minimum-notice-time-slot-interval
verified: 2026-05-10T20:00:00Z
status: human_needed
score: 8/8 must-haves verified
human_verification:
  - test: "Admin Booking Rules UI — live form interaction"
    expected: "Four inputs (Buffer Before, Buffer After, Minimum Notice, Slot Interval) are visible after clicking Booking Rules toggle in service edit form; values save correctly; changes take effect on the availability calendar"
    why_human: "Cannot verify DOM rendering, form interactivity, or end-to-end DB round-trip without running the app; checkpoint in Plan 03 was auto-approved rather than manually verified"
---

# Phase 21: Per-Service Booking Limits Verification Report

**Phase Goal:** Add bufferTimeBefore, bufferTimeAfter, minimumNoticeHours, and timeSlotInterval columns to services table. Apply these in getAvailableSlots so booked slots include travel buffer, customers can only book slots at least minimumNoticeHours in the future, and time slots are offered at timeSlotInterval increments. Add admin UI fields in ServiceForm. All columns default to 0/null — zero breaking changes.
**Verified:** 2026-05-10T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | services table has four new columns (buffer_time_before, buffer_time_after, minimum_notice_hours, time_slot_interval) | VERIFIED | Migration SQL at supabase/migrations/20260510000000_add_service_booking_limits.sql; all 4 ALTER TABLE ADD COLUMN IF NOT EXISTS statements present |
| 2 | All four columns have safe defaults (buffer columns NOT NULL DEFAULT 0; time_slot_interval nullable; minimumNoticeHours NOT NULL DEFAULT 0) | VERIFIED | Migration SQL confirms: INTEGER NOT NULL DEFAULT 0 for 3 columns, INTEGER DEFAULT NULL for time_slot_interval |
| 3 | shared/schema.ts Service type includes all four new fields | VERIFIED | Lines 75-78 of schema.ts: bufferTimeBefore, bufferTimeAfter, minimumNoticeHours (integer().default(0).notNull()), timeSlotInterval (integer() nullable) |
| 4 | insertServiceSchema accepts the four new fields without requiring them | VERIFIED | insertServiceSchema uses createInsertSchema(services, ...) which automatically makes fields with defaults optional; no manual exclusion needed |
| 5 | getStaffAvailableSlots applies buffer conflict check and minimum notice cutoff using tzNow | VERIFIED | staff-availability.ts line 54-55: noticeMs = minimumNoticeHours * 60 * 60 * 1000; cutoffTs = tzNow.getTime() + noticeMs. Lines 86-91: occupiedStart/End use shiftHHMM |
| 6 | getSlotsForServices loads limits BEFORE staffId fast-path; slot step = timeSlotInterval ?? durationMinutes | VERIFIED | Lines 152-164 load limits; lines 166-168: if (staffId) fast-path is after limits block; line 59: step = limits?.timeSlotInterval ?? durationMinutes |
| 7 | routes/availability.ts wires limits from primary service to getAvailabilityForDate for no-staff path | VERIFIED | Lines 42-59 of routes/availability.ts: loads primarySvc, builds limits object, passes as 6th arg to getAvailabilityForDate |
| 8 | ServiceForm.tsx has Booking Rules section with 4 inputs; values in onSubmit payload | VERIFIED | Lines 94-99: 5 state vars declared; line 152: all 4 in handleSubmit data literal; lines 333-420: collapsible JSX with 4 inputs |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260510000000_add_service_booking_limits.sql` | ALTER TABLE SQL with 4 columns and IF NOT EXISTS guard | VERIFIED | File exists; all 4 ADD COLUMN IF NOT EXISTS statements present; correct defaults |
| `shared/schema.ts` | Updated services pgTable definition with 4 new Drizzle column defs | VERIFIED | Lines 75-78: bufferTimeBefore, bufferTimeAfter, minimumNoticeHours, timeSlotInterval added inside pgTable |
| `server/lib/staff-availability.ts` | BookingLimits interface, shiftHHMM, updated getStaffAvailableSlots and getSlotsForServices | VERIFIED | All present: interface (line 4), shiftHHMM (line 12), exported; full buffer/notice/interval logic in slot loop |
| `server/lib/availability.ts` | getAvailabilityForDate accepting optional BookingLimits param; same buffer/notice/interval logic | VERIFIED | Imports BookingLimits and shiftHHMM from staff-availability.ts (line 5); limits param on line 35; cutoffTs on line 87; buffer check on lines 113-119 |
| `server/routes/availability.ts` | Loads limits from primary service and passes to getAvailabilityForDate for no-staff day-view path | VERIFIED | Lines 42-59: limits loading and passing in staffCount === 0 branch |
| `client/src/components/admin/services/ServiceForm.tsx` | Booking Rules section with 4 inputs; values in onSubmit | VERIFIED | 5 state vars, collapsible JSX, all 4 fields in handleSubmit data object at line 152 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| supabase/migrations/20260510000000_add_service_booking_limits.sql | public.services | ALTER TABLE ADD COLUMN IF NOT EXISTS | VERIFIED | All 4 ADD COLUMN IF NOT EXISTS statements present with correct names and types |
| shared/schema.ts services pgTable | Service type | typeof services.$inferSelect | VERIFIED | bufferTimeBefore, bufferTimeAfter, minimumNoticeHours, timeSlotInterval defined inside pgTable; Service type is inferred |
| server/routes/availability.ts | server/lib/staff-availability.ts getSlotsForServices | passes parsedServiceIds; getSlotsForServices fetches service records | VERIFIED | Line 61: getSlotsForServices(date, totalDurationMinutes, parsedServiceIds, staffId, { timeZone }) |
| server/lib/staff-availability.ts getStaffAvailableSlots | storage.getService | getSlotsForServices fetches primary service for limits | VERIFIED | Lines 155-163: storage.getService(serviceIds[0]) called before staffId fast-path |
| ServiceForm handleSubmit | onSubmit data object | data.bufferTimeBefore, data.bufferTimeAfter, data.minimumNoticeHours, data.timeSlotInterval | VERIFIED | Line 152: all 4 fields spread into data literal; onSubmit(data) called on line 169 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| server/lib/staff-availability.ts | limits (BookingLimits) | storage.getService(serviceIds[0]) in getSlotsForServices | Yes — reads from DB Service record | FLOWING |
| server/lib/availability.ts | limits (BookingLimits) | storage.getService(parsedServiceIds[0]) in routes/availability.ts | Yes — reads from DB Service record | FLOWING |
| ServiceForm.tsx | bufferTimeBefore/After/minimumNoticeHours/timeSlotInterval | service prop initialized from useState; prop comes from admin API response | Yes — values initialized from service?.fieldName | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| No hardcoded 30-min step remains in availability files | grep -n "m += 30" server/lib/staff-availability.ts server/lib/availability.ts | No matches | PASS |
| cutoffTs uses tzNow not raw new Date() in both files | grep -n "cutoffTs.*new Date()" both files | No matches | PASS |
| noticeMs correctly converts hours to milliseconds (* 60 * 60 * 1000) | grep -n "noticeMs" both files | staff-availability.ts:54 and availability.ts:86 both use * 60 * 60 * 1000 | PASS |
| limits loaded BEFORE staffId fast-path in getSlotsForServices | line ordering in staff-availability.ts | STEP 1 limits block at line 152; if (staffId) at line 167 | PASS |
| timeSlotInterval submits null when input blank | grep setTimeSlotInterval in ServiceForm.tsx | Line 403: val === '' ? null : Number(val) | PASS |
| TypeScript check passes | npm run check | Exit code 0, no output | PASS |
| All 5 documented commit hashes exist in git | git show {hash} --stat | All 5 commits verified: 556eb57, 67f420f, edc7bf7, 3096534, 013a69a | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BOOKING-LIMITS-01 | 21-01 | Schema: 4 new columns on services table with safe defaults | SATISFIED | Migration SQL + schema.ts both verified |
| BOOKING-LIMITS-02 | 21-02 | Backend: availability logic applies buffer/notice/interval | SATISFIED | Both availability files updated; routes wired |
| BOOKING-LIMITS-03 | 21-03 | Admin UI: ServiceForm Booking Rules section | SATISFIED | ServiceForm.tsx verified with all 4 inputs and onSubmit wiring |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| server/lib/staff-availability.ts line 148 | When serviceIds.length === 0 AND staffId provided, early return at line 148 bypasses limits loading (limits are not loaded for this path) | Info | serviceIds.length === 0 means no service context to derive limits from; this is intentional — the empty-serviceIds + staffId path cannot know which limits to apply |

No blocker anti-patterns found. The one noted edge case (serviceIds.length === 0 fast-path) is intentional per the plan design — limits require at least one serviceId to identify which service's limits to apply.

---

### Human Verification Required

#### 1. Admin Booking Rules UI — End-to-End

**Test:** Run `npm run dev`. Open the admin panel, navigate to Services, edit any service. Click the "Booking Rules" toggle button. Confirm four inputs appear: Buffer Before (min), Buffer After (min), Minimum Notice (hours), Slot Interval (min). Set Buffer After = 30, save. Open the booking flow for that service on a date with an existing booking — the slot immediately following the booking should have a 30-minute gap.

**Expected:** Four inputs visible after toggle; values persist after save; buffer gap appears in the booking calendar for affected slots; setting Minimum Notice = 24 hides today's slots within 24 hours; setting Slot Interval = 60 changes slots to appear on the hour only.

**Why human:** Cannot verify DOM rendering, form interactivity, or DB round-trip persistence without running the application. The Plan 03 checkpoint was auto-approved in `--auto` mode rather than verified by a human. The migration also requires manual operator action (`supabase db push` or direct psql) before the new columns exist in the live database — without it, the server will fail on startup when Drizzle tries to read the new columns.

---

### Gaps Summary

No functional gaps found. All 8 observable truths verified against actual code. TypeScript passes clean. All 5 commits exist in git history.

**One pending operator action:** The migration file `supabase/migrations/20260510000000_add_service_booking_limits.sql` must be applied to the database before the new columns are available at runtime. This is expected infrastructure work, not a code gap.

**One item routed to human verification:** The admin Booking Rules UI and full end-to-end booking calendar behavior require a human smoke test since the Plan 03 checkpoint was auto-approved.

---

_Verified: 2026-05-10T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
