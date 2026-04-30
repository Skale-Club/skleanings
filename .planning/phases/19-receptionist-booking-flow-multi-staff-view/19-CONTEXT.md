# Phase 19: Receptionist Booking Flow & Multi-Staff View — Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform the admin calendar into a full receptionist station: add a "By Staff" parallel-column view, a Quick Book modal optimized for walk-in speed, drag-to-reassign (time + staff) with undo, 30-second polling for live-ish updates, and a customer-facing booking page improvement that shows per-staff availability during time slot selection.

**In scope:**
- New "By Staff" calendar view — Day-scoped RBC `resources` columns, one per staff member
- Quick Book modal — triggered from column slot click; name + service required; phone/email/address/notes collapsed under "More options"
- Drag-to-reassign — `withDragAndDrop` HOC; time and staff both moveable; instant save + undo toast
- React Query `refetchInterval: 30_000` on bookings query (no WebSockets needed)
- Customer booking page: staff availability shown per slot during time selection step

**Out of scope:**
- Week view with multi-staff columns (too many columns, deferred)
- Supabase Realtime / WebSocket live updates
- Customer-side parallel staff column calendar (full reception mirror)
- Drag-to-resize duration (separate concern)
- Per-staff service configuration / service capability matrix

</domain>

<decisions>
## Implementation Decisions

### Multi-Staff Column View (D-01 through D-04)
- **D-01:** Add a 4th view option "By Staff" alongside Month/Week/Day in the calendar toolbar. Existing views stay unchanged.
- **D-02:** "By Staff" view uses RBC `resources` prop — each staff member in `scopedStaffList` is a resource. `resourceIdAccessor="id"`, `resourceTitleAccessor` shows first name. Only active in Day view scope (not Week/Month).
- **D-03:** When staff members overflow the screen width (5+), the calendar container scrolls horizontally. No column capping — the existing staff toggle buttons (eye icons) already let the receptionist hide off-shift staff.
- **D-04:** Clicking a slot in a staff column pre-fills `staffMemberId` to that column's staff ID (extends D-13 from Phase 14 — previously pre-filled only when 1 visible staff, now always pre-fills from column in By Staff view).

### Quick Book Modal (D-05 through D-09)
- **D-05:** Column slot click in "By Staff" view opens a **Quick Book modal** — separate from the full Phase 18 Create Booking modal (which remains accessible from a "Full form →" link inside Quick Book).
- **D-06:** Quick Book required fields: **customer name** (type-ahead, same contact search from Phase 14) + **service** (combobox, same Phase 18 pattern). All other fields — phone, email, address, end time override, notes — are collapsed under a "More options" disclosure.
- **D-07:** Time and staff are pre-filled and read-only in Quick Book (shown as display text, not editable inputs). Date is also pre-filled. Attendant clicked the slot to set these — no reason to re-enter.
- **D-08:** On submit: POST `/api/bookings`, status = `confirmed` (D-10 from Phase 14), payment = `site` (D-11 from Phase 14). On success: close modal, invalidate bookings cache (same as Phase 14 D-15).
- **D-09:** Customer name can be free-text "Walk-in" when the customer is anonymous — `upsertContact` on the server handles dedup by email/phone; a name-only entry is valid.

### Drag-to-Reassign (D-10 through D-13)
- **D-10:** Enable `withDragAndDrop` HOC from `react-big-calendar/lib/addons/dragAndDrop`. Wrap the existing `<Calendar>` component.
- **D-11:** Both operations enabled: drag within a column changes start/end time; drag across columns changes `staffMemberId` (and optionally time if dropped at a different time in the new column).
- **D-12:** On drop: fire `PUT /api/bookings/:id` immediately with updated `startTime`, `endTime`, `staffMemberId`. Show a toast: "[Staff name] — [time] ✓ Undo" with a 5-second undo window. Clicking "Undo" re-fires the PUT with the original values.
- **D-13:** Drag handles only appointment events (not gcal busy blocks). `draggable` is false for `isGcalBusy` events — they cannot be moved.

### Calendar Refresh (D-14)
- **D-14:** Add `refetchInterval: 30_000` to the existing bookings `useQuery` in `AppointmentsCalendarSection.tsx`. No WebSockets. 30-second polling is sufficient for a receptionist workflow where booking creation cadence is measured in minutes.

### Customer-Side Staff Availability (D-15 through D-17)
- **D-15:** The customer booking page's time slot step currently shows available slots for any staff (or the selected staff if step 2 was not skipped). Enhancement: show which specific staff members are available for each time slot — a small avatar/name indicator per slot, or a grouped slot list by staff.
- **D-16:** Reuse existing `staffList` query and `useAvailability` hook. For each staff member, query availability independently. Show slots labeled by staff name so the customer can pick both time AND staff in one step.
- **D-17:** If `serviceDeliveryModel` is `customer-comes-in` or `both`, the staff availability step is relevant (staff at a fixed location). If `at-customer`, the staff availability display is still valid — the receptionist assigns who goes to the job.

### Carried Forward (unchanged from Phase 14)
- Status defaults to `confirmed` for admin-created bookings
- Payment method defaults to `site`
- `apiRequest` for contact search (cookie auth, not Bearer token)
- Phase 18 multi-service combobox reused inside Quick Book "More options"

