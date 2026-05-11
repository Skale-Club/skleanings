-- Phase 28 RECUR-01: add intervalDays to service_frequencies so the booking
-- route can derive a concrete day-count from any frequency at subscription creation time.
ALTER TABLE service_frequencies
  ADD COLUMN IF NOT EXISTS interval_days INTEGER NOT NULL DEFAULT 7;

-- Backfill sensible defaults for existing rows based on name patterns.
-- Admin should review after migration and correct any mismatches.
UPDATE service_frequencies SET interval_days = 7  WHERE LOWER(name) LIKE '%week%';
UPDATE service_frequencies SET interval_days = 14 WHERE LOWER(name) LIKE '%bi%' OR LOWER(name) LIKE '%fort%';
UPDATE service_frequencies SET interval_days = 30 WHERE LOWER(name) LIKE '%month%';
