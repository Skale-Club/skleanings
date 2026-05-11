---
id: SEED-021
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when any staff member needs a lunch break or split shift
scope: Medium
---

# SEED-021: Multiple time slots per day (e.g., 8am-12pm and 2pm-7pm on Monday)

## Why This Matters

The current `staffAvailability` table allows only ONE time range per day per staff member (`startTime`, `endTime`, `isAvailable`). This means that if a team works morning and afternoon with a lunch break (8am-12pm and 2pm-7pm), the system has to configure the whole day as available (8am-7pm), which offers slots between 12pm-2pm that no one can attend.

The Cal.com screenshots show exactly this: Monday has 8:00am-12:00pm AND 2:00pm-7:00pm as two separate ranges, with `+` button to add more ranges and trash icon to remove individually.

**Why:** Cleaning companies frequently have operational pauses mid-day (team lunch, travel between locations). Without multiple slots, the system offers time slots that don't exist in reality.

## When to Surface

**Trigger:** when the first staff member configures split hours, or when the first booking appears in a break time that shouldn't have been available.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Availability / scheduling improvements milestone
- Real work calendar fidelity milestone
- Any milestone that touches `staffAvailability` or `getAvailableSlots`

## Scope Estimate

**Medium** — One phase. Schema: replace the single row in `staffAvailability` with multiple rows per day (`dayOfWeek`, `startTime`, `endTime`, `order`). Backend: `getAvailableSlots` already iterates over available intervals — needs to accept multiple ranges per day. Admin UI: `+` button to add range, trash icon per range, reordering.

## Breadcrumbs

- `shared/schema.ts` — `staffAvailability` table: `id`, `staffMemberId`, `dayOfWeek`, `startTime`, `endTime`, `isAvailable` — unique constraint per (staffMemberId, dayOfWeek) needs to change to allow multiple rows
- `server/storage.ts` — `getStaffAvailability()`, `setStaffAvailability()` — need to return/accept array of ranges per day
- `server/routes/staff.ts` — `GET /api/staff/:id/availability`, `POST /api/staff/:id/availability`
- `client/src/components/admin/StaffSection.tsx` — availability config UI per day
- `server/routes/availability.ts` (or routes.ts) — `getAvailableSlots` that calculates slots — needs to iterate multiple ranges

## Notes

Careful migration: the current table has one row per (staffMemberId, dayOfWeek). The new structure allows multiple rows. Migration: add `order` column (integer), drop unique constraint, allow multiple rows. Existing data continues working (one row per day = one range).

The current available slots algorithm probably merges availability ranges with existing booking ranges. With multiple ranges per day, the logic needs to iterate each range separately and accumulate slots.
