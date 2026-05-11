---
id: SEED-025
status: cancelled
cancelled_on: 2026-05-10
cancellation_reason: Cut — only makes sense with 5+ staff in the tenant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when the company grows and needs a default schedule for the whole team vs individual exceptions
scope: Medium
---

# SEED-025: "My availability" vs "Team availability" — individual vs collective availability

## Why This Matters

Cal.com shows two tabs: "My availability" (individual hours) and "Team availability" (team/company hours). In the current system, each staff has their own `staffAvailability`, but there's no concept of "company hours" that serves as a default for all new staff.

When a company has 10 workers all with the same hours (8am-6pm, Mon-Sat), configuring them one by one is unnecessary. "Team availability" would be the default template; each worker can have their individual exceptions ("My availability").

**Why:** Onboarding new staff is slow when the same schedule has to be reconfigured repeatedly. A team template accelerates the process and ensures consistency.

## When to Surface

**Trigger:** when having 5+ staff members in the system, or when implementing the availability redesign (SEED-021/022/023) — the named schedules concept (SEED-023) is the foundation for team schedules.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Availability redesign milestone (with SEED-023)
- Larger team management milestone
- When having 5+ active staff

## Scope Estimate

**Medium** — One phase. Concept: "company" schedules exist in `availabilitySchedules` without `staffMemberId` (or with `isCompanyDefault = true`). New staff inherit the company schedule by default. UI: "Team availability" tab in admin shows and edits the default company schedule; "My availability" tab per staff shows individual override.

## Breadcrumbs

- `shared/schema.ts` — `availabilitySchedules` table (from SEED-023): add `isCompanyTemplate` boolean, `staffMemberId` nullable (null = company-level schedule)
- `server/routes/availability.ts` — when creating a new staff, copy the company template as initial schedule
- `client/src/components/admin/StaffSection.tsx` — availability UI with "Team" / "Individual" tabs
- `client/src/components/admin/AvailabilitySection.tsx` — existing section for global company availability

## Notes

Depends on SEED-023 (named schedules) to exist — "Team availability" is just a schedule marked as company template. Inheritance behavior: new staff starts with a copy of the company template, not a reference — changes to the template don't affect existing staff retroactively (avoids surprises).
