# Phase 34: Component Split — Research

**Researched:** 2026-05-11
**Domain:** React component decomposition — large TSX files, prop-drilling vs context, useRef guard preservation
**Confidence:** HIGH

---

## Summary

Phase 34 is a pure refactoring phase with zero behavioural change. Both target files are
oversized monoliths: `BookingPage.tsx` (~39 KB, 948 lines) and `AppointmentsCalendarSection.tsx`
(~49 KB, 1566 lines). Both are self-contained UI orchestrators that own all their state and
delegate nothing to child components today.

The split strategy is clear from reading the files. `BookingPage` renders five distinct
conditional blocks (`step === 2 | 3 | 4 | 5` plus an inner duration sub-step). Each block
maps directly to a named sub-component requirement. All shared state lives in the parent and
must **stay there** (SPLIT-02). The `bookingStartedFiredRef` guard is a `useRef` in the parent;
it must stay in the parent and must **not** be moved into any child (SPLIT-03).

`AppointmentsCalendarSection` has two extractable modal blocks: the "Create Booking" `<Dialog>`
(lines 1252–1562) and the `<QuickBookModal>` wrapper (lines 1233–1249, delegating to the
already-extracted `QuickBookModal` component). The drag-to-reschedule logic is embedded in
`handleEventDrop` and `reassignMutation` — these should move into a `useDragToReschedule` hook
or be co-located with a wrapper component.

**Primary recommendation:** Extract sub-components by lifting JSX blocks into new files
inside `client/src/pages/booking/` and `client/src/components/admin/calendar/`. Pass
all shared state downward as typed props. No new context, no hook proliferation beyond what
already exists.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPLIT-01 | BookingPage refactored to thin orchestrator; five step sub-components extracted | Anatomy of BookingPage confirmed — five `step ===` blocks map 1-to-1 to required component names |
| SPLIT-02 | Shared state remains in BookingPage parent | All state (`step`, `selectedDate`, `selectedTime`, `selectedStaff`, `selectedDurations`, `selectedFrequencyId`, `form`, `createBooking`, `checkoutMutation`, etc.) is in the parent and must stay there |
| SPLIT-03 | booking_started useRef fire-once guard preserved | `bookingStartedFiredRef` at line 216 of BookingPage.tsx — must remain in parent component only |
| SPLIT-04 | AppointmentsCalendarSection: CreateBookingModal and drag-to-reschedule extracted | Create Booking Dialog block (lines 1252–1562) is extractable; drag logic in `handleEventDrop` + `reassignMutation` is extractable |
| SPLIT-05 | Full booking flow works after split — no regressions | TypeScript type coverage + manual smoke-test of booking flow is the verification gate |
</phase_requirements>

---

## Standard Stack

No new libraries. All tools already in the project.

### Core (already installed)
| Tool | Purpose | Notes |
|------|---------|-------|
| React 18 + TypeScript | Component model | `FC<Props>` pattern with explicit prop types |
| `useCart` (CartContext) | Cart state | Sub-components import via `useCart()` hook — no prop drilling needed for cart |
| `useCompanySettings` | Settings context | Same — import in child if needed |
| `react-hook-form` (Controller / `UseFormReturn`) | Form state | `form` object passed as prop to steps that render form fields |
| `@tanstack/react-query` | Server state | `useMutation` / `useQuery` results passed as props |
| Wouter `useLocation` | Navigation | Used in onSubmit; stays in parent |
| shadcn/ui `Dialog` | Modal shell | Extracted `CreateBookingModal` wraps existing Dialog JSX |

**Installation:** None required — all dependencies exist.

---

## Architecture Patterns

### Recommended Project Structure (after split)

```
client/src/pages/
├── BookingPage.tsx                   # Thin orchestrator — state + step routing only
└── booking/
    ├── StepStaffSelector.tsx         # step === 2 block (lines 341-394)
    ├── StepTimeSlot.tsx              # step === 3 block (lines 449-598) + duration sub-step (lines 397-447)
    ├── StepCustomerDetails.tsx       # step === 4 block (lines 601-676)
    ├── StepPaymentMethod.tsx         # step === 5 block (lines 679-770)
    ├── StepConfirmation.tsx          # Empty-cart guard (lines 315-330) — optional; small enough to leave inline
    └── BookingSummary.tsx            # Sticky sidebar (lines 775-943)

client/src/components/admin/
├── AppointmentsCalendarSection.tsx   # Thin shell — calendar + filters only
└── calendar/
    ├── CreateBookingModal.tsx        # Dialog open={!!newBookingSlot && !isQuickBook} (lines 1252-1562)
    └── useDragToReschedule.ts        # reassignMutation + handleEventDrop extracted to hook
```

