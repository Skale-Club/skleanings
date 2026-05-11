-- Phase 29 RECUR-05: add manage_token UUID for customer self-serve subscription management
-- gen_random_uuid() is built-in on Postgres 15+ (all Supabase projects). No extension needed.

ALTER TABLE recurring_bookings
  ADD COLUMN IF NOT EXISTS manage_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Unique index: each subscription has a distinct token for URL-safe lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_bookings_manage_token
  ON recurring_bookings (manage_token);

-- Backfill any pre-existing rows that received NULL before the DEFAULT took effect
-- (ADD COLUMN with NOT NULL DEFAULT handles this atomically in Postgres 11+ but be explicit)
UPDATE recurring_bookings
  SET manage_token = gen_random_uuid()
  WHERE manage_token IS NULL;
