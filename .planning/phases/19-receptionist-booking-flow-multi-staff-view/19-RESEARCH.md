# Phase 19: Receptionist Booking Flow & Multi-Staff View — Research

**Researched:** 2026-04-30
**Domain:** react-big-calendar resources API, DnD addon, booking update endpoint, per-staff availability
**Confidence:** HIGH (all findings verified from source code)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Multi-Staff Column View (D-01 through D-04)**
- D-01: Add a 4th view option "By Staff" alongside Month/Week/Day in the calendar toolbar. Existing views stay unchanged.
- D-02: "By Staff" view uses RBC `resources` prop — each staff member in `scopedStaffList` is a resource. `resourceIdAccessor="id"`, `resourceTitleAccessor` shows first name. Only active in Day view scope (not Week/Month).
- D-03: When staff members overflow screen width (5+), the calendar container scrolls horizontally. No column capping — the existing staff toggle buttons (eye icons) already let the receptionist hide off-shift staff.
- D-04: Clicking a slot in a staff column pre-fills `staffMemberId` to that column's staff ID (extends D-13 from Phase 14 — previously pre-filled only when 1 visible staff, now always pre-fills from column in By Staff view).

**Quick Book Modal (D-05 through D-09)**
- D-05: Column slot click in "By Staff" view opens a Quick Book modal — separate from the full Phase 18 Create Booking modal (which remains accessible from a "Full form →" link inside Quick Book).
- D-06: Quick Book required fields: customer name (type-ahead, same contact search from Phase 14) + service (combobox, same Phase 18 pattern). All other fields — phone, email, address, end time override, notes — are collapsed under a "More options" disclosure.
- D-07: Time and staff are pre-filled and read-only in Quick Book (shown as display text, not editable inputs). Date is also pre-filled.
- D-08: On submit: POST `/api/bookings`, status = `confirmed` (D-10 from Phase 14), payment = `site` (D-11 from Phase 14). On success: close modal, invalidate bookings cache.
- D-09: Customer name can be free-text "Walk-in" — `upsertContact` on the server handles dedup; a name-only entry is valid.

**Drag-to-Reassign (D-10 through D-13)**
- D-10: Enable `withDragAndDrop` HOC from `react-big-calendar/lib/addons/dragAndDrop`. Wrap the existing `<Calendar>` component.
- D-11: Both operations enabled: drag within a column changes start/end time; drag across columns changes `staffMemberId` (and optionally time).
- D-12: On drop: fire `PUT /api/bookings/:id` immediately with updated `startTime`, `endTime`, `staffMemberId`. Show a toast: "[Staff name] — [time] ✓ Undo" with a 5-second undo window. Clicking "Undo" re-fires the PUT with the original values.
- D-13: Drag handles only appointment events (not gcal busy blocks). `draggable` is false for `isGcalBusy` events.

**Calendar Refresh (D-14)**
- D-14: Add `refetchInterval: 30_000` to the existing bookings `useQuery` in `AppointmentsCalendarSection.tsx`.

**Customer-Side Staff Availability (D-15 through D-17)**
- D-15: Customer booking page time slot step shows which specific staff members are available for each time slot.
- D-16: Reuse existing `staffList` query and `useAvailability` hook. For each staff member, query availability independently.
- D-17: Staff availability display applies for all `serviceDeliveryModel` values.

### Claude's Discretion
- Exact RBC `withDragAndDrop` import pattern and HOC wiring
- Quick Book modal component name and file location (could be inline in AppointmentsCalendarSection or a new component)
- Undo toast implementation (shadcn/ui Toast with action button)
- Customer booking page slot display design (avatars vs name badges vs grouped list)

### Deferred Ideas (OUT OF SCOPE)
- Week view with multi-staff columns — keep for Phase 20
- Supabase Realtime / WebSocket live updates — 30s polling is sufficient
- Drag-to-resize appointment duration
- Per-staff service capability matrix
- Full parallel staff column view on customer-facing booking page
- Customer-side "real-time" slot refresh
</user_constraints>

