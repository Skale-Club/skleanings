# Roadmap: Skleanings

## Milestones

- ✅ **v1.0 Marketing Attribution** — Phases 10–14 (shipped 2026-05-05)
- ✅ **v2.0 White Label** — Phases 15–19 (shipped 2026-05-05)
- 🚧 **v3.0 Calendar Polish** — Phase 20 (in progress)

---

## v3.0 Calendar Polish

**Defined:** 2026-05-05
**Phases:** 1 (Phase 20)
**Scope:** Deep audit and refactor of the admin calendar — timeline alignment, RBC structure, By Staff view, drag-to-reassign behavior. Surface issues introduced or unresolved by Phases 14, 18, and 19, then fix them at the structural level rather than patching symptoms.

### Phase 20: Calendar Timeline & Structure Audit
**Goal**: The admin calendar renders with pixel-correct timeline alignment in every view (Day, Week, Month, By Staff), the underlying RBC + DnD HOC structure is well-organized and free of regressions from Phases 14/18/19, and any architectural debt in `AppointmentsCalendarSection.tsx` is identified and addressed where it blocks visual correctness.
**Depends on**: Phase 19 (multi-staff view must remain functional)
**Requirements**: CAL-FIX-01, CAL-FIX-02, CAL-FIX-03, CAL-FIX-04
**Success Criteria** (what must be TRUE):
  1. Time labels (e.g., "9:00 AM") in the gutter align horizontally with the corresponding grid line in Day, Week, and By Staff views — zero pixel offset at any zoom level
  2. The By Staff view renders one column per visible staff member with header, gutter, and event positions all aligned with the time grid; switching between Day/Week/Month/By Staff and back leaves no stale layout state
  3. Drag-to-reassign and QuickBook flows from Phase 19 continue to work after the refactor — no regression on existing UAT items
  4. `AppointmentsCalendarSection.tsx` structural issues that contribute to misalignment (e.g., HOC placement, resourceProps spread, conditional CSS) are documented and corrected
**Plans**: 4 plans
  - [ ] 20-01-PLAN.md — Wave 0: Create UAT + DIAGNOSIS artifacts; record baseline measurements
  - [ ] 20-02-PLAN.md — Wave 1: HIGH-confidence structural fixes (memoize components/resourceProps, delete redundant useEffect, useCallback handlers); re-measure
  - [ ] 20-03-PLAN.md — Wave 2: Diagnosis-driven CSS strategy selection (A/B/C/D); apply and re-measure
  - [ ] 20-04-PLAN.md — Wave 3: Conditional view-resource remount + full UAT signoff (CAL-FIX-01..04 + Phase 19 regression)
**UI hint**: yes

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

### 🚧 v3.0 Calendar Polish (In Progress)

- [ ] Phase 20: Calendar Timeline & Structure Audit (4 plans)

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
| 20. Calendar Timeline & Structure Audit | v3.0 | 0/TBD | Not started | — |
| 21. Per-service booking limits | standalone | 3/3 | Complete    | 2026-05-11 |
| 22. Date overrides for staff availability | standalone | 3/3 | Complete    | 2026-05-11 |
| 23. Multiple durations per service | standalone | 0/3 | Complete    | 2026-05-11 |
| 24. Manual confirmation flow per service | standalone | 3/3 | Complete    | 2026-05-11 |

---

## Requirement Coverage (v3.0)

| Phase | Requirements |
|-------|-------------|
| Phase 20 | CAL-FIX-01, CAL-FIX-02, CAL-FIX-03, CAL-FIX-04 |

### Phase 21: Per-service booking limits — buffer time, minimum notice, time-slot interval

**Goal:** Add `bufferTimeBefore`, `bufferTimeAfter`, `minimumNoticeHours`, and `timeSlotInterval` columns to the `services` table and apply them in the availability logic and admin UI. Cleaning company operators can configure travel buffer time and booking notice requirements per service.
**Requirements**: BOOKING-LIMITS-01, BOOKING-LIMITS-02, BOOKING-LIMITS-03
**Depends on:** Phase 20
**Plans:** 3/3 plans complete

Plans:
- [x] 21-01-PLAN.md — Wave 1: Schema + Supabase migration (4 new columns on services table)
- [x] 21-02-PLAN.md — Wave 2: Backend availability logic (buffer, notice, interval in getAvailableSlots)
- [x] 21-03-PLAN.md — Wave 2: Admin UI (Booking Rules section in ServiceForm)

### Phase 22: Date overrides for staff availability (SEED-022)

**Goal:** Add staffAvailabilityOverrides table so staff members can block specific dates or set different hours on a date, overriding their weekly schedule.
**Requirements**: OVR-01, OVR-02, OVR-03, OVR-04, OVR-05, OVR-06
**Depends on:** Phase 21
**Plans:** 3/3 plans complete

Plans:
- [x] 22-01-PLAN.md — Wave 1: Schema + Supabase migration (staffAvailabilityOverrides table)
- [x] 22-02-PLAN.md — Wave 2: Backend (storage CRUD, 3 REST endpoints, override logic in getStaffAvailableSlots)
- [x] 22-03-PLAN.md — Wave 3: Admin UI (DateOverridesTab in StaffManageDialog)

### Phase 23: Multiple durations per service (SEED-029)

**Goal:** Add serviceDurations table so a single service can offer multiple durations (e.g., 2h/$150, 4h/$250, 8h/$400). Customer selects duration in booking flow before calendar.
**Requirements**: SEED-029-schema, SEED-029-backend, SEED-029-ui
**Depends on:** Phase 21
**Plans:** 3/3 plans complete

Plans:
- [ ] 23-01-PLAN.md — Wave 1: Schema + Supabase migration (serviceDurations table + Drizzle types)
- [ ] 23-02-PLAN.md — Wave 2: Backend (storage CRUD, 5 REST endpoints, enrich GET /api/services/:id)
- [ ] 23-03-PLAN.md — Wave 3: Admin UI (ServiceForm durations section) + booking flow duration selector

### Phase 24: Manual confirmation flow per service (SEED-030)

**Goal:** Add requiresConfirmation boolean to services table. When true, bookings are created with awaiting_approval status. Admin sees approve/reject buttons. Customer receives "request received, pending confirmation" notification.
**Requirements**: SEED-030-SCHEMA, SEED-030-BACKEND, SEED-030-UI
**Depends on:** Phase 21
**Plans:** 3/3 plans complete

Plans:
- [x] 24-01-PLAN.md — Wave 1: Schema + Supabase migration (requiresConfirmation boolean on services)
- [x] 24-02-PLAN.md — Wave 2: Backend (booking creation status logic + approve/reject endpoints + awaiting_approval notifications)
- [x] 24-03-PLAN.md — Wave 3: Admin UI (BookingsSection approve/reject + ServiceForm toggle) + customer-facing awaiting message

### Phase 25: Multiple time slots per day (SEED-021)

**Goal:** Allow staff availability to have multiple time ranges per day (e.g., 8am-12pm AND 2pm-7pm). Replace single-slot-per-day constraint with multi-row support in staffAvailability. Admin UI gets + button to add ranges per day.
**Requirements**: TBD
**Depends on:** Phase 21
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 25 to break down)

---

*Full milestone archives: [milestones/](milestones/)*