**Reference:** The `ServicesSection` split in `client/src/components/admin/services/` is the
established pattern for this project. It keeps the parent (`ServicesSection.tsx`) as state
owner and exports sub-components (`ServiceForm`, `ServiceGridItem`, `ServiceListRow`,
`CategoryReorderRow`) from a sibling subdirectory.

### Pattern 1: Props-down, callbacks-up for step sub-components

Each booking step receives the minimum props it needs to render and one `onNext` callback:

```typescript
// client/src/pages/booking/StepStaffSelector.tsx
interface StepStaffSelectorProps {
  staffList: StaffMember[] | undefined;
  selectedStaff: StaffMember | null;
  onSelectStaff: (staff: StaffMember | null) => void;
  onNext: () => void;
}

export function StepStaffSelector({
  staffList,
  selectedStaff,
  onSelectStaff,
  onNext,
}: StepStaffSelectorProps) {
  // JSX lifted verbatim from BookingPage lines 341–394
}
```

### Pattern 2: Passing react-hook-form to sub-components

`StepCustomerDetails` and `StepPaymentMethod` both need `form`. Pass `UseFormReturn<BookingFormValues>`:

```typescript
// client/src/pages/booking/StepCustomerDetails.tsx
import type { UseFormReturn } from 'react-hook-form';
import type { BookingFormValues } from '../BookingPage'; // re-export type

interface StepCustomerDetailsProps {
  form: UseFormReturn<BookingFormValues>;
  onNext: () => void;
  onBack: () => void;
}
```

This avoids duplicating the Zod schema — `bookingFormSchema` and `BookingFormValues` are
defined once in `BookingPage.tsx` and imported by the child.

### Pattern 3: CreateBookingModal receives all its data as props

```typescript
// client/src/components/admin/calendar/CreateBookingModal.tsx
interface CreateBookingModalProps {
  open: boolean;
  slot: { date: string; startTime: string; staffMemberId?: number } | null;
  scopedStaffList: StaffMember[];
  selectableServices: Service[];
  showAddressField: boolean;
  getAccessToken: () => Promise<string | null>;
  onClose: () => void;
  onSuccess: () => void;
  onOpenQuickBook?: () => void;
}
```

The `form`, `useFieldArray`, `createBookingMutation`, and all contact-search state that
currently lives in `AppointmentsCalendarSection` moves inside `CreateBookingModal` — it
can own its own local state because the dialog is mounted/unmounted on each slot selection.

### Pattern 4: useDragToReschedule hook

```typescript
// client/src/components/admin/calendar/useDragToReschedule.ts
export function useDragToReschedule({
  getAccessToken,
  scopedStaffList,
}: {
  getAccessToken: () => Promise<string | null>;
  scopedStaffList: StaffMember[];
}) {
  // reassignMutation definition + handleEventDrop logic
  return { handleEventDrop };
}
```

### Anti-Patterns to Avoid

- **Moving `bookingStartedFiredRef` into a child:** The ref guard prevents re-firing
  `booking_started` when settings reload. If placed in a child, remounting the child
  (e.g., navigating between steps) would reset the ref and re-fire the event.
- **Creating a new BookingFlowContext:** SPLIT-02 explicitly states state stays in the parent.
  A context would be over-engineering for a single-page flow with a fixed step count. Props
  are the right vehicle here.
- **Moving `form` initialisation into sub-components:** `react-hook-form`'s `useForm` must be
  called once for the full form. Splitting it across components would break cross-field
  validation (e.g., triggering only name/email/phone fields on step 4, then address on step 5).
- **Splitting the Zod schema:** `bookingFormSchema` and `BookingFormValues` must stay co-located
  with the `useForm` call. Export them from `BookingPage.tsx` so children can import the type.
- **Extracting `QuickBookModal` again:** It is already a separate component
  (`client/src/components/admin/QuickBookModal.tsx`). The calendar split only needs to move the
  full-form Create Booking `Dialog`, not the quick-book wrapper.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe prop contracts | Manual interface duplication | TypeScript `export type` from parent file | Single source of truth; compiler enforces contract |
| Form state sharing | Duplicate `useForm` in each step | Pass `UseFormReturn<T>` as a prop | react-hook-form is designed for this; calling twice creates two independent form states |
| Step navigation | Custom router or context | `step` state + `handleNextStep` in parent, `onNext`/`onBack` props to children | Simplest possible; matches existing code |

