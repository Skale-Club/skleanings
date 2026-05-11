---
phase: 19-receptionist-booking-flow-multi-staff-view
plan: "02"
subsystem: admin-calendar
tags: [drag-and-drop, booking-reassignment, undo-toast, staff-assignment]
dependency_graph:
  requires: [19-01]
  provides: [drag-to-reassign, undo-toast, staffMemberId-persistence]
  affects: [AppointmentsCalendarSection, storage.updateBooking]
tech_stack:
  added: []
  patterns: [useMutation for drag reassign, ToastAction undo pattern, Drizzle type extension]
key_files:
  created: []
  modified:
    - server/storage.ts
    - client/src/components/admin/AppointmentsCalendarSection.tsx
decisions:
  - "reassignMutation uses onSuccess callback on mutate() call (not onSuccess on mutation definition) to access start/end locals for toast message — avoids closure issues"
  - "isGcalBusy early-return in handleEventDrop guards against drag on read-only busy blocks before any network call"
  - "onEventDrop cast as any — RBC DnD HOC type contract does not match CalendarEvent shape precisely; runtime shape verified from source"
metrics:
  duration: "~3 min"
  completed: "2026-04-30"
  tasks: 2
  files: 2
---

# Phase 19 Plan 02: Drag-to-Reassign with Undo Toast Summary

Drag-to-reassign: extended `storage.updateBooking()` with `staffMemberId`, wired `handleEventDrop` with `reassignMutation`, and added a 5-second undo `ToastAction`.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extend storage.updateBooking() to accept and persist staffMemberId | 9116242 | server/storage.ts |
| 2 | handleEventDrop, reassignMutation, and undo toast in AppointmentsCalendarSection | 9e3a34f | client/src/components/admin/AppointmentsCalendarSection.tsx |

## What Was Built

**Task 1 — storage.updateBooking() staffMemberId support (server/storage.ts)**
- Added `staffMemberId: number | null` to the `Partial<{...}>` type parameter of `updateBooking`
- No method body changes needed — Drizzle spreads `bookingUpdates` into `db.update().set(bookingUpdates)` automatically, so the field is forwarded to the SET clause when present

**Task 2 — Drag-to-reassign logic (AppointmentsCalendarSection.tsx)**
- Added `import { ToastAction } from '@/components/ui/toast'` 
- Added `reassignMutation`: calls `PUT /api/bookings/:id` with `startTime`, `endTime`, and `staffMemberId`; invalidates `/api/bookings` cache on success
- Added `handleEventDrop`: captures original start/end/staffId before mutating, derives new values from drop target (`resourceId` = staff column id in By Staff view), guards GCal busy blocks with early return
- Undo toast: shows staff name and formatted time, `ToastAction` re-fires `reassignMutation` with original values, 5-second duration
- Wired `onEventDrop={handleEventDrop as any}` replacing the empty stub from Plan 01

## Deviations from Plan

None — plan executed exactly as written. The pre-existing TypeScript error in `QuickBookModal.tsx` (untracked file) is out of scope and not caused by these changes.

## Known Stubs

None.

## Self-Check: PASSED

- server/storage.ts: `staffMemberId: number | null` at line 784 inside `updateBooking` Partial type block
- AppointmentsCalendarSection.tsx: `reassignMutation` declared at line 746, used at lines 854 and 870
- AppointmentsCalendarSection.tsx: `handleEventDrop` declared at line 829, wired at line 1100
- AppointmentsCalendarSection.tsx: `ToastAction` imported at line 71, used at line 867
- Commits 9116242 and 9e3a34f verified in git log
