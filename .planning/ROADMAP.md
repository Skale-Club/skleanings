# Roadmap: Skleanings

## Milestones

- ✅ **v1.0 Marketing Attribution** — Phases 10–14 (shipped 2026-05-05)
- ✅ **v2.0 White Label** — Phases 15–19 (shipped 2026-05-05)
- ✅ **v3.0 Calendar Polish** — Phase 20 (shipped 2026-05-11)
- 🔄 **v4.0 Booking Intelligence** — Phases 25–29 (in progress)

---

## Phases

<details>
<summary>✅ v1.0 Marketing Attribution (Phases 10–14) — SHIPPED 2026-05-05</summary>

- [x] Phase 10: Schema, Capture & Classification (3/3 plans) — completed 2026-04-25
- [x] Phase 11: Booking Flow Attribution (3/3 plans) — completed 2026-04-25
- [x] Phase 12: Marketing Dashboard UI (3/3 plans) — completed 2026-04-25
- [x] Phase 13: Visitor Journey & GHL Sync (3/3 plans) — completed 2026-04-26
- [x] Phase 14: Admin Calendar Create Booking from Slot (3/3 plans) — completed 2026-04-28

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v2.0 White Label (Phases 15–19) — SHIPPED 2026-05-05</summary>

- [x] Phase 15: Schema Foundation & Detokenization (3/3 plans) — completed 2026-04-29
- [x] Phase 16: SEO Meta Injection (3/3 plans) — completed 2026-04-30
- [x] Phase 17: Favicon, Legal & Company Type Admin UI (3/3 plans) — completed 2026-04-30
- [x] Phase 18: Admin Calendar Improvements (3/3 plans) — completed 2026-04-30
- [x] Phase 19: Receptionist Booking Flow & Multi-Staff View (4/4 plans) — completed 2026-04-30

Full details: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)

</details>

<details>
<summary>✅ v3.0 Calendar Polish (Phase 20) — SHIPPED 2026-05-11</summary>

- [x] Phase 20: Calendar Timeline & Structure Audit (4/4 plans) — completed 2026-05-11

Full details: [milestones/v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md)

</details>

---

### Standalone phases (Phases 21–24)

- [x] Phase 21: Per-service booking limits (3/3 plans) — completed 2026-05-11
- [x] Phase 22: Date overrides for staff availability (3/3 plans) — completed 2026-05-11
- [x] Phase 23: Multiple durations per service (3/3 plans) — completed 2026-05-11
- [x] Phase 24: Manual confirmation flow per service (3/3 plans) — completed 2026-05-11

---

### v4.0 Booking Intelligence (Phases 25–29)

- [ ] **Phase 25: Multiple Time Slots Per Day** — Multi-range daily availability with migration
- [ ] **Phase 26: Custom Booking Questions** — Service-specific intake questions for admin and customers
- [ ] **Phase 27: Recurring Bookings — Schema & Cron Foundation** — Database schema and auto-generation job
- [ ] **Phase 28: Recurring Bookings — Customer Flow & Notifications** — Frequency selector and 48h reminders
- [ ] **Phase 29: Recurring Bookings — Admin & Self-Serve Management** — Subscription panel and pause/cancel

---

## Phase Details

### Phase 25: Multiple Time Slots Per Day
**Goal**: Staff daily availability supports multiple non-overlapping time ranges so slots are only offered during configured windows with gaps respected.
**Depends on**: Phase 24
**Requirements**: SLOTS-01, SLOTS-02, SLOTS-03, SLOTS-04
**Success Criteria** (what must be TRUE):
  1. Admin can configure two or more separate time ranges on a single day (e.g., 8am–12pm and 2pm–7pm) and save without error
  2. Booking slots shown to customers contain no times that fall within a configured gap between ranges
  3. An admin removing a time range sees the editor update immediately and future bookings reflect the change
  4. Existing staff availability records load and behave identically after the migration runs — no data loss and no behavioral change
**Plans**: 3 plans
Plans:
- [ ] 25-01-PLAN.md — Schema + Migration (range_order column + shared/schema.ts update)
- [ ] 25-02-PLAN.md — Backend: storage orderBy, route validation, slot algorithm multi-range loop
- [ ] 25-03-PLAN.md — Frontend: AvailabilityTab multi-range editor UI
**UI hint**: yes

### Phase 26: Custom Booking Questions
**Goal**: Admins can attach service-specific intake questions that customers answer during checkout, with answers stored on the booking record.
**Depends on**: Phase 25
**Requirements**: QUEST-01, QUEST-02, QUEST-03, QUEST-04
**Success Criteria** (what must be TRUE):
  1. Admin can add a question of type text, textarea, or select to a service, mark it required or optional, and set its display order
  2. Admin can delete a question; the deletion applies only to future bookings and does not corrupt past records
  3. Customer booking a service with questions sees those questions in the Customer Details step before submitting
  4. A required question blocks booking submission with a clear validation message if left blank
  5. Admin viewing a completed booking sees all customer answers alongside the standard booking details