---

## Runtime State Inventory

Step 2.5: SKIPPED — this is a code-only refactor. No database tables, stored keys,
external service config, or OS-registered state is renamed or changed. No runtime state
migration is required.

---

## Environment Availability

Step 2.6: SKIPPED — no external tools or services beyond the project's own React/TypeScript
stack are required for this phase.

---

## Common Pitfalls

### Pitfall 1: useRef reset after extract
**What goes wrong:** `bookingStartedFiredRef` is moved into `StepStaffSelector` or a shared
hook. When step changes, the parent re-renders but `bookingStartedFiredRef.current` is now in
a child's closure scope. If the child unmounts (step changes away from 2) and remounts,
the ref resets to `false`, causing `booking_started` to fire twice.
**Why it happens:** `useRef` lifetime is tied to the component instance, not the value it holds.
**How to avoid:** Keep `bookingStartedFiredRef` in `BookingPage` — it fires once in the mount
`useEffect` that runs regardless of which step is rendered.
**Warning signs:** Analytics showing duplicate `booking_started` events per session.

### Pitfall 2: form.trigger across steps breaks
**What goes wrong:** Step 4 calls `form.trigger(["customerName", "customerEmail", "customerPhone"])`
to validate before advancing to step 5. If `form` is not the same instance, `trigger` operates
on an empty/different form.
**Why it happens:** Two `useForm()` calls produce two independent instances.
**How to avoid:** Single `useForm` in `BookingPage`, passed as a prop to all step components.

### Pitfall 3: stale closure in onSuccess callback
**What goes wrong:** `createBooking.mutate` onSuccess references `setLocation` from a parent
closure. After extract, the child's closure may capture an older `setLocation`.
**Why it happens:** `setLocation` from Wouter is stable but the callback captures the mutation
result `data` from the parent. If the mutation is moved to the child, `setLocation` must be
passed as a prop.
**How to avoid:** Keep `createBooking` and `checkoutMutation` in `BookingPage`. Pass their
`isPending` flags and a single `onSubmit` handler down to `StepPaymentMethod`.

### Pitfall 4: CreateBookingModal state leaked after close
**What goes wrong:** Contact search state (`contactSearchOpen`, `debouncedContactSearch`) or
form state persists across slot selections if the modal component does not unmount on close.
**Why it happens:** `<Dialog>` keeps children mounted when `open=false` by default in shadcn.
**How to avoid:** Add `key={newBookingSlot?.date + newBookingSlot?.startTime}` to the Dialog
or reset form in the `useEffect` watching `newBookingSlot` — this already exists in the current
code at line 609. Keep this reset effect inside `CreateBookingModal`.

### Pitfall 5: TypeScript import cycles
**What goes wrong:** `StepPaymentMethod.tsx` imports `BookingFormValues` from `BookingPage.tsx`,
but `BookingPage.tsx` imports `StepPaymentMethod`. Circular import.
**Why it happens:** Type and component in the same file.
**How to avoid:** Extract the Zod schema and form type to a sibling file:
`client/src/pages/booking/bookingSchema.ts`. Both `BookingPage` and step components import
from there.

---

## Code Examples

### BookingPage after split (orchestrator shape)

