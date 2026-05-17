-- Remove system_heartbeats table (legacy Vercel Cron keep-alive artifact)
-- Table was defined in Drizzle schema but never migrated via Supabase CLI.
-- Using IF EXISTS to handle the case where it does not exist in the live DB.
DROP TABLE IF EXISTS public.system_heartbeats;