**Plans**: TBD
**UI hint**: yes

### Phase 27: Recurring Bookings — Schema & Cron Foundation
**Goal**: The database and background job infrastructure exists to represent recurring subscriptions and automatically generate the next booking occurrence.
**Depends on**: Phase 26
**Requirements**: RECUR-01, RECUR-02
**Success Criteria** (what must be TRUE):
  1. A `recurringBookings` table exists in the database with frequency, status, next-generation date, and parent-booking reference columns
  2. A cron job runs daily and generates the next booking occurrence for any active subscription whose next generation date has been reached (one-ahead pattern)
  3. Generated bookings appear in the admin calendar and booking list as normal bookings linked to their recurring subscription
  4. The cron job logs its run result (subscriptions processed, bookings created, errors) without crashing on partial failures
**Plans**: TBD

### Phase 28: Recurring Bookings — Customer Flow & Notifications
**Goal**: Customers can opt into a recurring schedule at booking time and receive automatic 48-hour email reminders before each recurring cleaning.
**Depends on**: Phase 27
**Requirements**: RECUR-01, RECUR-03
**Success Criteria** (what must be TRUE):
  1. Customer sees a frequency selector (one-time, weekly, biweekly, monthly) with a discount preview on the booking page before checkout
  2. Selecting a recurring frequency and completing checkout creates a recurring subscription record linked to the booking
  3. Customer receives an email reminder 48 hours before each upcoming recurring cleaning — including the date, time, and service summary
  4. One-time bookings are unaffected — no reminder emails sent, no subscription created
**Plans**: TBD
**UI hint**: yes

### Phase 29: Recurring Bookings — Admin & Self-Serve Management
**Goal**: Admins can oversee all recurring subscriptions from the dashboard and customers can pause or cancel their own subscription via a self-serve link.
**Depends on**: Phase 28
**Requirements**: RECUR-04, RECUR-05
**Success Criteria** (what must be TRUE):
  1. Admin sees a Recurring Subscriptions panel listing all active and paused subscriptions with frequency, next booking date, and customer name
  2. Admin can pause a subscription (halts future generation) or cancel it (permanently stops) from the panel without leaving the admin dashboard
  3. Customer receives a self-serve link (via email) that lets them pause or cancel their subscription without logging in
  4. A paused subscription resumes generating bookings when the admin or customer un-pauses it
  5. A cancelled subscription shows as cancelled in the admin panel and generates no further bookings
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 10. Schema, Capture & Classification | v1.0 | 3/3 | Complete | 2026-04-25 |
| 11. Booking Flow Attribution | v1.0 | 3/3 | Complete | 2026-04-25 |
| 12. Marketing Dashboard UI | v1.0 | 3/3 | Complete | 2026-04-25 |
| 13. Visitor Journey & GHL Sync | v1.0 | 3/3 | Complete | 2026-04-26 |
| 14. Admin Calendar Create Booking from Slot | v1.0 | 3/3 | Complete | 2026-04-28 |
| 15. Schema Foundation & Detokenization | v2.0 | 3/3 | Complete | 2026-04-29 |
| 16. SEO Meta Injection | v2.0 | 3/3 | Complete | 2026-04-30 |
| 17. Favicon, Legal & Company Type Admin UI | v2.0 | 3/3 | Complete | 2026-04-30 |
| 18. Admin Calendar Improvements | v2.0 | 3/3 | Complete | 2026-04-30 |
| 19. Receptionist Booking Flow & Multi-Staff View | v2.0 | 4/4 | Complete | 2026-04-30 |
| 20. Calendar Timeline & Structure Audit | v3.0 | 4/4 | Complete | 2026-05-11 |
| 21. Per-service booking limits | standalone | 3/3 | Complete | 2026-05-11 |
| 22. Date overrides for staff availability | standalone | 3/3 | Complete | 2026-05-11 |
| 23. Multiple durations per service | standalone | 3/3 | Complete | 2026-05-11 |
| 24. Manual confirmation flow per service | standalone | 3/3 | Complete | 2026-05-11 |
| 25. Multiple Time Slots Per Day | v4.0 | 0/3 | Not started | — |
| 26. Custom Booking Questions | v4.0 | 0/3 | Not started | — |
| 27. Recurring Bookings — Schema & Cron Foundation | v4.0 | 0/3 | Not started | — |
| 28. Recurring Bookings — Customer Flow & Notifications | v4.0 | 0/3 | Not started | — |
| 29. Recurring Bookings — Admin & Self-Serve Management | v4.0 | 0/3 | Not started | — |

---

*Full milestone archives: [milestones/](milestones/)*
