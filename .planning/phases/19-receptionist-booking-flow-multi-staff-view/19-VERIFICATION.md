---
phase: 19-receptionist-booking-flow-multi-staff-view
verified: 2026-04-30T19:00:00Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "By Staff view — column layout and slot pre-fill"
    expected: "Clicking 'By Staff' switches to Day view with one column per visible staff member; clicking a slot in a column opens Quick Book with that staff member's name in the header and staffMemberId pre-filled"
    why_human: "DOM rendering of RBC resource columns requires a live browser; can't verify column count or slot pre-fill without running the app"
  - test: "Quick Book modal — 30-second walk-in flow"
    expected: "From By Staff view, clicking a slot opens Quick Book; typing 'Walk-in' + selecting a service + clicking Book creates a booking in under 30 seconds with status=confirmed and no phone required"
    why_human: "Form interaction, mutation firing, and modal close/open transition require a live browser session"
  - test: "Drag-to-reassign with undo toast"
    expected: "Dragging an appointment from one staff column to another fires PUT /api/bookings/:id with new staffMemberId; a toast with 'Undo' appears; clicking Undo fires a second PUT restoring original values"
    why_human: "Drag-and-drop requires a browser; undo toast 5-second timer is not verifiable programmatically"
  - test: "GCal busy block drag blocked"
    expected: "Attempting to drag a busy block (isGcalBusy=true event) does nothing — no network call fires"
    why_human: "Requires live GCal integration data or mock GCal event in the browser"
  - test: "Customer booking step 3 — per-staff availability badges"
    expected: "On a multi-staff site, slot buttons show staff first-name badges below the time label; on a single-staff site, slot buttons show only the time (no regression)"
    why_human: "Requires live DB with >1 staff member and availability data; badge rendering is a visual check"
---

# Phase 19: Receptionist Booking Flow & Multi-Staff View — Verification Report

**Phase Goal:** A receptionist at a barbershop, salon, or spa can run the daily booking floor from a single screen — see every staff member's schedule in parallel, book walk-ins in seconds without leaving the calendar, reassign appointments between staff with a drag, and the customer-facing booking flow shows per-staff availability.
**Verified:** 2026-04-30T19:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #   | Truth                                                                                                      | Status      | Evidence                                                                                                                                        |
|-----|------------------------------------------------------------------------------------------------------------|-------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| 1   | Admin calendar has "By Staff" view with every active staff member as a parallel vertical column            | ✓ VERIFIED  | `isByStaff` state at line 398; `resourceProps` spread with `resources: visibleStaffForResources` at line 938–944; `DnDCalendar` at line 1098    |
| 2   | Quick Book creates a booking from multi-staff view in ≤30 seconds (name + service = booked)               | ✓ VERIFIED  | `QuickBookModal.tsx` fully implemented; `quickBookMutation` POSTs to `/api/bookings` then PUTs status=confirmed; `isQuickBook` conditional wired |
| 3   | Drag-and-drop moves appointment between staff; booking record updated; 5-second undo window               | ✓ VERIFIED  | `handleEventDrop` at line 830; `reassignMutation` at line 747; `ToastAction` undo at line 868 with `duration: 5000`                             |
| 4   | Customer-facing booking flow shows which staff are available for each time slot                            | ✓ VERIFIED  | `useQueries` at line 82 of BookingPage.tsx; `staffBySlot` map at line 104; staff badges rendered at line 466–481                               |
| 5   | Bookings query polls every 30 seconds                                                                      | ✓ VERIFIED  | `refetchInterval: 30_000` at line 441 of AppointmentsCalendarSection.tsx                                                                        |

**Score:** 5/5 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact                                                        | Provides                                                                       | Status     | Details                                                                                                             |
|-----------------------------------------------------------------|--------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------------------------|
| `client/src/components/admin/AppointmentsCalendarSection.tsx`  | DnDCalendar HOC, isByStaff state, By Staff toolbar, resourceProps, extended handleSelectSlot | ✓ VERIFIED | `withDragAndDrop` imported at line 3; `DnDCalendar` declared at module scope line 146; `isByStaff` state line 398 |

### Plan 02 Artifacts

