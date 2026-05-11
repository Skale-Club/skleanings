---
id: SEED-023
status: cancelled
cancelled_on: 2026-05-10
cancellation_reason: Cut — Cal.com luxury; 1 schedule per staff solves 95% of cases
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when a staff member needs to alternate between two different schedules (e.g., summer vs winter)
scope: Medium
---

# SEED-023: Named availability schedules (multiple schedules per staff, like "Working Hours Default")

## Why This Matters

The current system has a single schedule per staff. Cal.com shows that each person can have multiple named schedules — "Working Hours Default", "Summer Schedule", "Part-time" — with one marked as Default. This allows switching between configurations without reconfiguring from scratch.

For a company with seasonality (more services in summer, fewer in winter), being able to have "Summer Hours" and "Winter Hours" as named schedules and switching between them is a real productivity feature.

**Why:** Reconfiguring hours every time the season changes is laborious and error-prone. Named schedules are standard in any mature scheduling product (Cal.com, Calendly, Acuity).

## When to Surface

**Trigger:** when implementing SEED-021 (multiple slots per day) and SEED-022 (date overrides) — the three form the complete availability system. Or when a staff complains about having to reconfigure hours seasonally.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Complete availability redesign milestone (with SEED-021 and SEED-022)
- Advanced schedule management milestone

## Scope Estimate

**Medium** — One phase. Schema: `availabilitySchedules` table (`id`, `staffMemberId`, `name`, `isDefault`, `timezone`) — `staffAvailability` rows reference a `scheduleId`. UI: list of schedules with "Set as default" button, edit per schedule, "+ New schedule" button.

## Breadcrumbs

- `shared/schema.ts` — new `availabilitySchedules` table; `staffAvailability` table gets FK `scheduleId`
- `server/routes/availability.ts` — `getAvailableSlots` uses the staff's `isDefault = true` schedule
- `client/src/components/admin/StaffSection.tsx` — per-staff schedules UI
- Visual reference: Cal.com screenshots — "Working Hours" with "Default" badge, "Set as default" button, trash button

## Notes

Implement AFTER SEED-021 — named schedules are a container for the multiple slots per day. Without SEED-021, a named schedule with just one slot per day has less value. The migration creates a default schedule for each existing staff and moves the `staffAvailability` rows to that schedule.
