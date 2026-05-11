-- Phase 25: Multiple time slots per day (SLOTS-01, SLOTS-04)
-- Adds range_order to staff_availability so multiple non-overlapping windows
-- per (staff_member_id, day_of_week) are stored in deterministic order.
-- DEFAULT 0 means existing single-range rows remain valid without any data update.
-- No UNIQUE constraint existed on (staff_member_id, day_of_week) — nothing to drop.

ALTER TABLE public.staff_availability
  ADD COLUMN IF NOT EXISTS range_order INTEGER NOT NULL DEFAULT 0;

-- Composite index: staff + day + order for ordered range lookups
CREATE INDEX IF NOT EXISTS staff_availability_staff_day_order_idx
  ON public.staff_availability (staff_member_id, day_of_week, range_order);
