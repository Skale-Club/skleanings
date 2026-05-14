-- Phase 55: Email Verification Tokens
-- Mirrors password_reset_tokens pattern (Phase 47).
-- Raw token never stored — only the SHA-256 hash is persisted.
-- No tenant_id: user_id FK is sufficient scope; tokens are per-user not per-tenant.

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evtoken_token_hash ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_evtoken_user_id ON email_verification_tokens(user_id);

-- Add email_verified_at to users — NULL means unverified
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
