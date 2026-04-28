---
phase: 14-admin-calendar-create-booking-from-slot
verified: 2026-04-28T00:00:00Z
status: human_needed
score: 7/7 must-have truths automatically verified; 1 human checkpoint deferred
re_verification: null
human_verification:
  - test: "End-to-end happy path against running dev server: click empty slot → modal opens → fill form → submit → calendar refreshes with new event AND status badge reads 'Confirmed' on /admin/bookings"
    expected: "Modal closes within ~1s; toast 'Booking created'; calendar shows the new event in the clicked slot; on /admin/bookings the new booking row's status badge reads 'Confirmed' (validates the PUT /:id/status fix end-to-end against the database)"
    why_human: "Plan 03 Task 2 was a checkpoint:human-verify gate that was auto-approved per workflow.auto_advance configuration without the 16-step manual smoke being executed. Step 10d in particular requires inspecting the DB-backed status badge in another admin page after a real network round-trip — cannot be verified by static analysis."
  - test: "409 conflict path: book the same slot/staff/time as an existing booking"
    expected: "Red banner inline says the server message ('Time slot is no longer available'); modal stays open; banner clears as soon as user edits any field"
    why_human: "Requires a live server returning a 409 — onError routing and banner rendering are wired in code, but the server-side conflict detection only fires under real concurrency conditions"
  - test: "400 Zod-validation path: submit with empty customer name OR address with <3 chars (after bypassing client-side via DevTools)"
    expected: "Field-level error 'Name is required' / 'Address is required' shows under the offending input; modal stays open"
    why_human: "Client-side Zod normally blocks invalid submission before reaching the server; testing the server-side path requires manipulating the DOM to bypass client validation, then observing form.setError mapping the server's Zod error path[0] to the right field"
  - test: "Free-text customer (no contact match): type 'Brand New Person' in customer name"
    expected: "Popover shows 'No matches — type a new name to create'; submitting creates a brand-new contact server-side via upsertContact"
    why_human: "Verifies the cookie-auth Bearer-token-trap avoidance — if /api/contacts silently returns [] due to wrong helper, the 'No matches' state could be a false positive; only a live server confirms the request actually reached requireAdmin"
---

# Phase 14: Admin Calendar Create Booking From Slot — Verification Report

**Phase Goal:** Attendant can create a complete booking directly from a slot click on the admin calendar, without leaving the calendar — replacing the placeholder modal in `AppointmentsCalendarSection.tsx` with a real form that pre-fills date/start time/staff, supports type-ahead customer lookup, computes end time + estimated price, POSTs to `/api/bookings`, and refreshes the calendar on success.

