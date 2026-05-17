-- Phase 47: Password Reset Tokens
-- Stores time-limited single-use tokens for the forgot-password flow.
-- Raw token is never stored — only the SHA-256 hash is persisted.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          serial PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
  ON password_reset_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
  ON password_reset_tokens(user_id);