| Artifact                                                        | Provides                                        | Status     | Details                                                                                          |
|-----------------------------------------------------------------|-------------------------------------------------|------------|--------------------------------------------------------------------------------------------------|
| `server/storage.ts`                                             | updateBooking with staffMemberId support        | ✓ VERIFIED | `staffMemberId: number \| null` at line 784 inside `updateBooking` Partial type                  |
| `client/src/components/admin/AppointmentsCalendarSection.tsx`  | handleEventDrop, reassignMutation, undo toast   | ✓ VERIFIED | `reassignMutation` line 747; `handleEventDrop` line 830; `onEventDrop={handleEventDrop as any}` line 1101 |

### Plan 03 Artifacts

| Artifact                                                        | Provides                                             | Status     | Details                                                                                         |
|-----------------------------------------------------------------|------------------------------------------------------|------------|-------------------------------------------------------------------------------------------------|
| `client/src/components/admin/QuickBookModal.tsx`               | Quick Book modal component                            | ✓ VERIFIED | File exists; `quickBookSchema` at line 77; `QuickBookModal` named export at line 123            |
| `client/src/components/admin/AppointmentsCalendarSection.tsx`  | QuickBookModal import + isQuickBook conditional render | ✓ VERIFIED | `import { QuickBookModal }` at line 76; conditional at line 1224; `onOpenFullForm` at line 1235  |

### Plan 04 Artifacts

| Artifact                                   | Provides                          | Status     | Details                                                                                         |
|--------------------------------------------|-----------------------------------|------------|-------------------------------------------------------------------------------------------------|
| `client/src/pages/BookingPage.tsx`         | per-staff availability via useQueries | ✓ VERIFIED | `useQueries` imported at line 13; declaration at line 82; `staffBySlot` map at line 104         |

---

## Key Link Verification

| From                        | To                          | Via                                              | Status     | Details                                                                                                  |
|-----------------------------|-----------------------------|--------------------------------------------------|------------|----------------------------------------------------------------------------------------------------------|
| CalendarToolbar             | isByStaff state             | `onByStaff` callback sets isByStaff              | ✓ WIRED    | Lines 259–273: `onByStaff && <button onClick={() => onByStaff(!isByStaff)}>By Staff</button>`          |
| DnDCalendar                 | resourceProps               | spread operator when isByStaff                   | ✓ WIRED    | Line 1099: `<DnDCalendar {...resourceProps} ...>`; resourceProps is `{}` when `!isByStaff`              |
| handleEventDrop             | PUT /api/bookings/:id       | reassignMutation.mutate                          | ✓ WIRED    | Line 855: `reassignMutation.mutate({id: event.bookingId, ...})`                                        |
| PUT /api/bookings/:id       | storage.updateBooking       | server route (unchanged)                         | ✓ WIRED    | `staffMemberId: number \| null` at storage.ts line 784; Drizzle spreads updates into SET clause        |
| QuickBookModal              | POST /api/bookings          | quickBookMutation.mutate                         | ✓ WIRED    | QuickBookModal.tsx line 237; payload includes staffMemberId, cartItems, paymentMethod='site'            |
| AppointmentsCalendarSection | QuickBookModal              | newBookingSlot.isQuickBook conditional           | ✓ WIRED    | Line 1224: `{newBookingSlot?.isQuickBook && <QuickBookModal ...>}`                                      |
| BookingPage step 3 slot rendering | perStaffAvailability  | perStaffAvailability[i].data for staffList[i]    | ✓ WIRED    | Lines 104–116: staffBySlot map built from perStaffAvailability; line 453: `staffBySlot.get(slot.time)` |
| useQueries                  | /api/availability           | queryFn per staff member                         | ✓ WIRED    | Line 93: `fetch(\`/api/availability?${params}\`)`  with staffId param                                  |

---

## Data-Flow Trace (Level 4)

| Artifact                          | Data Variable      | Source                         | Produces Real Data | Status      |
|-----------------------------------|--------------------|--------------------------------|--------------------|-------------|
| AppointmentsCalendarSection       | `allEvents`        | `/api/bookings` (range query)  | DB query in routes.ts | ✓ FLOWING |
| AppointmentsCalendarSection       | `scopedStaffList`  | `/api/staff?includeInactive=true` | DB query         | ✓ FLOWING |
| QuickBookModal                    | `selectableServices` | `/api/services`              | DB query           | ✓ FLOWING |
| QuickBookModal                    | `contactSuggestions` | `/api/contacts?search=...`   | DB query           | ✓ FLOWING |
| BookingPage step 3                | `slots`            | `useAvailability` hook         | DB availability query | ✓ FLOWING |
| BookingPage step 3                | `perStaffAvailability` | `useQueries` per staff      | DB availability query per staff | ✓ FLOWING |