**Verified:** 2026-04-28
**Status:** human_needed (all automated checks pass; manual smoke checkpoint was auto-approved without execution)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                  | Status      | Evidence                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------- |
| 1   | Clicking a slot opens a single-screen form modal pre-filled with bookingDate, startTime, staffMemberId | VERIFIED    | `Dialog open={!!newBookingSlot}` (line 1074); `form.reset({ bookingDate, startTime, staffMemberId })` (lines 562-579); `handleSelectSlot` populates `newBookingSlot` with all 3 fields (lines 759-766) |
| 2   | Required fields: customerName, customerPhone, customerAddress, service, quantity                       | VERIFIED    | All 5 FormFields rendered with min-length / required Zod rules (schema lines 70-87; JSX lines 1130-1259) |
| 3   | Optional fields: customerEmail, customer notes, end-time override                                      | VERIFIED    | customerEmail (line 1208), customerNotes (line 1292), endTimeOverride toggle (line 1265)  |
| 4   | Form computes and displays read-only endTime = service.durationMinutes × quantity                      | VERIFIED    | `computedEndTime` useMemo (lines 617-623); rendered read-only at line 1280-1283 when override is OFF |
| 5   | Form computes and displays read-only estimated total = service.price × quantity                        | VERIFIED    | `estimatedTotal` useMemo (lines 630-633); rendered at lines 1287-1290                     |
| 6   | Optional 'Adjust end time' toggle reveals editable HH:MM input; collapsed by default                   | VERIFIED    | `endTimeOverride: z.boolean().default(false)` (line 86); Switch at line 1268; conditional `<Input type="time">` at lines 1272-1278 |
| 7   | Form wired w/ react-hook-form + zodResolver; submit POSTs to /api/bookings; status='confirmed' (D-10) override; paymentMethod='site' (D-11); paymentStatus default 'unpaid' (D-12) | VERIFIED    | useForm + zodResolver (lines 543-559); createBookingMutation POSTs `/api/bookings` (line 647); follow-up PUT `/api/bookings/${id}/status` with `status: 'confirmed'` (lines 657-661); `paymentMethod: 'site' as const` (line 737); paymentStatus omitted from payload (relies on schema default) |
| 8   | Customer-name field offers type-ahead suggestions from GET /api/contacts?search=&limit= (debounced, ≥250 ms, hidden when <2 chars) | VERIFIED    | `useDebounced(watchedCustomerName, 250)` (line 597); `enabled: contactSearchOpen && debouncedContactSearch.trim().length >= 2` (line 608); 4-field setValue on selection (lines 1174-1177) |
| 9   | On 201: modal closes, ['/api/bookings'] invalidated, success toast, calendar refreshes                 | VERIFIED    | `queryClient.invalidateQueries({ queryKey: ['/api/bookings'] })` (line 666); `toast({ title: 'Booking created' })` (line 667); `setNewBookingSlot(null)` (line 668); `form.reset()` (line 669) |
| 10  | On 409: inline error banner, modal stays open                                                          | VERIFIED    | `setServerError(err?.message ?? 'Failed to create booking')` (line 695); banner JSX (lines 1300-1307); modal not closed in onError |
| 11  | On 400 with Zod errors: field-level errors via form.setError                                            | VERIFIED    | `form.setError(fieldName as any, { type: 'server', message: zerr.message })` (lines 684-687) |
| 12  | visitorId is OMITTED from request body (D-18)                                                          | VERIFIED    | Payload object (lines 727-748) does NOT include `visitorId`; explicit comment at line 747 |

**Score: 12/12 truths verified** (re-grouped from the 7 must-haves in the 3 plans into 12 atomic observable truths for verification).

### Required Artifacts

| Artifact                                                       | Expected                                                                                                                                                                                              | Exists | Substantive | Wired | Data Flows | Status   |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- | ----- | ---------- | -------- |
| `client/src/components/admin/AppointmentsCalendarSection.tsx`  | Replaces placeholder modal body with a real `<Form>` using react-hook-form + zodResolver + useMutation against /api/bookings + PUT /:id/status; type-ahead via /api/contacts; computed end time + estimated total | YES (1322 lines)   | YES (`useForm<BookingFormValues>(`, `zodResolver(bookingFormSchema)`, `useMutation({`, `apiRequest('POST', '/api/bookings'`, `useQuery<Service[]>`, `useQuery<ContactSuggestion[]>`, `addMinutesToHHMM(`, `endTimeOverride`, `Estimated total`, `bg-[#FFFF01] text-black font-bold rounded-full` all present) | YES (component is the existing admin calendar — already imported and rendered by `client/src/components/admin/AdminAppLayout.tsx` and other admin pages, unchanged in this phase) | YES — services come from `useQuery(['/api/services'])` which fetches the live services table; contacts come from `useQuery(['/api/contacts', debouncedContactSearch])`; bookings refresh comes from invalidating the existing `['/api/bookings']` query that drives the calendar render | VERIFIED |

### Key Link Verification

