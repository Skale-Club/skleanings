-- Phase 43: Add password column to users table for provisioned tenant admins
-- Nullable: OAuth-only users (Supabase auth) never have a password; only provisioned users do.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password text;
