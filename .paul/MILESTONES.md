# Milestones

Completed milestone log for this project.

| Milestone | Completed | Duration | Stats |
|-----------|-----------|----------|-------|
| v1.0 — Client Portal & Self-Service Booking Management | 2026-04-05 | 1 day | 3 phases, 8 plans |

---

## ✅ v1.0 — Client Portal & Self-Service Booking Management

**Completed:** 2026-04-05
**Duration:** 1 day (2026-04-05)

### Stats

| Metric | Value |
|--------|-------|
| Phases | 3 |
| Plans | 8 |
| Files changed | ~30 |

### Key Accomplishments

- Added `client` role to schema, auth middleware, route guards, and frontend role handling
- Added `bookings.userId` FK — authenticated client bookings now tracked with ownership; guest bookings unaffected
- Soft-auth autofill: booking form pre-fills contact fields from client account profile
- Full client API: GET/PATCH `/api/client/me`, GET `/api/client/bookings`, cancel and reschedule endpoints with ownership + date-window guards
- Legacy booking visibility via email-match fallback (parallel query merge, no complex OR)
- GHL + Twilio/Telegram notifications fire-and-forget on client cancel/reschedule
- ClientLogin page + AccountShell with profile and bookings tab navigation
- ProfileSection: name, phone, avatar editing via PATCH /api/client/me
- BookingsSection: booking list with status badges, eligibility-gated action buttons
- CancelBookingDialog (AlertDialog confirm flow) + RescheduleBookingDialog (date + slot picker via useAvailability)
- Full self-service cycle: login → view bookings → cancel or reschedule without admin involvement

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| `client` role added to role enum (not a separate table) | Consistent with existing role model; reuses all auth middleware patterns |
| `bookings.userId` nullable FK | Guest bookings must remain supported; ownership is opt-in |
| Legacy bookings: email-match fallback via two parallel queries + in-process merge | Avoids complex OR on nullable column; Set dedup is clean |
| Client router uses `(req as any).user` from `requireClient` | Avoids double Supabase round-trip; middleware already authenticated the user |
| GHL/notification sync is fire-and-forget | Client HTTP response must not block on external service latency |
| AlertDialog for cancel, Dialog for reschedule | AlertDialog has correct destructive/confirm semantics; Dialog suits multi-step picker |
| onError: toast only, no onClose in dialogs | User can retry without reopening — better UX for transient API errors |

---