### Claude's Discretion
- Exact RBC `withDragAndDrop` import pattern and HOC wiring
- Quick Book modal component name and file location (could be inline in AppointmentsCalendarSection or a new component)
- Undo toast implementation (shadcn/ui Toast with action button)
- Customer booking page slot display design (avatars vs name badges vs grouped list)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary Target Files
- `client/src/components/admin/AppointmentsCalendarSection.tsx` — main calendar component; contains `scopedStaffList`, `hiddenStaff`, current event handling, toolbar, slot click handler, Phase 18 Create Booking modal
- `client/src/pages/BookingPage.tsx` — customer-facing booking flow (748 lines); steps 2 (staff), 3 (date/time), 4 (address), 5 (payment); hooks: `useAvailability`, `useStaffCount`, `useMonthAvailability`

### Prior Phase Context
- `.planning/phases/14-admin-calendar-create-booking-from-slot/14-CONTEXT.md` — D-00 through D-19; core booking modal decisions (auth, defaults, type-ahead, pre-fill, submit)
- `.planning/phases/18-admin-calendar-improvements/18-CONTEXT.md` — D-01 through D-14; multi-service rows, end time logic, address conditional, modal width

### react-big-calendar
- `node_modules/react-big-calendar/lib/addons/dragAndDrop/` — DnD addon (already installed at v1.19.4)
- react-big-calendar resources API: `resources`, `resourceIdAccessor`, `resourceTitleAccessor`, `resourceAccessor` props on `<Calendar>`

### API Endpoints (verify before planning)
- `GET /api/staff` — staff list (used in AppointmentsCalendarSection)
- `POST /api/bookings` — create booking; accepts `cartItems[]`, `staffMemberId`, `status`
- `PUT /api/bookings/:id` — update booking (used for drag-to-reassign: startTime, endTime, staffMemberId)
- `GET /api/availability` — used by BookingPage hooks; verify it accepts `staffId` filter

### Shared Schema
- `shared/schema.ts` — `StaffMember`, `Booking`, `bookingItems` types; `insertBookingSchema` for validation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scopedStaffList` (AppointmentsCalendarSection, line ~426) — already computed array of visible staff; maps directly to RBC `resources` prop
- `hiddenStaff` Set — existing toggle logic; staff in this set should be excluded from `resources`
- `handleSelectSlot` — slot click handler; extend to detect which resource (staff column) was clicked
- Phase 18 service combobox (Popover + Command + CommandInput) — reuse in Quick Book modal
- Phase 14 customer type-ahead (Popover + Command + ContactSuggestion query) — reuse in Quick Book modal
- `getStaffColor(staffId)` — color by staff ID; reuse for resource column headers
- `useAvailability` hook (BookingPage) — accepts `staffId` filter; call once per visible staff for per-staff slot display
- `useStaffCount` hook — already in BookingPage; drives step 2 skip logic

### Established Patterns
- React Query `useQuery` with `queryKey: ['/api/bookings', ...]` — add `refetchInterval: 30_000` here
- shadcn/ui Toast (`useToast`) — already used for booking success; extend with action button for undo
- `withDragAndDrop` HOC: `import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'` — wraps Calendar component; add `onEventDrop` and `onEventResize` props
- Modal pattern: `Dialog`, `DialogContent`, `DialogHeader` from shadcn/ui — Quick Book uses same pattern as Phase 14/18 modals

### Integration Points
- AppointmentsCalendarSection `<Calendar>` → wrap with `withDragAndDrop` HOC
- AppointmentsCalendarSection toolbar → add "By Staff" button alongside existing Month/Week/Day
- Slot click `handleSelectSlot` → detect `resourceId` from RBC slot info when in By Staff view
- BookingPage step 3 (time slot selection) → add per-staff availability display
- `PUT /api/bookings/:id` → drag-to-reassign update endpoint (verify it accepts time + staff changes)

</code_context>

<specifics>
## Specific Ideas

- Quick Book layout modeled on the preview shown during discussion: header shows "Quick Book — [Staff name] [time]", two visible fields (customer type-ahead + service combobox), a collapsible "More options" section, brand yellow submit button full-width
- Undo toast wording: "[Staff first name] — [HH:MM AM/PM] ✓  Undo" with a countdown or simple close
- "By Staff" column headers: staff first name + avatar/color dot matching the existing `getStaffColor` color

</specifics>

<deferred>
## Deferred Ideas

- Week view with multi-staff columns — too many columns on screen, keep for Phase 20
- Supabase Realtime / WebSocket live updates — 30s polling is sufficient
- Drag-to-resize appointment duration — separate from reassignment, defer
- Per-staff service capability matrix (which staff can perform which service) — zero-config default (any staff = any service) is Phase 19 behavior
- Full parallel staff column view on customer-facing booking page — customer sees per-staff slots, not a full RBC calendar
- Customer-side "real-time" slot refresh — deferred; customer flow reloads on date change which is sufficient

</deferred>

---

*Phase: 19-receptionist-booking-flow-multi-staff-view*
*Context gathered: 2026-04-30*