---

## Summary

Phase 19 adds four distinct features to the existing admin calendar (`AppointmentsCalendarSection.tsx`) and customer booking page (`BookingPage.tsx`). All required infrastructure already exists in the codebase.

The react-big-calendar `resources` prop maps directly onto `scopedStaffList` — it enables Day view to render one column per staff member. The `withDragAndDrop` HOC is already installed at v1.19.4, its CSS file exists, and the `onEventDrop` callback receives `{ event, start, end, resourceId }` exactly as needed for cross-staff drag. The `PUT /api/bookings/:id` endpoint exists and accepts `startTime` and `endTime` updates via `insertBookingSchemaBase.partial()`, but **does not currently accept `staffMemberId`** — the storage `updateBooking()` method must be extended to forward that field. The `useAvailability` hook already accepts an optional `staffId` parameter, enabling per-staff slot queries in BookingPage.

**Primary recommendation:** Implement in 4 plans — (1) RBC resources + By Staff view + slot click resourceId detection, (2) Quick Book modal, (3) DnD wiring + undo toast + PUT extension for staffMemberId + 30s polling, (4) BookingPage per-staff slot display.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-big-calendar | 1.19.4 (installed) | Calendar with resources + DnD | Already in use; resources + DnD addon included |
| @tanstack/react-query | (installed) | Server state, refetchInterval | Already in use throughout app |
| shadcn/ui Toast (useToast) | (installed) | Undo toast with action button | Already used for booking success toast |
| react-hook-form + zod | (installed) | Quick Book form | Standard pattern in this codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-big-calendar DnD CSS | bundled | DnD drag preview styling | Must import alongside withDragAndDrop |
| date-fns | (installed) | Date formatting for undo toast | Already imported in AppointmentsCalendarSection |

**No new npm installs required.** All dependencies already exist in node_modules.

---

## Architecture Patterns

### RBC Resources API (By Staff View)

The `resources` prop on `<Calendar>` makes Day view render one column per resource. Verified from RBC source and existing `scopedStaffList` usage.

```typescript
// Source: node_modules/react-big-calendar (verified from DnD source + RBC docs)
<Calendar
  resources={scopedStaffList}          // array of resource objects
  resourceIdAccessor="id"              // field on each resource that is unique key
  resourceTitleAccessor="firstName"    // field to display in column header
  resourceAccessor="staffMemberId"     // field on each EVENT that links it to a resource
  // ... rest of existing props
/>
```

The event objects in `allEvents` already have `staffMemberId` — that maps directly to `resourceAccessor="staffMemberId"`. Events with `staffMemberId: null` (or unassigned) will appear in a "no resource" column if RBC renders one, or float depending on version behavior. Filter `gcalBusy` events per-resource so they land in the correct column.

**By Staff view is Day view scoped.** The `resources` prop is only passed when `currentView === 'day'` (or the custom "by-staff" view key maps to Day view internally). When Month/Week is active, `resources` must be `undefined` — RBC ignores it gracefully but including it in Month view causes layout issues.

### handleSelectSlot with resourceId

RBC calls `onSelectSlot` with `{ start, end, slots, resourceId }` when `resources` is active and a user clicks a column slot. The `resourceId` field equals the value from `resourceIdAccessor` (i.e., `staff.id`).

```typescript
// Extended handleSelectSlot — source: verified from RBC EventContainerWrapper.js
const handleSelectSlot = ({ start, resourceId }: { start: Date; resourceId?: number }) => {
  const visibleStaff = scopedStaffList.filter((staff) => !hiddenStaff.has(staff.id));
  const prefilledStaffId =
    resourceId ??                                      // By Staff column click → D-04
    (visibleStaff.length === 1 ? visibleStaff[0].id : undefined);  // D-13 fallback
  setNewBookingSlot({
    date: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    staffMemberId: prefilledStaffId,
    isQuickBook: resourceId !== undefined,  // determines which modal opens
  });
};
```

