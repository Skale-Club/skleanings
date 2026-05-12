-- Phase 32: Calendar Harmony Retry Queue
-- Adds durable job queue for GHL and Google Calendar sync operations

CREATE TABLE IF NOT EXISTS calendar_sync_queue (
  id              SERIAL PRIMARY KEY,
  booking_id      INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  target          TEXT NOT NULL,    -- 'ghl_contact' | 'ghl_appointment' | 'google_calendar'
  operation       TEXT NOT NULL,    -- 'create' | 'update' | 'cancel'
  payload         JSONB,
  status          TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'in_progress' | 'success' | 'failed_retryable' | 'failed_permanent'
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  last_error      TEXT,
  scheduled_for   TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS csq_status_scheduled_idx
  ON calendar_sync_queue (status, scheduled_for);

CREATE INDEX IF NOT EXISTS csq_booking_target_idx
  ON calendar_sync_queue (booking_id, target);
