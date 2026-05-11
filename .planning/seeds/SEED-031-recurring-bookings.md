---
id: SEED-031
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when the first customer asks to set up automatic weekly/biweekly cleaning, or when launching maintenance plans
scope: Large
---

# SEED-031: Recurring bookings — cleaning subscription (weekly, biweekly, monthly)

## Why This Matters

Recurring cleaning is the most profitable business model for a cleaning company: the customer doesn't need to re-schedule every week, revenue is predictable, and churn is low. Cal.com shows "Recurring event — People can subscribe for recurring events."

The current system has `serviceFrequencies` (weekly, biweekly, monthly) with percentage discount — but this is just a discount applied to a single booking, not automatic scheduling of future bookings. The difference is huge: with real recurrence, the system creates all future bookings automatically (or one at a time as the date approaches).

**Why:** Without real recurrence, the customer has to re-enter the site every week to schedule the next cleaning. With recurrence, they schedule once and it's done. This reduces acquisition cost per transaction and dramatically increases LTV.

## When to Surface

**Trigger:** when the first customer calls asking "how do I set up weekly cleaning?", or when launching a cleaning subscription plan as a product.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Subscription / recurrence milestone
- Revenue expansion milestone (increase LTV)
- Post-SEED-014 (SaaS billing) — booking recurrence is the product equivalent of SaaS subscription billing

## Scope Estimate

**Large** — A complete milestone. Components:
1. Schema: `recurringBookings` table (`id`, `contactId` FK, `serviceId`, `frequency` enum, `startDate`, `endDate` nullable, `status` active|paused|cancelled, `nextBookingDate`, `discountPercent`, `preferredStaffId`)
2. Backend: cron job that creates the next booking N days before the date (e.g., 7 days before)
3. Frontend: frequency selector in booking flow with preview of future cleaning calendar
4. Admin: recurring subscriptions panel (list, pause, cancel, change frequency)
5. Notifications: reminder for customer 48h before each recurring cleaning

## Breadcrumbs

- `shared/schema.ts` — `serviceFrequencies` table (discountPercent) — concept of frequency with discount already exists; real recurrence is the next step
- `shared/schema.ts` — `bookings` table — add `recurringBookingId` nullable FK
- `server/routes/bookings.ts` — `POST /api/bookings` — support recurring series creation
- `server/services/notifications.ts` — automatic reminders for recurring bookings
- `client/src/pages/BookingPage.tsx` — frequency step with option to activate recurrence

## Notes

Generation strategy: create the next booking only 7 days in advance (not all at once) — avoids calendar pollution and allows for availability adjustments. The current `serviceFrequencies` (with discountPercent) feeds the price of recurring bookings directly — leverage the existing table.

"Pause" is an important feature: customer is traveling in December, pauses cleanings and resumes in January without cancelling the subscription. This is a product differentiator vs "cancel and create new".
