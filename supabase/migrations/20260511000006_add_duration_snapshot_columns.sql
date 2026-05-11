-- Phase 30 DUR-04: add duration snapshot columns to booking_items
-- durationLabel: snapshot of the chosen ServiceDuration.label at booking time
-- durationMinutes: snapshot of the chosen ServiceDuration.durationMinutes at booking time
-- Both nullable — existing rows remain valid with NULL; no data migration needed.
ALTER TABLE public.booking_items
  ADD COLUMN IF NOT EXISTS duration_label    TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes  INTEGER;

-- Phase 30 DUR-06: add duration_minutes snapshot to recurring_bookings
-- NULL means "use the live catalog service.durationMinutes" (correct fallback for existing subscriptions).
ALTER TABLE public.recurring_bookings
  ADD COLUMN IF NOT EXISTS duration_minutes  INTEGER;
