-- Phase 65: Booking payment breakdown columns (PF-05)
-- Adds platform_fee_amount + tenant_net_amount INTEGER columns to bookings.
-- Populated by checkout.session.completed webhook from
-- payment_intent.application_fee_amount and (amount_total - application_fee_amount).
-- Both columns are nullable: existing bookings + legacy-flow bookings remain NULL.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS platform_fee_amount integer,
  ADD COLUMN IF NOT EXISTS tenant_net_amount   integer;
