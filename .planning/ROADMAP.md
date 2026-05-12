# Roadmap: Skleanings

## Milestones

- ✅ **v1.0 Marketing Attribution** — Phases 10–14 (shipped 2026-05-05)
- ✅ **v2.0 White Label** — Phases 15–19 (shipped 2026-05-05)
- ✅ **v3.0 Calendar Polish** — Phase 20 (shipped 2026-05-11)
- ✅ **v4.0 Booking Intelligence** — Phases 25–29 (shipped 2026-05-11)
- 🚧 **v5.0 Booking Experience** — Phases 30–32 (in progress)

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

<details>
<summary>✅ v4.0 Booking Intelligence (Phases 25–29) — SHIPPED 2026-05-11</summary>

- [x] Phase 21: Per-service booking limits (3/3 plans) — completed 2026-05-11
- [x] Phase 22: Date overrides for staff availability (3/3 plans) — completed 2026-05-11
- [x] Phase 23: Multiple durations per service (3/3 plans) — completed 2026-05-11
- [x] Phase 24: Manual confirmation flow per service (3/3 plans) — completed 2026-05-11
- [x] Phase 25: Multiple Time Slots Per Day (3/3 plans) — completed 2026-05-11
- [x] Phase 26: Custom Booking Questions (3/3 plans) — completed 2026-05-11
- [x] Phase 27: Recurring Bookings — Schema & Cron Foundation (3/3 plans) — completed 2026-05-11
- [x] Phase 28: Recurring Bookings — Customer Flow & Notifications (3/3 plans) — completed 2026-05-11
- [x] Phase 29: Recurring Bookings — Admin & Self-Serve Management (3/3 plans) — completed 2026-05-11

Full details: [milestones/v4.0-ROADMAP.md](milestones/v4.0-ROADMAP.md)

</details>

---

### 🚧 v5.0 Booking Experience (In Progress)

**Milestone Goal:** Improve the booking experience with flexible service durations, branded transactional email communication, and reliable external calendar sync via a durable retry queue.

## Phases

- [x] **Phase 30: Multiple Durations per Service** - Customers choose their preferred duration (e.g. 2h / 4h / 8h) when booking; admins configure duration options per service (completed 2026-05-11)
- [x] **Phase 31: Branded Transactional Email via Resend** - Customers receive on-brand confirmation, reminder, and cancellation emails; admins configure email credentials in the admin panel (completed 2026-05-12)
- [ ] **Phase 32: Calendar Harmony Retry Queue** - Booking sync to Google Calendar and GoHighLevel uses a durable queue with exponential backoff; admins can monitor and retry failed jobs

## Phase Details

### Phase 30: Multiple Durations per Service
**Goal**: Customers can select their preferred service duration during booking, and that selection is accurately reflected in slot availability, pricing, and booking records
**Depends on**: Nothing (first phase of milestone)
**Requirements**: DUR-01, DUR-02, DUR-03, DUR-04, DUR-05, DUR-06
**Success Criteria** (what must be TRUE):
  1. Admin can add, remove, and reorder duration options (label, minutes, price) on the service edit screen
  2. Customer sees duration cards (label + time + price) and can select one before choosing a time slot, when the service has durations configured
  3. Available time slots shown to the customer reflect the selected duration, not the catalog default
  4. The completed booking record stores the chosen duration label and minutes as a snapshot
  5. Recurring booking instances are generated using the duration chosen at original booking time, not the current catalog default
**Plans**: 3 plans
Plans:
- [x] 30-01-PLAN.md — Migration + schema: add snapshot columns and selectedDurationId to Zod
- [x] 30-02-PLAN.md — Server wiring: getServiceDuration storage method, CartContext fix, booking route resolution
- [x] 30-03-PLAN.md — Recurring pipeline: capture durationMinutes at subscription creation, fix generator
**UI hint**: yes

### Phase 31: Branded Transactional Email via Resend
**Goal**: Customers receive timely, on-brand transactional emails at key booking lifecycle moments; admins can configure and enable the Resend integration from the admin panel
**Depends on**: Phase 30
**Requirements**: EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05
**Success Criteria** (what must be TRUE):
  1. Admin can enter a Resend API key, from-address, and toggle transactional emails on or off from the admin Integrations panel
  2. Customer receives a confirmation email with service name, date, time, address, and selected duration label within 60 seconds of a confirmed booking
  3. Customer receives a reminder email approximately 24 hours before their scheduled appointment via cron job
  4. Customer receives a cancellation email immediately when their booking is cancelled by either party
  5. All email templates display the company logo, name, and brand colors sourced from companySettings
**Plans**: 3 plans
Plans:
- [x] 31-01-PLAN.md — Schema + migration + storage + Resend module (emailSettings table, sendResendEmail())
- [x] 31-02-PLAN.md — Email templates + booking trigger wiring (confirmation + cancellation fire-and-forget)
- [x] 31-03-PLAN.md — 24h reminder service + cron + GH Actions workflow + admin EmailTab UI
**UI hint**: yes

### Phase 32: Calendar Harmony Retry Queue
**Goal**: Booking sync events to Google Calendar and GoHighLevel are processed through a durable queue with automatic retries, and admins have visibility into sync health and can manually retry failed jobs
**Depends on**: Phase 31
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06, SYNC-07
**Success Criteria** (what must be TRUE):
  1. Booking creation, update, and cancellation enqueue sync jobs rather than calling GCal and GHL APIs directly — no fire-and-forget direct calls remain in the booking handler
  2. The sync worker processes jobs with SELECT FOR UPDATE SKIP LOCKED and retries up to 6 times with exponential backoff before marking a job as permanently failed
  3. Admin can view a sync health panel showing pending and failed job counts by target (GCal, GHL) and a table of recent failures with error messages
  4. Admin can trigger a manual retry for failed jobs on a specific booking from the admin panel
  5. A banner appears in admin when 10 or more consecutive failures are detected for a target, prompting reconnection
  6. A GitHub Actions workflow fires the sync worker every 5 minutes, replacing node-cron (which is a no-op on Vercel serverless)
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 10–14 | v1.0 | 15/15 | Complete | 2026-05-05 |
| 15–19 | v2.0 | 15/15 | Complete | 2026-05-05 |
| 20 | v3.0 | 4/4 | Complete | 2026-05-11 |
| 21–29 | v4.0 | 27/27 | Complete | 2026-05-11 |
| 30. Multiple Durations per Service | v5.0 | 3/3 | Complete    | 2026-05-11 |
| 31. Branded Transactional Email via Resend | v5.0 | 3/3 | Complete    | 2026-05-12 |
| 32. Calendar Harmony Retry Queue | v5.0 | 0/TBD | Not started | - |

---

*Full milestone archives: [milestones/](milestones/)*
