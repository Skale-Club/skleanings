-- Add industry to company_settings
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "industry" text DEFAULT 'cleaning';
