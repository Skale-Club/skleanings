---
status: partial
phase: 14-admin-calendar-create-booking-from-slot
source: [14-VERIFICATION.md]
started: 2026-04-28T00:00:00Z
updated: 2026-04-28T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end happy path with "Confirmed" status badge (Plan 03 Step 10d)
expected: Click empty slot → modal opens pre-filled (date / startTime / staff) → fill customer + service → submit. Modal closes within ~1s; toast "Booking created"; calendar shows the new event in the clicked slot; on /admin/bookings the new booking's status badge reads "Confirmed" (validates the PUT /:id/status fix end-to-end against the database).
result: [pending]

### 2. 409 conflict path
expected: Book the same slot/staff/time as an existing booking. Red inline banner shows the server's message ("Time slot is no longer available"); modal stays open; banner clears when user edits any field.
result: [pending]

### 3. 400 Zod-validation path
expected: Submit with empty customer name OR address with <3 chars (after bypassing client-side Zod via DevTools). Field-level errors "Name is required" / "Address is required" appear under the offending inputs (not as a banner); modal stays open.
result: [pending]

### 4. Free-text customer / new-contact flow
expected: Type "Brand New Person" (no match) → popover shows "No matches — type a new name to create". Submit → booking created with that name → new contact "Brand New Person" is upserted server-side and appears in /admin/contacts.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
