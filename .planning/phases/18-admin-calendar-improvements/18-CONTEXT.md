# Phase 18: Admin Calendar Improvements — Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the admin calendar Create Booking modal production-ready: fix time-label alignment in the calendar grid, widen the modal to ≥600px, add multi-service support with dynamic rows, make end time always directly editable, conditionally show the address field based on service delivery model, and ensure the submit button uses the brand yellow style.

**In scope:**
- `rbc-label` CSS alignment fix (CAL-01)
- Modal width ≥600px — target `sm:max-w-2xl` (~672px) (CAL-02)
- Multi-service dynamic rows: add/remove, no limit, live total (CAL-03)
- End time: always-editable time input, pre-filled from sum of durations (CAL-04)
- Address field: visible only when `serviceDeliveryModel` is `at-customer` or `both` (CAL-05)
- Submit button brand style — already implemented; verify only (CAL-06)

**Out of scope:**
- Multi-staff calendar view (Phase 19)
- Drag-to-reschedule on the calendar
- Customer-facing booking flow changes

</domain>

<decisions>
## Implementation Decisions

### Multi-Service Rows (CAL-03)
- **D-01:** Replace the single `serviceId` + `quantity` fields with a dynamic list of service rows. Each row: service selector (existing `selectableServices` list) + quantity number input + trash icon to remove. Minimum 1 row always present (trash icon disabled when only 1 row).
- **D-02:** `+ Add service` button appended below the last row. No maximum limit on rows.
- **D-03:** Zod schema changes from `serviceId: z.number()` + `quantity: z.number()` to `services: z.array(z.object({ serviceId: z.number().int().positive(), quantity: z.number().int().min(1) })).min(1)`.
- **D-04:** Estimated total = sum of `(service.price × quantity)` across all rows. Updates live as any row changes. Replaces the current single-service total display.

### End Time (CAL-04)
- **D-05:** Remove the `endTimeOverride` toggle switch entirely. The end time field is always a `<Input type="time">` — pre-filled from computed value, always typeable.
- **D-06:** Auto-compute = `startTime` + sum of all `(service.durationMinutes × quantity)` across all service rows. When service rows change, the end time auto-updates **only if** the current value matches the previously computed value (i.e., admin hasn't manually changed it). Track with a `userEditedEndTime` boolean or by comparing current value to last computed value.
- **D-07:** `endTimeOverride` field removed from Zod schema and submit handler. Server always receives the value directly from the time input.

### Address Field Conditional (CAL-05)
- **D-08:** Read `serviceDeliveryModel` from `companySettings` (already in context via `useQuery('/api/company-settings')`). Show the address field when `serviceDeliveryModel === 'at-customer' || serviceDeliveryModel === 'both'`. Hide (not disable) when `customer-comes-in`.
- **D-09:** When the field becomes hidden, clear the `customerAddress` form value to avoid sending stale data.

### Modal Width & Layout (CAL-02)
- **D-10:** Change `DialogContent className` from `sm:max-w-md` to `sm:max-w-2xl` (672px). Keep `max-h-[90vh] overflow-y-auto`.
- **D-11:** Use a 2-column grid for short fields: `[Customer name] [Phone]` on one row, `[Email] [Address (conditional)]` on another. Service rows, end time, total, and notes remain full-width.
- **D-12:** Field order: Date/Start (pre-fill display) → Staff → Customer name + Phone → Email + Address → Services rows → End time → Total → Notes → Submit.

### Time Label Alignment (CAL-01)
- **D-13:** Fix via CSS in `index.css`. The `rbc-label` (time gutter labels in react-big-calendar) should be vertically aligned to the top of each timeslot group, offset so the label text sits at the same visual height as the horizontal grid line. Target rule: `.appointments-calendar .rbc-label { padding-top: 0; transform: translateY(-50%); }` or equivalent — verify against live rendering.

### Submit Button (CAL-06)
- **D-14:** Already implemented: `bg-[#FFFF01] text-black font-bold w-full rounded-full`. Verify it's still present and no regression introduced by the other changes.

### Claude's Discretion
- Exact CSS fix for rbc-label alignment — measure in browser and adjust transform/padding values accordingly
- Whether to use `useFieldArray` from react-hook-form or manual array state for service rows — use `useFieldArray` (it's the idiomatic RHF approach for dynamic lists)
- Row remove button: ghost icon button with `Trash2` icon, same pattern as social links in CompanySettingsSection

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Calendar Component (primary target)
- `client/src/components/admin/AppointmentsCalendarSection.tsx` — 1322-line file; contains the full Create Booking modal (lines 1074–1319), form schema (lines 79–92), and computed end time logic (lines 635–638)

### CSS / Styling
- `client/src/index.css` lines 383–386 — `.rbc-label` rule; CAL-01 fix goes here

### Requirements
- `.planning/REQUIREMENTS.md` lines covering CAL-01 through CAL-06 — acceptance criteria for each fix

### Shared Types & Settings
- `client/src/components/admin/shared/types.ts` — `CompanySettingsData` interface; `serviceDeliveryModel` field added in Phase 17
- `server/routes/company.ts` — `/api/company-settings` endpoint; `serviceDeliveryModel` returned in response

### Prior Phase Context
- `.planning/phases/15-schema-foundation-detokenization/15-CONTEXT.md` — `serviceDeliveryModel` column added
- `.planning/phases/17-favicon-legal-company-type-admin-ui/17-CONTEXT.md` — D-09: exact enum values (`at-customer`, `customer-comes-in`, `both`)

### Booking API
- `server/routes/company.ts` or equivalent booking route — verify that the booking creation endpoint accepts an array of service items (or needs to be extended)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useFieldArray` from `react-hook-form` — the project already uses RHF; `useFieldArray` handles dynamic service rows without manual array state
- `selectableServices` memoized list (line 539) — already filters archived/hidden services; reuse for each service row's selector
- `computedEndTime` logic (lines 635–638) — extend to sum across all service rows instead of single service
- `estimatedTotal` display (lines 1287–1290) — extend to sum across all rows
- `Trash2` icon from lucide-react — already imported; use for row remove buttons

### Established Patterns
- Form uses `react-hook-form` + Zod schema — service rows extend the existing schema
- `useQuery('/api/company-settings')` already called in this file for busy times; add `serviceDeliveryModel` read from it
- All modal content uses `space-y-4` and `FormField`/`FormItem`/`FormLabel`/`FormControl` pattern
- 2-col grids already used elsewhere in admin (e.g., General tab in CompanySettingsSection)

### Integration Points
- Booking submit handler (line ~700+): currently sends single `serviceId` + `quantity` — must be updated to send array of items
- Server-side booking creation route: verify it already accepts `bookingItems` array (Phase 14 added multi-item support — check)

</code_context>

<specifics>
## Specific Ideas

- The service rows should look like the social links section in CompanySettingsSection: a vertical list of rows each with fields + a trash button on the right
- The `+ Add service` button should use `variant="outline"` with a dashed border, same as `Add Social Link`
- End time field: no label change needed — stays "End time" — but remove the "Adjust end time" switch row entirely

</specifics>

<deferred>
## Deferred Ideas

- Multi-staff calendar view (parallel staff columns) — Phase 19 scope
- Drag-and-drop appointment rescheduling on the calendar grid

</deferred>

---

*Phase: 18-admin-calendar-improvements*
*Context gathered: 2026-04-30*
