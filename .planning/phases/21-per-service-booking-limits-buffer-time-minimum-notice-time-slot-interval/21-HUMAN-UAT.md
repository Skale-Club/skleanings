---
status: partial
phase: 21-per-service-booking-limits-buffer-time-minimum-notice-time-slot-interval
source: [21-VERIFICATION.md]
started: 2026-05-11T03:00:00.000Z
updated: 2026-05-11T03:00:00.000Z
---

## Current Test

[awaiting human testing — apply migration first]

## Pre-requisite

Apply migration before testing:
```
supabase db push
# or:
psql $POSTGRES_URL_NON_POOLING -f supabase/migrations/20260510000000_add_service_booking_limits.sql
```

## Tests

### 1. Booking Rules section visible in admin service edit
expected: Admin > Services > Edit any service > "Booking Rules" toggle expands 4 inputs: Buffer Before (min), Buffer After (min), Minimum Notice (hrs), Slot Interval (min)
result: [pending]

### 2. Buffer after blocks travel time on booking calendar
expected: Set Buffer After = 30 on a service, save. Check booking calendar — a 30-min gap appears after existing bookings for that service (no slot can start within 30 min of a booking ending)
result: [pending]

### 3. Minimum notice filters near-future slots
expected: Set Minimum Notice = 24 on a service, save. Check booking calendar for today — slots within 24 hours from now are not offered
result: [pending]

### 4. Slot interval changes slot grid granularity
expected: Set Slot Interval = 60 on a service, save. Check booking calendar — time slots now appear at 60-min increments (on the hour) instead of using service duration as default
result: [pending]

### 5. Values persist on save and reload
expected: Save booking rule values, reload the service edit form — all four values are pre-populated with the saved values
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