| From                                                | To                                                              | Via                                                                                  | Status   | Details                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------- |
| `newBookingSlot` state                              | `useForm` defaultValues                                         | `useEffect` calls `form.reset(...)` when `newBookingSlot` becomes truthy             | WIRED    | Lines 562-579 — explicit `form.reset({ bookingDate: newBookingSlot.date, startTime: newBookingSlot.startTime, staffMemberId: newBookingSlot.staffMemberId ?? null, ... })` |
| service selection (`watch`)                         | computed endTime + estimated price                              | `form.watch('serviceId')` and `form.watch('quantity')` feed `useMemo` for compute    | WIRED    | `watchedServiceId` / `watchedQuantity` (lines 581-584); `selectedService` / `computedEndTime` / `estimatedTotal` memos (lines 612-633) |
| customerName input onChange                         | debounced search state                                          | inline `useDebounced` with `setTimeout` cleanup                                      | WIRED    | `useDebounced<T>` helper at module scope (lines 170-177); `debouncedContactSearch = useDebounced(watchedCustomerName, 250)` (line 597) |
| debounced search state                              | GET /api/contacts?search=…&limit=…                              | `useQuery` with `enabled: contactSearchOpen && trim.length >= 2`                     | WIRED    | Lines 599-610 — `apiRequest('GET', \`/api/contacts?search=${encodeURIComponent(debouncedContactSearch)}&limit=8\`)` with the gating `enabled` flag |
| Contact suggestion click                            | `form.setValue` for name/phone/email/address                    | `onSelect` handler calls 4 setValue calls                                            | WIRED    | Lines 1173-1178 — all 4 setValue calls fire, then `setContactSearchOpen(false)`           |
| form submit                                         | POST /api/bookings                                              | `createBookingMutation.mutate(payload)`                                              | WIRED    | Line 750 — onSubmit assembles cartItems-shaped payload and calls mutate                   |
| POST 201 response                                   | PUT /api/bookings/:id/status with status='confirmed'            | `apiRequest('PUT', \`/api/bookings/${created.id}/status\`, { status: 'confirmed' })` inside onSuccess | WIRED | Lines 657-661 — wrapped in try/catch with console.warn fallback (best-effort)             |
| successful create                                   | calendar refresh                                                | `queryClient.invalidateQueries({ queryKey: ['/api/bookings'] })`                     | WIRED    | Line 666 — invalidates the same key the calendar's bookings useQuery (line 397) reads from |

All 8 key links verified WIRED.

### Data-Flow Trace (Level 4)

| Artifact                              | Data Variable                                                | Source                                                          | Produces Real Data? | Status   |
| ------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- | ------------------- | -------- |
| Service dropdown                      | `selectableServices`                                         | `useQuery(['/api/services'])` filtered by !isArchived/!isHidden | YES — server route `/api/services` is established and returns live services table data; same query used by `BookingsSection.tsx` proves the data path | FLOWING |
| Contact suggestions                   | `contactSuggestions`                                         | `useQuery(['/api/contacts', debouncedContactSearch])`           | YES — server route `server/routes/contacts.ts:8` calls `storage.listContactsWithStats(search, limit)` which queries the contacts table; cookie-auth via `requireAdmin` matches admin session | FLOWING |
| Booking creation                      | created.id (from POST response)                              | POST /api/bookings → `storage.createBooking` (server/storage.ts:660) returns the inserted Booking row | YES — verified server-side: route at server/routes/bookings.ts:53 inserts the booking and returns the row | FLOWING |
| Status confirm                        | (no return value used)                                       | PUT /api/bookings/:id/status → `storage.updateBookingStatus(id, status)` | YES — verified: route at server/routes/bookings.ts:220-230 directly writes the status — does NOT go through `insertBookingSchemaBase.partial()` strip | FLOWING |
| Calendar refresh post-create          | `bookings` array driving `events`                            | Existing `useQuery(['/api/bookings', 'range', from, to])` (line 396); refreshed by invalidate | YES — same key invalidated, calendar re-fetches and re-renders | FLOWING |
| Pre-fill values                       | `newBookingSlot.date / startTime / staffMemberId`            | `handleSelectSlot` populates from real `start: Date` parameter from react-big-calendar | YES — slot click event delivers a real Date, `format(start, 'yyyy-MM-dd')` and `format(start, 'HH:mm')` produce real values | FLOWING |

All artifacts produce real data. No HOLLOW or DISCONNECTED states.

### Behavioral Spot-Checks

| Behavior                                       | Command                                  | Result                                                                                              | Status   |
| ---------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| TypeScript type-checks cleanly                 | `npm run check`                          | Exit 0; no diagnostics emitted                                                                       | PASS     |
| All referenced server routes exist             | grep server/routes/{bookings,contacts}.ts for the literal route declarations | POST /api/bookings (line 53), PUT /:id/status (line 220), GET /api/contacts (line 8 of contacts.ts) all present | PASS     |
| Client helpers behave as Plan 03 documents     | grep client/src/lib/queryClient.ts       | `throwIfResNotOk` decorates errors with `.status` (line 19) and `.data` (line 20); `apiRequest` sends `credentials: "include"` (line 47) and calls `throwIfResNotOk` (line 51) — exactly the contract Plan 03 relies on | PASS     |
| Production build succeeds                      | (deferred — not run as part of this verification because `npm run check` already covers TypeScript and the SUMMARYs document `npm run build` exits 0 in each plan execution; spot-check skipped to avoid a long build run) | SKIPPED  | SKIP    |
| Dev server smoke (slot click → modal → submit → calendar refresh) | requires running server + admin login | not executed                                                                                         | SKIP — routed to human verification |