---

## Behavioral Spot-Checks

| Behavior                             | Command                                                                                        | Result                       | Status  |
|--------------------------------------|------------------------------------------------------------------------------------------------|------------------------------|---------|
| DnDCalendar at module scope          | grep "DnDCalendar = withDragAndDrop" AppointmentsCalendarSection.tsx                          | Line 146, outside any function | ✓ PASS |
| refetchInterval 30s on bookings      | grep "refetchInterval: 30_000" AppointmentsCalendarSection.tsx                                | Line 441 in bookings useQuery | ✓ PASS |
| staffMemberId in updateBooking       | grep "staffMemberId: number \| null" server/storage.ts                                        | Line 784                     | ✓ PASS  |
| quickBookMutation fires on submit    | QuickBookModal.tsx onSubmit → quickBookMutation.mutate({..., paymentMethod: 'site'})          | Lines 284–297                | ✓ PASS  |
| useQueries import in BookingPage     | import line 13 in BookingPage.tsx                                                             | `useQueries` in import list  | ✓ PASS  |
| staffBySlot guards staffCount > 1   | grep "staffCount > 1" BookingPage.tsx                                                         | Lines 97, 105, 466           | ✓ PASS  |
| Undo toast duration 5000ms           | grep "duration: 5000" AppointmentsCalendarSection.tsx                                         | Line 882                     | ✓ PASS  |
| Full form Dialog open condition      | grep "!newBookingSlot.isQuickBook" AppointmentsCalendarSection.tsx                            | Line 1243                    | ✓ PASS  |
| isGcalBusy early-return guard        | handleEventDrop line 841: `if (event.isGcalBusy) return;`                                    | Found                        | ✓ PASS  |
| draggableAccessor returns false for busy | line 1100: `draggableAccessor={((event) => !event.isGcalBusy) as any}`                 | Found                        | ✓ PASS  |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                               | Status           | Evidence                                                     |
|-------------|-------------|-----------------------------------------------------------|------------------|--------------------------------------------------------------|
| D-01        | 19-01       | By Staff button in calendar toolbar                       | ✓ SATISFIED      | CalendarToolbar lines 259–273                                |
| D-02        | 19-01       | By Staff view renders one column per staff member         | ✓ SATISFIED      | resourceProps at line 938; spread into DnDCalendar line 1099 |
| D-03        | 19-01       | Horizontal scroll for 5+ staff columns                   | ✓ SATISFIED      | `overflowX: isByStaff ? 'auto' : undefined` line 1096        |
| D-04        | 19-01       | Column slot click pre-fills staffMemberId                 | ✓ SATISFIED      | handleSelectSlot lines 815–827; resourceId coercion line 817  |
| D-05        | 19-03       | Quick Book modal for By Staff slot clicks                 | ✓ SATISFIED      | isQuickBook conditional at line 1224                         |
| D-06        | 19-03       | Two visible fields (name + service); rest under More options | ✓ SATISFIED  | QuickBookModal.tsx lines 327–515; Collapsible at line 450     |
| D-07        | 19-03       | Staff name + time display-only in Quick Book header       | ✓ SATISFIED      | QuickBookModal.tsx lines 313–321                             |
| D-08        | 19-03       | Quick Book submits with status=confirmed, payment=site    | ✓ SATISFIED      | Lines 242–244 (status PUT), line 294 (paymentMethod: 'site') |
| D-09        | 19-03       | Walk-in accepted without phone/email                      | ✓ SATISFIED      | quickBookSchema optional phone; submit line 286: `|| ''`     |
| D-10        | 19-01/02    | 30-second polling on bookings query                       | ✓ SATISFIED      | `refetchInterval: 30_000` line 441                           |
| D-11        | 19-02       | Drag across staff columns updates staffMemberId           | ✓ SATISFIED      | handleEventDrop lines 850–860; resourceId → newStaffId       |
| D-12        | 19-02       | Undo toast with 5-second window after drag                | ✓ SATISFIED      | ToastAction lines 867–883; `duration: 5000`                  |
| D-13        | 19-02       | GCal busy blocks not draggable                            | ✓ SATISFIED      | draggableAccessor line 1100; early-return guard line 841     |
| D-14        | 19-01       | 30-second polling (same as D-10, confirmed)               | ✓ SATISFIED      | Same as D-10                                                 |
| D-15        | 19-04       | per-staff availability queries run in parallel            | ✓ SATISFIED      | useQueries lines 82–101                                      |
| D-16        | 19-04       | Slot buttons show available staff badges                  | ✓ SATISFIED      | Lines 466–481 in BookingPage.tsx                             |
| D-17        | 19-04       | No regression for single-staff sites                      | ✓ SATISFIED      | `staffCount > 1` guards at lines 97, 105, 466               |

