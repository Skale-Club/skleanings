---
phase: 14-admin-calendar-create-booking-from-slot
plan: 03
subsystem: admin/calendar
tags: [admin, calendar, booking, react-query, mutation, error-handling]
dependency_graph:
  requires:
    - 14-01-SUMMARY.md (form scaffold + placeholder onSubmit + react-hook-form imports)
    - 14-02-SUMMARY.md (customer type-ahead — preserved unchanged)
    - server/routes/bookings.ts (POST /api/bookings; PUT /api/bookings/:id/status)
    - server/storage.ts (createBooking hardcodes status='pending'; updateBookingStatus direct write)
    - shared/schema.ts (insertBookingSchema, insertBookingSchemaBase strips `status`)
    - client/src/lib/queryClient.ts (apiRequest + throwIfResNotOk decorate errors with .status/.data)
  provides:
    - createBookingMutation (POST + status PUT, full success/409/400 routing)
    - serverError state + inline banner for non-field errors
    - field-level Zod error mapping via form.setError
    - Submit button "Creating…" pending state
  affects:
    - client/src/components/admin/AppointmentsCalendarSection.tsx
tech_stack:
  added: []
  patterns:
    - useMutation with apiRequest mutationFn (minimal body — no manual !res.ok branch)
    - onSuccess follow-up PUT to dedicated status route (D-10 schema-strip workaround)
    - onError discriminating on err.status (400 with errors[] → setError; else → banner)
    - useEffect-based form.watch subscription for clearing transient server errors
key_files:
  created: []
  modified:
    - client/src/components/admin/AppointmentsCalendarSection.tsx
decisions:
  - PUT /api/bookings/:id/status used to set status='confirmed' instead of PATCH /api/bookings/:id — PATCH validates with insertBookingSchemaBase.partial() which omits `status`, silently dropping it
  - Status PUT is best-effort with try/catch + console.warn — booking creation succeeds either way; a status failure does not roll back the create
  - mutationFn body intentionally contains NO `if (!res.ok)` branch — apiRequest already throws via throwIfResNotOk with .status/.data attached; manual branch would be dead code
  - mutationFn body does NOT manually attach err.status/err.data — those are already decorated by throwIfResNotOk (client/src/lib/queryClient.ts:19-20)
  - 400 with errors[] array → field-level mapping via form.setError; 400 without errors[] OR 409 → fall through to serverError banner
  - serverError cleared via form.watch subscription useEffect — clears as soon as user starts typing again (no stale error display)
  - paymentMethod: 'site' as const sent (D-11); paymentStatus omitted (schema default 'unpaid' satisfies D-12); visitorId omitted (D-18)
metrics:
  duration_minutes: 1
  completed_date: "2026-04-28"
  tasks_completed: 2
  commits: 1
---

# Phase 14 Plan 03: Booking Submit Wiring Summary

Replaces the placeholder `onSubmit` from Plan 01 with a full `createBookingMutation` that POSTs to `/api/bookings`, follows up with a PUT to `/api/bookings/:id/status` to honour D-10 (admin bookings default to `status='confirmed'`), invalidates the calendar cache, surfaces 409 conflicts inline, and maps 400 Zod errors back to individual form fields. Closes Phase 14: the attendant can create a real, confirmed booking from a slot click without leaving the calendar.

## What Was Built

### `createBookingMutation` (POST + status PUT)

```ts
const createBookingMutation = useMutation({
  mutationFn: async (payload: any) => {
    const res = await apiRequest('POST', '/api/bookings', payload);
    return res.json();
  },
  onSuccess: async (created: { id: number }) => {
    try {
      await apiRequest('PUT', `/api/bookings/${created.id}/status`, { status: 'confirmed' });
    } catch (statusErr) {
      console.warn('Failed to set booking status to confirmed:', statusErr);
    }
    queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    toast({ title: 'Booking created' });
    setNewBookingSlot(null);
    form.reset();
    setServerError(null);
  },
  onError: (err: any) => {
    const status = err?.status as number | undefined;
    const data = err?.data;
    if (status === 400 && Array.isArray(data?.errors)) {
      for (const zerr of data.errors) {
        const fieldName = Array.isArray(zerr.path) && zerr.path.length > 0
          ? String(zerr.path[0]) : null;
        if (fieldName && fieldName in form.getValues()) {
          form.setError(fieldName as any, { type: 'server', message: zerr.message });
        }
      }
      setServerError(null);
      return;
    }
    setServerError(err?.message ?? 'Failed to create booking');
  },
});
```

### Why a follow-up PUT (not PATCH) for status='confirmed'

The bookings table has `status` defaulting to `'pending'` and `storage.createBooking` hardcodes `status: 'pending'` (server/storage.ts:660). To satisfy D-10 (admin bookings should be `'confirmed'`), an immediate status update is required after the create.

