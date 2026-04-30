ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS favicon_url TEXT DEFAULT '';
