-- Add reconnect tracking columns to staff_google_calendar
ALTER TABLE staff_google_calendar
  ADD COLUMN IF NOT EXISTS needs_reconnect boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_disconnected_at timestamptz;
