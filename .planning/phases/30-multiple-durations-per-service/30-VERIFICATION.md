---
phase: 30-multiple-durations-per-service
verified: 2026-05-11T00:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 30: Multiple Durations Per Service — Verification Report

**Phase Goal:** Customers can select their preferred service duration during booking, and that selection is accurately reflected in slot availability, pricing, and booking records.
**Verified:** 2026-05-11
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | bookingItems rows can store duration_label TEXT and duration_minutes INTEGER | VERIFIED | `shared/schema.ts` line 505-506; migration `20260511000006_add_duration_snapshot_columns.sql` |
| 2 | recurringBookings rows can store duration_minutes INTEGER (nullable) | VERIFIED | `shared/schema.ts` line 223; migration targets `public.recurring_bookings` |
| 3 | cartItemSchema accepts selectedDurationId without Zod stripping it | VERIFIED | `shared/schema.ts` line 552: `selectedDurationId: z.number().optional()` |
| 4 | getCartItemsForBooking() forwards selectedDurationId to booking API | VERIFIED | `CartContext.tsx` line 240: `selectedDurationId: item.selectedDurationId` |
| 5 | POST /api/bookings resolves chosen ServiceDuration and writes durationLabel + durationMinutes snapshot | VERIFIED | `server/routes/bookings.ts` lines 81-105: resolution loop + push |
| 6 | storage.getServiceDuration(id) exists on IStorage and DatabaseStorage | VERIFIED | `server/storage.ts` lines 170 (interface) + 703-706 (implementation) |
| 7 | Slot availability uses the customer-selected duration (totalDuration from CartContext) | VERIFIED | `BookingPage.tsx` line 83: `useAvailability(selectedDate, totalDuration, ...)`; CartContext totalDuration = `items.reduce(sum + item.durationMinutes * quantity)` |
| 8 | Duration card selection overrides item.durationMinutes in CartContext | VERIFIED | `BookingPage.tsx` lines 434-438: `updateItem` sets `service.durationMinutes` and `selectedDurationId` |
| 9 | createRecurringBooking captures chosenDurationMinutes from bookingItemsData | VERIFIED | `server/routes/bookings.ts` lines 164 + 178: `chosenDurationMinutes` resolved and passed |
| 10 | Recurring generator reads sub.durationMinutes with catalog fallback | VERIFIED | `server/services/recurring-booking-generator.ts` line 80: `sub.durationMinutes ?? service.durationMinutes` |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260511000006_add_duration_snapshot_columns.sql` | ALTER TABLE migration for booking_items and recurring_bookings | VERIFIED | Contains `ADD COLUMN IF NOT EXISTS duration_label TEXT` and `ADD COLUMN IF NOT EXISTS duration_minutes INTEGER` for both tables |
| `shared/schema.ts` | Drizzle columns for bookingItems + recurringBookings; cartItemSchema with selectedDurationId | VERIFIED | Lines 505-506 (bookingItems), 223 (recurringBookings), 552 (cartItemSchema) |
| `server/storage.ts` | getServiceDuration(id) on IStorage interface + DatabaseStorage | VERIFIED | Lines 170 (interface declaration) + 703-706 (implementation with `db.select().from(serviceDurations).where(eq(...))`) |
| `server/routes/bookings.ts` | Duration resolution loop + durationLabel/durationMinutes in bookingItemsData; chosenDurationMinutes capture for recurring | VERIFIED | Lines 81-105 (resolution), 164+178 (recurring capture) |
| `client/src/context/CartContext.tsx` | selectedDurationId forwarded in getCartItemsForBooking; totalDuration reflects selected duration | VERIFIED | Line 240 (selectedDurationId), lines 222-224 (totalDuration calculation) |
| `server/services/recurring-booking-generator.ts` | sub.durationMinutes ?? service.durationMinutes | VERIFIED | Line 80 — old hardcoded `service.durationMinutes` replaced |
| `client/src/components/admin/services/ServiceForm.tsx` | Admin duration CRUD UI (DUR-01/DUR-02) | VERIFIED | Full CRUD: fetch, add, save, delete on `/api/services/:id/durations` |
| `server/routes/catalog.ts` | Admin duration CRUD API endpoints (DUR-01/DUR-02) | VERIFIED | GET, POST, PATCH, DELETE routes at `/api/services/:id/durations` |
| `client/src/pages/BookingPage.tsx` | Duration selection cards before calendar; slot query uses totalDuration | VERIFIED | Lines 396-444 (cards); line 83 (useAvailability with totalDuration) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CartContext.tsx getCartItemsForBooking` | `server/routes/bookings.ts cartItemSchema.parse` | selectedDurationId in POST body | WIRED | Line 240 sends `selectedDurationId: item.selectedDurationId`; cartItemSchema line 552 accepts it |
| `server/routes/bookings.ts bookingItemsData` | `storage.createBooking` bookingItems insert | durationLabel + durationMinutes fields in push call | WIRED | Lines 104-105 push `durationLabel` and `durationMinutes: resolvedDurationMinutes` |
| `server/routes/bookings.ts createRecurringBooking call` | `recurringBookings.durationMinutes DB column` | `durationMinutes: chosenDurationMinutes` argument | WIRED | Lines 164 + 178 |
| `server/services/recurring-booking-generator.ts` | `sub.durationMinutes` | `const durationMinutes = sub.durationMinutes ?? service.durationMinutes` | WIRED | Line 80 confirmed; old bug `= service.durationMinutes` removed |
| `BookingPage.tsx duration card selection` | `CartContext totalDuration` | `updateItem({ service: { durationMinutes }, selectedDurationId })` | WIRED | Line 434-438 calls updateItem; CartContext.updateItem spreads service override into item |
| `CartContext totalDuration` | `availability API totalDurationMinutes` | `useAvailability(selectedDate, totalDuration, ...)` | WIRED | BookingPage line 83 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `BookingPage.tsx` duration cards | `selectedDurations[svc.id]` | `/api/services/:id` (includes durations array from `storage.getServiceDurations`) | Yes — DB query via `catalog.ts` lines 254-258 | FLOWING |
| `BookingPage.tsx` slot calendar | `slots` via `useAvailability` | `/api/availability?totalDurationMinutes=N` — reads from `CartContext.totalDuration` which reflects chosen `item.durationMinutes` | Yes — real slot engine called with selected duration | FLOWING |
| `server/routes/bookings.ts` durationLabel | `chosenDuration.label` | `storage.getServiceDuration(cartItem.selectedDurationId)` → DB row | Yes — single-row select from `serviceDurations` | FLOWING |
| `recurring-booking-generator.ts` durationMinutes | `sub.durationMinutes` | `recurringBookings` row read from DB by generator | Yes — `durationMinutes` from DB row or catalog fallback | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running server/browser to verify slot filtering behavior interactively. Items requiring human verification documented below.

