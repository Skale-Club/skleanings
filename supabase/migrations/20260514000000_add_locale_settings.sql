-- supabase/migrations/20260514000000_add_locale_settings.sql
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS language        text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS start_of_week   text NOT NULL DEFAULT 'sunday',
  ADD COLUMN IF NOT EXISTS date_format     text NOT NULL DEFAULT 'MM/DD/YYYY';
