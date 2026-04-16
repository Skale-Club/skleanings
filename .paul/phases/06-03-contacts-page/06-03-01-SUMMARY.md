---
phase: 06-03-contacts-page
plan: 01
subsystem: api
tags: [contacts, storage, booking-flow]

requires:
  - phase: 06-01-01
    provides: contacts table + upsertContact storage method
provides:
  - listContactsWithStats (raw SQL LEFT JOIN with booking aggregates)
  - updateBookingContactId storage method
  - GET /api/contacts (list with stats + search)
  - GET /api/contacts/:id (single contact)
  - GET /api/contacts/:id/bookings (booking history)
  - PUT /api/contacts/:id (update notes/profile)
  - upsertContact wired into booking creation (after createBooking, before GHL sync)

key-files:
  modified:
    - server/storage.ts
    - server/routes/bookings.ts
    - server/routes.ts
  created:
    - server/routes/contacts.ts

key-decisions:
  - "listContactsWithStats uses raw SQL for LEFT JOIN aggregation — drizzle doesn't support lateral joins cleanly"
  - "upsertContact failure is non-blocking — wrapped in try/catch so contact errors never break booking creation"

duration: ~10min
started: 2026-04-09T00:00:00Z
completed: 2026-04-09T00:00:00Z
---

# Phase 3 Plan 01: Contacts API + Storage Methods + Booking Flow Wiring

**Contacts API endpoints live, storage layer extended, every new booking now auto-links to a contact.**

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: GET /api/contacts with stats | Pass | listContactsWithStats raw SQL LEFT JOIN |
| AC-2: GET /api/contacts/:id + bookings | Pass | getContact + getContactBookings |
| AC-3: PUT /api/contacts/:id updates | Pass | updateContact with partial update |
| AC-4: New bookings auto-link contacts | Pass | upsertContact + updateBookingContactId after createBooking |

---
*Phase: 06-03-contacts-page, Plan: 01 — Completed: 2026-04-09*
