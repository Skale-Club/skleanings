---
id: SEED-022
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when the first staff member needs to block a specific date or have different hours on a date
scope: Small
---

# SEED-022: Date overrides — different availability on specific dates

## Why This Matters

The current system only configures availability by day of week (`dayOfWeek`). If a worker will be available on Saturday May 17 but normally doesn't work on Saturday, there's no way to configure that. If the company will close on Friday May 23 (holiday), there's no way to block just that day.

The Cal.com screenshots show "Date overrides — Add dates when your availability changes from your daily hours" with `+ Add an override` button — exactly this use case.

**Why:** Holidays, individual vacations, special events — any real business has dates that deviate from the weekly pattern. Without date overrides, admin must manually cancel bookings after they're accepted.

## When to Surface

**Trigger:** when the first holiday arrives and the team needs to block availability, or when SEED-021 (multiple slots per day) is implemented — both are part of the same availability system redesign.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Availability / scheduling improvements milestone
- Together with SEED-021 (multiple slots)
- Team schedule management milestone

## Scope Estimate

**Small** — A short phase. Schema: new `staffAvailabilityOverrides` table (`staffMemberId`, `date`, `isUnavailable` boolean, `startTime` nullable, `endTime` nullable). Backend: `getAvailableSlots` checks overrides for the date before applying the weekly schedule. UI: date calendar + modal to configure override.

## Breadcrumbs

- `shared/schema.ts` — new `staffAvailabilityOverrides` table (`id`, `staffMemberId` FK, `date` date, `isUnavailable` boolean, `startTime` time nullable, `endTime` time nullable, `reason` text nullable)
- `server/storage.ts` — new `getStaffAvailabilityOverrides(staffMemberId, dateRange)` query
- `server/routes/availability.ts` — `getAvailableSlots` needs to check override before using the weekly schedule
- `client/src/components/admin/StaffSection.tsx` — availability config section

## Notes

Precedence logic: override takes priority over the weekly schedule. If override marks `isUnavailable = true`, the day is blocked regardless of `dayOfWeek`. If override has startTime/endTime, it replaces the day-of-week hours. If no override exists, use the weekly schedule normally.

The UI can be a simple calendar with clickable days to add/remove overrides — similar to the existing date picker in the booking flow.
