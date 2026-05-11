-- Phase 26: Custom booking questions per service (QUEST-01, QUEST-02)
CREATE TABLE IF NOT EXISTS public.service_booking_questions (
  id          SERIAL PRIMARY KEY,
  service_id  INTEGER NOT NULL
                REFERENCES public.services(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'text',  -- 'text' | 'textarea' | 'select'
  options     JSONB,          -- only for type='select'; array of strings e.g. ["Cat","Dog","None"]
  required    BOOLEAN NOT NULL DEFAULT false,
  "order"     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS service_booking_questions_service_id_idx
  ON public.service_booking_questions (service_id);
