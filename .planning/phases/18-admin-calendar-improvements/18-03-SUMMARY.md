---
plan: 18-03
phase: 18-admin-calendar-improvements
status: complete
completed: 2026-04-30
commits: 5b8f9f1, 571c016
---

# Plan 18-03 Summary: Conditional Address Field + Gap Fixes

## What was built

**Task 1 (CAL-05):** Added conditional address field visibility based on `serviceDeliveryModel`:
- `useCompanySettings()` imported and wired to derive `showAddressField` boolean
- `customerAddress` schema changed from `z.string().min(3)` to `z.string().optional().or(z.literal(''))`
- `useEffect` clears `customerAddress` when field is hidden (D-09)
- Address `FormField` wrapped in `{showAddressField && (...)}` conditional render
- Defaults to visible (null/undefined serviceDeliveryModel → show)

**Gap fixes (from checkpoint feedback):**
- **CAL-03**: Replaced `<Select>` in service rows with a searchable `Popover + Command + CommandInput` combobox. One popover open at a time via `openServiceIdx` state.
- **CAL-04**: Fixed end-time auto-fill race condition — `setUserEditedEndTime(true)` on any user input, sync effect depends only on `computedEndTime` (removed `userEditedEndTime` from deps to prevent re-fire on flag change).
- **CAL-01**: CSS selector made more specific (`.rbc-time-gutter .rbc-label`), added `display: block`, `line-height: 1`, `overflow: visible` for reliable `translateY(-50%)` behavior.

## Key files changed
- `client/src/components/admin/AppointmentsCalendarSection.tsx` — useCompanySettings import, showAddressField logic, conditional JSX, combobox service selector, end time fix
- `client/src/index.css` — more specific `.rbc-time-gutter .rbc-label` rule

## Deviations
- Service selector changed from `<Select>` to `Combobox` (user-requested search — improves UX when there are many services)
- End time `setUserEditedEndTime` logic simplified per checkpoint feedback

## Self-Check: PASSED
- `import { useCompanySettings }` present ✓
- `const { settings: companySettings } = useCompanySettings()` present ✓
- `const showAddressField =` present ✓
- `customerAddress: z.string().optional().or(z.literal(''))` present ✓
- `{showAddressField && (` wrapping address field ✓
- `form.setValue('customerAddress', '', { shouldValidate: false })` in useEffect ✓
- Searchable combobox with `CommandInput` for each service row ✓
- `npm run check` exits 0 ✓
- Checkpoint approved by user ✓
