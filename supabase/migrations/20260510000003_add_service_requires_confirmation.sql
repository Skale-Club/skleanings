-- Phase 24: Manual confirmation flow per service (SEED-030)
-- Adds requires_confirmation boolean to services table (default false).
-- bookings.status is a text column — no SQL enum change needed.
-- All status values (pending, confirmed, cancelled, completed, awaiting_approval)
-- are validated at the application layer in Zod/TypeScript.
-- Using IF NOT EXISTS so re-running is safe.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN NOT NULL DEFAULT false;
