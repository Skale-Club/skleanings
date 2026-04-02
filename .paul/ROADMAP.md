# Roadmap: skleanings

## Overview

Skleanings is a booking platform for a cleaning company. The current milestone (v0.2) adds a Staff Members feature, enabling customers to book services with a specific professional. The system enforces per-staff availability, resolves conflicts across multiple staff, and syncs each staff member's Google Calendar to automatically block their busy times.

## Current Milestone

**v0.3 — TBD** (planning)
Status: Not started
Phases: TBD

## Completed Milestone

**v0.2 — Staff Members** (v0.2.0)
Status: ✅ Complete — 2026-04-02
Phases: 5 of 5 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Schema & Storage Layer | 3 | ✅ Complete | 2026-04-02 |
| 2 | Staff Management API + Admin UI | 2 | ✅ Complete | 2026-04-02 |
| 3 | Google Calendar OAuth per Staff | 2 | ✅ Complete | 2026-04-02 |
| 4 | Smart Availability Engine | 1 | ✅ Complete | 2026-04-02 |
| 5 | Booking Flow UI — Staff Selection | 1 | ✅ Complete | 2026-04-02 |

## Phase Details

### Phase 1: Schema & Storage Layer

**Goal:** All database tables for staff feature exist with correct relationships; storage layer has typed methods for all staff operations; existing bookings remain unaffected.
**Depends on:** Nothing (first phase)
**Research:** Unlikely (internal schema patterns established)

**Scope:**
- `staffMembers` table (id, firstName, lastName, email, phone, profileImageUrl, isActive, bio)
- `staffServiceAbilities` junction table (staffMemberId → serviceId, many-to-many)
- `staffAvailability` table (staffMemberId, dayOfWeek, startTime, endTime, isAvailable)
- `staffGoogleCalendar` table (staffMemberId, accessToken, refreshToken, calendarId, connectedAt)
- Add nullable `staffMemberId` to `bookings` table
- IStorage methods: CRUD staff, assign services, set availability, store Google tokens
- Drizzle insert/select schemas and TypeScript types

**Plans:**
- [ ] 01-01: Staff schema tables + Drizzle types
- [ ] 01-02: Bookings migration (add staffMemberId nullable)
- [ ] 01-03: Storage layer methods for staff

### Phase 2: Staff Management API + Admin UI

**Goal:** Admin can create and manage staff members, assign services, and set working hours through the admin dashboard.
**Depends on:** Phase 1 (schema + storage)
**Research:** Unlikely (CRUD pattern established in codebase)

**Scope:**
- REST endpoints: `/api/staff` (CRUD), `/api/staff/:id/services`, `/api/staff/:id/availability`
- Admin UI: Staff list page, create/edit staff dialog, service assignment, hours configuration
- Staff count endpoint (`/api/staff/count`) used by frontend to conditionally show selector

**Plans:**
- [ ] 02-01: Staff API endpoints (CRUD + service assignment + availability)
- [ ] 02-02: Admin UI — staff list + create/edit dialog
- [ ] 02-03: Admin UI — service assignment + availability hours

### Phase 3: Google Calendar OAuth per Staff *(optional integration)*

**Goal:** Each staff member can connect their personal Google Calendar; external events automatically block their booking availability.
**Depends on:** Phase 2 (staff must exist to connect calendar)
**Research:** Likely (Google OAuth 2.0 flow, Google Calendar API busy times)
**Research topics:** Google Calendar API scopes for busy-time only, token refresh strategy, Vercel env var setup for Google credentials

**Scope:**
- Google OAuth 2.0 flow (per staff member, `/api/staff/:id/calendar/connect`)
- Token storage + refresh logic
- Busy-time fetching from Google Calendar API (freebusy query)
- Calendar disconnect endpoint
- Admin UI: connect/disconnect Google Calendar per staff member

**Plans:**
- [ ] 03-01: Google OAuth flow + token storage
- [ ] 03-02: Busy-time fetching + caching strategy
- [ ] 03-03: Admin UI — calendar connect/disconnect per staff

### Phase 4: Smart Availability Engine

**Goal:** Availability endpoint returns slots based on per-staff schedules, Google Calendar busy times, and existing bookings — with correct cross-service conflict resolution for carts with multiple services.
**Depends on:** Phase 3 (Google Calendar tokens available)
**Research:** Unlikely (extends existing `server/lib/availability.ts`)

**Scope:**
- Refactor `getAvailableSlots` to accept optional `serviceIds[]` param
- For each slot: check which staff can do each service → are they free?
- Cross-service logic: cart has services A + B → staff for A and staff for B must both have overlapping free slots
- Error handling: if no staff can cover a service at any slot, surface as "service unavailable for this date"
- Backward-compatible: if no staff in system, old global logic runs unchanged
- `staffId` param on availability endpoint: when customer selects a specific staff, filter to that staff only

**Plans:**
- [ ] 04-01: Per-staff slot computation (hours + Google busy + existing bookings)
- [ ] 04-02: Cross-service availability merging (cart intersection logic)
- [ ] 04-03: Error handling + backward-compatibility layer

### Phase 5: Booking Flow UI — Staff Selection

**Goal:** Booking flow conditionally shows a staff selection step; selected staff is passed through to booking creation; confirmation screen shows assigned professional.
**Depends on:** Phase 4 (availability engine must support staffId filtering)
**Research:** Unlikely (extends existing BookingPage.tsx)

**Scope:**
- `/api/staff/count` check on BookingPage mount → hide step if count ≤ 1
- Staff selection step: show available staff for the services in cart (with photo + name)
- Selected staffId stored in booking state
- Availability query updated to include `staffId` when staff is selected
- POST `/api/bookings` updated to accept `staffMemberId`
- Booking confirmation shows assigned professional name
- Admin booking view shows assigned staff

**Plans:**
- [ ] 05-01: Staff selection UI component + conditional display logic
- [ ] 05-02: Availability + booking submission with staffId
- [ ] 05-03: Confirmation screen + admin booking view updates

---
*Roadmap created: 2026-04-02*
*Last updated: 2026-04-02 — v0.2 complete*
