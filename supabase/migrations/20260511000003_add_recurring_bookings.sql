-- Phase 27: Recurring Bookings — Schema & Cron Foundation
-- Creates the recurring_bookings table and adds the FK column to bookings.

CREATE TABLE recurring_bookings (
  id                        serial PRIMARY KEY,
  contact_id                integer REFERENCES contacts(id) ON DELETE SET NULL,
  service_id                integer NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  service_frequency_id      integer NOT NULL REFERENCES service_frequencies(id) ON DELETE RESTRICT,
  discount_percent          numeric(5,2) NOT NULL DEFAULT 0,
  interval_days             integer NOT NULL,          -- snapshot: 7 (weekly) | 14 (biweekly) | 30 (monthly)
  frequency_name            text NOT NULL,             -- snapshot of serviceFrequencies.name at creation
  start_date                date NOT NULL,             -- YYYY-MM-DD, date of first booking
  end_date                  date,                      -- nullable — open-ended subscriptions
  next_booking_date         date NOT NULL,             -- YYYY-MM-DD — cron checks this column
  preferred_start_time      text NOT NULL,             -- HH:MM
  preferred_staff_member_id integer REFERENCES staff_members(id) ON DELETE SET NULL,
  status                    text NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'paused', 'cancelled')),
  cancelled_at              timestamptz,
  paused_at                 timestamptz,
  origin_booking_id         integer REFERENCES bookings(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Cron query index: fetches active subscriptions by next generation date
CREATE INDEX idx_recurring_bookings_status_next_date
  ON recurring_bookings (status, next_booking_date);

-- Add FK column to bookings — nullable; set by cron for auto-generated bookings
ALTER TABLE bookings
  ADD COLUMN recurring_booking_id integer
  REFERENCES recurring_bookings(id) ON DELETE SET NULL;

-- Prevent duplicate auto-generation for the same subscription + booking date
CREATE UNIQUE INDEX idx_bookings_recurring_date_unique
  ON bookings (recurring_booking_id, booking_date)
  WHERE recurring_booking_id IS NOT NULL;