### Decision Coverage (D-00 through D-19, per phase context request)

| Decision | Topic                                                                                              | Implementation Evidence                                                                                                              | Status     |
| -------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| D-00     | Simplify the attendant's life — lean, single-screen                                                | Single Dialog, single Form, ~245-line modal body. No multi-step wizard, no addon UI, no recurrence. Aligns with directive.            | SATISFIED  |
| D-01     | Single service per booking                                                                         | `cartItems: [{ serviceId, quantity }]` — only one cart item shape (lines 739-746). No multi-service UI in the modal.                  | SATISFIED  |
| D-02     | No service options / frequency / addon UI                                                          | Service `<Select>` is a plain dropdown; the only customer-input optional field for the cart item is `customerNotes`. No options/freq/addons in the form. | SATISFIED  |
| D-03     | No recurring picker                                                                                | Form schema has no recurrence fields; no recurrence UI in the modal body.                                                            | SATISFIED  |
| D-04     | Single screen, no wizard                                                                           | One `<Form>`, no step state, no multiple panels.                                                                                     | SATISFIED  |
| D-05     | Type-ahead via /api/contacts?search=&limit=                                                        | `useQuery(['/api/contacts', debouncedContactSearch])` with `apiRequest('GET', \`/api/contacts?search=…&limit=8\`)` (lines 599-610). | SATISFIED  |
| D-06     | Free-text always wins                                                                              | Selecting a suggestion calls `setValue` but does not lock the field; the Input is freely editable afterwards (lines 1148-1153). Plan 02 explicitly preserved this. | SATISFIED  |
| D-07     | End time auto-computed; "Adjust end time" toggle                                                   | `computedEndTime` from `service.durationMinutes × quantity` (lines 617-623); Switch toggle (line 1268); conditional editable HH:mm input (lines 1272-1278); collapsed by default (`endTimeOverride: z.boolean().default(false)`). | SATISFIED  |
| D-08     | totalDurationMinutes derived (or override-derived)                                                 | Line 717-723 — onSubmit derives `totalDurationMinutes` from override endTime when toggle is ON, otherwise uses pre-computed.          | SATISFIED  |
| D-09     | Estimated total = service.price × quantity                                                         | `estimatedTotal` useMemo (lines 630-633): `(Number(selectedService.price) * (watchedQuantity || 1)).toFixed(2)`; rendered (lines 1287-1290). | SATISFIED  |
| D-10     | Status defaults to 'confirmed' (override)                                                          | Two-step: POST creates booking with default `pending`; onSuccess fires `apiRequest('PUT', \`/api/bookings/${id}/status\`, { status: 'confirmed' })` (lines 656-661) — the dedicated route bypasses the `insertBookingSchemaBase.partial()` schema strip that would silently drop status on PATCH. | SATISFIED  |
| D-11     | paymentMethod = 'site'                                                                             | `paymentMethod: 'site' as const` in payload (line 737).                                                                              | SATISFIED  |
| D-12     | paymentStatus = 'unpaid' (schema default)                                                          | Payload omits paymentStatus; schema default 'unpaid' applies. No paymentStatus key in payload (verified by grep — no matches).        | SATISFIED  |
| D-13     | staffMemberId pre-fill mirrors handleSelectSlot                                                    | `handleSelectSlot` (lines 759-766): `staffMemberId: visibleStaff.length === 1 ? visibleStaff[0].id : undefined`. Modal renders read-only when staffMemberId is set; `<Select>` from `scopedStaffList` otherwise (lines 1095-1128). | SATISFIED  |
| D-14     | Pre-fill from newBookingSlot: bookingDate, startTime, staffMemberId                                | `useEffect` calls `form.reset({ bookingDate: newBookingSlot.date, startTime: newBookingSlot.startTime, staffMemberId: newBookingSlot.staffMemberId ?? null, ... })` (lines 562-579). | SATISFIED  |
| D-15     | Success: close modal, invalidate ['/api/bookings'], no redirect                                    | onSuccess: `queryClient.invalidateQueries({ queryKey: ['/api/bookings'] })` (line 666); `setNewBookingSlot(null)` (line 668); `form.reset()` (line 669). No `setLocation` redirect. | SATISFIED  |
| D-16     | 409: inline error in modal, no auto-dismiss                                                        | `serverError` state (line 643); set in onError fall-through (line 695); banner JSX (lines 1300-1307); cleared only by user editing (lines 700-704), not auto-dismissed. | SATISFIED  |
| D-17     | 400: field-level errors via form.setError                                                          | onError branches on `status === 400 && Array.isArray(data?.errors)`; iterates and calls `form.setError(zerr.path[0], { type: 'server', message: zerr.message })` (lines 677-692). | SATISFIED  |
| D-18     | visitorId omitted                                                                                  | Payload object explicitly omits visitorId (line 747 comment confirms intent). Phase 11 D-03 makes `linkBookingToAttribution` a no-op when missing. | SATISFIED  |
| D-19     | Existing admin auth (cookie-based via requireAdmin)                                                | Type-ahead query uses plain `apiRequest` (cookie via `credentials: "include"`); createBookingMutation also uses plain `apiRequest`. Plan 02 explicitly chose the cookie path over Bearer to avoid the silent-no-op trap. | SATISFIED  |