```typescript
// client/src/pages/BookingPage.tsx (after)
import { StepStaffSelector } from './booking/StepStaffSelector';
import { StepTimeSlot } from './booking/StepTimeSlot';
import { StepCustomerDetails } from './booking/StepCustomerDetails';
import { StepPaymentMethod } from './booking/StepPaymentMethod';
import { BookingSummary } from './booking/BookingSummary';

export default function BookingPage() {
  // --- ALL state stays here ---
  const [step, setStep] = useState<2 | 3 | 4 | 5>(2);
  const [selectedDate, setSelectedDate] = useState(...);
  // ... (all existing state declarations, unchanged)

  // --- bookingStartedFiredRef stays here ---
  const bookingStartedFiredRef = useRef(false);
  useEffect(() => {
    // Exact same guard — not moved
    if (!settingsReady || bookingStartedFiredRef.current) return;
    // ...
  }, [settingsReady, csForKey, items, totalPrice]);

  return (
    <div className="bg-slate-50 py-8 min-h-[60vh]">
      <div className="container-custom mx-auto max-w-5xl mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {step === 2 && staffCount > 1 && (
              <StepStaffSelector
                staffList={staffList}
                selectedStaff={selectedStaff}
                onSelectStaff={setSelectedStaff}
                onNext={() => handleNextStep(3)}
              />
            )}
            {step === 3 && (
              <StepTimeSlot
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                viewDate={viewDate}
                slots={slots}
                monthAvailability={monthAvailability}
                isSlotsPending={isSlotsPending}
                isMonthAvailabilityPending={isMonthAvailabilityPending}
                staffBySlot={staffBySlot}
                staffCount={staffCount}
                timeFormat={timeFormat}
                itemsWithDurations={itemsWithDurations}
                selectedDurations={selectedDurations}
                allDurationsSelected={allDurationsSelected}
                onSelectDate={setSelectedDate}
                onSelectTime={setSelectedTime}
                onViewDateChange={setViewDate}
                onDurationSelect={(svcId, duration) =>
                  setSelectedDurations((prev) => ({ ...prev, [svcId]: duration }))
                }
                onApplyDurations={() => { /* updateItem calls */ }}
              />
            )}
            {step === 4 && (
              <StepCustomerDetails
                form={form}
                onNext={() => handleNextStep(5)}
                onBack={() => setStep(3)}
              />
            )}
            {step === 5 && (
              <StepPaymentMethod
                form={form}
                finalPrice={finalPrice}
                isBelowMinimum={isBelowMinimum}
                minimumBookingValue={minimumBookingValue}
                adjustmentAmount={adjustmentAmount}
                isPending={createBooking.isPending || checkoutMutation.isPending}
                onSubmit={form.handleSubmit(onSubmit)}
                onBack={() => setStep(4)}
              />
            )}
          </div>
          <div className="lg:col-span-1" ref={summaryRef}>
            <BookingSummary
              items={items}
              step={step}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              selectedStaff={selectedStaff}
              totalDuration={totalDuration}
              totalPrice={totalPrice}
              finalPrice={finalPrice}
              isBelowMinimum={isBelowMinimum}
              minimumBookingValue={minimumBookingValue}
              adjustmentAmount={adjustmentAmount}
              timeFormat={timeFormat}
              frequencies={frequencies}
              selectedFrequencyId={selectedFrequencyId}
              onSelectFrequency={setSelectedFrequencyId}
              onRemoveItem={removeItem}
              onUpdateQuantity={updateQuantity}
              onContinueToContact={() => handleNextStep(4)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### bookingSchema.ts (avoids circular import)

```typescript
// client/src/pages/booking/bookingSchema.ts
import { z } from 'zod';

