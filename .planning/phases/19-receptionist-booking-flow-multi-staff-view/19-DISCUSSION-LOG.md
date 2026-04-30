# Phase 19: Receptionist Booking Flow & Multi-Staff View — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 19-receptionist-booking-flow-multi-staff-view
**Areas discussed:** Multi-staff column view, Walk-in booking speed, Drag-to-reassign scope, Real-time & customer scope

---

## Multi-staff column view

| Option | Description | Selected |
|--------|-------------|----------|
| New 'By Staff' view button | 4th view option alongside Month/Week/Day. Switches to Day-scoped parallel columns. Existing views unchanged. | ✓ |
| Auto-switch Day view to multi-column | Day view shows resource columns when multiple staff visible. No new button. | |

**User's choice:** New 'By Staff' view button

---

| Option | Description | Selected |
|--------|-------------|----------|
| Day view only | Practical and readable. Week view with N staff = too many columns. | ✓ |
| Day and Week views | Week shows each day as a group of staff columns. Requires horizontal scrolling. | |

**User's choice:** Day view only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal scroll | Calendar container scrolls horizontally for 5+ staff. Native RBC behavior. | ✓ |
| Show/hide toggles cap columns | Eye icon toggles control visible staff. No horizontal scroll. | |

**User's choice:** Horizontal scroll

---

## Walk-in booking speed

| Option | Description | Selected |
|--------|-------------|----------|
| Add a Quick Book mode | Minimal form: name (type-ahead) + service. Email/address/notes collapsed under "More options". | ✓ |
| Phase 18 modal is sufficient | Staff + time pre-filled. 30-second target achievable with current form. | |

**User's choice:** Quick Book mode

---

| Option | Description | Selected |
|--------|-------------|----------|
| Name + service only | Minimum viable walk-in. Phone/email/address under "More options". | ✓ |
| Name + phone + service | Phone required for follow-up texts. Everything else optional. | |

**User's choice:** Name + service only

---

## Drag-to-reassign scope

| Option | Description | Selected |
|--------|-------------|----------|
| Time + staff reassignment | Drag within column = reschedule. Drag across columns = reassign staff. Both update the booking. | ✓ |
| Staff reassignment only | Cross-column drag changes staff, time stays the same. | |
| Time rescheduling only | Within-column drag changes time. No cross-column moves. | |

**User's choice:** Time + staff reassignment

---

| Option | Description | Selected |
|--------|-------------|----------|
| Instant update + undo toast | Drop fires API immediately. Toast: "Moved to Maria — Undo" with undo window. | ✓ |
| Confirm dialog before saving | Confirmation popover after drop before API call. Explicit but slower. | |

**User's choice:** Instant update + undo toast

---

## Real-time & customer scope

| Option | Description | Selected |
|--------|-------------|----------|
| Polling every 30s | React Query refetchInterval: 30_000. Simple, no new infrastructure. | ✓ |
| Polling every 10s | More responsive, slightly more DB load. | |
| Supabase Realtime (live) | WebSocket subscription. True real-time. Requires Replication setup. | |

**User's choice:** Polling every 30s

---

| Option | Description | Selected |
|--------|-------------|----------|
| Include customer-side | Customer booking page shows per-staff availability. Reuses existing hooks. | ✓ |
| Defer to Phase 20 | Phase 19 already large. BookingPage.tsx is 748 lines. | |

**User's choice:** Include customer-side staff availability

---

## Claude's Discretion

- Exact RBC withDragAndDrop HOC wiring
- Quick Book modal component structure
- Undo toast implementation detail
- Customer booking page slot display design (avatars vs name badges vs grouped list)

## Deferred Ideas

- Week view with multi-staff columns
- Supabase Realtime / WebSocket live updates
- Drag-to-resize appointment duration
- Full parallel staff column view on customer booking page