All 20 decisions (D-00 through D-19) accounted for and SATISFIED in the codebase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| (none)      | 14-01/02/03 | Phase 14 is a standalone admin-operations phase with no requirement IDs declared in any plan; CONTEXT.md confirms scope is captured in decisions D-00 through D-19 | N/A — explicitly empty `requirements: []` in all 3 plan frontmatters | All decisions individually verified above |

No orphaned requirements (no REQUIREMENTS.md mapping for Phase 14).

### Anti-Patterns Found

| File                                                              | Line  | Pattern                                          | Severity | Impact                                                                                              |
| ----------------------------------------------------------------- | ----- | ------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------- |
| client/src/components/admin/AppointmentsCalendarSection.tsx       | 403   | `if (!res.ok) return [];`                        | INFO     | Pre-existing pattern in the bookings-range query — NOT in code touched by Phase 14. No goal impact. |
| client/src/components/admin/AppointmentsCalendarSection.tsx       | 415   | `if (!res.ok) return [];`                        | INFO     | Pre-existing pattern in the staff-list query — NOT in code touched by Phase 14. No goal impact.     |
| client/src/components/admin/AppointmentsCalendarSection.tsx       | 484   | `if (!res.ok) return;`                           | INFO     | Pre-existing pattern in the GCal busy fetch — NOT in code touched by Phase 14. No goal impact.      |
| client/src/components/admin/AppointmentsCalendarSection.tsx       | 646   | `mutationFn: async (payload: any) => { ... }`    | INFO     | `payload: any` rather than a typed shape. Acceptable per Plan 03 (server-side `insertBookingSchema` is the contract; client typing would duplicate it). No goal impact. |

NO STUB PATTERNS DETECTED IN PHASE-14 CODE:
- `Use the Bookings section to create the full booking…` (placeholder) — REMOVED (verified by grep — no matches)
- `Go to Bookings` (redirect button) — REMOVED (verified by grep — no matches)
- `console.log('TODO Plan 03'` — REMOVED (verified by grep — no matches)
- No `apiRequest('PATCH', '/api/bookings/${...}'` — REMOVED/AVOIDED (the bug Plan 03 explicitly solves)
- onSubmit no longer a placeholder — wired to `createBookingMutation.mutate(payload)` (line 750)
- mutationFn body has no dead `if (!res.ok)` branch (verified — only matches are pre-existing, unrelated queries)

### Human Verification Required

Plan 03 Task 2 was a `checkpoint:human-verify gate="blocking"` task that was auto-approved per `workflow.auto_advance = true` configuration without the 16-step manual smoke being executed. The phase summary explicitly states this. Static analysis confirms the code path is structurally correct (POST → PUT /:id/status → invalidate → toast → close), but four behaviors should be confirmed against a running dev server before the phase is declared fully closed:

