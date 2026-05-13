# Roadmap: Skleanings

## Milestones

- ✅ **v1.0 Marketing Attribution** — Phases 10–14 (shipped 2026-05-05)
- ✅ **v2.0 White Label** — Phases 15–19 (shipped 2026-05-05)
- ✅ **v3.0 Calendar Polish** — Phase 20 (shipped 2026-05-11)
- ✅ **v4.0 Booking Intelligence** — Phases 21–29 (shipped 2026-05-11)
- ✅ **v5.0 Booking Experience** — Phases 30–32 (shipped 2026-05-13)
- ✅ **v6.0 Platform Quality** — Phases 33–35 (shipped 2026-05-13)
- 🚧 **v7.0 Xkedule Foundation** — Phases 36–37 (active)

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

<details>
<summary>✅ v6.0 Platform Quality (Phases 33–35) — SHIPPED 2026-05-13</summary>

- [x] Phase 33: Rate Limiting (1/1 plans) — completed 2026-05-13
- [x] Phase 34: Component Split (4/4 plans) — completed 2026-05-13
- [x] Phase 35: Blog Cron Migration (2/2 plans) — completed 2026-05-13

Full details: [milestones/v6.0-ROADMAP.md](milestones/v6.0-ROADMAP.md)

</details>

---

## v7.0 Xkedule Foundation (Phases 36–37)

- [x] **Phase 36: Locale Settings** — Add language, startOfWeek, dateFormat to companySettings; admin UI + booking flow consumption (completed 2026-05-13)
- [x] **Phase 37: Super-Admin Panel** — Dedicated /superadmin route with session auth, stats, health check, companySettings access, error logs (completed 2026-05-13)

---

## Phase Details

### Phase 36: Locale Settings
**Goal**: Admins can configure tenant locale (language, week start, date format) and the booking flow and calendar consume those settings automatically
**Depends on**: Phase 35 (companySettings pattern established)
**Requirements**: LOC-01, LOC-02, LOC-03, LOC-04, LOC-05
**Success Criteria** (what must be TRUE):
  1. Admin can save language (en / pt-BR), startOfWeek (sunday / monday), and dateFormat (MM/DD/YYYY / DD/MM/YYYY / YYYY-MM-DD) from the General section of Company Settings
  2. The admin appointments calendar first day of week reflects the saved startOfWeek value without a page reload after saving
  3. Dates displayed in the customer booking flow use the tenant's configured dateFormat
  4. All three locale columns are persisted via a Supabase CLI migration applied to companySettings
**Plans**: 3 plans
Plans:
- [x] 36-01-PLAN.md — DB migration + Drizzle schema + CompanySettingsData type extension
- [x] 36-02-PLAN.md — Admin UI: three locale Select fields in CompanySettingsSection General tab
- [ ] 36-03-PLAN.md — Consumer wiring: AppointmentsCalendarSection weekStartsOn + booking flow month header locale
**UI hint**: yes

### Phase 37: Super-Admin Panel
**Goal**: A dedicated /superadmin route protected by separate credentials gives platform operators visibility into tenant health, stats, and settings without needing the tenant admin login
**Depends on**: Phase 36
**Requirements**: SADM-01, SADM-02, SADM-03, SADM-04, SADM-05, SADM-06
**Success Criteria** (what must be TRUE):
  1. Visiting /superadmin with no valid super-admin session redirects or returns 403; visiting with valid credentials (SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD_HASH env vars) renders the panel
  2. All /api/super-admin/* endpoints return 403 for requests without a valid super-admin session cookie
  3. The panel displays live tenant stats: total bookings, total customers, total services, staff count, and DB uptime
  4. The panel displays a health check section showing DB connectivity, applied Supabase migration count, and presence of required environment variables
  5. Super-admin can view and edit companySettings fields and see the last 50 server error log entries from within the panel
**Plans**: 3 plans
Plans:
- [x] 37-01-PLAN.md — Server foundation: session.d.ts TypeScript augmentation + error-log ring buffer + patchConsoleError() startup wire
- [x] 37-02-PLAN.md — Super-admin API routes: login/logout/me, stats, health check, company-settings CRUD, error logs
- [ ] 37-03-PLAN.md — Frontend: SuperAdmin.tsx standalone page (login + dashboard), useSuperAdmin hooks, App.tsx route isolation
**UI hint**: yes

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 10–14 | v1.0 | 15/15 | Complete | 2026-05-05 |
| 15–19 | v2.0 | 15/15 | Complete | 2026-05-05 |
| 20 | v3.0 | 4/4 | Complete | 2026-05-11 |
| 21–29 | v4.0 | 27/27 | Complete | 2026-05-11 |
| 30–32 | v5.0 | 9/9 | Complete | 2026-05-13 |
| 33–35 | v6.0 | 7/7 | Complete | 2026-05-13 |
| 36 | v7.0 | 2/3 | Complete    | 2026-05-13 |
| 37 | v7.0 | 2/3 | Complete    | 2026-05-13 |

---

*Full milestone archives: [milestones/](milestones/)*
