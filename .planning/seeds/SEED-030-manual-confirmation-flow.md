---
id: SEED-030
status: dormant
planted: 2026-05-10
last_revised: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when admin wants to manually approve bookings before confirming, especially for large jobs or new customers
scope: Small
---

# SEED-030: Manual confirmation flow per service (requires confirmation)

## Why This Matters

Cal.com has "Requires confirmation — The booking needs to be manually confirmed before it is pushed to your calendar and a confirmation is sent." For high-value cleaning services (post-construction cleaning, commercial cleaning), admin may want to evaluate the request before confirming: verify real availability, negotiate price, confirm site access.

Today the system creates bookings with `pending` status by default, but doesn't have a flow for "this service category requires manual approval — the customer knows they're awaiting confirmation".

**Why:** Complex or high-value services ($500+) deserve a pre-qualification process. Without manual confirmation, the customer assumes it's confirmed and the business may have capacity issues.

## When to Surface

**Trigger:** when adding high-value services (post-construction cleaning, commercial cleaning), or when admin starts rejecting bookings after creation (signal that pre-approval is needed).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Premium / enterprise services milestone
- Booking management / approval workflow milestone

## Scope Estimate

**Small** — A short phase. Schema: add `requiresConfirmation` boolean to `services` (default false). Backend: when `requiresConfirmation = true`, booking is created with `awaiting_approval` status instead of `pending`. Email/notification to customer: "Your request has been received — awaiting business confirmation." Admin notified to approve/reject. Approve/Reject buttons in bookings panel.

## Breadcrumbs

- `shared/schema.ts` — `services` table — new `requiresConfirmation` boolean column
- `shared/schema.ts` — `bookings` table — status enum can gain `awaiting_approval`
- `server/routes/bookings.ts` — `POST /api/bookings` — initial status logic based on service
- `client/src/components/admin/BookingsSection.tsx` — approval UI with Approve/Reject buttons
- `server/services/notifications.ts` — admin notification of new request awaiting approval

## Notes

"Disable cancelling" and "Disable rescheduling" are natural extensions of this seed — when `requiresConfirmation = true`, admin may also want `cancellationPolicy: 'admin_only'`. Can be additional fields in the same schema change: `cancellationPolicy` and `reschedulePolicy` per service.

**Decision (2026-05-10):** Feature is OPTIONAL per tenant. Default: `requiresConfirmation = false` for all services on creation. Tenant activates service by service, based on their business policy:
- Tenant that trusts auto-confirmation (high volume, low ticket) leaves all off
- Tenant that prefers triage (high ticket, complex schedules) activates on all
- Tenant can activate only on premium services (>$500) and leave common services auto-confirmed

Per-service configuration (rather than tenant-global) is deliberate — maximum flexibility without complicating the default.
