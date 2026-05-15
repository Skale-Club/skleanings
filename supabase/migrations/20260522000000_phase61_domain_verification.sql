-- Phase 61 (CD-01): Add verification columns to domains table.
-- Existing primary domains are auto-verified so they continue to resolve via
-- resolveTenantMiddleware after the verification gate ships in 61-03.

ALTER TABLE domains
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_token TEXT;

-- Backfill: existing primary domains are auto-verified (they're system-generated
-- subdomains like {slug}.xkedule.com — there is no DNS to verify).
UPDATE domains
SET verified = true,
    verified_at = created_at
WHERE is_primary = true
  AND verified = false;
