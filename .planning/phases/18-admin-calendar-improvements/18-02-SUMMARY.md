---
plan: 18-02
phase: 18-admin-calendar-improvements
status: complete
completed: 2026-04-30
commits: e8bf2e3, dbbf3a9
---

# Plan 18-02 Summary: Create Booking Form Refactor

## What was built
Major refactor of the Create Booking modal in `AppointmentsCalendarSection.tsx` covering CAL-02, CAL-03, CAL-04, and CAL-06:

1. **Modal width (CAL-02):** `DialogContent` changed from `sm:max-w-md` to `sm:max-w-2xl` (672px)
2. **2-col grid layout (D-11):** Customer name + phone wrapped in `<div className="grid grid-cols-2 gap-4">`
3. **Multi-service rows (CAL-03):** `useFieldArray` replaces single `serviceId`/`quantity` fields. Schema updated to `services: z.array(...)`, dynamic add/remove rows with trash icon (disabled at 1 row), "+ Add service" outline/dashed button
4. **Always-editable end time (CAL-04):** `endTimeOverride` toggle removed entirely. End time is always an `<Input type="time">` that auto-fills from sum of all service durations, with a `userEditedEndTime` guard to stop auto-filling when admin manually types a value. `setUserEditedEndTime(false)` resets on slot change
5. **Submit handler:** Rewrites to send `cartItems: values.services.map(...)` array. Notes attach to first item only
6. **Brand button (CAL-06):** Verified `bg-[#FFFF01] text-black font-bold rounded-full` — already correct, no change needed

## Key files changed
- `client/src/components/admin/AppointmentsCalendarSection.tsx` — imports, schema, defaultValues, useFieldArray, computedEndTime, estimatedTotal, onSubmit, JSX service section, JSX end-time section

## Deviations
None — all D-01 through D-07, D-10, D-11, D-14 decisions implemented as specified.

## Self-Check: PASSED
- `import { useForm, useFieldArray }` ✓
- `Trash2` and `Plus` in lucide-react imports ✓
- `services: z.array(` in schema ✓
- No `endTimeOverride` in file ✓
- `useFieldArray({` wired ✓
- `values.services.map` in onSubmit ✓
- `appendService({` ✓
- `removeService(` ✓
- `sm:max-w-2xl` on DialogContent ✓
- `grid grid-cols-2 gap-4` wrapping name/phone ✓
- `userEditedEndTime` state and guard ✓
- `npm run check` exits 0 ✓
