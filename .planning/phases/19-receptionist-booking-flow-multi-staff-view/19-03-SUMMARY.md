---
phase: 19-receptionist-booking-flow-multi-staff-view
plan: 03
subsystem: ui
tags: [react, admin, calendar, quick-book, modal, receptionist, walk-in]

# Dependency graph
requires:
  - phase: 19-01
    provides: isQuickBook flag on newBookingSlot state, By Staff column slot click wiring

provides:
  - QuickBookModal component with two-field fast booking UX
  - AppointmentsCalendarSection conditional Quick Book vs full form rendering

affects:
  - 19-04 (conflict detection reads staffMemberId pre-filled by Quick Book)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - QuickBookModal with own looser Zod schema (phone/email optional for walk-ins)
    - Collapsible "More options" pattern for progressive disclosure
    - Module-scope helper functions (addMinutesToHHMM, useDebounced) replicated in QuickBookModal

key-files:
  created:
    - client/src/components/admin/QuickBookModal.tsx
  modified:
    - client/src/components/admin/AppointmentsCalendarSection.tsx

key-decisions:
  - "Walk-in phone defaults to '' not null — DB notNull constraint, Quick Book schema makes it optional (D-09)"
  - "quickBookSchema uses z.string().optional().or(z.literal('')) for phone/email — allows both undefined and empty string from controlled inputs"
  - "Service filter uses !isArchived && !isHidden to match existing selectableServices pattern in AppointmentsCalendarSection"
  - "Collapsible moreOptionsOpen state tracked in component state (not form state) — purely UI concern"
  - "computedEndTime computed inline (not useMemo) for simplicity — single service, no array reduce needed"

# Metrics
duration: ~6min
completed: 2026-04-30
---

# Phase 19 Plan 03: Quick Book Modal Summary

**QuickBookModal.tsx component with customer type-ahead, service combobox, 'More options' Collapsible (phone/email/notes), 'Full form' link, brand yellow submit; wired into AppointmentsCalendarSection with isQuickBook conditional rendering**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-30T18:29:53Z
- **Completed:** 2026-04-30T18:35:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created QuickBookModal.tsx as a new named export with its own Zod schema (`quickBookSchema`) that makes phone/email optional (walk-in support per D-09)
- Customer name type-ahead replicates the Popover+Command+ContactSuggestion pattern from AppointmentsCalendarSection
- Service combobox with Popover+Command, filtered by `!isArchived && !isHidden`
- Collapsible "More options" disclosure section with phone, email, and notes inputs
- "Full form →" ghost button wired via `onOpenFullForm` prop (D-05)
- `quickBookMutation` POSTs to `/api/bookings` then PUTs status=confirmed (D-08); walk-in phone defaults to '' (D-09)
- D-07: staff name + formatted time shown as display-only paragraph in DialogHeader (not editable inputs)
- AppointmentsCalendarSection: `QuickBookModal` imported, conditional render when `newBookingSlot.isQuickBook === true`, `onOpenFullForm` transitions to full form by setting `isQuickBook: false`, full Create Booking Dialog open condition narrowed to `!!newBookingSlot && !newBookingSlot.isQuickBook`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create QuickBookModal.tsx component** - `3d76583` (feat)
2. **Task 2: Wire QuickBookModal into AppointmentsCalendarSection** - `9e3a34f` (feat, included in 19-02 parallel commit)

## Files Created/Modified

- `client/src/components/admin/QuickBookModal.tsx` - New component: quickBookSchema, QuickBookModal with type-ahead, service combobox, Collapsible, mutation
- `client/src/components/admin/AppointmentsCalendarSection.tsx` - QuickBookModal import, conditional render, onOpenFullForm handler, narrowed Dialog open condition

## Decisions Made

- Walk-in phone defaults to `''` not `null` — the booking DB schema has `customerPhone notNull`, but Quick Book accepts walk-ins without a phone number; the schema makes the field optional and the submit handler defaults to `''`
- `quickBookSchema` uses `z.string().optional().or(z.literal(''))` for phone/email — this handles both `undefined` (field never touched) and `''` (controlled input cleared)
- Service filter matches existing `selectableServices` pattern: `!s.isArchived && !s.isHidden`
- `computedEndTime` is calculated inline (not `useMemo`) — single service, no multi-row array reduce needed in Quick Book; simplicity preferred

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Service filter corrected from `isActive` to `isHidden`**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** Plan spec used `s.isActive !== false` but `Service` type in schema has no `isActive` field — only `isArchived` and `isHidden`
- **Fix:** Changed filter to `!s.isArchived && !s.isHidden` to match the pattern in AppointmentsCalendarSection
- **Files modified:** client/src/components/admin/QuickBookModal.tsx
- **Verification:** `npm run check` passes with no TS errors

### Parallel Agent Note

Task 2 changes to AppointmentsCalendarSection.tsx were applied locally and committed via the parallel 19-02 agent's commit (`9e3a34f`). The 19-02 agent was working in the same git worktree and included the QuickBookModal import and conditional render changes in their commit. Both sets of changes (drag-and-drop + Quick Book wiring) are now in `9e3a34f`.

## Issues Encountered

None beyond the TypeScript type error documented as deviation above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. QuickBookModal submits real POST /api/bookings payloads. The component is fully wired.

## Next Phase Readiness

- Plan 19-04 can implement conflict detection using the `staffMemberId` pre-filled via Quick Book and full form slot clicks

---
*Phase: 19-receptionist-booking-flow-multi-staff-view*
*Completed: 2026-04-30*
