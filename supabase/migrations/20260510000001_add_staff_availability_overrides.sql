-- Phase 22: Date overrides for staff availability (SEED-022)
-- Adds staff_availability_overrides table so staff can block specific dates
-- or set custom hours that override their weekly schedule.
-- Uses IF NOT EXISTS so re-running is safe.

CREATE TABLE IF NOT EXISTS public.staff_availability_overrides (
  id              SERIAL PRIMARY KEY,
  staff_member_id INTEGER NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  is_unavailable  BOOLEAN NOT NULL DEFAULT false,
  start_time      TEXT,           -- HH:MM, nullable — only set when is_unavailable=false
  end_time        TEXT,           -- HH:MM, nullable
  reason          TEXT,           -- optional note e.g. "Holiday", "Doctor appointment"
  CONSTRAINT staff_availability_overrides_staff_date_unique UNIQUE (staff_member_id, date)
);

-- Index for fast lookups by staff + date (used by getStaffAvailableSlots)
CREATE INDEX IF NOT EXISTS staff_availability_overrides_staff_date_idx
  ON public.staff_availability_overrides (staff_member_id, date);