---

## Anti-Patterns Found

| File                                     | Line | Pattern               | Severity | Impact                                                                                        |
|------------------------------------------|------|-----------------------|----------|-----------------------------------------------------------------------------------------------|
| None found in phase-modified files       | —    | —                     | —        | All `placeholder` attributes found are legitimate HTML form input hints, not stub indicators  |

No TODO/FIXME/PLACEHOLDER comments found in phase-modified files. No empty handlers or return null stubs found. The `onEventDrop` stub (`() => {}`) noted in Plan 01 was replaced in Plan 02 with `handleEventDrop as any` (line 1101). All mutations POSTing/PUTting real data.

---

## Human Verification Required

All five items require a running browser session against `localhost:5000`. The code is fully wired — these checks verify rendering correctness and interaction behavior that can't be asserted programmatically.

### 1. By Staff Column Layout

**Test:** Open the admin calendar. Click the "By Staff" button in the toolbar.
**Expected:** Day view switches to a multi-column layout with one vertical column per visible staff member. Each column header shows the staff member's first name. Month/Week/Day buttons still work and reset the view to single-column.
**Why human:** RBC resource column rendering requires a live browser; can't verify column headers or visual layout from static analysis.

### 2. Quick Book Modal — 30-second Walk-in Flow

**Test:** With By Staff view active, click on any slot in a staff column. Fill in "Walk-in" as customer name, select any service, click "Book". Measure time from click to modal close.
**Expected:** Quick Book modal opens with the staff member's name and slot time displayed at the top. After submitting, the modal closes, the booking appears on the calendar within the polling interval, and status=confirmed in the DB.
**Why human:** Form interaction, API timing, and visual confirmation require a live session.

### 3. Drag-to-Reassign with Undo Toast

**Test:** In By Staff view, drag an existing appointment from one staff column to another. Then click "Undo" in the toast that appears.
**Expected:** PUT fires with new staffMemberId; toast appears with staff name and time plus "Undo" button; clicking Undo fires a second PUT restoring original staff and time; calendar refreshes both times.
**Why human:** Drag-and-drop interaction, network tab verification, and toast timing require a live browser.

### 4. GCal Busy Block Not Draggable

**Test:** If Google Calendar is connected, verify a "Busy block" event cannot be dragged (cursor does not change to grab, no drag interaction initiates).
**Expected:** Busy blocks are stationary; only real bookings can be dragged.
**Why human:** Requires live GCal sync data; draggableAccessor is correctly wired but visual behavior needs confirmation.

### 5. Customer Booking Step 3 — Per-Staff Badges

**Test:** With 2+ staff members having availability, proceed to step 3 of the customer booking flow. Observe the time slot buttons.
**Expected:** Each slot button that has available staff shows small pill badges with first names below the time. On a single-staff installation, slot buttons show only the time (no badges rendered).
**Why human:** Requires live availability data across multiple staff members; badge rendering is visual.

---

## Gaps Summary

No gaps found. All five observable truths from the ROADMAP success criteria are verified against the codebase:

- Plan 01: DnDCalendar HOC at module scope (line 146), isByStaff state, By Staff toolbar button, resourceProps, handleSelectSlot with resourceId pre-fill, and 30-second polling — all present and wired.
- Plan 02: storage.updateBooking accepts staffMemberId (storage.ts line 784), handleEventDrop fires reassignMutation, undo ToastAction with 5000ms duration — all present and wired.
- Plan 03: QuickBookModal.tsx exists with quickBookSchema, customer type-ahead, service combobox, Collapsible "More options", "Full form →" link, brand yellow submit; wired into AppointmentsCalendarSection by isQuickBook conditional.
- Plan 04: useQueries parallel per-staff availability in BookingPage.tsx, staffBySlot map, staff badges behind staffCount > 1 guard, isSlotsPending extended.

The phase is code-complete. The human_needed status reflects 5 interactive behaviors that require a running browser to verify.

---

_Verified: 2026-04-30T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
