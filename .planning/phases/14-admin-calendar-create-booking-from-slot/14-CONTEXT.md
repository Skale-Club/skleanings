# Phase 14: Admin calendar create booking from slot — Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Let the attendant create a complete booking directly from a slot click on the admin calendar — without leaving the calendar.

**In scope:** Replace the placeholder "Create Booking" modal in `client/src/components/admin/AppointmentsCalendarSection.tsx` with a real booking-creation form pre-filled from slot context, wired to `POST /api/bookings`, and refreshing the calendar on success.

**Out of scope (other phases):** New customer-side flows, admin re-write of `/admin/bookings`, recurring booking creation from calendar, addon cross-sell in admin context, payment processing inside the modal.

</domain>

<decisions>
## Implementation Decisions

### Guiding Principle
- **D-00:** Simplify the attendant's life, not complicate. Lean over feature parity with the customer flow. Pre-fill aggressively, default values that remove decisions, single-screen form. When in doubt about a feature, leave it out.

### Modal Scope
- **D-01:** **Single service per booking.** No multi-service selection in the modal — covers ~90% of attendant slot-creation cases. Multi-service edits happen post-create in the existing `/admin/bookings` section.
- **D-02:** **No service options / frequency / addon UI in the modal.** Inputs are: service (single), quantity (default 1), customer notes (optional). Server computes authoritative price via `calculateCartItemPrice()` regardless. For services whose final price depends on options the attendant needs to set, they edit the booking after create.
- **D-03:** **No recurring / frequency picker in the modal.** Recurring bookings stay on the customer flow.
- **D-04:** **Single screen.** No multi-step wizard.

### Customer Lookup
- **D-05:** **Type-ahead search using the existing `GET /api/contacts?search=&limit=` endpoint.** As the attendant types into the customer-name field, suggest matching contacts. Selecting a suggestion pre-fills name, phone, email, address. Attendant can always type free-text for a new customer — backend's `upsertContact` (in `POST /api/bookings`) handles dedup by email/phone.
- **D-06:** Free-text fields are the source of truth on submit — type-ahead is a convenience layer, never a hard constraint.

### Pricing & Duration
- **D-07:** **End time auto-computed from `services.durationMinutes` × quantity.** Displayed read-only inside the modal. A small "Adjust end time" toggle reveals an editable HH:MM input for edge cases — collapsed by default.
- **D-08:** **`totalDurationMinutes` derived from service × quantity** (or attendant override if D-07 toggle is open).
- **D-09:** **Estimated total price** shown inside the modal as `service.basePrice × quantity`. Server is authoritative — actual `totalPrice` on the created booking comes back from the API response. For services with complex pricing (`hourly`, `sqft`, options-driven), the displayed estimate may differ from the final value; that's acceptable — the attendant can adjust afterwards.

### Defaults That Remove Decisions
- **D-10:** **Status defaults to `confirmed`** (overriding the schema default of `pending`). Admin-created bookings reflect a deliberate booking decision by staff, not a self-service request awaiting review.
- **D-11:** **Payment method defaults to `site`** (the existing pay-on-site option). Admin slot-creation is never a Stripe flow.
- **D-12:** **Payment status defaults to `unpaid`** (schema default).
- **D-13:** **`staffMemberId` pre-fill** mirrors the existing `handleSelectSlot` behaviour: set when the calendar has exactly one visible staff (`visibleStaff.length === 1`), otherwise leave the field as a required dropdown the attendant fills.

