---
id: SEED-029
status: shipped
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when a service needs to offer different duration options for different space sizes
scope: Small
---

# SEED-029: Multiple durations per service (e.g., Cleaning 2h / 4h / 8h)

## Why This Matters

Cal.com shows "Allow multiple durations" with the example of "ACME" having 60m, 120m, and 240m as options. For cleaning, this is straightforward: a cleaning can be 2h (studio), 4h (3 bedrooms), or 8h (large house). The customer chooses the duration matching their space.

The current system has `durationMinutes` as a single field per service. `areaSizes` (JSONB) exists for the `area_based` type, but multiple durations for the `fixed_item` type don't exist.

**Why:** Offering "Cleaning 2h" and "Cleaning 4h" as separate services unnecessarily multiplies the catalog. Multiple durations on the same service is cleaner and lets the customer compare on the same card.

## When to Surface

**Trigger:** when admin creates the second service that is essentially the same service but with different duration (signal that multiple durations are needed).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Service catalog / pricing improvements milestone
- Together with SEED-027 (booking questions) — duration can be determined by the answer to "how many m²?"

## Scope Estimate

**Small** — A short phase. Schema: new `serviceDurations` table (`id`, `serviceId` FK, `label` text, `durationMinutes` int, `price` numeric, `order`). When a service has `serviceDurations`, the booking flow shows a duration selector before going to the calendar. `durationMinutes` on the service becomes the default/fallback.

## Breadcrumbs

- `shared/schema.ts` — `services` table (`durationMinutes`) + new `serviceDurations` table
- `client/src/pages/BookingPage.tsx` — service selection step — render duration selector
- `server/routes/services.ts` — `GET /api/services/:id` — include `durations` in response
- `server/routes/availability.ts` — `getAvailableSlots` — receive dynamic `durationMinutes` from chosen service
- `client/src/components/admin/ServicesSection.tsx` — service edit UI — "Available durations" section

## Notes

Visual pattern: selection cards or buttons with label ("2h — Small apartment — $150"), similar to the existing `areaSizes` for `area_based`. Price can vary by duration (more hours = more expensive) — each `serviceDuration` has its own `price`.