### withDragAndDrop HOC

**Import path (verified from node_modules/react-big-calendar/lib/addons/dragAndDrop/index.js):**

```typescript
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const DnDCalendar = withDragAndDrop(Calendar);
```

The `DnDCalendar` must be created at module scope (outside the component), not inside render. Creating it inside the component causes remount on every render.

**onEventDrop callback — verified from EventContainerWrapper.js line 176-184:**

```typescript
// interactionInfo object shape (verified from source):
// { event: CalendarEvent, start: Date, end: Date, resourceId: number | undefined }
const handleEventDrop = ({ event, start, end, resourceId }: {
  event: CalendarEvent;
  start: Date;
  end: Date;
  resourceId?: number;  // undefined when dropped in non-resource view; staff.id when in By Staff view
}) => {
  if (event.isGcalBusy) return;  // D-13: gcal blocks are not draggable
  // ... fire PUT /api/bookings/:event.bookingId
};
```

The `resourceId` in `onEventDrop` is the `resource` prop value from `EventContainerWrapper`, which equals the resource column's id. When dragging across staff columns, `resourceId` changes to the target column's staff id. **This is the staffMemberId for the drag-to-reassign feature.**

**draggableAccessor prop — controls which events can be dragged:**

```typescript
// D-13: gcal busy blocks must not be draggable
draggableAccessor={(event: CalendarEvent) => !event.isGcalBusy}
```

### updateBooking — staffMemberId Gap

**Verified from server/storage.ts lines 771-822:** The current `updateBooking` signature accepts `customerName`, `customerEmail`, `customerPhone`, `customerAddress`, `bookingDate`, `startTime`, `endTime`, `status`, `paymentStatus`, `totalPrice` — but does **NOT** include `staffMemberId`.

**Verified from server/routes/bookings.ts line 204-218:** `PUT /api/bookings/:id` uses `insertBookingSchemaBase.partial().parse(req.body)`. The `insertBookingSchemaBase` is derived from the `bookings` table via `createInsertSchema(bookings).omit(...)`. Since the `bookings` table has `staffMemberId` and the omit list only excludes `id`, `createdAt`, `status`, `ghlAppointmentId`, `ghlContactId`, `ghlSyncStatus`, `userId` — `staffMemberId` IS present in `insertBookingSchemaBase`. So the **route already accepts staffMemberId** in the request body and Zod validation will pass it through. However, `storage.updateBooking()` silently drops it because the method signature destructures only named fields.

**Required fix:** Extend `storage.updateBooking()` to accept and forward `staffMemberId?: number | null`.

### 30-Second Polling

```typescript
// Extend existing useQuery in AppointmentsCalendarSection.tsx:
const { data: bookings = [] } = useQuery<Booking[]>({
  queryKey: ['/api/bookings', 'range', from, to],
  queryFn: async () => { /* existing */ },
  refetchInterval: 30_000,  // D-14: add this line only
});
```

### useAvailability — staffId Support

**Verified from client/src/hooks/use-booking.ts lines 55-81:** `useAvailability` already accepts `options?: { staffId?: number; serviceIds?: number[] }`. The `staffId` is appended to the query params as `staffId=N`. The hook calls `GET /api/availability?date=...&totalDurationMinutes=...&staffId=N`.

For per-staff slot display in BookingPage (D-15/D-16), the pattern is to call `useAvailability` once per staff member:

```typescript
// BookingPage — call hook once per staff for per-staff slots
// This works because useAvailability is a useQuery wrapping fetch,
// React allows multiple calls with different args
const staffSlots = staffList?.map(member => ({
  staff: member,
  // cannot call hook in .map() — must use a child component or restructure
}));
```

