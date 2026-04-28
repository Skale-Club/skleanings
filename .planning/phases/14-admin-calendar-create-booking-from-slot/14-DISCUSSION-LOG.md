# Phase 14: Admin calendar create booking from slot — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `14-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 14-admin-calendar-create-booking-from-slot
**Areas discussed:** Service scope, Customer lookup, Status default + post-submit, Duration / end-time

---

## Service scope per booking

| Option | Description | Selected |
|--------|-------------|----------|
| Single service per slot | Leaner, covers 90% of attendant cases. Multi-service edits happen later in `/admin/bookings`. | ✓ |
| Multiple services per slot | Parity with customer cart flow. Larger modal, more state. | |

**User's choice:** Recommended — single service per slot.
**Notes:** User chose "do recommended" across all areas. Multi-service deferred to potential future phase if demand emerges.

---

## Customer lookup

| Option | Description | Selected |
|--------|-------------|----------|
| Type-ahead from existing contacts | Search `GET /api/contacts?search=&limit=`. Selecting a hit pre-fills name/phone/email/address. Free-text always allowed. | ✓ |
| Free-text fields only | Simpler. Backend `upsertContact` already dedups by email/phone server-side. | |

**User's choice:** Recommended — type-ahead.
**Notes:** Saves redigitation, surfaces "this is a returning customer" signal. Backend dedup remains the source of truth.

---

## Status default + post-submit behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Status `confirmed`, close modal, refresh calendar | Admin manually scheduling = high intent. No redirect, attendant keeps working in the calendar. | ✓ |
| Status `pending`, open booking detail page | Parity with customer flow. Forces a context switch to verify before confirming. | |

**User's choice:** Recommended — `confirmed` + close modal + invalidate calendar.
**Notes:** Removes a decision point from the attendant. Calendar refresh shows the booking landing in the clicked slot.

---

## Duration / end-time

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-compute with optional override | `endTime` derived from `service.durationMinutes × quantity`, displayed read-only with a "Adjust end time" toggle for edge cases. | ✓ |
| Always editable | Attendant types end time manually each time. Maximum flexibility, more keystrokes. | |
| Strictly auto-computed | No override. Smallest UI, but inflexible when the actual job runs longer. | |

**User's choice:** Recommended — auto-compute with collapsed override.
**Notes:** Default path is zero-typing; override is one extra click for the rare case.

---

## Claude's Discretion

The user explicitly delegated tactical UI choices ("faça o recomendado, tudo em inglês"):

- Form library: `react-hook-form` + `zodResolver(insertBookingSchema)`.
- Modal: reuse the existing shadcn `<Dialog>` already mounted in `AppointmentsCalendarSection.tsx`.
- Field order, helper copy, placeholder text, micro-spacing — researcher / planner can decide consistent with the rest of the admin UI.
- Skipped from the modal without asking (logged as decisions D-02, D-03 in CONTEXT.md): service options, frequency, addons, multi-step wizard.

## Deferred Ideas

Captured in `14-CONTEXT.md` `<deferred>` section:
- Multi-service in admin slot-creation
- Recurring booking creation from calendar
- Addon cross-sell in admin modal
- In-modal Stripe payment capture
- Drag-to-resize end-time on the calendar event itself
