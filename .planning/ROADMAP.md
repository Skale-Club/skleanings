# Roadmap: Skleanings

## Milestones

- ✅ **v1.0 Marketing Attribution** — Phases 10–14 (shipped 2026-05-05)
- ✅ **v2.0 White Label** — Phases 15–19 (shipped 2026-05-05)
- ✅ **v3.0 Calendar Polish** — Phase 20 (shipped 2026-05-11)
- ✅ **v4.0 Booking Intelligence** — Phases 21–29 (shipped 2026-05-11)
- ✅ **v5.0 Booking Experience** — Phases 30–32 (shipped 2026-05-13)
- [ ] **v6.0 Platform Quality** — Phases 33–35 (active)

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
<summary>✅ v4.0 Booking Intelligence (Phases 21–29) — SHIPPED 2026-05-11</summary>

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

<details>
<summary>✅ v5.0 Booking Experience (Phases 30–32) — SHIPPED 2026-05-13</summary>

- [x] Phase 30: Multiple Durations per Service (3/3 plans) — completed 2026-05-11
- [x] Phase 31: Branded Transactional Email via Resend (3/3 plans) — completed 2026-05-12
- [x] Phase 32: Calendar Harmony Retry Queue (3/3 plans) — completed 2026-05-12

Full details: [milestones/v5.0-ROADMAP.md](milestones/v5.0-ROADMAP.md)

</details>

### v6.0 Platform Quality (Phases 33–35)

- [x] **Phase 33: Rate Limiting** - Add in-memory rate limiting to public analytics and chat endpoints (completed 2026-05-13)
- [ ] **Phase 34: Component Split** - Refactor BookingPage and AppointmentsCalendarSection into focused sub-components
- [ ] **Phase 35: Blog Cron Migration** - Migrate blog generation cron from Vercel Cron to GitHub Actions with endpoint auth

---

## Phase Details

### Phase 33: Rate Limiting
**Goal**: Public endpoints are protected against abuse and excessive request volume
**Depends on**: Nothing (server-side only change, no phase dependencies within v6.0)
**Requirements**: RATE-01, RATE-02, RATE-03, RATE-04
**Success Criteria** (what must be TRUE):
  1. Sending 11 rapid requests to `POST /api/analytics/session` from the same IP yields a 429 response on the 11th with a `Retry-After` header
  2. Sending 11 rapid requests to `POST /api/analytics/events` from the same IP yields a 429 response on the 11th
  3. Sending 21 rapid requests to `POST /api/chat/message` from the same IP yields a 429 on the 21st
  4. Normal traffic (under limit) receives 200 responses with no change in behavior
  5. Rate limiter config uses `standardHeaders: true` and `legacyHeaders: false` (no `X-RateLimit-*` legacy headers emitted)
**Plans**: 1 plan
Plans:
- [x] 33-01-PLAN.md — Fix express-rate-limit config and remove duplicate custom guards

### Phase 34: Component Split
**Goal**: BookingPage and AppointmentsCalendarSection are maintainable files with focused sub-components and no regressions
**Depends on**: Nothing (independent refactor)
**Requirements**: SPLIT-01, SPLIT-02, SPLIT-03, SPLIT-04, SPLIT-05
**Success Criteria** (what must be TRUE):
  1. Customer can complete a full booking (staff selection through confirmation) without any regression in behavior or UI
  2. `BookingPage.tsx` contains only orchestration logic; each step lives in its own file (`StepStaffSelector`, `StepTimeSlot`, `StepCustomerDetails`, `StepPaymentMethod`)
  3. The `booking_started` analytics event fires exactly once per booking flow regardless of re-renders (useRef fire-once guard preserved)
  4. Admin calendar displays correctly with `CreateBookingModal` and drag-to-reschedule operating as separate extracted components
**Plans**: 4 plans
Plans:
- [ ] 34-01-PLAN.md — bookingSchema.ts + BookingSummary.tsx (schema/type foundation)
- [ ] 34-02-PLAN.md — Four step components: StepStaffSelector, StepTimeSlot, StepCustomerDetails, StepPaymentMethod
- [ ] 34-03-PLAN.md — CreateBookingModal.tsx + useDragToReschedule.ts (admin calendar split)
- [ ] 34-04-PLAN.md — Wire sub-components into BookingPage and AppointmentsCalendarSection orchestrators

### Phase 35: Blog Cron Migration
**Goal**: Blog generation runs reliably via GitHub Actions; Vercel Cron config and the systemHeartbeats table are fully removed
**Depends on**: Nothing (infrastructure change, independent of Phases 33–34)
**Requirements**: BLOG-01, BLOG-02, BLOG-03, BLOG-04
**Success Criteria** (what must be TRUE):
  1. `.github/workflows/blog-cron.yml` exists and triggers `POST /api/blog/generate` daily at 09:00 UTC with a valid Bearer token
  2. `POST /api/blog/generate` called without `Authorization: Bearer <BLOG_CRON_TOKEN>` returns 401
  3. `vercel.json` contains no cron entry for blog generation
  4. The `systemHeartbeats` table and all references to it are removed from schema, migrations, storage, and routes
**Plans**: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 10–14 | v1.0 | 15/15 | Complete | 2026-05-05 |
| 15–19 | v2.0 | 15/15 | Complete | 2026-05-05 |
| 20 | v3.0 | 4/4 | Complete | 2026-05-11 |
| 21–29 | v4.0 | 27/27 | Complete | 2026-05-11 |
| 30–32 | v5.0 | 9/9 | Complete | 2026-05-13 |
| 33 | v6.0 | 1/1 | Complete    | 2026-05-13 |
| 34 | v6.0 | 0/4 | Not started | - |
| 35 | v6.0 | 0/? | Not started | - |

---

*Full milestone archives: [milestones/](milestones/)*
