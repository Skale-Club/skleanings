---
phase: 25-multiple-time-slots-per-day
verified: 2026-05-11T00:00:00Z
status: human_needed
score: 10/11 must-haves verified
re_verification: false
human_verification:
  - test: "Open Staff management, edit a staff member, go to Availability tab — confirm existing single range loads correctly and UI is not blank/broken"
    expected: "Existing single-range row appears in the per-day card with correct start/end times"
    why_human: "React component rendering requires a browser; cannot verify DOM output programmatically"
  - test: "On any day, click 'Add range' — confirm a second time row appears below the first"
    expected: "A new row with default 09:00–17:00 appears immediately without page reload"
    why_human: "Client-side state update (setDays) requires browser interaction"
  - test: "Set first range to 08:00–12:00, second to 14:00–17:00, click Save — confirm success toast and persistence after dialog close/reopen"
    expected: "Both ranges survive a round-trip through the API and reload correctly"
    why_human: "Requires live DB connection + browser session"
  - test: "Book a service on a day with two ranges (e.g. 08:00–12:00 and 14:00–17:00) in the customer booking flow"
    expected: "No slots appear between 12:00 and 14:00 — the gap is respected"
    why_human: "Slot generation behavior depends on live availability data and booking flow UI"
---

# Phase 25: Multiple Time Slots Per Day — Verification Report

**Phase Goal:** Staff daily availability supports multiple non-overlapping time ranges so slots are only offered during configured windows with gaps respected.
**Verified:** 2026-05-11
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | Migration file exists with `ADD COLUMN IF NOT EXISTS range_order INTEGER NOT NULL DEFAULT 0` | VERIFIED | File present at `supabase/migrations/20260511000000_add_staff_availability_range_order.sql`; exact SQL confirmed on line 8 |
| 2  | Migration includes composite index `staff_availability_staff_day_order_idx` | VERIFIED | Line 11-12 of migration file; `CREATE INDEX IF NOT EXISTS` with idempotent guard |
| 3  | `shared/schema.ts` staffAvailability table includes `rangeOrder` field | VERIFIED | Line 930: `rangeOrder: integer("range_order").notNull().default(0)` |
| 4  | `getStaffAvailability` orders by `dayOfWeek ASC, rangeOrder ASC` | VERIFIED | `server/storage.ts` lines 1737–1739: `.orderBy(asc(staffAvailability.dayOfWeek), asc(staffAvailability.rangeOrder))` |
| 5  | `availabilityItemSchema` includes `rangeOrder` with `.default(0)` | VERIFIED | `server/routes/staff.ts` line 16: `rangeOrder: z.number().int().min(0).default(0)` |
| 6  | PUT endpoint validates non-overlapping ranges and returns 400 on conflict | VERIFIED | Lines 222–236 of `server/routes/staff.ts`: day-grouped overlap check with `sorted[i].endTime > sorted[i+1].startTime` guard |
| 7  | `getStaffAvailableSlots` uses `.filter()` (not `.find()`) to collect all day ranges | VERIFIED | `server/lib/staff-availability.ts` lines 134–135: `.filter((a) => a.dayOfWeek === dayOfWeek && a.isAvailable)` |
| 8  | DB calls (bookings + busy times) are hoisted outside the range loop via `Promise.all` | VERIFIED | Lines 141–144: `Promise.all([storage.getBookingsByDateAndStaff(...), getStaffBusyTimes(...)])` before the `for..of dayRecords` loop |
| 9  | `_generateSlots` accepts `prefetchedBookings` and `prefetchedBusyTimes` to avoid N+1 | VERIFIED | Lines 28–29 of `SlotGenOptions` interface; lines 40–45 use `??` fallback pattern |
| 10 | `StaffManageDialog` uses `DayState[]` + `RangeEntry[]` state; `AvailabilityRow` removed | VERIFIED | Interfaces at lines 24–32; `useState<DayState[]>` at line 329; no `AvailabilityRow` match in file |
| 11 | Save payload uses `days.flatMap(...)` producing `rangeOrder` field per range | VERIFIED | Lines 357–374: `flatMap` produces `{ dayOfWeek, isAvailable, startTime, endTime, rangeOrder }` objects; PUT call at line 375 |

