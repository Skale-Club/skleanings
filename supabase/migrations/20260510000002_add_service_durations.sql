-- Phase 23: Multiple durations per service (SEED-029)
-- Creates service_durations table so a single service can offer multiple duration options.

CREATE TABLE IF NOT EXISTS public.service_durations (
  id              SERIAL PRIMARY KEY,
  service_id      INTEGER NOT NULL
                    REFERENCES public.services(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price           NUMERIC(10, 2) NOT NULL,
  "order"         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS service_durations_service_id_idx
  ON public.service_durations (service_id);
