---
id: SEED-028
status: cancelled
planted: 2026-05-10
last_revised: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when implementing Xkedule's service catalog — residential and commercial must coexist from the start
scope: Medium
---

# SEED-028: Residential and commercial services — classification and coupled flows

## Why This Matters

Xkedule must support **two fundamental types of cleaning service simultaneously, in the same tenant:**

1. **Residential** — goes to the customer's home. Full address required, intake form asks home info (bedrooms, pets), price usually fixed or area-based.
2. **Non-residential / Commercial** — goes to office, restaurant, store, condo building. Commercial address required, intake form asks space info (m², business hours, frequency), price usually by contract/recurrence.

The two flows have important differences that can't be solved with single logic:
- Different address validation (apartment vs commercial unit)
- Different intake fields (see SEED-027 — custom questions per service)
- Different pricing model (residential fixed vs commercial by contract)
- Different notifications (residential talks to person; commercial talks to business contact)
- Different booking flow (residential schedules 1 visit; commercial may schedule indefinite recurrence)

**Why:** If the system only supports residential, the tenant has to create weird workarounds to sell to businesses. If only commercial, it loses 90% of the cleaning market. Coupling both flows from the start avoids massive refactoring later.

## When to Surface

**Trigger:** when implementing Xkedule's service catalog module (together with SEED-013), because the data structure must support both from the initial schema.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Xkedule service catalog milestone
- Booking flow milestone (must render different flows based on type)
- Together with SEED-013 (multi-tenant) and SEED-031 (recurring)

## Scope Estimate

**Medium** — A substantial phase. Components:

1. **Schema:**
   - `serviceCategory` column in `services` (enum: `residential` | `commercial` | `both`) — determines intake flow and validation
   - `defaultLocationType` column in `services` (enum: `client_address` | `business_address` | `pickup` | `phone` | `online`) — where the service is performed
   - `requiresContract` column in `services` (boolean) — large commercials may require contract acceptance before booking
   - `customerType` column in `bookings` (enum: `individual` | `business`) — record who the customer was

2. **Backend:**
   - Address validation differs by `serviceCategory` (residential: apt optional; commercial: business name + contact required)
   - Residential vs commercial pricing model can use different pricingTypes (`fixed_item` vs `custom_quote`)

3. **Frontend:**
   - Booking flow detects `serviceCategory` of the first service in cart and renders appropriate Customer Details step
   - Residential: Name, email, phone, address (with apt/unit), entry instructions
   - Commercial: Business name, tax ID, contact person (name, role, email, phone), commercial address, business hours, access instructions
   - Can cart mix residential and commercial services? Decide in planning — probably NO (different customer each time)

4. **Admin:**
   - Bookings filter by `customerType` (individual vs business) — separate reports
   - Different email/SMS templates (residential: personal tone; commercial: institutional tone)

## Breadcrumbs

- `shared/schema.ts` — `services` table (add `serviceCategory`, `defaultLocationType`, `requiresContract`)
- `shared/schema.ts` — `bookings` table (add `customerType`, possibly `businessName`, `businessTaxId`, `contactPerson`)
- `client/src/pages/BookingPage.tsx` — Customer Details step — branching based on `serviceCategory`
- `client/src/components/admin/ServicesSection.tsx` — service edit UI — "Category" field
- Together with SEED-027 (custom booking questions) — each category can have different default questions
- Together with SEED-031 (recurring) — large commercials tend to be recurring; align UX

## Notes

**Type `both`:** some services (e.g., carpet cleaning) can be sold for both residential and commercial. This case uses `both` and the booking flow asks at checkout start "Is this for your home or business?".

**Contract for commercials:** when `requiresContract = true`, the booking is not confirmed until the customer accepts contract-specific terms (digital signature or signed PDF upload). Can be a future extension — start without it, with simple terms acceptance.

**Business tax ID:** for the Brazilian market, use CNPJ. For US market, use EIN. Schema should be generic (`businessTaxId` text) — validation per tenant/country (SEED-011 locale).
