---
phase: 14-admin-calendar-create-booking-from-slot
plan: 01
subsystem: admin/calendar
tags: [admin, calendar, booking, form, react-hook-form]
dependency_graph:
  requires:
    - shared/schema.ts (services, bookings)
    - client/src/components/ui/form.tsx
    - client/src/components/ui/select.tsx
    - client/src/components/ui/switch.tsx
    - client/src/lib/queryClient.ts
  provides:
    - Booking creation form scaffold inside AppointmentsCalendarSection
    - addMinutesToHHMM helper at module scope
    - bookingFormSchema (Zod) and BookingFormValues type
    - selectedService / computedEndTime / estimatedTotal reactive memos
  affects:
    - client/src/components/admin/AppointmentsCalendarSection.tsx
tech_stack:
  added:
    - react-hook-form (already in repo deps)
    - @hookform/resolvers/zod (already in repo deps)
  patterns:
    - useForm + zodResolver + shadcn <Form> components
    - useQuery(['/api/services']) — same pattern as BookingsSection.tsx
    - useEffect-based form.reset() on prefill-source state change
    - Reactive computed displays via form.watch + useMemo
key_files:
  created: []
  modified:
    - client/src/components/admin/AppointmentsCalendarSection.tsx
decisions:
  - Local bookingFormSchema (not insertBookingSchema) for atomic field validation; cartItems mapping deferred to Plan 03 submit
  - addMinutesToHHMM placed at module scope alongside hexToRgba (no date-fns dependency to keep helper tiny)
  - onSubmit left as console.log placeholder per plan spec — Plan 03 wires the mutation
  - Form pre-fill driven by useEffect watching newBookingSlot (matches existing slot state shape)
metrics:
  duration_minutes: 3
  completed_date: "2026-04-28"
  tasks_completed: 2
  commits: 2
---

# Phase 14 Plan 01: Booking Form Scaffold Summary

Replaces the placeholder Create-Booking modal body in `AppointmentsCalendarSection.tsx` with a complete react-hook-form scaffold that pre-fills slot context, computes end time and estimated total reactively, and exposes an end-time override toggle — leaving `onSubmit` as a no-op placeholder for Plan 03 to wire the actual mutation.

## What Was Built

### Form Schema (BookingFormValues)

Local Zod schema defined above the component:

```ts
const bookingFormSchema = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().min(7),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerAddress: z.string().min(3),
  bookingDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  staffMemberId: z.number().nullable().optional(),
  serviceId: z.number().int().positive(),
  quantity: z.number().int().min(1).default(1),
  customerNotes: z.string().optional(),
  endTimeOverride: z.boolean().default(false),
});
type BookingFormValues = z.infer<typeof bookingFormSchema>;
```

Why a local schema rather than `insertBookingSchema`: the API request body uses `cartItems[]`, but the form collects atomic `serviceId` + `quantity`. Mapping happens at submit time (Plan 03). A local schema gives field-level errors via react-hook-form without faking a `cartItems` array on the form.

### Pre-fill Behaviour

A `useEffect` watching `newBookingSlot` calls `form.reset(...)` whenever the slot state transitions from null to populated:

- `bookingDate` ← `newBookingSlot.date`
- `startTime` ← `newBookingSlot.startTime`
- `staffMemberId` ← `newBookingSlot.staffMemberId ?? null`
- All customer fields cleared
- `serviceId` cleared (forces "Select a service" state)
- `quantity = 1`, `endTimeOverride = false`

This guarantees re-opening the modal for a different slot does not leak prior input.

### Computed Values

Three `useMemo`s driven by `form.watch`:

- `selectedService` — looks up the service by `watchedServiceId` from `selectableServices` (filters out archived + hidden)
- `computedEndTime` — `addMinutesToHHMM(startTime, durationMinutes × quantity)` when service + start are present
- `estimatedTotal` — `Number(service.price) × quantity`, formatted to 2 decimals

A second `useEffect` writes `computedEndTime` back into the form via `form.setValue('endTime', ...)` — but only when `endTimeOverride === false`. When the toggle is ON, the editable `<Input type="time">` becomes the source of truth and the auto-compute is suppressed.

### Visible Fields (top → bottom)

1. Date (read-only display from `newBookingSlot.date`)
2. Start time (read-only display from `newBookingSlot.startTime`)
3. Staff — read-only when pre-filled, `<Select>` from `scopedStaffList` otherwise (D-13)
4. Customer name `<Input>` (placeholder "Type to search or enter new" — type-ahead wires in Plan 02)
5. Phone `<Input>` (required)
6. Email `<Input>` (optional)
7. Address `<Input>` (required — D-14)
8. Service `<Select>` from `useQuery<Service[]>(['/api/services'])`, archived/hidden filtered out
9. Quantity `<Input type="number" min={1}>`, defaulted to 1
10. End time — read-only computed display (or `<Input type="time">` when override is ON)
11. "Adjust end time" `<Switch>` (D-07)
12. Estimated total — `${(service.price × quantity).toFixed(2)}` (D-09)
13. Customer notes `<Textarea>` (optional)
14. Submit `<Button>` — Brand Yellow `#FFFF01`, black bold text, pill-shaped per CLAUDE.md

### Placeholder onSubmit (Plan 03 will replace)

```ts
const onSubmit = (values: BookingFormValues) => {
  // TODO Plan 03: wire mutation, close modal on 201, surface 409/400 errors
  console.log('TODO Plan 03: submit', values);
};
```

