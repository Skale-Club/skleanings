# Requirements: v4.0 Booking Intelligence

## v4.0 Requirements

### Availability — Multiple Slots Per Day (SEED-021)

- [x] **SLOTS-01**: Staff availability supports multiple time ranges per day (e.g., 8am-12pm AND 2pm-7pm on Monday)
- [x] **SLOTS-02**: Admin can add, remove, and reorder time ranges per day in the availability editor
- [x] **SLOTS-03**: Booking slot generation respects all configured ranges — no slots offered during gaps between ranges
- [x] **SLOTS-04**: Migration preserves existing single-range availability data without data loss or behavioral change

### Booking Questions — Custom Intake Per Service (SEED-027)

- [x] **QUEST-01**: Admin can add custom intake questions to a service (text, textarea, select types) with required/optional flag
- [x] **QUEST-02**: Admin can set display order and delete questions; changes apply to future bookings only
- [x] **QUEST-03**: Customer sees service-specific questions in the Customer Details step of the booking flow
- [x] **QUEST-04**: Customer answers are stored with the booking record and visible to admin in booking details

### Recurring Bookings — Cleaning Subscriptions (SEED-031)

- [ ] **RECUR-01**: Customer can select a recurring frequency (weekly, biweekly, monthly) with discount preview when booking
- [x] **RECUR-02**: System automatically generates the next booking 7 days before the scheduled date (one-ahead generation)
- [x] **RECUR-03**: Customer receives an automatic 48h reminder notification before each recurring cleaning
- [x] **RECUR-04**: Admin can view all recurring subscriptions, see next booking date, pause, and cancel
- [x] **RECUR-05**: Customer can pause (temporary) and cancel (permanent) their recurring subscription from a self-serve page

## Future Requirements (deferred)

- Multiple range reordering via drag-and-drop (SLOTS-02 starts with up/down buttons)
- Question types: number, checkbox, date picker (QUEST-01 ships with text, textarea, select only)
- Recurring booking rescheduling per-occurrence (edit one without affecting the series)
- Customer-side subscription management portal with full history
- Discount codes tied to recurring subscriptions
- Multi-staff recurring bookings (preferred staff + fallback)

## Out of Scope (v4.0)

- Google Calendar sync for recurring events — sync is already per-booking; recurring will reuse the same mechanism
- SMS reminders — email reminders only for v4.0
- Customer login/account for managing subscriptions — self-serve cancel/pause via email link token
- Stripe subscription billing — payment is still per-booking (charge on generation); SaaS billing is SEED-032

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SLOTS-01 | Phase 25 | Not started |
| SLOTS-02 | Phase 25 | Not started |
| SLOTS-03 | Phase 25 | Not started |
| SLOTS-04 | Phase 25 | Not started |
| QUEST-01 | Phase 26 | Not started |
| QUEST-02 | Phase 26 | Not started |
| QUEST-03 | Phase 26 | Not started |
| QUEST-04 | Phase 26 | Not started |
| RECUR-01 | Phase 27 + Phase 28 | Not started |
| RECUR-02 | Phase 27 | Not started |
| RECUR-03 | Phase 28 | Not started |
| RECUR-04 | Phase 29 | Not started |
| RECUR-05 | Phase 29 | Not started |
