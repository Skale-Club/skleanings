---
id: SEED-027
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when admin needs service-specific information before confirming the booking
scope: Medium
---

# SEED-027: Custom intake questions per service (booking questions)

## Why This Matters

The current booking flow always captures the same fields: name, email, phone, address. But each service may need specific information:
- Residential cleaning: "How many bedrooms?", "Pets?", "Any products to avoid?"
- Post-construction cleaning: "How many m²?", "Is there fresh plaster/paint?"
- Upholstery cleaning: "What sofa material?", "Specific stains?"

Cal.com shows this as "Booking questions" — additional configurable fields per event type with types (text, long text, multiple choice, checkbox) and required/optional flag.

**Why:** Without custom questions, admin has to call each customer to gather basic information before the service — unnecessary friction that delays confirmation.

## When to Surface

**Trigger:** when the first specialized service is added that requires information beyond the address, or when admin implements a pre-qualification flow.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Booking flow improvements milestone
- Specialized services / catalog expansion milestone
- Any milestone that adds new service types

## Scope Estimate

**Medium** — One phase. Schema: new `serviceBookingQuestions` table (`id`, `serviceId` FK, `label`, `type` enum (text|textarea|select|checkbox|number), `options` JSONB (for select), `required` boolean, `order`). Answered values go in `bookingItems.customerNotes` JSONB (already exists) or a new `questionAnswers` JSONB column. UI: questions section in service edit + dynamic question rendering in the Customer Details step of the booking flow.

## Breadcrumbs

- `shared/schema.ts` — `services` + `bookingItems` tables (has `customerNotes` text — could become JSONB or add `questionAnswers` JSONB)
- `server/routes/services.ts` — `GET /api/services/:id` — include `bookingQuestions` in response
- `client/src/pages/BookingPage.tsx` — Customer Details step — render dynamic questions
- `client/src/components/admin/ServicesSection.tsx` — service edit UI — "Booking Questions" section

## Notes

The `customerNotes` field in `bookingItems` already exists as free text — in the short term, document in admin UI that staff should ask these infos via notes. The seed is for the structured version with typed fields. Start with 3 types: text, textarea, select — enough for 90% of cases.