**Score:** 11/11 truths verified in code — browser UAT (Task 3 checkpoint) pending human verification.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260511000000_add_staff_availability_range_order.sql` | Non-destructive ALTER TABLE adding range_order + composite index | VERIFIED | Exact SQL present; `ADD COLUMN IF NOT EXISTS` idempotent guard; no UNIQUE constraint |
| `shared/schema.ts` | staffAvailability table with rangeOrder column | VERIFIED | Line 930 adds `rangeOrder: integer("range_order").notNull().default(0)` |
| `server/storage.ts` | getStaffAvailability ordered by dayOfWeek + rangeOrder | VERIFIED | Lines 1737–1739 confirm dual `.orderBy()` |
| `server/routes/staff.ts` | availabilityItemSchema with rangeOrder; overlap validation | VERIFIED | Line 16 (schema); lines 222–236 (overlap guard returning 400) |
| `server/lib/staff-availability.ts` | .filter() loop, hoisted DB calls, _generateSlots accepts prefetched data | VERIFIED | All patterns confirmed at lines 28–29, 134–136, 141–160 |
| `client/src/components/admin/StaffManageDialog.tsx` | DayState[], RangeEntry[], add/remove buttons, flatMap payload | VERIFIED | All structures present; `Add range` button at line 492; trash guard at line 457 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `shared/schema.ts` staffAvailability table | `server/storage.ts` StaffAvailability type | `typeof staffAvailability.$inferSelect` | WIRED | `rangeOrder` column at line 930 auto-infers into the TypeScript type |
| `migration` range_order column | `public.staff_availability` table | `ALTER TABLE ADD COLUMN` | WIRED | SQL present; applied via Supabase CLI at deploy time |
| `server/routes/staff.ts` PUT /:id/availability | `server/storage.ts` setStaffAvailability | `storage.setStaffAvailability(id, availability)` | WIRED | Line 238 of routes/staff.ts |
| `server/lib/staff-availability.ts` getStaffAvailableSlots | `storage.getBookingsByDateAndStaff` | hoisted `Promise.all` before range loop | WIRED | Lines 141–143 confirm single fetch before loop |
| `server/lib/staff-availability.ts` getStaffAvailableSlots | `_generateSlots` | `for..of dayRecords` loop | WIRED | Lines 147–158: loop calls `_generateSlots` once per range |
| `AvailabilityTab useEffect` | `DayState[]` state | `setDays(next)` mapping server rows grouped by day | WIRED | Lines 338–352: filter+sort per dayOfWeek, then `setDays(next)` |
| save mutation | PUT /api/staff/:id/availability | `days.flatMap(...)` with rangeOrder | WIRED | Lines 357–375: flatMap produces correct payload; `apiRequest('PUT', ...)` at line 375 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `StaffManageDialog.tsx` AvailabilityTab | `days` (DayState[]) | `useEffect` maps `availability` from server query | Yes — populated from API response via filter+sort | FLOWING |
| `staff-availability.ts` getStaffAvailableSlots | `dayRecords` | `storage.getStaffAvailability(staffMemberId)` DB query | Yes — real DB select ordered by dayOfWeek + rangeOrder | FLOWING |
| `staff-availability.ts` _generateSlots | `existingBookings` | `prefetchedBookings ?? storage.getBookingsByDateAndStaff(...)` | Yes — real DB query or prefetched value | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles phase-relevant files without error | `npm run check 2>&1 \| grep "staff\|schema\|StaffManage"` | No errors in phase files | PASS |
| rangeOrder field in schema | `grep -n "rangeOrder" shared/schema.ts` | Line 930 confirmed | PASS |
| Overlap guard in route | `grep "not overlap" server/routes/staff.ts` | Line 233 confirmed | PASS |
| .filter() replaces .find() in weekly path | `grep "availability.find" server/lib/staff-availability.ts` | No matches | PASS |
| Browser UAT (multi-range save + booking gap) | Manual browser test | Not run | SKIP (human needed) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| SLOTS-01 | 25-01, 25-02 | Staff availability supports multiple time ranges per day | SATISFIED | schema rangeOrder + storage orderBy + filter loop + N+1 fix all verified |
| SLOTS-02 | 25-03 | Admin can add, remove, and reorder time ranges per day | SATISFIED (code) | DayState[], add/remove buttons, flatMap payload all present; browser UAT pending |
| SLOTS-03 | 25-02 | Booking slot generation respects all ranges — no slots during gaps | SATISFIED (code) | .filter() loop + allSlots Set union ensures only within-range slots are generated; booking gap behavior needs browser UAT |
| SLOTS-04 | 25-01 | Migration preserves existing single-range data without loss | SATISFIED | `ADD COLUMN IF NOT EXISTS` with `DEFAULT 0`; no UNIQUE constraint; existing rows get rangeOrder=0 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `StaffManageDialog.tsx` | 270 | `placeholder="e.g. Holiday..."` | Info | HTML input placeholder in DateOverridesTab — unrelated to phase 25, not a stub |

No blockers or warnings found in phase 25 files.

---

### Human Verification Required

#### 1. Single-Range Regression Check

**Test:** Open Staff management in the browser, edit an existing staff member that has one availability range per day, go to the Availability tab.
**Expected:** Each day shows its existing single range (correct start/end times) in the new per-day card layout without blank rows or JS errors.
**Why human:** React DOM rendering of mapped state requires a browser session.

#### 2. Add Range Interaction

**Test:** On any available day, click the "Add range" button.
**Expected:** A second time-range row (defaulting to 09:00–17:00) appears immediately below the first, with its own start/end inputs and a trash icon.
**Why human:** Client-side `setDays` state update requires browser interaction.

#### 3. Save and Reload Persistence

**Test:** Set Monday to two non-overlapping ranges (e.g., 08:00–12:00 and 14:00–17:00), click Save, close the dialog, reopen it.
**Expected:** Success toast on save; both ranges appear after reopening (round-trip persistence).
**Why human:** Requires live DB write + re-fetch through the API.

#### 4. Booking Flow Gap Enforcement

**Test:** Book a service on the day configured with two ranges (08:00–12:00 and 14:00–17:00) in the customer-facing booking flow.
**Expected:** No time slots are shown between 12:00 and 14:00. Slots before 12:00 and from 14:00 onwards are available.
**Why human:** End-to-end slot generation depends on live availability data and the booking calendar UI.

---

### Gaps Summary

No code gaps found. All 11 observable truths are verified in the codebase:

- Migration SQL is correct and idempotent
- Schema includes `rangeOrder`
- Storage orders by `dayOfWeek + rangeOrder`
- Route validates non-overlapping ranges and returns 400 on conflict
- Slot generation iterates all day ranges via `.filter()` loop with hoisted DB calls
- Frontend uses `DayState[]` state, add/remove buttons, and `flatMap` payload with `rangeOrder`

The only outstanding items are browser-side UAT checks (Task 3 of Plan 25-03), which were pre-designated as human checkpoints and do not constitute code gaps.

---

_Verified: 2026-05-11_
_Verifier: Claude (gsd-verifier)_