export const bookingFormSchema = z.object({
  customerName: z.string().min(2, 'Name is required'),
  customerEmail: z.string().email('Invalid email'),
  customerPhone: z.string().min(10, 'Valid phone number required'),
  customerStreet: z.string().min(5, 'Street address is required'),
  customerUnit: z.string().optional(),
  customerCity: z.string().min(2, 'City is required'),
  customerState: z.string().min(2, 'State is required'),
  paymentMethod: z.enum(['site', 'online']),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;
```

### AppointmentsCalendarSection after split (orchestrator shape)

```typescript
// AppointmentsCalendarSection.tsx (after) — keeps calendar, filters, metrics, staff legend
// No longer contains: Create Booking form, useFieldArray, form, reassignMutation inner logic

import { CreateBookingModal } from './calendar/CreateBookingModal';
import { useDragToReschedule } from './calendar/useDragToReschedule';

export function AppointmentsCalendarSection({ getAccessToken, staffMemberId }) {
  // State that drives the calendar (unchanged)
  const [newBookingSlot, setNewBookingSlot] = useState(null);
  const { handleEventDrop } = useDragToReschedule({ getAccessToken, scopedStaffList, toast, queryClient });

  return (
    <div className="space-y-6">
      {/* Header, metrics, DnDCalendar — unchanged */}

      {newBookingSlot?.isQuickBook && (
        <QuickBookModal ... />
      )}

      <CreateBookingModal
        open={!!newBookingSlot && !newBookingSlot?.isQuickBook}
        slot={newBookingSlot}
        scopedStaffList={scopedStaffList}
        selectableServices={selectableServices}
        showAddressField={showAddressField}
        getAccessToken={getAccessToken}
        onClose={() => setNewBookingSlot(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
          toast({ title: 'Booking created' });
        }}
        onOpenQuickBook={() =>
          setNewBookingSlot((prev) => prev ? { ...prev, isQuickBook: true } : null)
        }
      />
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| Colocated everything in one file | Extract sub-components with typed props | Standard for any React file > ~300 lines |
| useForm in child | useForm in parent, pass UseFormReturn<T> | react-hook-form docs explicitly support this |
| Context for everything | Props for local flow, Context for global state | Cart and CompanySettings remain in context; step flow uses props |

---

## Open Questions

1. **StepConfirmation vs inline empty-cart guard**
   - What we know: The empty-cart guard (lines 315–330) is 15 lines. SPLIT-01 lists `StepConfirmation` as one of the sub-components.
   - What's unclear: Whether that name refers to the empty-cart guard or a post-submission confirmation view (which lives at `/confirmation` route, not in BookingPage).
   - Recommendation: Name it `EmptyCartGuard.tsx` or simply leave it inline in `BookingPage`. The planner should clarify with the requirement owner.

2. **Duration selector placement**
   - What we know: The duration sub-step renders inside `step === 3` before the calendar (lines 397–447). It is conditional on `!allDurationsSelected`.
   - What's unclear: Should it be a separate component (`StepDurationSelector`) or bundled into `StepTimeSlot`?
   - Recommendation: Bundle into `StepTimeSlot` (it renders only inside the `step === 3` guard, sharing the same step). This avoids creating a 6th step component for what is a sub-state within step 3.

3. **reassignMutation: hook vs co-location**
   - What we know: `handleEventDrop` + `reassignMutation` are 60 lines.
   - What's unclear: Whether a custom hook is worth the indirection given the small size.
   - Recommendation: Extract as `useDragToReschedule` hook regardless — it touches `queryClient`, `toast`, and `scopedStaffList`, making it the right hook boundary.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no jest.config, vitest.config, or test/ directory found |
| Config file | None — Wave 0 must add if tests are written |
| Quick run command | `npm run check` (TypeScript type check as proxy) |
| Full suite command | `npm run check && npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPLIT-01 | BookingPage renders each step component without throwing | smoke | `npm run check` (type errors caught) | ❌ Wave 0 (optional) |
| SPLIT-02 | Shared state in parent drives child rendering | type check | `npm run check` | ✅ (TypeScript enforces prop contract) |
| SPLIT-03 | booking_started fires exactly once per session | manual | Manual browser test — dev tools Network tab | N/A |
| SPLIT-04 | CreateBookingModal opens/closes on slot click | smoke | Manual browser test in admin calendar | N/A |
| SPLIT-05 | Full booking flow completes end-to-end | e2e | Manual browser test: select service → complete booking | N/A |

### Sampling Rate
- **Per task commit:** `npm run check` — TypeScript must pass clean
- **Per wave merge:** `npm run check && npm run build` — build must succeed
- **Phase gate:** Both TypeScript and build green; manual booking flow smoke test before `/gsd:verify-work`

### Wave 0 Gaps
- No test files to create; verification relies on TypeScript strict mode and manual smoke test
- Confirm `npm run check` exits 0 before starting any wave

*(No automated test infrastructure gaps blocking this phase — TypeScript is the primary regression safety net for a pure refactor.)*

---

## Project Constraints (from CLAUDE.md)

- **Frontend stack:** React 18, TypeScript, Vite, Wouter (routing), React Query, shadcn/ui, Tailwind CSS — no new libraries
- **State management:** React Query for server state, Context API for cart/auth — no Redux, no new contexts
- **Storage layer pattern:** Not applicable for this front-end-only phase
- **Brand guidelines:** Sub-components must preserve all existing className strings verbatim — no style changes
- **Type safety:** `shared/schema.ts` is source of truth; sub-components import types from there
- **Memory note:** Admin tools should be lean; CreateBookingModal extraction follows this principle — simpler, not richer

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `client/src/pages/BookingPage.tsx` (948 lines, read in full)
- Direct code inspection of `client/src/components/admin/AppointmentsCalendarSection.tsx` (1566 lines, read in full)
- Direct code inspection of `client/src/context/CartContext.tsx` (read in full)
- Direct code inspection of `client/src/components/admin/ServicesSection.tsx` (reference pattern, partial read)

### Secondary (MEDIUM confidence)
- react-hook-form documentation pattern: passing `UseFormReturn<T>` as prop is an established and documented use case

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all tools already present
- Architecture: HIGH — both files read in full; exact line numbers documented
- Pitfalls: HIGH — derived from actual code reading, not speculation
- Validation: HIGH — TypeScript check is sufficient for pure refactor; no runtime infra gaps

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable project; no fast-moving dependencies)
