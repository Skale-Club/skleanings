---
id: SEED-026
status: shipped
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when admin complains that bookings are being created without travel time between services, or when minimum notice becomes a priority
scope: Medium
---

# SEED-026: Per-service booking limits (buffer time, minimum notice, time-slot intervals)

## Why This Matters

The current system has a single `minimumBookingValue` in `companySettings` but no per-service control of:
- **Buffer time before/after** — travel time between services (leaving home A, arriving at home B)
- **Minimum notice** — how many hours in advance a booking can be made (avoid last-minute bookings that are impossible to fulfill)
- **Time-slot intervals** — offer slots every 30min vs 1h vs service duration

For a cleaning company, buffer time is critical: a 2h cleaning in Brooklyn can't be immediately followed by another in Manhattan — it needs 30-45min of travel between them.

**Why:** Without buffer time, the system offers physically impossible time slots to fulfill with a team that has to travel between clients.

## When to Surface

**Trigger:** when the first travel conflict appears, or when admin configures staff with multiple bookings on the same day.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Scheduling / availability improvements milestone
- Field operations team management milestone
- Together with SEED-021 (multiple slots per day)

## Scope Estimate

**Medium** — One phase. Schema: add columns to `services`: `bufferTimeBefore` (minutes, default 0), `bufferTimeAfter` (minutes, default 0), `minimumNoticeHours` (default 0), `timeSlotInterval` (minutes nullable — null = uses service duration). Backend: `getAvailableSlots` applies buffers when calculating availability. UI: fields in the service edit tab in admin.

## Breadcrumbs

- `shared/schema.ts` — `services` table — add 4 limit columns
- `server/routes/availability.ts` — `getAvailableSlots` — apply buffer before/after when marking slot as occupied
- `client/src/components/admin/ServicesSection.tsx` — service edit UI — new "Booking Rules" section
- `companySettings.minimumBookingValue` — exists, but is in $ value not in time — both coexist

## Notes

"Buffer after event" is the most critical for cleaning — it's the travel time to the next client. "Buffer before event" is useful for preparation (buying specific supplies). Time-slot intervals: for 3h services, offering slots every 1h (not every 3h) gives the customer more flexibility.
