-- Phase 26: Store customer question answers alongside booking item (QUEST-04)
ALTER TABLE public.booking_items
  ADD COLUMN IF NOT EXISTS question_answers JSONB;
