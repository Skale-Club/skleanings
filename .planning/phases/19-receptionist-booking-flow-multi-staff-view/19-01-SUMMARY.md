---
phase: 19-receptionist-booking-flow-multi-staff-view
plan: 01
subsystem: ui
tags: [react, react-big-calendar, calendar, drag-and-drop, admin, staff]

# Dependency graph
requires:
  - phase: 14-admin-calendar-create-booking-from-slot
    provides: AppointmentsCalendarSection with booking creation modal and slot handling

provides:
  - DnDCalendar HOC at module scope wrapping react-big-calendar Calendar
  - isByStaff state driving multi-column resource view
  - By Staff toolbar button toggling between standard and resource-column Day view
  - resourceProps (resources/accessors) injected only when isByStaff is true
  - Horizontal scroll container for 5+ staff columns (D-03)
  - handleSelectSlot extended with resourceId for D-04 staff pre-fill
  - 30-second polling on bookings query (D-14)
  - isQuickBook flag on newBookingSlot state for Plan 03

affects:
  - 19-02 (drag-and-drop event rescheduling uses DnDCalendar and onEventDrop stub)
  - 19-03 (Quick Book modal reads isQuickBook from newBookingSlot)
  - 19-04 (conflict detection reads staffMemberId from resourceId pre-fill)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DnDCalendar HOC at module scope (Pitfall 1 — never inside component body)
    - resourceProps as empty spread ({}) for non-resource views (Pitfall 2 fix)
    - handleSelectSlot accepts resourceId?: string | number per RBC SlotInfo contract

key-files:
  created: []
  modified:
    - client/src/components/admin/AppointmentsCalendarSection.tsx

key-decisions:
  - "resourceAccessor/resourceIdAccessor/resourceTitleAccessor implemented as arrow functions (not string keys) — DnDCalendar type contract requires functions, not string literals"
  - "resourceId coerced from string|number to number via typeof guard — RBC SlotInfo.resourceId is string | number | undefined"
  - "as any casts used on draggableAccessor, eventPropGetter, onSelectEvent, onSelectSlot — DnDCalendar generic is object, not CalendarEvent"

patterns-established:
  - "DnDCalendar module-scope pattern: const DnDCalendar = withDragAndDrop(Calendar) OUTSIDE component"
  - "resourceProps spread pattern: isByStaff ? { resources, accessors } : {} — avoids static resource props on standard views"

requirements-completed: [D-01, D-02, D-03, D-04, D-10, D-14]

# Metrics
duration: 15min
completed: 2026-04-30
---

# Phase 19 Plan 01: Multi-Staff View Infrastructure Summary

**DnDCalendar HOC at module scope, isByStaff state, By Staff toolbar button, resource column props, horizontal-scroll container, extended handleSelectSlot with resourceId, and 30-second bookings polling**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-30T18:10:00Z
- **Completed:** 2026-04-30T18:27:27Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- DnDCalendar HOC declared at module scope (not component body) to prevent RBC remount on render
- By Staff button in toolbar switches to Day view with one column per visible staff member; Month/Week/Day buttons reset isByStaff
- resourceProps spread only injected when isByStaff === true, avoiding static resource props contaminating standard views (Pitfall 2)
- handleSelectSlot now accepts resourceId and pre-fills staffMemberId from column (D-04) before falling back to single-staff heuristic (D-13)
- 30-second polling added to bookings range query (D-14)
- isQuickBook flag added to newBookingSlot state type for Plan 03

## Task Commits

Each task was committed atomically:

1. **Task 1: DnDCalendar HOC + DnD CSS + 30s polling** - `ead3597` (feat)
2. **Task 2: isByStaff state + By Staff toolbar + resource columns + handleSelectSlot extension** - `ecbab57` (feat)

## Files Created/Modified

- `client/src/components/admin/AppointmentsCalendarSection.tsx` - DnDCalendar HOC, isByStaff state, By Staff button, resourceProps, extended handleSelectSlot, 30s polling

## Decisions Made

- resourceAccessor/resourceIdAccessor/resourceTitleAccessor implemented as arrow functions (not string keys) — DnDCalendar's generic type requires accessor functions, string literals fail TS compilation
- resourceId in handleSelectSlot typed as `string | number | undefined` to match RBC SlotInfo contract, then coerced to number via typeof guard
- `as any` casts applied to draggableAccessor, eventPropGetter, onSelectEvent, onSelectSlot — DnDCalendar generic is `object`, not `CalendarEvent`; consistent with existing Calendar cast patterns in the file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] resourceAccessor/resourceIdAccessor/resourceTitleAccessor changed from string keys to arrow functions**
- **Found during:** Task 2 (resource props building)
- **Issue:** Plan specified `resourceIdAccessor: 'id' as const` etc. but DnDCalendar TypeScript signature requires accessor functions, not string keys — TS2322 type error
- **Fix:** Changed all three to arrow functions: `(resource: any) => resource.id`, `(resource: any) => resource.firstName`, `(event: any) => event.staffMemberId`
- **Files modified:** client/src/components/admin/AppointmentsCalendarSection.tsx
- **Verification:** `npm run check` passes with no TS errors
- **Committed in:** ecbab57 (Task 2 commit)

**2. [Rule 1 - Bug] handleSelectSlot resourceId typed as string | number and draggableAccessor/eventPropGetter/onSelectEvent/onSelectSlot cast to any**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** RBC SlotInfo.resourceId is `string | number | undefined`, not `number | undefined`; DnDCalendar generic parameter `object` incompatible with CalendarEvent typed callbacks
- **Fix:** Typed resourceId as `string | number`, added typeof coercion guard; added `as any` casts to affected props
- **Files modified:** client/src/components/admin/AppointmentsCalendarSection.tsx
- **Verification:** `npm run check` and `npm run build` pass
- **Committed in:** ecbab57 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 - Bug)
**Impact on plan:** Both fixes required for TypeScript compilation. Semantics unchanged — resource accessor functions produce same values as string key accessors.

## Issues Encountered

None beyond the TypeScript type errors documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 19-01 infrastructure complete: DnDCalendar, isByStaff, resourceProps, and extended handleSelectSlot are ready
- Plan 19-02 can wire onEventDrop for drag-and-drop rescheduling (stub already in place)
- Plan 19-03 can implement Quick Book modal using isQuickBook flag from newBookingSlot
- Plan 19-04 can implement conflict detection using pre-filled staffMemberId

---
*Phase: 19-receptionist-booking-flow-multi-staff-view*
*Completed: 2026-04-30*