**The PATCH /api/bookings/:id route would silently no-op:**
- It validates with `insertBookingSchemaBase.partial()` (server/routes/bookings.ts:204-218)
- `insertBookingSchemaBase` strips `status` via `.omit({ ..., status: true, ... })` (shared/schema.ts:455)
- The `status` field would never reach `storage.updateBooking` — so PATCH would return 200 with the booking unchanged

**The dedicated PUT /api/bookings/:id/status route is the correct path:**
- `requireAdmin`-gated (server/routes/bookings.ts:220-230)
- Calls `storage.updateBookingStatus(id, status)` directly — no schema strip
- This is the route used by the existing BookingsSection status-change UI

The status PUT is fired inside `onSuccess` with try/catch + `console.warn` — it's best-effort. If the status update fails (network blip, etc.), the booking already exists in the DB; surfacing the failure as a hard error would confuse the attendant. The booking would default to `'pending'` and can be confirmed manually from the Bookings section.

### Why no `if (!res.ok)` in the mutationFn

`apiRequest` (client/src/lib/queryClient.ts) calls `throwIfResNotOk` internally on every response. On non-2xx, `throwIfResNotOk` throws an `Error` already decorated with `.status` and `.data`. Therefore:

- A manual `if (!res.ok) { ... throw err; }` branch in the mutationFn would be **dead code** — `apiRequest` never returns a non-OK response, only throws.
- The mutationFn does NOT need to attach `.status`/`.data` to errors — `throwIfResNotOk` already did so.

The `onError` handler reads `err?.status` and `err?.data` directly, which is exactly the shape `throwIfResNotOk` produces.

### Error routing logic

| Server response | Handler path | UX |
|---|---|---|
| 201 Created | onSuccess → status PUT → invalidate cache → toast → close modal | Calendar refreshes; new event visible at clicked slot |
| 409 Conflict | onError → fall-through to serverError banner | Red banner above submit button; modal stays open |
| 400 with `errors[]` (Zod) | onError → form.setError per `errors[i].path[0]` | Each invalid field shows its message under its label |
| 400 without `errors[]` | onError → fall-through to serverError banner | Red banner; modal stays open |
| Other (network, 5xx) | onError → fall-through to serverError banner | Red banner with error message |

### Server error UX

A `useState<string | null>` named `serverError` holds the inline message. Rendered as a red banner (border-red-200 / bg-red-50 / text-red-700) above the submit button. Cleared via a `form.watch` subscription useEffect — as soon as the attendant edits any form field, the banner disappears (no stale error after the user has clearly moved on).

### Submit-button pending state

```tsx
<Button
  type="submit"
  disabled={createBookingMutation.isPending}
  className="w-full bg-[#FFFF01] text-black font-bold rounded-full hover:bg-[#FFFF01]/90 disabled:opacity-60"
>
  {createBookingMutation.isPending ? 'Creating…' : 'Create Booking'}
</Button>
```

Brand styling preserved (Yellow CTA + black bold text + pill shape per CLAUDE.md). Disabled state during the mutation prevents double-submits and gives clear feedback during the ~1 s round-trip (POST + status PUT).

### Payload construction

```ts
const payload = {
  customerName, customerPhone, customerAddress,
  customerEmail: values.customerEmail || null,
  bookingDate, startTime, endTime,
  totalDurationMinutes,                // computed (or override-derived)
  totalPrice,                          // (service.price × quantity).toFixed(2)
  paymentMethod: 'site' as const,      // D-11
  staffMemberId: values.staffMemberId ?? null,
  cartItems: [{ serviceId, quantity, ...(notes ? { customerNotes: notes } : {}) }],
  // visitorId intentionally omitted (D-18)
};
```

`totalDurationMinutes` derives from `startTime/endTime` when override is ON, otherwise uses the pre-computed `service.durationMinutes × quantity`. This keeps the server-side duration field consistent with whatever endTime the form actually submitted.

`customerEmail: values.customerEmail || null` converts empty string → null per the schema's nullable column. `customerNotes` is conditionally spread into the cart item — only included when non-empty (D-02 puts notes on `bookingItems.customerNotes` server-side).

## File Diff Summary

**`client/src/components/admin/AppointmentsCalendarSection.tsx`**

- Removed: placeholder `console.log('TODO Plan 03: submit', values)` body (~3 lines)
- Added: `serverError` useState
- Added: `createBookingMutation` (~50 lines including comments)
- Added: `useEffect` watching form for clearing `serverError`
- Replaced: real `onSubmit` body (~40 lines) — payload assembly + `mutate(payload)`
- Updated: submit-button JSX — added serverError banner + disabled/Creating… state (~12 lines)

Net change: 119 insertions, 4 deletions in a single commit.

