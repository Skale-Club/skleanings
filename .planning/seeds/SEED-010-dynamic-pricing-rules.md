---
id: SEED-010
status: cancelled
cancelled_on: 2026-05-10
cancellation_reason: Advanced feature; product needs to mature first
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: when demand grows to the point of having idle slots on some days and overbooking on others
scope: Large
---

# SEED-010: Dynamic pricing rules (surge/discount by demand, day of week, time of day)

## Why This Matters

The current system has fixed prices (with frequency-based discount option — weekly, biweekly). There's no mechanism to offer lower prices on low-demand days (Monday 8am) or apply surge pricing in premium hours (Saturday 10am). For a cleaning company with finite staff capacity, dynamic pricing is a direct revenue lever.

**Why:** The pricing structure is already sophisticated (`pricingType`, `serviceOptions`, `serviceFrequencies`). Adding price adjustment rules per slot is a natural extension — demand data already exists in the booking tables.

## When to Surface

**Trigger:** when the business hits >80% occupancy on weekends consistently, or when admin starts manually creating promotions for specific days.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Revenue optimization / yield management milestone
- Post-White Label milestone when product is mature and scaling
- Advanced analytics milestone with historical demand data

## Scope Estimate

**Large** — One milestone. Schema: `pricingRules` table (dayOfWeek, timeRange, modifier %, priority). Admin UI: rule builder. Backend: apply modifiers during price calculation in availability check. Frontend: show adjusted price in the time slot selector.

## Breadcrumbs

- `shared/schema.ts` — `services` (pricingType, basePrice), `serviceFrequencies` (discountPercent) tables — natural extension
- `server/routes.ts` — `GET /api/availability` — where final per-slot price would be calculated
- `client/src/pages/BookingPage.tsx` — StepTimeSlot, where per-slot price would be displayed
- `server/storage.ts` — `getAvailableSlots()` — where modifier would be applied

## Notes

Start simple: rules by day of week + time range with a % adjustment (positive for surge, negative for discount). No ML required — manual rules defined by admin are sufficient to start. Future version could use historical booking data to automatically suggest rules.