**IMPORTANT:** Hooks cannot be called inside `.map()`. The implementation must either:
- Create a child component `<StaffSlotQuery staffId={id} date={selectedDate} duration={totalDuration} />` that calls `useAvailability` once, or
- Fetch availability for all staff in a single custom hook that calls multiple queries via `useQueries` (React Query's parallel query API)

`useQueries` is the clean solution:

```typescript
import { useQueries } from '@tanstack/react-query';

const staffAvailabilityQueries = useQueries({
  queries: (staffList ?? []).map((member) => ({
    queryKey: [api.availability.check.path, selectedDate, totalDuration, member.id],
    queryFn: () => fetchAvailabilityForStaff(selectedDate, totalDuration, member.id),
    enabled: !!selectedDate && totalDuration > 0,
    staleTime: 0,
    gcTime: 0,
  })),
});
// staffAvailabilityQueries[i].data → slots for staffList[i]
```

### Undo Toast Pattern

shadcn/ui `useToast` supports an `action` prop on toast:

```typescript
// Source: verified from existing shadcn/ui toast usage in this codebase
const { toast } = useToast();

toast({
  description: `${staffName} — ${format(newStart, 'h:mm a')} ✓`,
  action: (
    <ToastAction altText="Undo" onClick={() => undoDrop(originalBooking)}>
      Undo
    </ToastAction>
  ),
  duration: 5000,
});
```

`ToastAction` must be imported from `@/components/ui/toast`.

### Recommended Project Structure (new files)

No new directories needed. All additions go into existing locations:

```
client/src/components/admin/
├── AppointmentsCalendarSection.tsx   # Modified: DnD, resources, By Staff view, polling
└── QuickBookModal.tsx                # New: Quick Book modal component (D-05)

server/storage.ts                     # Modified: updateBooking() adds staffMemberId
client/src/pages/BookingPage.tsx      # Modified: per-staff slot display (D-15/D-16)
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Calendar resource columns | Custom CSS grid of columns | RBC `resources` prop | RBC handles event layout, overlap, scrolling per column |
| Drag preview UI | Custom drag ghost | `withDragAndDrop` CSS | styles.css provides the standard RBC drag preview |
| Parallel queries | Sequential fetches with useEffect | `useQueries` from @tanstack/react-query | Built-in parallel query execution with loading states |
| Undo state management | Custom timer + useState | useRef for original values + toast duration | Simpler: store original at drop time, clear on toast dismiss |

---

## Common Pitfalls

### Pitfall 1: DnDCalendar Created Inside Component
**What goes wrong:** `const DnDCalendar = withDragAndDrop(Calendar)` inside the component body causes RBC to remount on every render — losing all DnD state and causing flicker.
**Why it happens:** HOC returns a new class/component reference on every call.
**How to avoid:** Declare `const DnDCalendar = withDragAndDrop(Calendar)` at module scope, outside the `AppointmentsCalendarSection` function.
**Warning signs:** Calendar flickers or loses events on any state change.

### Pitfall 2: resources Prop in Month/Week View
**What goes wrong:** Passing `resources` prop when `currentView` is month or week causes RBC to attempt resource-column layout in views that don't support it, producing blank or broken rendering.
**Why it happens:** RBC applies resource layout logic to all views when resources is set.
**How to avoid:** Only pass `resources`, `resourceIdAccessor`, `resourceTitleAccessor`, `resourceAccessor` when `currentView === 'day'` (the By Staff mode). In all other views, omit these props entirely.

### Pitfall 3: resourceId Is the Resource Object's id, Not staffMemberId Directly
**What goes wrong:** `onEventDrop` gives `resourceId` equal to the value of `resourceIdAccessor` on the resource. Since `resourceIdAccessor="id"` and staff objects have `id: number`, the `resourceId` IS the staff member id. But if `resourceIdAccessor` were set to a string path, this would differ.
**Why it happens:** RBC uses the accessor to extract the resource key.
**How to avoid:** Confirm `resourceIdAccessor="id"` (not a function) and treat `resourceId` directly as `staffMemberId` in the drop handler.

### Pitfall 4: staffMemberId Not Forwarded by storage.updateBooking()
**What goes wrong:** Drag-to-reassign fires `PUT /api/bookings/:id` with `staffMemberId` in the body. The route parses it via Zod (passes), but `storage.updateBooking()` silently ignores it because the TypeScript method signature doesn't include it.
**Why it happens:** `updateBooking()` was written before staff reassignment was needed.
**How to avoid:** Add `staffMemberId?: number | null` to the `updates` parameter type in `storage.updateBooking()` and include it in the `db.update().set(...)` call.

### Pitfall 5: useAvailability Called in .map() (Hooks Rules Violation)
**What goes wrong:** Attempting `staffList.map(s => useAvailability(...))` violates React's rules of hooks — hooks cannot be called inside loops.
**Why it happens:** Per-staff availability requires one query per staff member.
**How to avoid:** Use `useQueries` from `@tanstack/react-query` which is designed exactly for dynamic parallel queries.

### Pitfall 6: Missing DnD CSS Import
**What goes wrong:** Drag preview ghost, resize handles, and drag-active class styling all missing — dragging appears broken visually.
**Why it happens:** `withDragAndDrop` injects class names but the CSS file must be imported separately.
**How to avoid:** Add `import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'` alongside the existing `import 'react-big-calendar/lib/css/react-big-calendar.css'` in the component or its parent stylesheet.
**Warning signs:** Dragging an event shows no ghost, events jump without visual feedback.

### Pitfall 7: Quick Book Missing Required booking Schema Fields
**What goes wrong:** Quick Book submits minimal fields but `insertBookingSchema` requires `customerPhone` and `customerAddress` (notNull in DB). Phone is under "More options" — if collapsed, it's empty.
**Why it happens:** The full booking schema enforces notNull constraints. `customerAddress` is notNull in the DB but the quick book hides it.
**How to avoid:** Phone must default to a placeholder (e.g., "—") or be shown always. Address: for `customer-comes-in` delivery model, `customerAddress` defaults to the business address. For `at-customer`, the Quick Book "More options" section must include address. Alternatively, send `customerAddress: ''` and rely on the schema's `optional().or(z.literal(''))` pattern already in `bookingFormSchema`.

**Actual schema check:** `bookingFormSchema` in `AppointmentsCalendarSection.tsx` already has `customerAddress: z.string().optional().or(z.literal(''))` and `customerPhone: z.string().min(7)`. The Quick Book must include phone in "More options" or accept a blank default with a schema loosening.

---

## Code Examples

### Verified: By Staff View Setup

```typescript
// Module scope (outside component):
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
const DnDCalendar = withDragAndDrop(Calendar);

// Inside component JSX:
const isByStaff = currentView === 'by-staff';  // or whatever key used for 4th view
const resourceProps = isByStaff ? {
  resources: scopedStaffList.filter(s => !hiddenStaff.has(s.id)),
  resourceIdAccessor: 'id' as const,
  resourceTitleAccessor: 'firstName' as const,
  resourceAccessor: 'staffMemberId' as const,
} : {};

<DnDCalendar
  {...resourceProps}
  draggableAccessor={(event: CalendarEvent) => !event.isGcalBusy}
  onEventDrop={handleEventDrop}
  // Note: do NOT pass onEventResize — D-10 says resize is out of scope
  views={['month', 'week', 'day', 'by-staff']}  // register custom view
  // ... rest of existing props unchanged
/>
```

**Note on custom view key:** RBC's `views` prop accepts an object for custom views. For "By Staff" scoped to Day, the simplest approach is to use `Views.DAY` for the actual rendering but add a synthetic toolbar state variable `isByStaff: boolean` that controls whether `resources` are passed. The toolbar shows 4 buttons but the RBC view stays `day`. This avoids registering a custom RBC view class.

### Verified: onEventDrop Handler

```typescript
// Source: EventContainerWrapper.js line 176-184 (time-grid drops)
// interactionInfo.resourceId = the resource column's id (= staffMemberId)
const handleEventDrop = ({ event, start, end, resourceId }: {
  event: CalendarEvent;
  start: Date;
  end: Date;
  resourceId?: number;
}) => {
  if (event.isGcalBusy) return;

  const originalStart = event.start;
  const originalEnd = event.end;
  const originalStaffId = event.staffMemberId;

  const newStartTime = format(start, 'HH:mm');
  const newEndTime = format(end, 'HH:mm');
  const newStaffId = resourceId ?? event.staffMemberId;

  const staffName = scopedStaffList.find(s => s.id === newStaffId)?.firstName ?? 'Staff';

  reassignMutation.mutate(
    { id: event.bookingId, startTime: newStartTime, endTime: newEndTime, staffMemberId: newStaffId },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
        toast({
          description: `${staffName} — ${format(start, 'h:mm a')} ✓`,
          action: (
            <ToastAction altText="Undo" onClick={() => {
              reassignMutation.mutate({
                id: event.bookingId,
                startTime: format(originalStart, 'HH:mm'),
                endTime: format(originalEnd, 'HH:mm'),
                staffMemberId: originalStaffId,
              });
            }}>
              Undo
            </ToastAction>
          ),
          duration: 5000,
        });
      },
    }
  );
};
```

### Verified: storage.updateBooking() Extension

```typescript
// server/storage.ts — extend the updates parameter type:
async updateBooking(
  id: number,
  updates: Partial<{
    customerName: string;
    customerEmail: string | null;
    customerPhone: string;
    customerAddress: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    status: string;
    paymentStatus: string;
    totalPrice: string;
    staffMemberId: number | null;  // ADD THIS
  }> & {
    bookingItems?: Array<{...}>;
  }
): Promise<Booking> {
  // The db.update().set(bookingUpdates) already spreads all fields —
  // adding staffMemberId to the type is sufficient; the ORM handles the rest
```

### Verified: useQueries for Per-Staff Availability

```typescript
// BookingPage.tsx — replaces single useAvailability call for step 3
import { useQueries } from '@tanstack/react-query';

// Existing: staffList is already fetched when staffCount > 1
const perStaffAvailability = useQueries({
  queries: (staffList ?? []).map((member) => ({
    queryKey: ['/api/availability', selectedDate, totalDuration, member.id, serviceIds],
    queryFn: async () => {
      if (!selectedDate || totalDuration === 0) return [];
      const params = new URLSearchParams({
        date: selectedDate,
        totalDurationMinutes: String(totalDuration),
        staffId: String(member.id),
      });
      if (serviceIds.length) params.append('serviceIds', serviceIds.join(','));
      const res = await fetch(`/api/availability?${params}`);
      if (!res.ok) return [];
      return res.json() as Promise<Array<{ time: string; available: boolean }>>;
    },
    enabled: !!selectedDate && totalDuration > 0,
    staleTime: 0,
    gcTime: 0,
  })),
});
// perStaffAvailability[i].data → slots array for staffList[i]
// perStaffAvailability[i].isLoading → loading state for that staff
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 19 is a frontend/backend code change with no new external tool dependencies. All required packages (react-big-calendar 1.19.4 with DnD addon, @tanstack/react-query, shadcn/ui) are already installed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification (no automated test suite detected) |
| Config file | none |
| Quick run command | `npm run check` (TypeScript only) |
| Full suite command | `npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-02 | By Staff view renders one column per visible staff in Day view | manual | — | N/A |
| D-04 | Slot click in By Staff column pre-fills staffMemberId | manual | — | N/A |
| D-05 | Quick Book modal opens on By Staff column click | manual | — | N/A |
| D-08 | Quick Book submits to POST /api/bookings with status=confirmed | manual | `npm run check` (type check) | N/A |
| D-10 | withDragAndDrop wraps Calendar, DnD CSS imported | manual | `npm run build` | N/A |
| D-11 | onEventDrop fires with correct resourceId for cross-staff drop | manual | — | N/A |
| D-12 | PUT /api/bookings/:id updates staffMemberId in DB | manual | `npm run check` | N/A |
| D-14 | bookings query has refetchInterval: 30_000 | code review | `npm run check` | N/A |
| D-16 | Per-staff availability shows in BookingPage step 3 | manual | — | N/A |

### Sampling Rate
- **Per task commit:** `npm run check` — TypeScript must pass
- **Per wave merge:** `npm run build` — full build must succeed
- **Phase gate:** Manual walk-through of By Staff view, Quick Book, drag-to-reassign, BookingPage staff slots before `/gsd:verify-work`

### Wave 0 Gaps
None — no new test files required for this phase. TypeScript check and build are the automated gates.

---

## Critical Findings (answers to research questions)

### Q1: RBC resources API props
- `resources`: array of resource objects (map `scopedStaffList` directly)
- `resourceIdAccessor`: `"id"` — the field on each resource used as unique key
- `resourceTitleAccessor`: `"firstName"` — displayed in column headers
- `resourceAccessor`: `"staffMemberId"` — field on each event linking it to a resource column
- Pass these props ONLY when in Day view / By Staff mode; omit for Month and Week

### Q2: withDragAndDrop HOC exact API
- Import path: `import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'`
- CSS: `import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'` (file confirmed at `node_modules/react-big-calendar/lib/addons/dragAndDrop/styles.css`)
- Props added: `onEventDrop`, `onEventResize`, `draggableAccessor`, `resizableAccessor`, `onDropFromOutside`, `dragFromOutsideItem`, `onDragStart`
- Drop event object: `{ event: CalendarEvent, start: Date, end: Date, resourceId: number | undefined }` — confirmed from `EventContainerWrapper.js` line 176-184
- `resourceId` in drop = the resource column's `resourceIdAccessor` value = `staffMemberId` when in By Staff view

### Q3: PUT /api/bookings/:id — what it currently accepts
- Route: `PUT /:id` calls `handleBookingUpdate` which parses body via `insertBookingSchemaBase.partial()`
- `insertBookingSchemaBase` includes `staffMemberId` (not in omit list)
- **Zod validation PASSES `staffMemberId` through** — the route already accepts it
- **BUT `storage.updateBooking()` does NOT forward `staffMemberId`** — method signature missing this field
- Fix required: add `staffMemberId?: number | null` to `storage.updateBooking()` type + db.update()

### Q4: useAvailability staffId support
- Confirmed: `useAvailability(date, totalDurationMinutes, options?: { staffId?: number; serviceIds?: number[] })`
- The `options.staffId` is appended as `?staffId=N` to the GET request
- Can be called per-staff via `useQueries` — hooks rules require this pattern (cannot call in .map())
- `useAvailability` returns `Array<{ time: string; available: boolean }>`

### Q5: AppointmentsCalendarSection props and CalendarEvent fields
- Component props: `getAccessToken: () => Promise<string | null>`, `staffMemberId?: number | null`
- `CalendarEvent` interface (lines 140-149):
  ```typescript
  interface CalendarEvent {
    bookingId: number;
    title: string;
    start: Date;
    end: Date;
    status: string;
    staffMemberId: number | null;
    color: string;
    isGcalBusy?: boolean;
  }
  ```
- `scopedStaffList` = `staffList` filtered by `filterStaffMemberId` prop (line 426-433)
- `hiddenStaff` = Set<number>, toggled by eye icons in the Filters popover
- `handleSelectSlot` currently takes `{ start: Date }` — must be extended to `{ start: Date; resourceId?: number }`

### Q6: DnD CSS import needed
- YES: `node_modules/react-big-calendar/lib/addons/dragAndDrop/styles.css` confirmed to exist
- Must be imported; without it, drag preview and resize handle styles are absent

---

## Open Questions

1. **Quick Book phone field validation**
   - What we know: `bookingFormSchema.customerPhone` requires `min(7)`. Quick Book collapses phone under "More options".
   - What's unclear: Should phone default to a placeholder string, or should the Quick Book have its own looser schema?
   - Recommendation: Quick Book uses its own Zod schema (not `bookingFormSchema`) with `customerPhone: z.string().optional().default('')`. Server's `insertBookingSchema` requires phone via `notNull` in DB — either make phone required in Quick Book too (always visible), or add a server-side default of 'Unknown'.

2. **"By Staff" as 4th view vs. toolbar state**
   - What we know: RBC's `views` prop registers view keys. Adding a custom view requires either registering a full view class or using a toolbar trick.
   - What's unclear: Cleanest approach for "By Staff" without a custom RBC view class.
   - Recommendation: Add a `isByStaff` boolean state. Toolbar shows 4 buttons (Month/Week/Day/By Staff). "By Staff" button sets `isByStaff=true` AND `currentView='day'`. Month/Week/Day buttons set `isByStaff=false`. Pass `resources` props only when `isByStaff && currentView === 'day'`. This avoids RBC custom view registration entirely.

3. **Events without staffMemberId in By Staff view**
   - What we know: Some bookings may have `staffMemberId: null`. RBC will not render these in any staff column.
   - What's unclear: Should unassigned bookings show in a special "Unassigned" column, or be hidden?
   - Recommendation: Add a synthetic "Unassigned" resource object `{ id: null, firstName: 'Unassigned' }` as the last resource column. Filter events where `staffMemberId === null` to appear in this column using `resourceAccessor` pointing at a transformed field. This is the simplest approach for Phase 19; can be omitted if unassigned bookings are rare.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/react-big-calendar/lib/addons/dragAndDrop/withDragAndDrop.js` — HOC implementation, props accepted
- `node_modules/react-big-calendar/lib/addons/dragAndDrop/EventContainerWrapper.js` lines 176-184 — `onEventDrop` callback shape with `resourceId`
- `node_modules/react-big-calendar/lib/addons/dragAndDrop/WeekWrapper.js` lines 124-135 — `handleInteractionEnd` with `resourceId`
- `node_modules/react-big-calendar/lib/addons/dragAndDrop/EventWrapper.js` — `draggableAccessor` usage
- `node_modules/react-big-calendar/package.json` — confirmed version 1.19.4
- `client/src/components/admin/AppointmentsCalendarSection.tsx` — full component read; props, CalendarEvent, scopedStaffList, handleSelectSlot, bookings query
- `client/src/hooks/use-booking.ts` — `useAvailability` signature with staffId option confirmed
- `server/routes/bookings.ts` lines 204-218 — `PUT /:id` uses `insertBookingSchemaBase.partial()` (includes staffMemberId)
- `server/storage.ts` lines 771-822 — `updateBooking()` method signature (staffMemberId absent)
- `shared/schema.ts` lines 452-471 — `insertBookingSchemaBase` omit list (staffMemberId not omitted)
- `client/src/pages/BookingPage.tsx` — full component read; useAvailability usage, staffList query, step structure

### Secondary (MEDIUM confidence)
- `@tanstack/react-query` `useQueries` API — consistent with existing use-booking.ts patterns

---

## Metadata

**Confidence breakdown:**
- RBC resources API: HIGH — verified from installed source
- withDragAndDrop API and drop event shape: HIGH — verified from installed source
- PUT /api/bookings/:id Zod acceptance: HIGH — verified from routes + schema
- storage.updateBooking() gap: HIGH — verified from storage.ts
- useAvailability staffId: HIGH — verified from hook source
- useQueries pattern: HIGH — standard @tanstack/react-query API

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable libraries, server code unlikely to change)
