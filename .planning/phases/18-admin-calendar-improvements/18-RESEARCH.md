# Phase 18: Admin Calendar Improvements — Research

**Researched:** 2026-04-30
**Domain:** React admin UI — react-hook-form, react-big-calendar, shadcn/ui modal
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Multi-Service Rows (CAL-03)**
- D-01: Replace single `serviceId` + `quantity` with dynamic list of service rows. Each row: service selector + quantity number input + trash icon. Minimum 1 row always (trash disabled when only 1 row).
- D-02: `+ Add service` button appended below the last row. No maximum row limit.
- D-03: Zod schema changes from `serviceId: z.number()` + `quantity: z.number()` to `services: z.array(z.object({ serviceId: z.number().int().positive(), quantity: z.number().int().min(1) })).min(1)`.
- D-04: Estimated total = sum of `(service.price × quantity)` across all rows. Updates live. Replaces single-service total display.

**End Time (CAL-04)**
- D-05: Remove `endTimeOverride` toggle switch entirely. End time field is always `<Input type="time">` — pre-filled from computed value, always typeable.
- D-06: Auto-compute = `startTime` + sum of all `(service.durationMinutes × quantity)` across all service rows. Updates only if current value matches previously computed value (i.e., admin hasn't manually changed it). Track with a `userEditedEndTime` boolean or by comparing current value to last computed value.
- D-07: `endTimeOverride` field removed from Zod schema and submit handler. Server always receives the value directly from the time input.

**Address Field Conditional (CAL-05)**
- D-08: Read `serviceDeliveryModel` from `companySettings` via `useCompanySettings()` context hook. Show address field when `serviceDeliveryModel === 'at-customer' || serviceDeliveryModel === 'both'`. Hide (not disable) when `customer-comes-in`.
- D-09: When field becomes hidden, clear `customerAddress` form value to avoid sending stale data.

**Modal Width & Layout (CAL-02)**
- D-10: Change `DialogContent className` from `sm:max-w-md` to `sm:max-w-2xl` (672px). Keep `max-h-[90vh] overflow-y-auto`.
- D-11: Use 2-column grid for short fields: `[Customer name] [Phone]` on one row, `[Email] [Address (conditional)]` on another. Service rows, end time, total, and notes remain full-width.
- D-12: Field order: Date/Start (pre-fill display) → Staff → Customer name + Phone → Email + Address → Services rows → End time → Total → Notes → Submit.

**Time Label Alignment (CAL-01)**
- D-13: Fix via CSS in `index.css`. Target rule: `.appointments-calendar .rbc-label { padding-top: 0; transform: translateY(-50%); }` or equivalent — verify against live rendering.

**Submit Button (CAL-06)**
- D-14: Already implemented: `bg-[#FFFF01] text-black font-bold w-full rounded-full`. Verify it's still present after other changes, no regression.

### Claude's Discretion
- Exact CSS fix for rbc-label alignment — measure in browser and adjust transform/padding values accordingly
- Whether to use `useFieldArray` from react-hook-form or manual array state for service rows — use `useFieldArray` (idiomatic RHF approach for dynamic lists)
- Row remove button: ghost icon button with `Trash2` icon, same pattern as social links in CompanySettingsSection

### Deferred Ideas (OUT OF SCOPE)
- Multi-staff calendar view (parallel staff columns) — Phase 19 scope
- Drag-and-drop appointment rescheduling on the calendar grid
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAL-01 | Calendar grid time lines align correctly with time slot labels | CSS `.rbc-label` rule at `client/src/index.css` lines 383–386; D-13 fix confirmed viable |
| CAL-02 | Create Booking modal minimum width ≥600px | `DialogContent` at line 1075 currently has `sm:max-w-md`; change to `sm:max-w-2xl` |
| CAL-03 | Create Booking supports multiple services via `+ Add service` row | Server already accepts `cartItems` array; schema and form must be updated to `services: z.array(...)` |
| CAL-04 | End time field is directly editable (not only auto-computed) | Current toggle-switch approach (lines 1262–1284) to be replaced with always-editable `<Input type="time">` |
| CAL-05 | Address field only appears when `serviceDeliveryModel` is `at-customer` or `both` | `useCompanySettings()` context hook available; `CompanySettingsData.serviceDeliveryModel` is `string \| null` |
| CAL-06 | Submit button uses brand yellow style | Already implemented at line 1311; verify-only |
</phase_requirements>

---

## Summary

Phase 18 is a focused UI-only improvement to `AppointmentsCalendarSection.tsx`. All six requirements are pure frontend changes — no new API endpoints or database migrations are needed. The server booking creation endpoint (`POST /api/bookings`) already accepts a `cartItems` array and has done so since Phase 14, so CAL-03 is entirely a form-layer change.

The most complex change is CAL-03/04 combined: replacing the single `serviceId`/`quantity` pair with a `useFieldArray`-driven list, and replacing the `endTimeOverride` toggle with an always-editable time input that auto-updates only when the admin hasn't manually overridden it. The `useFieldArray` API from `react-hook-form` is already available in the project (it ships with the installed `react-hook-form` package) but has not been used in any project file yet — the import is new.

CAL-05 relies on `useCompanySettings()` — a context hook that already exists and is populated from `CompanySettingsProvider` in `App.tsx`. It is not currently imported in `AppointmentsCalendarSection.tsx`; the import must be added.

CAL-01 is a two-line CSS change. CAL-02 is a one-word className change. CAL-06 is verification-only.

**Primary recommendation:** Implement in three focused waves — (1) CSS + modal width + button verify, (2) multi-service rows with useFieldArray, (3) end-time always-editable + address conditional.

---

## Standard Stack

### Core (already in project)

| Library | Version (installed) | Purpose | Role in Phase 18 |
|---------|--------------------|---------|--------------------|
| react-hook-form | ships with project | Form state management | `useFieldArray` for dynamic service rows |
| zod | ships with project | Schema validation | New `services` array field in `bookingFormSchema` |
| @hookform/resolvers | ships with project | Zod integration | Already wired via `zodResolver` |
| react-big-calendar | ships with project | Calendar grid | `.rbc-label` CSS target for CAL-01 |
| shadcn/ui (Dialog, Form, Input, Select, Button) | ships with project | Modal components | No new shadcn installs needed |
| lucide-react | ships with project | Icons | `Trash2` and `Plus` icons for service rows |

### New Import Required

| Import | From | Why |
|--------|------|-----|
| `useFieldArray` | `react-hook-form` | Not yet used in this file; new dynamic row management |
| `Trash2`, `Plus` | `lucide-react` | Neither is currently imported in `AppointmentsCalendarSection.tsx` |
| `useCompanySettings` | `@/context/CompanySettingsContext` | Not currently imported in this file |

**No npm installs required.** All dependencies are already installed.

---

## Architecture Patterns

### Recommended Structure (no file additions needed)

All changes are contained in two existing files:
```
client/src/
├── components/admin/AppointmentsCalendarSection.tsx  # Primary target (all form changes)
└── index.css                                         # CAL-01 .rbc-label fix only
```

### Pattern 1: useFieldArray for Dynamic Service Rows (CAL-03)

**What:** Replace single `serviceId`/`quantity` form fields with a `useFieldArray`-managed list.
**When to use:** Any RHF form needing a variable-length list of structured objects.

**Schema change (lines 70–87 currently):**
```typescript
// BEFORE
serviceId: z.number({ invalid_type_error: 'Select a service' }).int().positive(),
quantity: z.number().int().min(1).default(1),
endTimeOverride: z.boolean().default(false),

// AFTER (D-03 + D-07)
services: z.array(
  z.object({
    serviceId: z.number({ invalid_type_error: 'Select a service' }).int().positive(),
    quantity: z.number().int().min(1).default(1),
  })
).min(1),
// endTimeOverride removed entirely
```

**useFieldArray wiring:**
```typescript
import { useForm, useFieldArray } from 'react-hook-form';

// After form declaration:
const { fields, append, remove } = useFieldArray({
  control: form.control,
  name: 'services',
});
```

**Default values change:**
```typescript
// BEFORE
serviceId: undefined as unknown as number,
quantity: 1,
endTimeOverride: false,

// AFTER
services: [{ serviceId: undefined as unknown as number, quantity: 1 }],
```

**Form reset on slot click (line 562 currently):**
```typescript
services: [{ serviceId: undefined as unknown as number, quantity: 1 }],
```

### Pattern 2: Always-Editable End Time with Auto-Compute Guard (CAL-04)

**What:** Replace the toggle-switch/read-only pattern with a plain `<Input type="time">` that auto-updates from computed value only when admin hasn't typed a custom value.

**Mechanism (D-06):**
```typescript
// Track whether the admin has manually edited the end time
const [userEditedEndTime, setUserEditedEndTime] = useState(false);

// Recompute: sum across all service rows
const computedEndTime = useMemo(() => {
  const totalMinutes = form.getValues('services').reduce((sum, row) => {
    const svc = selectableServices.find(s => s.id === row.serviceId);
    return sum + (svc ? svc.durationMinutes * (row.quantity || 1) : 0);
  }, 0);
  if (!watchedStartTime || totalMinutes === 0) return '';
  return addMinutesToHHMM(watchedStartTime, totalMinutes);
}, [/* watched services, watchedStartTime */]);

// Sync computed value into form only if admin hasn't manually changed it
useEffect(() => {
  if (!userEditedEndTime && computedEndTime) {
    form.setValue('endTime', computedEndTime, { shouldValidate: false });
  }
}, [computedEndTime, userEditedEndTime]);

// Reset userEditedEndTime on slot reset
// In the newBookingSlot useEffect: setUserEditedEndTime(false)
```

**End time field in JSX (replaces lines 1261–1284):**
```tsx
<FormField control={form.control} name="endTime" render={({ field }) => (
  <FormItem>
    <FormLabel>End time</FormLabel>
    <FormControl>
      <Input
        type="time"
        {...field}
        onChange={(e) => {
          field.onChange(e);
          setUserEditedEndTime(e.target.value !== computedEndTime);
        }}
      />
    </FormControl>
    <FormMessage />
  </FormItem>
)} />
```

### Pattern 3: Conditional Address Field (CAL-05)

**What:** Read `serviceDeliveryModel` from `useCompanySettings()` context; show/hide address field.
**Pattern:**
```typescript
const { settings: companySettings } = useCompanySettings();
const showAddressField =
  companySettings?.serviceDeliveryModel === 'at-customer' ||
  companySettings?.serviceDeliveryModel === 'both';

// When hiding, clear value (D-09):
useEffect(() => {
  if (!showAddressField) {
    form.setValue('customerAddress', '', { shouldValidate: false });
  }
}, [showAddressField]);
```

**JSX — conditionally render:**
```tsx
{showAddressField && (
  <FormField control={form.control} name="customerAddress" render={({ field }) => (
    <FormItem>
      <FormLabel>Address</FormLabel>
      <FormControl><Input {...field} /></FormControl>
      <FormMessage />
    </FormItem>
  )} />
)}
```

**Zod schema adjustment:** `customerAddress` must be made optional (or use `.optional()`) since it won't be shown for `customer-comes-in` model:
```typescript
customerAddress: z.string().optional().or(z.literal('')),
```
Currently it has `z.string().min(3, 'Address is required')` — this must change.

### Pattern 4: 2-Column Grid Layout (CAL-02 / D-11)

The existing pattern from CompanySettingsSection General tab:
```tsx
<div className="grid grid-cols-2 gap-4">
  <FormField name="customerName" ... />
  <FormField name="customerPhone" ... />
</div>
<div className="grid grid-cols-2 gap-4">
  <FormField name="customerEmail" ... />
  {showAddressField && <FormField name="customerAddress" ... />}
</div>
```

### Pattern 5: Service Row UI (D-01, D-02)

Follows the social links pattern from `CompanySettingsSection.tsx` (lines 360–419):
```tsx
{fields.map((field, index) => (
  <div key={field.id} className="flex items-end gap-2">
    <FormField name={`services.${index}.serviceId`} ... {/* Select */} />
    <FormField name={`services.${index}.quantity`} ... {/* Input type="number" */} />
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={fields.length === 1}
      onClick={() => remove(index)}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
))}
<Button
  type="button"
  variant="outline"
  className="w-full border-dashed"
  onClick={() => append({ serviceId: undefined as unknown as number, quantity: 1 })}
>
  <Plus className="h-4 w-4 mr-2" /> Add service
</Button>
```

### Pattern 6: Submit Handler Multi-Service Update

**Current `onSubmit` sends (lines 726–748):**
```typescript
cartItems: [{ serviceId: values.serviceId, quantity: values.quantity || 1, ... }]
```

**New `onSubmit` must send:**
```typescript
// totalPrice = sum across all service rows
const totalPrice = values.services.reduce((sum, row) => {
  const svc = selectableServices.find(s => s.id === row.serviceId);
  return sum + (svc ? Number(svc.price) * (row.quantity || 1) : 0);
}, 0).toFixed(2);

// totalDurationMinutes derived from startTime/endTime difference (always)
const [sh, sm] = values.startTime.split(':').map(Number);
const [eh, em] = values.endTime.split(':').map(Number);
const totalDurationMinutes = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));

cartItems: values.services.map(row => ({
  serviceId: row.serviceId,
  quantity: row.quantity || 1,
  // customerNotes attaches to first item only (or omit from all — consistent with D-02)
})),
```

The `notes` field (`customerNotes`) attaches to the first cart item per the existing D-02 pattern, or can be omitted from all items (notes are on the booking-level via `customerNotes` form field which isn't in the payload currently — verify at implementation time).

### Anti-Patterns to Avoid

- **Don't use `form.watch('services')` in `useMemo` without the full array** — RHF `watch` with an array field returns a snapshot; use `useFieldArray`'s `fields` for rendering and `form.getValues('services')` for read-only calculations inside effects.
- **Don't forget to reset `userEditedEndTime` on slot reset** — if skipped, the computed auto-fill won't work for subsequent modal opens.
- **Don't leave `customerAddress` required when `showAddressField` is false** — Zod will still fail validation. Make the field `.optional()` unconditionally and validate at submit time if needed.
- **Don't use `watchedEndTimeOverride` in `onSubmit` logic** — D-07 removes this field entirely. The duration calculation must always derive from startTime/endTime difference.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dynamic form array (add/remove service rows) | Manual `useState([...items])` + spread-update | `useFieldArray` from react-hook-form | RHF handles field registration, focus management, validation, and key stability automatically |
| CSS rbc-label alignment | JavaScript offset calculations | CSS `transform: translateY(-50%)` | React-big-calendar renders time labels at the start of each group; a CSS transform is the standard fix used by the community |
| Company settings access | New `useQuery('/api/company-settings')` call | `useCompanySettings()` context hook | Query is already deduped at the provider level; adding another `useQuery` with the same key would work but is redundant |

**Key insight:** `useFieldArray` is the only meaningful external API needed for this phase. Everything else uses existing project primitives.

---

## Verified Code State (from file inspection)

### Current Form Schema (lines 70–88, `AppointmentsCalendarSection.tsx`)

```typescript
const bookingFormSchema = z.object({
  customerName: z.string().min(2, 'Name is required'),
  customerPhone: z.string().min(7, 'Phone is required'),
  customerEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  customerAddress: z.string().min(3, 'Address is required'),  // ← must become optional for CAL-05
  bookingDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  staffMemberId: z.number().nullable().optional(),
  serviceId: z.number({ invalid_type_error: 'Select a service' }).int().positive(),  // ← replace with services array
  quantity: z.number().int().min(1).default(1),                                       // ← remove
  customerNotes: z.string().optional(),
  endTimeOverride: z.boolean().default(false),  // ← remove (D-07)
});
```

### Current End-Time Logic (lines 617–640)

- `computedEndTime` = `addMinutesToHHMM(startTime, selectedService.durationMinutes * quantity)` (single service)
- `useEffect` syncs computed value into form when `watchedEndTimeOverride` is `false`
- Modal toggle at lines 1262–1284: switch enables editable `<Input type="time">`

### Current Submit Handler Key Points (lines 706–751)

- Validates `selectedService` exists
- Derives `totalDurationMinutes` from `computedTotalDurationMinutes` (or override diff)
- Computes `totalPrice` as `selectedService.price * quantity`
- Sends `cartItems: [{ serviceId, quantity, customerNotes? }]`
- Uses `apiRequest('POST', '/api/bookings', payload)`

### Current Modal Structure

- **Line 1075:** `<DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">` — change `sm:max-w-md` to `sm:max-w-2xl`
- **Line 1311:** Submit button: `className="w-full bg-[#FFFF01] text-black font-bold rounded-full hover:bg-[#FFFF01]/90 disabled:opacity-60"` — already correct (CAL-06 = verify only)

### Current CSS (index.css lines 383–386)

```css
.appointments-calendar .rbc-time-slot,
.appointments-calendar .rbc-label {
  @apply text-xs text-muted-foreground;
}
```

No `padding-top` or `transform` property currently. The CAL-01 fix adds alignment correction to `.appointments-calendar .rbc-label` specifically (not to `.rbc-time-slot`).

### `useCompanySettings` Hook

- File: `client/src/context/CompanySettingsContext.tsx`
- Export: `export function useCompanySettings(): { settings: CompanySettings | null; isLoading: boolean; isReady: boolean }`
- `settings.serviceDeliveryModel` is `string | null` (from `CompanySettingsData` in `shared/types.ts`)
- **NOT currently imported in `AppointmentsCalendarSection.tsx`** — new import required

### `useFieldArray` Availability

- Package: `react-hook-form` (already installed)
- **NOT currently used anywhere in `client/src/`** — first usage in the project
- Import: `import { useForm, useFieldArray } from 'react-hook-form'`
- The existing import at line 16 is `import { useForm } from 'react-hook-form'` — must add `useFieldArray`

### Server Booking Endpoint Confirmation

`POST /api/bookings` in `server/routes/bookings.ts` (lines 53–130+):
- Validates via `insertBookingSchema.parse(req.body)`
- `insertBookingSchema` at `shared/schema.ts` line 462: `cartItems: z.array(cartItemSchema).optional()`
- `cartItemSchema` requires `serviceId: z.number()` and `quantity: z.number().default(1)`
- Loop at lines 71–93 iterates `cartItems`, fetches each service, calls `calculateCartItemPrice`, builds `bookingItemsData`
- **Conclusion: server already fully supports multiple cart items. No server changes needed for CAL-03.**

### `serviceDeliveryModel` Enum Values (confirmed from two sources)

From `server/routes/company.ts` line 63 (publicCompanySettingsFallback):
```
serviceDeliveryModel: "at-customer"
```

From Phase 17 CONTEXT.md (D-09):
- `at-customer` — "At Customer Location"
- `customer-comes-in` — "Customer Comes In"
- `both` — "Both"

Show address field when: `serviceDeliveryModel === 'at-customer' || serviceDeliveryModel === 'both'`
Hide address field when: `serviceDeliveryModel === 'customer-comes-in'` (or null/undefined — default to showing for safety)

---

## Common Pitfalls

### Pitfall 1: `watch('services')` Returns Stale Array in useMemo
**What goes wrong:** `form.watch('services')` used inside `useMemo` will not automatically re-compute when individual fields inside the array change, causing stale total/duration.
**Why it happens:** RHF `watch` at the array level returns a new reference per render but the `useMemo` deps array comparison may not catch deep changes.
**How to avoid:** Use `form.watch('services')` at the component render level (assign to a variable) then include that variable in `useMemo` deps, OR use `useFieldArray`'s `fields` array plus explicit `form.watch()` calls for each row's values.
**Pattern:**
```typescript
const watchedServices = form.watch('services'); // at render level
const computedEndTime = useMemo(() => {
  // use watchedServices here
}, [watchedServices, watchedStartTime]);
```

### Pitfall 2: `customerAddress` Zod Validation Still Fires When Field is Hidden
**What goes wrong:** If `customerAddress` remains `z.string().min(3)` in the schema, submitting with `serviceDeliveryModel === 'customer-comes-in'` will fail validation even though the field is not shown.
**Why it happens:** Zod validates the full schema regardless of UI visibility.
**How to avoid:** Change schema to `customerAddress: z.string().optional().or(z.literal(''))` and clear the field value when hiding (D-09 already mandates this).

### Pitfall 3: `useFieldArray` `fields` Array — Key Must Be `field.id` Not `index`
**What goes wrong:** Using array `index` as the React key for `useFieldArray` rows causes incorrect re-renders when rows are removed from the middle.
**Why it happens:** RHF generates a stable `id` per field entry.
**How to avoid:** Always `key={field.id}` on the mapped row element.

### Pitfall 4: Forgetting to Reset `userEditedEndTime` on Modal Close/Slot Change
**What goes wrong:** Second modal open auto-fill for end time doesn't work because `userEditedEndTime` is still `true` from a previous session.
**How to avoid:** Set `setUserEditedEndTime(false)` inside the `newBookingSlot` `useEffect` that resets the form (line ~562).

### Pitfall 5: `serviceId` Field in Service Rows Needs `undefined` Default, Not `0`
**What goes wrong:** Default of `0` passes Zod's `.positive()` check differently and the Select component shows incorrect placeholder state.
**How to avoid:** Default each row's `serviceId` to `undefined as unknown as number` — same pattern as the current single `serviceId` default at line 554.

### Pitfall 6: `onSubmit` Still References Removed `selectedService` / `endTimeOverride`
**What goes wrong:** The current `onSubmit` (lines 706–751) references `selectedService`, `computedTotalDurationMinutes`, and `values.endTimeOverride` — all of which are removed in the new design.
**How to avoid:** The submit handler must be rewritten entirely. `totalDurationMinutes` now derives from `endTime - startTime` arithmetic. `totalPrice` sums across all service rows. No `selectedService` check needed (Zod min(1) on `services` array handles validation).

---

## State of the Art

| Old Approach | Current Approach | Changed In | Impact on Phase 18 |
|--------------|------------------|------------|---------------------|
| Single service per admin booking | Multiple services via `cartItems` array | Phase 14 | Server is ready; only form layer needs updating |
| `endTimeOverride` toggle switch | Always-editable time input | Phase 18 (this phase) | Simplification — fewer state vars |
| Manual state for dynamic lists | `useFieldArray` | Phase 18 (first use in project) | New import, zero new packages |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 18 is entirely frontend code/CSS changes. No external tools, services, databases, or CLI utilities beyond the project's existing dev server are required.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in project (no vitest.config, no jest.config, no test/ directory outside node_modules) |
| Config file | None |
| Quick run command | `npm run check` (TypeScript type checking only) |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAL-01 | `.rbc-label` visually aligns with grid line | manual | Visual inspection in browser | N/A |
| CAL-02 | Modal ≥600px on screens >768px | manual | Visual inspection in browser | N/A |
| CAL-03 | Multiple service rows added, submitted, persist in booking | manual | Open calendar, click slot, add 2 services, submit | N/A |
| CAL-04 | Typing in end time overrides auto-compute | manual | Visual + form submission test | N/A |
| CAL-05 | Address field hidden when `customer-comes-in`, visible for `at-customer`/`both` | manual | Change company settings model, reopen modal | N/A |
| CAL-06 | Brand yellow submit button present | manual + `npm run check` | `npm run check` catches className regressions only | N/A |

### Sampling Rate
- **Per task commit:** `npm run check` (TypeScript type safety)
- **Per wave merge:** `npm run check` + visual browser verification
- **Phase gate:** `npm run check` green + all 6 manual acceptance criteria met before `/gsd:verify-work`

### Wave 0 Gaps
None — no test files to create. This project has no automated test infrastructure. TypeScript (`npm run check`) is the only automated quality gate. Manual browser verification is the validation path for all UI changes.

---

## Open Questions

1. **Address field: what Zod validation when shown?**
   - What we know: Currently `z.string().min(3, 'Address is required')` — must become optional for CAL-05
   - What's unclear: Should there be a minimum length validation when `at-customer` is set and the field IS visible? The context decisions don't specify.
   - Recommendation: Make it `z.string().optional().or(z.literal(''))` unconditionally in the Zod schema. Optionally add a superRefine check at submit if `showAddressField && !values.customerAddress` — but this complicates the schema. Simplest approach: remove validation, rely on attendant behavior. Phase 19 can add stricter validation.

2. **`customerNotes` routing in multi-service payload**
   - What we know: Current D-02 says notes attach to the cart item (`bookingItems.customerNotes`). With multiple services, it's ambiguous which item gets the notes.
   - Recommendation: Attach `customerNotes` to the first cart item only (index 0), consistent with current behavior. The planner should document this explicitly in the plan.

3. **Watch pattern for `watchedServices` in computed total/duration**
   - What we know: `form.watch('services')` returns the array; individual row changes must trigger recompute.
   - Recommendation: Use `const watchedServices = form.watch('services')` at component render level, include in `useMemo` and `useEffect` deps. This is the standard RHF pattern for arrays.

---

## Sources

### Primary (HIGH confidence)
- File inspection: `client/src/components/admin/AppointmentsCalendarSection.tsx` — full file read, exact line numbers confirmed
- File inspection: `client/src/index.css` lines 375–420 — current `.rbc-label` CSS rule confirmed
- File inspection: `client/src/components/admin/shared/types.ts` — `CompanySettingsData.serviceDeliveryModel: string | null` confirmed
- File inspection: `server/routes/bookings.ts` lines 53–130 — `cartItems` array support confirmed
- File inspection: `server/routes/company.ts` lines 21–66 — `serviceDeliveryModel: "at-customer"` default confirmed
- File inspection: `client/src/context/CompanySettingsContext.tsx` — `useCompanySettings` hook API confirmed
- File inspection: `shared/schema.ts` lines 434–470 — `cartItemSchema` and `insertBookingSchema.cartItems` confirmed
- File inspection: `.planning/phases/17-favicon-legal-company-type-admin-ui/17-CONTEXT.md` — D-09 enum values confirmed
- File inspection: `.planning/phases/18-admin-calendar-improvements/18-CONTEXT.md` — all decisions D-01 through D-14

### Secondary (MEDIUM confidence)
- `react-hook-form` `useFieldArray` API — confirmed available in installed package via `node_modules/react-hook-form/dist/__tests__/useFieldArray/` test files; standard RHF v7 API
- Social links pattern in `CompanySettingsSection.tsx` lines 360–419 — manual array state (not `useFieldArray`); `useFieldArray` is the cleaner alternative the context decisions mandate

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed, exact imports verified
- Architecture: HIGH — exact current code inspected, line numbers confirmed
- Pitfalls: HIGH — derived from actual code state, not hypothetical
- Server contract: HIGH — `cartItems` array confirmed in both schema and route handler

**Research date:** 2026-04-30
**Valid until:** 2026-06-01 (stable codebase, no external dependencies)