#### 1. End-to-end happy path with confirmed status badge (Step 10d in Plan 03)

**Test:**
1. `npm run dev`, sign in to admin, open Calendar.
2. Click an empty slot on a future date.
3. Confirm Date / Start time / Staff (when single visible staff) are pre-filled.
4. Type 2+ chars in Customer name → suggestions appear within ~250 ms; click one → name/phone/email/address fill in.
5. Pick a service → end time and estimated total update to start + duration / price × 1.
6. Submit.
7. Navigate to `/admin/bookings`. Find the most recent booking matching the customer name and date.

**Expected:** Modal closes within ~1s. Toast "Booking created" appears. Calendar shows the new event in the clicked slot. On `/admin/bookings`, the booking's status badge reads **"Confirmed"** (NOT "Pending").

**Why human:** Validates the PUT /:id/status fix end-to-end against the database. If the badge reads "Pending", the status route did not take effect — that would be a regression of the BLOCKER explicitly fixed in Plan 03 (PATCH route silently strips `status`).

#### 2. 409 conflict path (Step 12)

**Test:** Click an empty slot. Fill the form with the same date/start time as an existing booking on the same staff. Submit.

**Expected:** A red banner inline says "Time slot is no longer available" (or the server's exact message). Modal stays open. Banner clears when the user edits any field.

**Why human:** Server-side conflict detection requires real concurrency conditions; only a live server can reliably exercise this code path.

#### 3. 400 validation path (Step 13)

**Test:** Click an empty slot. Bypass client-side Zod (DevTools → Elements → manually clear `value` on the customer name input AND set `customerAddress` to 1 char OR submit the form via a mutated event). Submit.

**Expected:** Field-level errors "Name is required" / "Address is required" show under the offending input, not as a banner.

**Why human:** Client-side Zod normally blocks invalid submission before reaching the server; testing the server-side path requires manipulating the DOM. Validates that `form.setError(zerr.path[0], …)` correctly maps the server's Zod error path to the right field.

#### 4. Free-text customer / new-contact flow (Steps 14-15)

**Test:** Type "Brand New Person" (a name guaranteed not to match). Confirm popover shows "No matches — type a new name to create". Fill phone/address/service and submit. Then navigate to `/admin/contacts` (or the equivalent contacts page) and verify a new contact "Brand New Person" was created.

**Expected:** Booking is created with the typed name. A new contact is upserted server-side via `upsertContact` in the POST /api/bookings handler.

**Why human:** Verifies the cookie-auth Bearer-token-trap avoidance — if `/api/contacts` silently returned `[]` due to wrong helper, the "No matches" state could be a false positive. Only a live server confirms the request actually reached `requireAdmin` and that `upsertContact` ran on submit.

### Gaps Summary

**No code gaps.** All 12 observable truths verified in the codebase, all 8 key links wired, all 6 data-flow traces produce real data, all 20 implementation decisions (D-00 through D-19) accounted for, and no anti-patterns introduced by Phase 14. TypeScript type-checks cleanly.

**Status `human_needed`** is recommended (not `passed`) solely because Plan 03's blocking checkpoint:human-verify task was auto-approved without execution. The 16-step manual smoke script was never run against a live dev server. The four highest-value subset of those checks are routed to human verification above.

If the user runs and confirms the four human-verification scenarios, the phase moves to `passed` with no follow-up work needed. If any of the four fail, the regression is localized:
- Scenario 1 (status="Confirmed") failure → status PUT did not fire OR is not setting `'confirmed'`. Check Network tab for the PUT to `/api/bookings/:id/status` and inspect its response.
- Scenario 2 (409 banner) failure → check that `err?.message` is being set as `serverError` in the onError handler.
- Scenario 3 (400 field-level) failure → check that `data.errors[*].path[0]` matches a form field name (server emits Zod-style paths).
- Scenario 4 (free-text new contact) failure → verify the contacts type-ahead endpoint actually returns `[]` (DevTools → Network) rather than failing silently due to auth.

---

_Verified: 2026-04-28_
_Verifier: Claude (gsd-verifier)_