### Pre-fill from Slot Context
- **D-14:** Pre-filled from the existing `newBookingSlot` state ([AppointmentsCalendarSection.tsx:467](../../../client/src/components/admin/AppointmentsCalendarSection.tsx#L467)):
  - `bookingDate` ← slot date (`yyyy-MM-dd`)
  - `startTime` ← slot start (`HH:mm`)
  - `staffMemberId` ← per D-13

### Submit & Refresh
- **D-15:** **On success: close modal, invalidate `['/api/bookings']` React Query cache, do not redirect.** The new booking appears in the slot the attendant clicked, calendar stays open, attendant can keep working.
- **D-16:** **On 409 (slot conflict):** Show inline error in the modal with the message from the server. Do not auto-dismiss — the attendant chooses to fix or cancel.
- **D-17:** **On 400 (validation):** Surface field-level errors via `react-hook-form` integration with the `insertBookingSchema` Zod errors.
- **D-18:** Attribution: `visitorId` is **omitted** from the request body. Phase 11 D-03 already makes `linkBookingToAttribution` a silent no-op when missing — admin bookings simply have no attribution row, by design.

### Auth
- **D-19:** Modal uses the existing admin authentication (the calendar page is already behind `requireAdmin` server-side and the admin session client-side). The `POST /api/bookings` endpoint itself is public, so there is no extra auth header to add — the existing `apiRequest` / `authenticatedRequest` helper used elsewhere in the file is fine.

### Claude's Discretion
- Form library: `react-hook-form` with `zodResolver(insertBookingSchema)` — the standard pattern in this codebase.
- Modal component: existing shadcn `<Dialog>` already in `AppointmentsCalendarSection.tsx`.
- Service dropdown: shadcn `<Select>` over `useQuery(['/api/services'])` (already used by `BookingsSection`).
- Field-level UX micro-decisions (placeholder text, helper copy, exact field order) — researcher / planner picks reasonable defaults consistent with the rest of the admin UI.

### Folded Todos
None — todo backlog had no matches for Phase 14.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing flow being replaced
- [client/src/components/admin/AppointmentsCalendarSection.tsx](../../../client/src/components/admin/AppointmentsCalendarSection.tsx) — `handleSelectSlot` at line 467, placeholder modal at line 782. Slot state shape (`newBookingSlot`) is the pre-fill source.

### Backend contract
- [server/routes/bookings.ts](../../../server/routes/bookings.ts) line 53 — `POST /api/bookings`. Already handles availability check, `bookingItemsData` derivation from `cartItems`, contact upsert, conversion logging, GHL sync, Twilio/Telegram notifications. Do not modify; the modal calls this as-is.
- [shared/schema.ts](../../../shared/schema.ts) line 165 — `bookings` table schema. `customerAddress` is `notNull` (required field). `endTime` and `totalDurationMinutes` are required. Status field default is `pending` — Phase 14 overrides to `confirmed` per D-10.
- [shared/schema.ts](../../../shared/schema.ts) line 468 — `insertBookingSchema` (Zod). The `cartItems` array must contain at least one item (refine rule).
- [shared/routes.ts](../../../shared/routes.ts) line 106 — `bookings.create` route definition with response codes (201, 400, 409).

### Reusable assets
- [server/routes/contacts.ts](../../../server/routes/contacts.ts) line 7 — `GET /api/contacts?search=&limit=` for type-ahead (D-05).
- `useQuery(['/api/services'])` pattern already used by [client/src/components/admin/BookingsSection.tsx](../../../client/src/components/admin/BookingsSection.tsx) line 414.
- [client/src/lib/queryClient.ts](../../../client/src/lib/queryClient.ts) — `apiRequest` / `authenticatedRequest` helpers.

### Codebase conventions
- [.planning/codebase/CONVENTIONS.md](../../codebase/CONVENTIONS.md) — naming, imports, error handling patterns.
- [.planning/codebase/INTEGRATIONS.md](../../codebase/INTEGRATIONS.md) — admin section conventions.

### Prior decisions referenced
- [.planning/phases/11-booking-flow-attribution/11-CONTEXT.md](../11-booking-flow-attribution/11-CONTEXT.md) D-03 — `linkBookingToAttribution` no-ops when `visitorId` is null. Admin bookings rely on this.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`<Dialog>` shadcn modal**: Already imported and used in `AppointmentsCalendarSection.tsx` for the placeholder. Replace its body, keep the wrapper.
- **`newBookingSlot` state + `setNewBookingSlot` setter**: Existing slot capture state — extend its type to carry a richer pre-fill payload, or add a sibling state for form values.
- **`scopedStaffList`** in `AppointmentsCalendarSection.tsx`: already memoized list of staff visible in the current calendar view — use directly for the staff dropdown when D-13 falls through.
- **`useQuery(['/api/services'])`**: pattern from `BookingsSection.tsx`.
- **`useToast`**: for success notification ("Booking created" toast).
- **`useQueryClient().invalidateQueries(['/api/bookings'])`**: same pattern used by `updateMutation` in `BookingsSection.tsx` line 446 — copy that.

### Established Patterns
- **React Query mutations** with `onSuccess` invalidation are the standard for write paths.
- **`react-hook-form` + `zodResolver`** is used elsewhere in the admin for create/edit forms.
- **shadcn UI components** (`Form`, `FormField`, `Input`, `Select`, `Textarea`) for all form controls.
- **`apiRequest`/`authenticatedRequest`** wrappers for fetch calls.

### Integration Points
- The modal lives entirely inside `AppointmentsCalendarSection.tsx`. No new top-level admin route.
- The calendar's existing `events` array refreshes automatically when `['/api/bookings']` is invalidated — no manual event manipulation needed.

### Constraints
- The Booking schema requires `customerAddress` (notNull). If type-ahead resolves a contact without an address, the field still has to be filled before submit.
- The `cartItems` Zod refine rule requires at least one item — single-service selection (D-01) sends `cartItems: [{ serviceId, quantity }]`.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly asked for "process to make the attendant's life easier, not more complicated" — keep this verbatim in mind during planning. Every "should we add X?" answer should default to "no, leave it out" unless the attendant clearly needs it during slot-creation.
- The current placeholder modal text — "Use the Bookings section to create the full booking with services and pricing" — is a known incomplete state ([AppointmentsCalendarSection.tsx:806](../../../client/src/components/admin/AppointmentsCalendarSection.tsx#L806)). Phase 14 deletes that copy.

</specifics>

<deferred>
## Deferred Ideas

- **Multi-service in admin slot-creation** — would expand the modal significantly; if real demand emerges, separate phase.
- **Recurring booking creation from the calendar** — distinct UX (recurrence rule editor, recurrence preview) — separate phase.
- **Addon cross-sell in admin modal** — admin tools optimize for speed, not upsell. Out of scope.
- **In-modal payment capture (Stripe)** — admin slot creation is pay-on-site by default; online payment flows live on the customer side.
- **Drag-to-resize for end time inside the modal** — nice-to-have once the basic flow ships.

### Reviewed Todos (not folded)
None — todo match returned 0 candidates.

</deferred>

---

*Phase: 14-admin-calendar-create-booking-from-slot*
*Context gathered: 2026-04-28*
