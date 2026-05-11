---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Booking Experience
status: executing
stopped_at: Completed 30-02-PLAN.md
last_updated: "2026-05-11T22:20:51.830Z"
last_activity: 2026-05-11
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-11)

**Core value:** Customers can discover, book, and pay for cleaning services online without calling — and the business can manage everything from one admin panel.
**Current focus:** Phase 30 — Multiple Durations per Service

## Current Position

Phase: 30 (Multiple Durations per Service) — EXECUTING
Plan: 3 of 3
Status: Ready to execute
Last activity: 2026-05-11

Progress: [░░░░░░░░░░] 0%

## Shipped Milestones

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 Marketing Attribution | 10–14 (5 phases) | 15 | 2026-05-05 |
| v2.0 White Label | 15–19 (5 phases) | 15 | 2026-05-05 |
| v3.0 Calendar Polish | 20 (1 phase) | 4 | 2026-05-11 |
| v4.0 Booking Intelligence | 21–29 (9 phases) | 27 | 2026-05-11 |

See: .planning/MILESTONES.md

## Accumulated Context

### Decisions

All milestone decisions logged in PROJECT.md Key Decisions table.

Recent decisions affecting current work:

- [Research]: Do NOT use drizzle-orm query builder .for("update", { skipLocked: true }) — known bug #3554; use raw db.execute with FOR UPDATE SKIP LOCKED instead
- [Research]: Do NOT install @react-email/components — deprecated since React Email v6; all components are now in react-email package directly
- [Research]: Do NOT remove nodemailer — still powers v4.0 recurring subscription reminders; Resend is a parallel addition in server/lib/email-resend.ts
- [Research]: react-email v6 peer dep conflict with React 18 — use --legacy-peer-deps; do not upgrade to React 19
- [Research]: CartContext.totalDuration must use selected duration, not catalog default — override item.durationMinutes at selection time
- [Research]: serviceDurations migration status uncertain — Phase 30 plan must begin with supabase db status check before implementation
- [Phase 30-multiple-durations-per-service]: recurringBookings.durationMinutes is nullable (null = use catalog default) — safe fallback for pre-Phase-30 subscription rows
- [Phase 30]: questionAnswers omitted from CartContext getCartItemsForBooking — CartItem type does not carry the field; server route already forwards it directly from cartItem

### Pending Todos

None yet.

### Blockers/Concerns

- **MIGRATION STATUS UNKNOWN** — serviceDurations schema exists in shared/schema.ts but Supabase migration may not be applied. Phase 30 plan must verify with `supabase db status` before writing any implementation code.
- **Phase 19 UAT pending** — 5 human browser checks in `.planning/phases/19-receptionist-booking-flow-multi-staff-view/19-HUMAN-UAT.md` (By Staff layout, QuickBook, drag-to-reassign, GCal busy guard, customer badges).
- **Phase 31 DNS pre-flight** — Resend domain DNS records (DKIM CNAME, SPF TXT) need 72-hour propagation window before go-live. Must be in Phase 31 pre-flight checklist.
- **Phase 32 GH Actions secret** — INTERNAL_CRON_SECRET must be added to both Vercel and GitHub Actions secrets before Phase 32 deployment. Must be in Phase 32 pre-flight checklist.

## Session Continuity

Last session: 2026-05-11T22:20:51.818Z
Stopped at: Completed 30-02-PLAN.md
Resume file: None