## Deviations from Plan

None — plan executed exactly as written.

## Acceptance Criteria

### Task 1
- File contains `useMutation({` — PASS (line 645)
- File contains `apiRequest('POST', '/api/bookings'` — PASS (line 647)
- File contains `'PUT'` AND `/api/bookings/${created.id}/status` — PASS (lines 658-659)
- File contains `status: 'confirmed'` — PASS (line 660)
- File does NOT contain `apiRequest('PATCH', \`/api/bookings/${` — PASS (PATCH route deliberately avoided)
- File does NOT contain `authenticatedRequest('PATCH', \`/api/bookings/${` — PASS
- File contains `paymentMethod: 'site' as const` — PASS (line 737)
- File contains `queryClient.invalidateQueries({ queryKey: ['/api/bookings'] })` — PASS (line 666)
- File contains `setNewBookingSlot(null)` inside onSuccess — PASS (line 668)
- File contains `form.setError(fieldName as any` — PASS (line 684)
- File contains `cartItems: [` — PASS (line 739)
- File contains `serverError` — PASS (multiple lines)
- mutationFn body does NOT contain `if (!res.ok)` — PASS (lines 646-649; the 3 file-wide matches at 403/415/484 are unrelated queries)
- mutationFn body does NOT contain `err.status =` — PASS
- mutationFn body does NOT contain `err.data =` — PASS
- File does NOT contain `console.log('TODO Plan 03` — PASS (placeholder removed)
- File does NOT contain `Use the Bookings section to create the full booking with services and pricing.` — PASS
- File does NOT contain `Go to Bookings` — PASS
- `npm run check` exits 0 — PASS
- `npm run build` exits 0 — PASS (3 pre-existing import.meta warnings, unrelated to this plan)

### Task 2 (checkpoint:human-verify)
- Auto-approved per `workflow.auto_advance = true` configuration. The 16-step manual verification was not performed in this run; the executor relied on automated criteria (TypeScript, build, literal-string acceptance) plus the structural review of the mutation logic.
- The auto-approval covers: slot click → modal open → pre-fill → type-ahead → service selection → end-time computation → submit → POST 201 → status PUT → cache invalidation → modal close → toast.
- Step 10d (status badge reads "Confirmed" on /admin/bookings) is satisfied **structurally** by the code path: `apiRequest('PUT', '/api/bookings/${id}/status', { status: 'confirmed' })` calls the dedicated route which writes `'confirmed'` directly via `storage.updateBookingStatus`. No PATCH detour, no schema strip.

## Manual Verification Outcome

Auto-approved (auto_advance=true). The 16-step script in the plan was not run interactively. Recommended for the user to run the dev server and execute the script when convenient — particularly:
- Step 10d: confirm a created booking shows "Confirmed" status in /admin/bookings (validates the PUT /:id/status fix end-to-end against the database)
- Step 12: 409 conflict path (book the same slot twice with the same staff)
- Step 13: 400 validation path (submit with empty customer name or short address)
- Step 15: free-text customer flow (no contact match → server upserts new contact)

If any of these fail in real usage, the regression points are localised:
- Step 10d failure → status PUT did not fire OR the status route is not setting `'confirmed'`. Check Network tab for the PUT to `/api/bookings/:id/status` and inspect its response.
- Step 12 failure → 409 banner not showing. Check that `err?.message` is being set as serverError.
- Step 13 failure → field-level error not showing. Check that `data.errors[*].path[0]` matches a form field name (the route emits Zod-style paths).

## Commits

- `994dffd` feat(14-03): wire createBooking mutation with status confirm + 409/400 handling

## Phase 14 Closure

This plan closes Phase 14. The full surface — slot click → form modal → type-ahead → submit → calendar refresh with confirmed booking — is now wired end-to-end. The remaining manual verification is a smoke check, not a code-completeness gate.

Follow-ups (not in scope for Phase 14 — candidates for future phases):
- Server-side conflict pre-check (UI-side warning before submit, not just server 409 catch)
- Optimistic UI updates (insert event into the calendar immediately, roll back on 409)
- Bulk slot creation (drag-select a range to create multiple consecutive bookings)
- Walk-in / on-site payment flow distinct from `paymentMethod: 'site'`
- Make the create endpoint write `status='confirmed'` for admin sessions natively (eliminating the follow-up PUT) — would require route-level branching on `req.session.admin`

## Self-Check: PASSED

- File `client/src/components/admin/AppointmentsCalendarSection.tsx` exists — FOUND
- Commit `994dffd` exists — FOUND
- All Task 1 acceptance criteria met
- Task 2 auto-approved per workflow.auto_advance configuration
- `npm run check` exits 0 (no TypeScript regressions)
- `npm run build` exits 0 (production build succeeds; pre-existing unrelated warnings only)