The form runs validation, but submission produces a console log only. Plan 03 will replace this body with `useMutation` against `POST /api/bookings`, mapping `{serviceId, quantity}` → `cartItems`, applying defaults `status='confirmed'` (D-10) / `paymentMethod='site'` (D-11), invalidating `['/api/bookings']`, surfacing 409/400 errors.

## File Diff Summary

**`client/src/components/admin/AppointmentsCalendarSection.tsx`**

Imports added/extended (Task 1):
- `useMutation`, `useQueryClient` (merged into existing `@tanstack/react-query` import)
- `useForm` from `react-hook-form`
- `zodResolver` from `@hookform/resolvers/zod`
- `z` from `zod`
- `Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription` from `@/components/ui/form`
- `Input` from `@/components/ui/input`
- `Textarea` from `@/components/ui/textarea`
- `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `@/components/ui/select`
- `Switch` from `@/components/ui/switch`
- `Label` from `@/components/ui/label`
- `useToast` from `@/hooks/use-toast`
- `apiRequest, authenticatedRequest` from `@/lib/queryClient`
- `Service` type added to `@shared/schema` import

Module-scope additions (Task 1 + 2):
- `bookingFormSchema` Zod object + `BookingFormValues` type (Task 1)
- `addMinutesToHHMM(hhmm, minutes)` helper, placed after `hexToRgba` (Task 2)

Component-body additions (Task 2, after `activeFilterCount` and before `handleSelectEvent`):
- `useToast()` and `useQueryClient()` hooks
- `useQuery<Service[]>(['/api/services'])` + `selectableServices` memo
- `useForm<BookingFormValues>` with full defaultValues
- `useEffect` that resets form on `newBookingSlot` change
- 4 `form.watch(...)` reads (`watchedServiceId`, `watchedQuantity`, `watchedStartTime`, `watchedEndTimeOverride`)
- `selectedService` / `computedEndTime` / `computedTotalDurationMinutes` / `estimatedTotal` memos
- `useEffect` that writes `computedEndTime` back into the form when override is OFF
- Placeholder `onSubmit` console.log

Modal body replacement (Task 2):
- Old body (lines 782–822, ~40 lines): placeholder paragraph + "Go to Bookings" redirect button — REMOVED
- New body (~170 lines): complete `<Form>` with 14 fields/displays — ADDED

Net change: ~261 insertions, ~29 deletions across two commits.

## Deviations from Plan

None — plan executed exactly as written.

## Acceptance Criteria

### Task 1
- File contains `import { useForm } from 'react-hook-form'` — PASS
- File contains `import { zodResolver } from '@hookform/resolvers/zod'` — PASS
- File contains `from '@/components/ui/form'` — PASS
- File contains `const bookingFormSchema = z.object(` — PASS
- File contains `type BookingFormValues = z.infer<typeof bookingFormSchema>` — PASS
- File contains `customerAddress: z.string().min(3` (D-14 required-address) — PASS
- File contains `endTimeOverride: z.boolean().default(false)` (D-07) — PASS
- `npm run check` exits 0 — PASS

### Task 2
- File contains `useForm<BookingFormValues>(` — PASS (line 527)
- File contains `zodResolver(bookingFormSchema)` — PASS
- File contains `useQuery<Service[]>({` — PASS
- File contains `addMinutesToHHMM(` — PASS (definition line 155, use line 577)
- File contains `endTimeOverride` — PASS
- File contains `Adjust end time` — PASS (line 1057)
- File contains `Estimated total` — PASS (line 1076-1078)
- File contains `bg-[#FFFF01] text-black font-bold rounded-full` — PASS (line 1092)
- File does NOT contain `Use the Bookings section to create the full booking with services and pricing.` — PASS (removed)
- File does NOT contain `Go to Bookings` — PASS (removed)
- File contains `useEffect` calling `form.reset(` triggered by `newBookingSlot` change — PASS
- `npm run check` exits 0 — PASS
- `npm run build` exits 0 — PASS (3 pre-existing esbuild warnings about `import.meta` in cjs server output, unrelated to this plan)

## Commits

- `18537a9` feat(14-01): add booking form imports and schema to AppointmentsCalendarSection
- `2bb6983` feat(14-01): replace placeholder modal body with full booking form scaffold

## What Plan 02 Will Add

Type-ahead customer search wired into the `customerName` field — typing queries `GET /api/contacts?search=&limit=`, suggestions populate name/phone/email/address on selection (D-05/D-06). The form scaffold is now ready for that drop-in.

## What Plan 03 Will Add

Replaces the placeholder `onSubmit` with a real `useMutation`:
- Maps form values → `insertBookingSchema` body (cartItems array, `status: 'confirmed'`, `paymentMethod: 'site'`)
- POSTs to `/api/bookings`
- On 201 success: close modal, invalidate `['/api/bookings']`, toast "Booking created" (D-15)
- On 409: inline conflict message (D-16)
- On 400: surface field-level Zod errors (D-17)

## Self-Check: PASSED

- File `client/src/components/admin/AppointmentsCalendarSection.tsx` exists — FOUND
- Commit `18537a9` exists — FOUND
- Commit `2bb6983` exists — FOUND
- All Task 1 acceptance criteria met
- All Task 2 acceptance criteria met
- `npm run check` exits 0 (no TypeScript regressions)
- `npm run build` exits 0 (production build succeeds)
