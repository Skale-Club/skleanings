-- Phase 21: Per-service booking limits
-- Adds buffer times, minimum notice, and time-slot interval to the services table.
-- All columns use IF NOT EXISTS so re-running is safe.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS buffer_time_before  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buffer_time_after   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_notice_hours INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_slot_interval  INTEGER DEFAULT NULL;