---

### Requirements Coverage

| Requirement | Description | Source Plan | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DUR-01 | Admin configura múltiplas durações (label, minutos, preço, ordem) | Pre-existing; confirmed in Plans 01-03 PLAN notes | SATISFIED | `ServiceForm.tsx` + `catalog.ts` CRUD endpoints `/api/services/:id/durations` |
| DUR-02 | Admin adiciona, remove e reordena durações na tela de editar serviço | Pre-existing; confirmed in Plans 01-03 PLAN notes | SATISFIED | `ServiceForm.tsx` handleAddDuration, handleSaveDuration, handleDeleteDuration; `catalog.ts` POST/PATCH/DELETE routes |
| DUR-03 | Cliente vê cards de duração antes do calendário quando o serviço tem durações | Pre-existing; confirmed in Plan 02 | SATISFIED | `BookingPage.tsx` lines 396-444: duration cards rendered for services with `.durations.length > 0` |
| DUR-04 | Slot de disponibilidade usa duração selecionada pelo cliente | Plan 02 (CartContext totalDuration) | SATISFIED | `CartContext` computes `totalDuration` from `item.durationMinutes`; `BookingPage` passes it as `totalDurationMinutes` to `/api/availability` |
| DUR-05 | Duração selecionada fica em snapshot no bookingItem | Plans 01 + 02 | SATISFIED | Migration adds columns; `cartItemSchema` includes `selectedDurationId`; booking route writes `durationLabel` + `durationMinutes` to bookingItemsData |
| DUR-06 | Recurring subscriptions preservam duração escolhida | Plans 01 + 03 | SATISFIED | `recurringBookings.durationMinutes` column; `chosenDurationMinutes` captured in booking route; generator reads `sub.durationMinutes ?? service.durationMinutes` |

**Orphaned requirements:** None. All 6 DUR-01 through DUR-06 requirements are mapped to Phase 30 plans and verified in code.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | — | — | — |

No stub patterns, TODO/FIXME markers, empty handlers, or hardcoded empty data found in Phase 30 modified files. The `??` null-coalescing fallback in the generator (`sub.durationMinutes ?? service.durationMinutes`) is intentional backward-compatible design, not a stub.

---

### Human Verification Required

#### 1. Duration Card UI Renders Correctly

**Test:** Navigate to BookingPage with a service that has multiple durations configured. Verify duration selection cards appear before the calendar with correct labels, time display, and prices.
**Expected:** Each duration card shows label, formatted duration (e.g. "2h — $120.00"), is selectable, and the "Continue to Schedule" button is disabled until all services have a duration selected.
**Why human:** UI rendering and interactive state cannot be verified programmatically.

#### 2. Slot Availability Reflects Selected Duration

**Test:** On BookingPage, select a 4-hour duration for a service that defaults to 2 hours. Confirm the calendar shows different available slots than with the 2-hour default.
**Expected:** Slots reflect the 4-hour block requirement — fewer or different slots available compared to 2-hour selection.
**Why human:** Requires live server, real availability data, and visual comparison.

#### 3. Booking Record Stores Duration Snapshot

**Test:** Complete a booking with a non-default duration selected. Query the `booking_items` table for the created row.
**Expected:** `duration_label` and `duration_minutes` columns are populated with the values from the chosen ServiceDuration (not NULL, not service catalog default).
**Why human:** Requires DB access and a completed booking flow.

#### 4. Recurring Booking Generator Uses Snapshot Duration

**Test:** Create a recurring booking with a non-default duration. Allow the generator to run (or trigger it manually). Inspect a generated future instance.
**Expected:** Generated instance has `totalDurationMinutes` and `endTime` consistent with the snapshot duration, not the catalog default.
**Why human:** Requires live recurring generator execution and DB inspection.

---

### Gaps Summary

No gaps found. All 10 observable truths are verified with concrete code evidence. All 6 DUR requirements have implementation evidence across Plans 01, 02, and 03. All commits (a68e41e, 6bc4d87, 8304871, 0668486, e05befc, 74b7b4e) confirmed in git log. TypeScript type-check and build reported green at plan completion.

---

_Verified: 2026-05-11_
_Verifier: Claude (gsd-verifier)_
